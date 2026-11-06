import {
  DiagnosticWeights,
  DrillSuggestion,
  ImportedScoreReport,
  QuestionAttempt,
  SATDomainId,
  SATSection,
  TestSession,
} from '../types';
import { SAT_DOMAINS } from '../data/satQuestionBank';

export interface DomainDiagnosticStat {
  domainId: SATDomainId;
  domainName: string;
  section: SATSection;
  validAttempts: number;
  excludedAiCount: number;
  excludedRepeatCount: number;
  rawAccuracyPct: number;
  weightedMasteryPct: number;
  irtAbilityTheta: number; // -2.5 to +2.5
  estimatedDomainScore: number; // 200 to 800 scale equivalent
  standardDeviation: number;
  statusLabel: 'NOMINAL / MASTERED' | 'DEVELOPING' | 'PRIORITY FOCUS';
}

export interface ProgressionPoint {
  id: string;
  date: string;
  label: string;
  sourceType: 'mock' | 'drill' | 'practice' | 'imported';
  totalScore: number;
  rwScore: number;
  mathScore: number;
  included: boolean;
}

export interface ComprehensiveDiagnosticReport {
  predictedTotalScore: number;
  predictedRwScore: number;
  predictedMathScore: number;
  confidenceInterval95: [number, number];
  standardDeviation: number;
  effectiveSampleSize: number;
  totalValidAttempts: number;
  totalExcludedAiAttempts: number;
  totalExcludedRepeatAttempts: number;
  learningVelocityPtsPerWeek: number;
  domainStats: Record<SATDomainId, DomainDiagnosticStat>;
  progressionCurve: ProgressionPoint[];
  weakestSkills: { skill: string; domainId: SATDomainId; accuracyPct: number; attempts: number }[];
  drillSuggestions: DrillSuggestion[];
}

export const DEFAULT_DIAGNOSTIC_WEIGHTS: DiagnosticWeights = {
  mockExamWeight: 1.0,
  drillWeight: 0.45,
  practiceWeight: 0.25,
  importedScoreWeight: 0.85,
  recencyHalfLifeDays: 21,
  priorAnchorStrength: 0.35,
};

export function computeComprehensiveDiagnostics(
  sessions: TestSession[],
  importedReports: ImportedScoreReport[],
  weights: DiagnosticWeights,
  referenceNowMs: number = Date.now()
): ComprehensiveDiagnosticReport {
  const activeSessions = sessions.filter((s) => s.includedInDiagnostics);
  const activeImports = importedReports.filter((r) => r.includedInDiagnostics);

  // Track seen questions chronologically to enforce the rule:
  // "When, only during practice or drills, AI is used on a question before it is submitted,
  // it should be flagged in history and not count. If it has already been taken in another format,
  // it should also be flagged as such and not count."
  const seenQuestionIds = new Set<string>();
  const chronologicalSessions = [...activeSessions].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  interface WeightedAttemptRecord {
    attempt: QuestionAttempt;
    sessionMode: TestSession['mode'];
    weight: number;
    isExcludedAi: boolean;
    isExcludedRepeat: boolean;
    isValidForDiagnostics: boolean;
  }

  const evaluatedAttempts: WeightedAttemptRecord[] = [];
  let totalExcludedAiAttempts = 0;
  let totalExcludedRepeatAttempts = 0;

  for (const session of chronologicalSessions) {
    if (session.mode === 'id_search') continue;

    for (const att of session.attempts) {
      const isAlreadySeen = seenQuestionIds.has(att.questionId) || att.isRepeatAttempt;
      seenQuestionIds.add(att.questionId);

      const isAiFlagged =
        (session.mode === 'practice' || session.mode === 'drill') &&
        att.usedAiBeforeSubmit;

      if (isAiFlagged) totalExcludedAiAttempts++;
      if (isAlreadySeen && !isAiFlagged) totalExcludedRepeatAttempts++;

      const isValid = !isAiFlagged && !isAlreadySeen && att.countsTowardDiagnostics;

      // Calculate mode weight * exponential recency decay
      const modeBaseWeight =
        session.mode === 'mock'
          ? weights.mockExamWeight
          : session.mode === 'drill'
          ? weights.drillWeight
          : weights.practiceWeight;

      const ageDays = Math.max(
        0,
        (referenceNowMs - new Date(att.timestamp).getTime()) / (1000 * 60 * 60 * 24)
      );
      const halfLife = Math.max(3, weights.recencyHalfLifeDays || 21);
      const decayFactor = Math.pow(0.5, ageDays / halfLife);

      evaluatedAttempts.push({
        attempt: att,
        sessionMode: session.mode,
        weight: isValid ? modeBaseWeight * decayFactor : 0,
        isExcludedAi: isAiFlagged,
        isExcludedRepeat: isAlreadySeen,
        isValidForDiagnostics: isValid,
      });
    }
  }

  // Compute prior anchor from active Imported SAT/PSAT Score Reports
  let priorRw = 620;
  let priorMath = 620;
  let hasOfficialPrior = false;

  if (activeImports.length > 0) {
    hasOfficialPrior = true;
    let wSum = 0;
    let rwSum = 0;
    let mathSum = 0;
    for (const rep of activeImports) {
      const ageDays = Math.max(
        0,
        (referenceNowMs - new Date(rep.testDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      const w = weights.importedScoreWeight * Math.pow(0.5, ageDays / 90);
      wSum += w;
      rwSum += rep.rwScore * w;
      mathSum += rep.mathScore * w;
    }
    if (wSum > 0) {
      priorRw = rwSum / wSum;
      priorMath = mathSum / wSum;
    }
  }

  // Domain-level Bayesian IRT calculation
  const domainStats = {} as Record<SATDomainId, DomainDiagnosticStat>;
  let totalValidAttempts = 0;
  let effectiveSampleSize = 0;

  for (const domMeta of SAT_DOMAINS) {
    const domId = domMeta.id;
    const domRecords = evaluatedAttempts.filter((r) => r.attempt.domain === domId);
    const validRecords = domRecords.filter((r) => r.isValidForDiagnostics);
    const excludedAiCount = domRecords.filter((r) => r.isExcludedAi).length;
    const excludedRepeatCount = domRecords.filter((r) => r.isExcludedRepeat).length;

    totalValidAttempts += validRecords.length;

    // Prior mastery from imported score reports if available
    let priorMasteryPct =
      domMeta.section === 'reading_writing'
        ? ((priorRw - 200) / 600) * 100
        : ((priorMath - 200) / 600) * 100;

    if (activeImports.length > 0) {
      const latestImport = activeImports[0];
      const band = latestImport.domainBands?.[domId];
      if (band && typeof band.estimatedMasteryPct === 'number') {
        priorMasteryPct = band.estimatedMasteryPct;
      }
    }

    let weightedCorrect = 0;
    let weightTotal = 0;
    let correctCount = 0;

    for (const rec of validRecords) {
      if (rec.attempt.isCorrect) correctCount++;
      // IRT difficulty bonus: answering a Hard (+1.5) question correctly carries higher ability signal
      // than an Easy (-0.8) question; missing an Easy question penalizes more than missing a Hard one.
      const diffMultiplier = rec.attempt.isCorrect
        ? 1 + Math.max(0, rec.attempt.irtDifficulty) * 0.22
        : 1 + Math.max(0, -rec.attempt.irtDifficulty) * 0.22;

      const itemWeight = rec.weight * diffMultiplier;
      weightTotal += itemWeight;
      if (rec.attempt.isCorrect) {
        weightedCorrect += itemWeight;
      }
    }

    effectiveSampleSize += weightTotal;

    const rawAccuracyPct =
      validRecords.length > 0
        ? Math.round((correctCount / validRecords.length) * 100)
        : Math.round(priorMasteryPct);

    const priorStrength = hasOfficialPrior
      ? Math.max(0.1, weights.priorAnchorStrength * 3)
      : Math.max(0.25, weights.priorAnchorStrength * 1.5);

    const bayesianMasteryPct = Math.max(
      10,
      Math.min(
        99,
        ((priorMasteryPct * priorStrength + (weightedCorrect / Math.max(0.001, weightTotal)) * 100 * weightTotal) /
          (priorStrength + weightTotal))
      )
    );

    const theta = ((bayesianMasteryPct - 50) / 50) * 2.2;
    const estimatedDomainScore =
      Math.round(
        Math.max(200, Math.min(800, 200 + (bayesianMasteryPct / 100) * 600)) / 10
      ) * 10;

    const domainSD = Math.round(
      Math.max(15, 65 / Math.sqrt(1 + validRecords.length * 0.45 + (hasOfficialPrior ? 1.5 : 0)))
    );

    const statusLabel: DomainDiagnosticStat['statusLabel'] =
      bayesianMasteryPct >= 78
        ? 'NOMINAL / MASTERED'
        : bayesianMasteryPct >= 60
        ? 'DEVELOPING'
        : 'PRIORITY FOCUS';

    domainStats[domId] = {
      domainId: domId,
      domainName: domMeta.name,
      section: domMeta.section,
      validAttempts: validRecords.length,
      excludedAiCount,
      excludedRepeatCount,
      rawAccuracyPct,
      weightedMasteryPct: Math.round(bayesianMasteryPct),
      irtAbilityTheta: Number(theta.toFixed(2)),
      estimatedDomainScore,
      standardDeviation: domainSD,
      statusLabel,
    };
  }

  // Combine domain scores into section scores using official SAT domain weights
  const rwWeighted =
    domainStats.INI.estimatedDomainScore * 0.26 +
    domainStats.CAS.estimatedDomainScore * 0.28 +
    domainStats.EOI.estimatedDomainScore * 0.20 +
    domainStats.SEC.estimatedDomainScore * 0.26;

  const mathWeighted =
    domainStats.ALG.estimatedDomainScore * 0.35 +
    domainStats.ADV.estimatedDomainScore * 0.35 +
    domainStats.PSD.estimatedDomainScore * 0.15 +
    domainStats.GEO.estimatedDomainScore * 0.15;

  const predictedRwScore = Math.round(Math.max(200, Math.min(800, rwWeighted)) / 10) * 10;
  const predictedMathScore = Math.round(Math.max(200, Math.min(800, mathWeighted)) / 10) * 10;
  const predictedTotalScore = predictedRwScore + predictedMathScore;

  const overallSD = Math.round(
    Math.max(
      20,
      90 / Math.sqrt(1 + effectiveSampleSize * 0.35 + (hasOfficialPrior ? 2.0 : 0))
    )
  );

  const ciLow = Math.max(400, Math.round((predictedTotalScore - 1.96 * overallSD) / 10) * 10);
  const ciHigh = Math.min(1600, Math.round((predictedTotalScore + 1.96 * overallSD) / 10) * 10);

  // Build progression curve across all sessions and imported reports (including deselected ones so UI can toggle them)
  const progressionCurve: ProgressionPoint[] = [];

  for (const rep of importedReports) {
    progressionCurve.push({
      id: rep.id,
      date: rep.testDate,
      label: `${rep.testType}: ${rep.label}`,
      sourceType: 'imported',
      totalScore: rep.totalScore,
      rwScore: rep.rwScore,
      mathScore: rep.mathScore,
      included: rep.includedInDiagnostics,
    });
  }

  for (const sess of sessions) {
    if (sess.mode === 'id_search') continue;
    const validSessionAttempts = sess.attempts.filter(
      (a) => !a.usedAiBeforeSubmit && !a.isRepeatAttempt
    );
    const acc =
      validSessionAttempts.length > 0
        ? validSessionAttempts.filter((a) => a.isCorrect).length /
          validSessionAttempts.length
        : 0.65;

    const rwEst =
      sess.scaledScore?.rw ||
      Math.round((300 + acc * 480) / 10) * 10;
    const mathEst =
      sess.scaledScore?.math ||
      Math.round((300 + acc * 480) / 10) * 10;

    progressionCurve.push({
      id: sess.id,
      date: sess.completedAt || sess.startedAt,
      label: sess.title,
      sourceType: sess.mode,
      totalScore: sess.scaledScore?.total || rwEst + mathEst,
      rwScore: rwEst,
      mathScore: mathEst,
      included: sess.includedInDiagnostics,
    });
  }

  progressionCurve.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Compute learning velocity (points per week across included points)
  const includedPoints = progressionCurve.filter((p) => p.included);
  let learningVelocityPtsPerWeek = 0;
  if (includedPoints.length >= 2) {
    const first = includedPoints[0];
    const last = includedPoints[includedPoints.length - 1];
    const weeks = Math.max(
      1,
      (new Date(last.date).getTime() - new Date(first.date).getTime()) /
        (1000 * 60 * 60 * 24 * 7)
    );
    learningVelocityPtsPerWeek = Math.round((last.totalScore - first.totalScore) / weeks);
  }

  // Identify weakest subtopics/skills and build actionable Drill Suggestions
  const skillMap = new Map<
    string,
    { domainId: SATDomainId; correct: number; total: number }
  >();
  for (const rec of evaluatedAttempts) {
    if (!rec.isValidForDiagnostics) continue;
    const key = rec.attempt.skill;
    const prev = skillMap.get(key) || {
      domainId: rec.attempt.domain,
      correct: 0,
      total: 0,
    };
    prev.total += 1;
    if (rec.attempt.isCorrect) prev.correct += 1;
    skillMap.set(key, prev);
  }

  const weakestSkills = Array.from(skillMap.entries())
    .map(([skill, data]) => ({
      skill,
      domainId: data.domainId,
      accuracyPct: Math.round((data.correct / data.total) * 100),
      attempts: data.total,
    }))
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, 5);

  const sortedDomainsByWeakness = Object.values(domainStats).sort(
    (a, b) => a.weightedMasteryPct - b.weightedMasteryPct
  );

  const drillSuggestions: DrillSuggestion[] = sortedDomainsByWeakness
    .slice(0, 3)
    .map((dom, idx) => {
      const domMeta = SAT_DOMAINS.find((d) => d.id === dom.domainId)!;
      const matchingWeakSkill = weakestSkills.find(
        (w) => w.domainId === dom.domainId
      );
      const targetSkills = matchingWeakSkill
        ? [matchingWeakSkill.skill]
        : domMeta.skills.slice(0, 2);

      return {
        id: `diag-sug-${dom.domainId.toLowerCase()}-${idx}`,
        title: `${dom.domainName}: ${targetSkills[0]} Precision Drill`,
        rationale: `Current weighted mastery in ${dom.domainName} is ${dom.weightedMasteryPct}% (±${dom.standardDeviation} pts SD). A targeted ${idx === 0 ? 10 : 8}-question drill on ${targetSkills.join(' & ')} offers the highest marginal score gain.`,
        source: 'diagnostics',
        mode: idx === 2 ? 'practice' : 'drill',
        domains: [dom.domainId],
        skills: targetSkills,
        difficulties: dom.weightedMasteryPct < 60 ? ['M', 'H'] : ['H'],
        suggestedLength: idx === 0 ? 10 : 8,
        estimatedGainPts: idx === 0 ? 30 : 20,
      };
    });

  return {
    predictedTotalScore,
    predictedRwScore,
    predictedMathScore,
    confidenceInterval95: [ciLow, ciHigh],
    standardDeviation: overallSD,
    effectiveSampleSize: Number(effectiveSampleSize.toFixed(1)),
    totalValidAttempts,
    totalExcludedAiAttempts,
    totalExcludedRepeatAttempts,
    learningVelocityPtsPerWeek,
    domainStats,
    progressionCurve,
    weakestSkills,
    drillSuggestions,
  };
}

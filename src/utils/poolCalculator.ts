import {
  SATDomainId,
  SATQuestion,
  TestStartConfig,
} from '../types';

export interface DomainPoolShortfall {
  domainId: SATDomainId;
  requiredCount: number;
  unseenAvailableCount: number;
  totalAvailableCount: number;
  shortfall: number;
}

export interface PoolCalculationResult {
  candidateUnseen: SATQuestion[];
  candidateAll: SATQuestion[];
  requiredTotal: number;
  isUnseenSufficientForRepresentativeSession: boolean;
  domainShortfalls: DomainPoolShortfall[];
  selectedQuestions: SATQuestion[];
  usedFallbackToAnswered: boolean;
  exhaustionMessage?: string;
}

// Official SAT domain weights for representative Mock Exams and multi-domain Drills
export const OFFICIAL_DOMAIN_PROPORTIONS: Record<SATDomainId, number> = {
  INI: 0.26,
  CAS: 0.28,
  EOI: 0.20,
  SEC: 0.26,
  ALG: 0.35,
  ADV: 0.35,
  PSD: 0.15,
  GEO: 0.15,
};

export function calculateAndSelectQuestionPool(
  allQuestions: SATQuestion[],
  answeredQuestionIds: Set<string>,
  config: TestStartConfig
): PoolCalculationResult {
  // Handle Mode 4: Search by Question ID
  if (config.mode === 'id_search') {
    const query = (config.searchQuestionId || '').trim().toLowerCase();
    const matched = allQuestions.filter(
      (q) =>
        q.id.toLowerCase() === query ||
        q.externalId.toLowerCase() === query ||
        q.id.toLowerCase().includes(query)
    );
    const chosen = matched.length > 0 ? [matched[0]] : allQuestions.slice(0, 1);
    return {
      candidateUnseen: chosen,
      candidateAll: chosen,
      requiredTotal: 1,
      isUnseenSufficientForRepresentativeSession: true,
      domainShortfalls: [],
      selectedQuestions: chosen,
      usedFallbackToAnswered: false,
    };
  }

  // Filter by section, domains, skills, difficulties, and active practice test exclusion
  const activeDomains =
    config.mode === 'mock'
      ? config.mockSections === 'reading_writing'
        ? (['INI', 'CAS', 'EOI', 'SEC'] as SATDomainId[])
        : config.mockSections === 'math'
        ? (['ALG', 'ADV', 'PSD', 'GEO'] as SATDomainId[])
        : (['INI', 'CAS', 'EOI', 'SEC', 'ALG', 'ADV', 'PSD', 'GEO'] as SATDomainId[])
      : config.selectedDomains.length > 0
      ? config.selectedDomains
      : (['INI', 'CAS', 'EOI', 'SEC', 'ALG', 'ADV', 'PSD', 'GEO'] as SATDomainId[]);

  const filteredAll = allQuestions.filter((q) => {
    if (!activeDomains.includes(q.domain)) return false;
    if (
      config.mode !== 'mock' &&
      config.selectedSkills.length > 0 &&
      !config.selectedSkills.includes(q.skill)
    ) {
      return false;
    }
    if (
      config.mode !== 'mock' &&
      config.difficulties.length > 0 &&
      !config.difficulties.includes(q.difficulty)
    ) {
      return false;
    }
    if (config.excludeActivePracticeTests && q.isActivePracticeTest) {
      return false;
    }
    return true;
  });

  const filteredUnseen = filteredAll.filter((q) => !answeredQuestionIds.has(q.id));

  // Determine target question count
  // Official Digital SAT Mock Structure:
  // - Reading and Writing: Two 27-question modules = 54 questions
  // - Math: Two 22-question modules = 44 questions
  // - Full Digital SAT ('both'): 4 modules = 98 questions
  const requiredTotal =
    config.mode === 'mock'
      ? config.mockSections === 'both'
        ? 98
        : config.mockSections === 'reading_writing'
        ? 54
        : 44
      : config.mode === 'drill'
      ? Math.max(1, config.drillLength || 10)
      : Math.max(1, filteredAll.length);

  // Calculate domain-level representativeness for Mock Exams and Drills
  const domainShortfalls: DomainPoolShortfall[] = [];
  let totalWeight = activeDomains.reduce(
    (acc, d) => acc + (OFFICIAL_DOMAIN_PROPORTIONS[d] || 0.25),
    0
  );
  if (totalWeight <= 0) totalWeight = 1;

  for (const domainId of activeDomains) {
    const domainAll = filteredAll.filter((q) => q.domain === domainId);
    const domainUnseen = filteredUnseen.filter((q) => q.domain === domainId);
    const share = (OFFICIAL_DOMAIN_PROPORTIONS[domainId] || 0.25) / totalWeight;
    const requiredForDomain =
      config.mode === 'practice'
        ? domainUnseen.length
        : config.mode === 'mock' && config.mockSections === 'both'
        ? Math.max(
            1,
            Math.round(
              (['INI', 'CAS', 'EOI', 'SEC'].includes(domainId) ? 54 : 44) *
                (OFFICIAL_DOMAIN_PROPORTIONS[domainId] || 0.25)
            )
          )
        : Math.max(1, Math.round(requiredTotal * share));

    const shortfall = Math.max(0, requiredForDomain - domainUnseen.length);
    if (shortfall > 0) {
      domainShortfalls.push({
        domainId,
        requiredCount: requiredForDomain,
        unseenAvailableCount: domainUnseen.length,
        totalAvailableCount: domainAll.length,
        shortfall,
      });
    }
  }

  const isUnseenSufficient =
    filteredUnseen.length >= requiredTotal && domainShortfalls.length === 0;

  // Selection logic per mode
  let selectedQuestions: SATQuestion[] = [];
  let usedFallbackToAnswered = false;

  if (config.mode === 'practice') {
    const basePool =
      config.practiceCompletedBehavior === 'remove_completed_before_session'
        ? filteredUnseen
        : filteredAll;
    selectedQuestions = basePool.length > 0 ? basePool : filteredAll;
    if (
      config.startAtQuestionNumber &&
      config.startAtQuestionNumber > 1 &&
      config.startAtQuestionNumber <= selectedQuestions.length
    ) {
      const startIdx = config.startAtQuestionNumber - 1;
      selectedQuestions = [
        ...selectedQuestions.slice(startIdx),
        ...selectedQuestions.slice(0, startIdx),
      ];
    }
  } else {
    // Mock Exam or Drill Mode:
    // Exclude previously answered questions unless unseen pool cannot form a representative test
    // and user (or fallback setting) permits recycling answered questions.
    const wantUnseenOnly =
      config.mode === 'mock' || config.questionPoolFilter === 'unanswered_only';

    const selectFromCandidatePool = (pool: SATQuestion[]) => {
      if (config.mode === 'mock' && config.mockSections === 'both') {
        const rwPool = pool.filter((q) => q.section === 'reading_writing');
        const mathPool = pool.filter((q) => q.section === 'math');
        const rwPicked = pickBalancedQuestions(
          rwPool,
          ['INI', 'CAS', 'EOI', 'SEC'],
          Math.min(54, rwPool.length),
          true
        );
        const mathPicked = pickBalancedQuestions(
          mathPool,
          ['ALG', 'ADV', 'PSD', 'GEO'],
          Math.min(44, mathPool.length),
          true
        );
        return [...rwPicked, ...mathPicked];
      }
      return pickBalancedQuestions(
        pool,
        activeDomains,
        Math.min(requiredTotal, pool.length),
        config.mode === 'mock'
      );
    };

    if (wantUnseenOnly && isUnseenSufficient) {
      selectedQuestions = selectFromCandidatePool(filteredUnseen);
    } else if (wantUnseenOnly && !isUnseenSufficient) {
      if (config.allowPoolExhaustionFallback) {
        usedFallbackToAnswered = true;
        // Prioritize all unseen first, then top up from previously answered to reach representative balance
        const unseenIds = new Set(filteredUnseen.map((q) => q.id));
        const seenPool = filteredAll.filter((q) => !unseenIds.has(q.id));
        const combined = [...filteredUnseen, ...seenPool];
        selectedQuestions = selectFromCandidatePool(combined);
      } else {
        selectedQuestions = selectFromCandidatePool(filteredUnseen);
      }
    } else {
      // 'any_questions' in drill mode
      selectedQuestions = selectFromCandidatePool(filteredAll);
    }
  }

  let exhaustionMessage: string | undefined;
  if (!isUnseenSufficient && (config.mode === 'mock' || config.mode === 'drill')) {
    const deficitDomains = domainShortfalls
      .map((s) => `${s.domainId} (need ${s.requiredCount}, ${s.unseenAvailableCount} unseen)`)
      .join(', ');
    exhaustionMessage = `Unseen question pool has ${filteredUnseen.length} items for a ${requiredTotal}-question representative ${config.mode} (${deficitDomains || 'insufficient unseen count'}). You have final decision below to either include previously answered questions or run with unseen items only.`;
  }

  return {
    candidateUnseen: filteredUnseen,
    candidateAll: filteredAll,
    requiredTotal,
    isUnseenSufficientForRepresentativeSession: isUnseenSufficient,
    domainShortfalls,
    selectedQuestions,
    usedFallbackToAnswered,
    exhaustionMessage,
  };
}

function pickBalancedQuestions(
  pool: SATQuestion[],
  domains: SATDomainId[],
  targetCount: number,
  splitIntoTwoModules = false
): SATQuestion[] {
  if (pool.length <= targetCount) return [...pool];
  const picked: SATQuestion[] = [];
  const usedIds = new Set<string>();

  // Round-robin across requested domains to maintain representative topic distribution
  let pass = 0;
  const maxPasses = Math.max(200, targetCount * 4);
  while (picked.length < targetCount && pass < maxPasses) {
    const domainId = domains[pass % domains.length];
    const candidate = pool.find(
      (q) => q.domain === domainId && !usedIds.has(q.id)
    );
    if (candidate) {
      picked.push(candidate);
      usedIds.add(candidate.id);
    } else {
      const anyRemaining = pool.find((q) => !usedIds.has(q.id));
      if (!anyRemaining) break;
      picked.push(anyRemaining);
      usedIds.add(anyRemaining.id);
    }
    pass++;
  }

  if (splitIntoTwoModules && picked.length >= 4) {
    const half = Math.ceil(picked.length / 2);
    const mod1 = picked
      .slice(0, half)
      .sort((a, b) => a.irtDifficulty - b.irtDifficulty);
    const mod2 = picked
      .slice(half)
      .sort((a, b) => a.irtDifficulty - b.irtDifficulty);
    return [...mod1, ...mod2];
  }

  // Sort Reading & Writing before Math
  return picked.sort((a, b) => {
    if (a.section === b.section) return a.irtDifficulty - b.irtDifficulty;
    return a.section === 'reading_writing' ? -1 : 1;
  });
}

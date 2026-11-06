import React, { useEffect, useMemo, useState } from 'react';
import {
  DiagnosticWeights,
  DrillSuggestion,
  ImportedScoreReport,
  SATQuestion,
  TestSession,
} from '../types';
import {
  ComprehensiveDiagnosticReport,
  DEFAULT_DIAGNOSTIC_WEIGHTS,
} from '../utils/diagnosticEngine';
import { formatMathHtml } from '../utils/formatMathHtml';
import { AmbientBackgroundAnimation, AsterOrbLogo } from './AsterOrbLogo';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Sliders,
  Bookmark,
  History,
  Sparkles,
  ExternalLink,
  X,
  RotateCcw,
  Activity,
  Award,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface DiagnosticsScreenProps {
  diagnosticReport: ComprehensiveDiagnosticReport;
  sessions: TestSession[];
  importedReports: ImportedScoreReport[];
  weights: DiagnosticWeights;
  onUpdateWeights: (newWeights: DiagnosticWeights) => void;
  onToggleSessionInclusion: (sessionId: string) => void;
  onToggleReportInclusion: (reportId: string) => void;
  starredQuestionIds: Set<string>;
  onToggleStarQuestion: (questionId: string) => void;
  allQuestions: SATQuestion[];
  onOpenQuestionInTestingScreen: (question: SATQuestion) => void;
  onSelectDrillSuggestion: (suggestion: DrillSuggestion) => void;
  intendedTotalScore: number;
}

export const DiagnosticsScreen: React.FC<DiagnosticsScreenProps> = ({
  diagnosticReport,
  sessions,
  importedReports,
  weights,
  onUpdateWeights,
  onToggleSessionInclusion,
  onToggleReportInclusion,
  starredQuestionIds,
  onToggleStarQuestion,
  allQuestions,
  onOpenQuestionInTestingScreen,
  onSelectDrillSuggestion,
  intendedTotalScore,
}) => {
  const [activeSubView, setActiveSubView] = useState<'general' | 'last_test' | 'history' | 'starred'>('general');
  const [showWeightsEditor, setShowWeightsEditor] = useState(false);
  const [showSectionLines, setShowSectionLines] = useState(false);
  const [includeExcludedInChart, setIncludeExcludedInChart] = useState(false);
  const [selectedStarredModalQuestion, setSelectedStarredModalQuestion] =
    useState<SATQuestion | null>(null);

  const scoreGap = Math.max(0, intendedTotalScore - diagnosticReport.predictedTotalScore);

  const defaultFocusParagraph = useMemo(() => {
    const topWeak = diagnosticReport.weakestSkills
      .slice(0, 2)
      .map((w) => `${w.skill} (${w.domainId})`)
      .join(' and ');
    const focusTopics =
      topWeak || 'Circles in Geometry and Transitions in Reading & Writing';
    return `You're currently tracking around ${diagnosticReport.predictedTotalScore} (${diagnosticReport.predictedRwScore} Reading & Writing, ${diagnosticReport.predictedMathScore} Math), which puts you ${
      scoreGap > 0
        ? `${scoreGap} points away from your ${intendedTotalScore} goal`
        : `right on track for your ${intendedTotalScore} target`
    }. Your biggest opportunity for quick points right now is in ${focusTopics}, where medium and hard questions have slowed you down most recently. Spend your next couple of 10-question drills tightening up those two areas before taking your next full timed section.`;
  }, [
    diagnosticReport.predictedTotalScore,
    diagnosticReport.predictedRwScore,
    diagnosticReport.predictedMathScore,
    diagnosticReport.weakestSkills,
    scoreGap,
    intendedTotalScore,
  ]);

  const [aiFocusSummary, setAiFocusSummary] = useState<string>(defaultFocusParagraph);
  const [refreshingSummary, setRefreshingSummary] = useState(false);

  const fetchFocusSummary = async () => {
    setRefreshingSummary(true);
    try {
      const res = await fetch('/api/ai/diagnostic-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predictedTotalScore: diagnosticReport.predictedTotalScore,
          predictedRwScore: diagnosticReport.predictedRwScore,
          predictedMathScore: diagnosticReport.predictedMathScore,
          intendedTotalScore,
          weakestSkills: diagnosticReport.weakestSkills.slice(0, 3),
        }),
      });
      const data = await res.json();
      if (data?.summary && typeof data.summary === 'string') {
        setAiFocusSummary(data.summary.trim());
      }
    } catch {
      setAiFocusSummary(defaultFocusParagraph);
    } finally {
      setRefreshingSummary(false);
    }
  };

  useEffect(() => {
    setAiFocusSummary(defaultFocusParagraph);
    fetchFocusSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    diagnosticReport.predictedTotalScore,
    diagnosticReport.predictedRwScore,
    diagnosticReport.predictedMathScore,
    intendedTotalScore,
  ]);

  const lastCompletedSession = sessions.find((s) => s.mode !== 'id_search') || sessions[0];
  const starredQuestionsList = allQuestions.filter((q) =>
    starredQuestionIds.has(q.id)
  );

  // Build chronological Progress Chart dataset from past TestSession objects
  const sessionProgressData = useMemo(() => {
    const validSessions = sessions
      .filter(
        (s) =>
          s.mode !== 'id_search' &&
          (includeExcludedInChart || s.includedInDiagnostics)
      )
      .slice()
      .sort(
        (a, b) =>
          new Date(a.completedAt || a.startedAt).getTime() -
          new Date(b.completedAt || b.startedAt).getTime()
      );

    let baselineTotal: number | null = null;
    let prevTotal: number | null = null;

    return validSessions.map((sess, idx) => {
      const rwAttempts = sess.attempts.filter((a) => a.section === 'reading_writing');
      const mathAttempts = sess.attempts.filter((a) => a.section === 'math');
      const rwAcc =
        rwAttempts.length > 0
          ? rwAttempts.filter((a) => a.isCorrect).length / rwAttempts.length
          : 0.72;
      const mathAcc =
        mathAttempts.length > 0
          ? mathAttempts.filter((a) => a.isCorrect).length / mathAttempts.length
          : 0.75;

      const fallbackRw = Math.round((240 + rwAcc * 560) / 10) * 10;
      const fallbackMath = Math.round((240 + mathAcc * 560) / 10) * 10;

      const rwScore = sess.scaledScore?.rw ?? fallbackRw;
      const mathScore = sess.scaledScore?.math ?? fallbackMath;
      const totalScore = sess.scaledScore?.total ?? rwScore + mathScore;

      if (baselineTotal === null) baselineTotal = totalScore;
      const cumulativeGrowth = totalScore - baselineTotal;
      const stepDelta = prevTotal !== null ? totalScore - prevTotal : 0;
      prevTotal = totalScore;

      const dt = new Date(sess.completedAt || sess.startedAt);
      const shortDate = Number.isNaN(dt.getTime())
        ? `Session ${idx + 1}`
        : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullDate = Number.isNaN(dt.getTime())
        ? sess.completedAt
        : dt.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

      const correctCount = sess.attempts.filter((a) => a.isCorrect).length;
      const totalCount = Math.max(1, sess.attempts.length);
      const accuracyPct = Math.round((correctCount / totalCount) * 100);

      return {
        id: sess.id,
        index: idx + 1,
        axisLabel: `${shortDate}`,
        shortDate,
        fullDate,
        title: sess.title,
        mode:
          sess.mode === 'mock'
            ? 'Mock Exam'
            : sess.mode === 'drill'
            ? 'Drill'
            : 'Practice',
        totalScore,
        rwScore,
        mathScore,
        cumulativeGrowth,
        stepDelta,
        accuracyPct,
        correctCount,
        totalCount: sess.attempts.length,
        included: sess.includedInDiagnostics,
      };
    });
  }, [sessions, includeExcludedInChart]);

  const progressSummary = useMemo(() => {
    if (sessionProgressData.length === 0) {
      return {
        startScore: 0,
        latestScore: 0,
        totalGrowth: 0,
        peakScore: 0,
        yMin: 1200,
        yMax: 1600,
      };
    }
    const startScore = sessionProgressData[0].totalScore;
    const latestScore =
      sessionProgressData[sessionProgressData.length - 1].totalScore;
    const scores = sessionProgressData.map((d) => d.totalScore);
    const peakScore = Math.max(...scores);
    const minScore = Math.min(...scores, intendedTotalScore);
    const yMin = Math.max(400, Math.floor((minScore - 80) / 50) * 50);
    return {
      startScore,
      latestScore,
      totalGrowth: latestScore - startScore,
      peakScore,
      yMin,
      yMax: 1600,
    };
  }, [sessionProgressData, intendedTotalScore]);

  const getNaturalStatusLabel = (status: string) => {
    if (status === 'NOMINAL / MASTERED') return 'Strong';
    if (status === 'DEVELOPING') return 'Building';
    return 'Focus Area';
  };

  return (
    <div className="relative max-w-6xl mx-auto space-y-6 pb-14">
      <AmbientBackgroundAnimation />

      <div className="relative z-10 space-y-6">
        {/* TOP OPEN SECTION (NOT A CARD): One-Paragraph AI Focus Summary */}
        <section
          aria-label="What to Focus On"
          className="pb-5 border-b border-slate-200 dark:border-slate-800/80 space-y-2"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AsterOrbLogo size={18} active={refreshingSummary} interactive={false} />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                What to Focus On Next
              </span>
            </div>
            <button
              type="button"
              onClick={fetchFocusSummary}
              disabled={refreshingSummary}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Refresh summary"
            >
              <RefreshCw
                className={`w-3 h-3 ${refreshingSummary ? 'animate-spin' : ''}`}
              />
              <span>Refresh</span>
            </button>
          </div>

          <p className="text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-200 max-w-4xl">
            {aiFocusSummary}
          </p>
        </section>

        {/* Top Header & Sub-View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">
              Progress & Score Analytics
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your estimated score range, topic breakdown, and practice history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-xl border border-slate-300/60 dark:border-slate-800 overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setActiveSubView('general')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  activeSubView === 'general'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveSubView('last_test')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  activeSubView === 'last_test'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Last Session
              </button>
              <button
                type="button"
                onClick={() => setActiveSubView('history')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  activeSubView === 'history'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                History ({sessions.length + importedReports.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSubView('starred')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  activeSubView === 'starred'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Starred ({starredQuestionsList.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowWeightsEditor(!showWeightsEditor)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-indigo-400/50 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors whitespace-nowrap shrink-0"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Score Weights</span>
            </button>
          </div>
        </div>

        {/* Modifiable Score Weights Panel */}
        {showWeightsEditor && (
          <div className="rounded-2xl border border-indigo-500/40 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  How Your Score Estimate Is Weighted
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Adjust how much full mock exams, quick drills, untimed practice, and past score reports influence your estimated score.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUpdateWeights(DEFAULT_DIAGNOSTIC_WEIGHTS)}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <label className="block space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span>Timed Mock Exams</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {weights.mockExamWeight.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={2.0}
                  step={0.05}
                  value={weights.mockExamWeight}
                  onChange={(e) =>
                    onUpdateWeights({
                      ...weights,
                      mockExamWeight: Number(e.target.value),
                    })
                  }
                  className="w-full accent-indigo-600"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span>Quick Study Drills</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {weights.drillWeight.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={1.2}
                  step={0.05}
                  value={weights.drillWeight}
                  onChange={(e) =>
                    onUpdateWeights({
                      ...weights,
                      drillWeight: Number(e.target.value),
                    })
                  }
                  className="w-full accent-indigo-600"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span>Untimed Practice</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {weights.practiceWeight.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  value={weights.practiceWeight}
                  onChange={(e) =>
                    onUpdateWeights({
                      ...weights,
                      practiceWeight: Number(e.target.value),
                    })
                  }
                  className="w-full accent-indigo-600"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span>Past Score Reports</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {weights.importedScoreWeight.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={2.0}
                  step={0.05}
                  value={weights.importedScoreWeight}
                  onChange={(e) =>
                    onUpdateWeights({
                      ...weights,
                      importedScoreWeight: Number(e.target.value),
                    })
                  }
                  className="w-full accent-indigo-600"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span>Recent Activity Focus (Days)</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {weights.recencyHalfLifeDays}d
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={1}
                  value={weights.recencyHalfLifeDays}
                  onChange={(e) =>
                    onUpdateWeights({
                      ...weights,
                      recencyHalfLifeDays: Number(e.target.value),
                    })
                  }
                  className="w-full accent-indigo-600"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span>Baseline Stability</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {weights.priorAnchorStrength.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  value={weights.priorAnchorStrength}
                  onChange={(e) =>
                    onUpdateWeights({
                      ...weights,
                      priorAnchorStrength: Number(e.target.value),
                    })
                  }
                  className="w-full accent-indigo-600"
                />
              </label>
            </div>
          </div>
        )}

        {/* Top KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Estimated SAT Score
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {diagnosticReport.predictedTotalScore}
              </span>
              <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                ±{diagnosticReport.standardDeviation} pts
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Range: {diagnosticReport.confidenceInterval95[0]}–{diagnosticReport.confidenceInterval95[1]} ·{' '}
              {scoreGap > 0 ? `${scoreGap} pts to goal` : 'Target Reached'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Section Breakdown
            </span>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {diagnosticReport.predictedRwScore} R&W · {diagnosticReport.predictedMathScore} Math
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Pace: {diagnosticReport.learningVelocityPtsPerWeek >= 0 ? `+${diagnosticReport.learningVelocityPtsPerWeek}` : diagnosticReport.learningVelocityPtsPerWeek} pts/week
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Questions Counted
            </span>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {diagnosticReport.totalValidAttempts} Unassisted Attempts
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Across mock tests, drills, and practice sets
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Filtered Practice Items
            </span>
            <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {diagnosticReport.totalExcludedAiAttempts} AI Help · {diagnosticReport.totalExcludedRepeatAttempts} Repeats
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Kept in history without skewing your score estimate
            </div>
          </div>
        </div>

        {/* SUB-VIEW 1: OVERVIEW */}
        {activeSubView === 'general' && (
          <div className="space-y-6">
            {/* Progress Chart */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    <span>Score Progress Over Time</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tracks your total and section scores across completed practice and mock tests.
                  </p>
                </div>

                {/* Growth Summary Metrics & Chart Controls */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {sessionProgressData.length > 0 && (
                    <div className="flex items-center gap-2.5 sm:gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 mr-1">Start:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {progressSummary.startScore}
                        </span>
                      </div>
                      <span className="text-slate-300 dark:text-slate-700">→</span>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 mr-1">Latest:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {progressSummary.latestScore}
                        </span>
                      </div>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <div>
                        <span
                          className={`font-bold ${
                            progressSummary.totalGrowth >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {progressSummary.totalGrowth >= 0
                            ? `+${progressSummary.totalGrowth}`
                            : progressSummary.totalGrowth}{' '}
                          pts
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowSectionLines(!showSectionLines)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      showSectionLines
                        ? 'border-indigo-500/50 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {showSectionLines ? 'Hide Sections' : 'Show R&W / Math'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIncludeExcludedInChart(!includeExcludedInChart)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      includeExcludedInChart
                        ? 'border-amber-500/50 bg-amber-50/70 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {includeExcludedInChart ? 'All Sessions' : 'Counted Only'}
                  </button>
                </div>
              </div>

              {/* Recharts Responsive ComposedChart */}
              {sessionProgressData.length > 0 ? (
                <div className="h-64 sm:h-72 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 p-2 sm:p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={sessionProgressData}
                      margin={{ top: 16, right: 16, left: 0, bottom: 8 }}
                    >
                      <defs>
                        <linearGradient id="totalScoreFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.38} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#334155"
                        opacity={0.25}
                        vertical={false}
                      />

                      <XAxis
                        dataKey="axisLabel"
                        padding={{ left: 12, right: 12 }}
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={{ stroke: '#475569', opacity: 0.4 }}
                        tickLine={false}
                      />

                      <YAxis
                        yAxisId="total"
                        domain={[progressSummary.yMin, progressSummary.yMax]}
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        width={42}
                      />

                      {showSectionLines && (
                        <YAxis
                          yAxisId="section"
                          orientation="right"
                          domain={[550, 800]}
                          ticks={[550, 620, 680, 740, 800]}
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          axisLine={false}
                          tickLine={false}
                          width={34}
                        />
                      )}

                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const item = payload[0].payload;
                          return (
                            <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 shadow-xl text-xs space-y-2 min-w-[210px]">
                              <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {item.mode} · {item.fullDate}
                                </span>
                                <span
                                  className={`font-mono font-bold ${
                                    item.cumulativeGrowth >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {item.cumulativeGrowth >= 0
                                    ? `+${item.cumulativeGrowth}`
                                    : item.cumulativeGrowth}{' '}
                                  pts
                                </span>
                              </div>

                              <div className="font-bold text-slate-900 dark:text-slate-100">
                                {item.title}
                              </div>

                              <div className="grid grid-cols-3 gap-2 pt-0.5 font-mono">
                                <div className="rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1.5 text-center">
                                  <div className="text-[10px] text-slate-500">Total</div>
                                  <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                    {item.totalScore}
                                  </div>
                                </div>
                                <div className="rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1.5 text-center">
                                  <div className="text-[10px] text-slate-500">R&W</div>
                                  <div className="text-sm font-bold text-sky-600 dark:text-sky-400">
                                    {item.rwScore}
                                  </div>
                                </div>
                                <div className="rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1.5 text-center">
                                  <div className="text-[10px] text-slate-500">Math</div>
                                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                    {item.mathScore}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
                                <span>
                                  Accuracy: {item.correctCount}/{item.totalCount} ({item.accuracyPct}%)
                                </span>
                              </div>
                            </div>
                          );
                        }}
                      />

                      <ReferenceLine
                        yAxisId="total"
                        y={intendedTotalScore}
                        stroke="#f59e0b"
                        strokeDasharray="5 5"
                        label={{
                          value: `Goal: ${intendedTotalScore}`,
                          position: 'insideTopRight',
                          fill: '#f59e0b',
                          fontSize: 11,
                        }}
                      />

                      <Area
                        yAxisId="total"
                        type="monotone"
                        dataKey="totalScore"
                        name="Total Score"
                        isAnimationActive={false}
                        stroke="#6366f1"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#totalScoreFill)"
                        activeDot={{ r: 6, strokeWidth: 2, stroke: '#ffffff' }}
                        dot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#ffffff' }}
                      />

                      {showSectionLines && (
                        <>
                          <Line
                            yAxisId="section"
                            type="monotone"
                            dataKey="rwScore"
                            name="Reading & Writing"
                            isAnimationActive={false}
                            stroke="#0ea5e9"
                            strokeWidth={2}
                            strokeDasharray="4 3"
                            dot={{ r: 3.5, fill: '#0ea5e9' }}
                          />
                          <Line
                            yAxisId="section"
                            type="monotone"
                            dataKey="mathScore"
                            name="Math"
                            isAnimationActive={false}
                            stroke="#10b981"
                            strokeWidth={2}
                            strokeDasharray="4 3"
                            dot={{ r: 3.5, fill: '#10b981' }}
                          />
                        </>
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-8 text-center text-xs text-slate-500">
                  Complete a practice set, drill, or mock exam to see your score chart over time.
                </div>
              )}

              {/* Interactive Session Data Points Strip */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>
                    Click any test or session below to include or exclude it from your score estimate:
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {diagnosticReport.progressionCurve.map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() =>
                        pt.sourceType === 'imported'
                          ? onToggleReportInclusion(pt.id)
                          : onToggleSessionInclusion(pt.id)
                      }
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                        pt.included
                          ? 'border-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-950/40 text-slate-900 dark:text-slate-100'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/40 text-slate-400 line-through opacity-60'
                      }`}
                      title={`Click to ${pt.included ? 'exclude' : 'include'} ${pt.label}`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          pt.sourceType === 'imported'
                            ? 'bg-emerald-500'
                            : pt.sourceType === 'mock'
                            ? 'bg-indigo-500'
                            : 'bg-sky-500'
                        }`}
                      />
                      <span className="font-sans font-medium truncate max-w-[160px]">
                        {pt.label}
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {pt.totalScore}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 8-Domain Topic Breakdown */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Performance by Topic
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Combines your past score reports with your practice, drill, and mock test results.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.values(diagnosticReport.domainStats).map((dom) => (
                  <div
                    key={dom.domainId}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {dom.domainName} ({dom.domainId})
                        </span>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Section Pace: ~{dom.estimatedDomainScore}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-mono font-bold ${
                          dom.statusLabel === 'NOMINAL / MASTERED'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : dom.statusLabel === 'DEVELOPING'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {dom.weightedMasteryPct}% · {getNaturalStatusLabel(dom.statusLabel)}
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${dom.weightedMasteryPct}%` }}
                        className={`h-full rounded-full ${
                          dom.statusLabel === 'NOMINAL / MASTERED'
                            ? 'bg-emerald-500'
                            : dom.statusLabel === 'DEVELOPING'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>Counted: {dom.validAttempts} Qs ({dom.rawAccuracyPct}% correct)</span>
                      {(dom.excludedAiCount > 0 || dom.excludedRepeatCount > 0) && (
                        <span>
                          Filtered: {dom.excludedAiCount} AI · {dom.excludedRepeatCount} Repeat
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Practice Sets */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Recommended Practice Sets
                  </h2>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Click any card to pre-fill it in Test Start
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {diagnosticReport.drillSuggestions.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => onSelectDrillSuggestion(card)}
                    className="text-left rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 bg-slate-50/70 dark:bg-slate-950/60 p-4 transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        <span>
                          {card.mode.toUpperCase()} · {card.domains.join(', ')} · {card.suggestedLength} Qs
                        </span>
                        <span>+{card.estimatedGainPts} pts</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {card.rationale}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 pt-1">
                      <span>Open in Test Start</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUB-VIEW 2: LAST SESSION REVIEW */}
        {activeSubView === 'last_test' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-5">
            {lastCompletedSession ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                      Most Recent Session · {new Date(lastCompletedSession.completedAt).toLocaleDateString()}
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {lastCompletedSession.title}
                    </h2>
                    {lastCompletedSession.config.prefilledSuggestionId && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                        {lastCompletedSession.config.userOverrodeSuggestion
                          ? 'You customized the suggested settings before starting.'
                          : 'Completed from your recommended practice sets.'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 font-mono">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-slate-500">Session Score Pace</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {lastCompletedSession.scaledScore?.total || 1420} ({lastCompletedSession.scaledScore?.rw || 700} R&W / {lastCompletedSession.scaledScore?.math || 720} Math)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <Award className="w-4 h-4 text-emerald-500" />
                      <span>Accuracy</span>
                    </div>
                    <div className="text-lg font-bold font-mono">
                      {lastCompletedSession.attempts.filter((a) => a.isCorrect).length} /{' '}
                      {lastCompletedSession.attempts.length} Correct
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <Clock className="w-4 h-4 text-sky-500" />
                      <span>Average Time</span>
                    </div>
                    <div className="text-lg font-bold font-mono">
                      {Math.round(
                        lastCompletedSession.attempts.reduce((s, a) => s + a.timeSpentSec, 0) /
                          Math.max(1, lastCompletedSession.attempts.length)
                      )}s / question
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <Activity className="w-4 h-4 text-indigo-500" />
                      <span>Counted Toward Score</span>
                    </div>
                    <div className="text-lg font-bold font-mono">
                      {lastCompletedSession.attempts.filter((a) => a.countsTowardDiagnostics).length} Questions
                    </div>
                  </div>
                </div>

                {/* Question-by-Question Breakdown of Last Test */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Questions from This Session
                  </h3>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {lastCompletedSession.attempts.map((att, i) => {
                      const qObj = allQuestions.find((q) => q.id === att.questionId);
                      return (
                        <div
                          key={`${att.questionId}-${i}`}
                          className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/40 dark:bg-slate-950/40"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono font-bold text-slate-500 w-6 shrink-0">
                              #{i + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                                  {att.questionId}
                                </span>{' '}
                                · {att.domain} — {att.skill}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                Your Answer: {att.selectedAnswer} · {att.timeSpentSec}s
                                {att.usedAiBeforeSubmit && (
                                  <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">
                                    · [AI Help Used — Not Counted]
                                  </span>
                                )}
                                {att.isRepeatAttempt && (
                                  <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">
                                    · [Repeat Question — Not Counted]
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <span
                              className={`font-mono font-bold ${
                                att.isCorrect
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {att.isCorrect ? '✓ Correct' : '✕ Missed'}
                            </span>
                            {qObj && (
                              <button
                                type="button"
                                onClick={() => setSelectedStarredModalQuestion(qObj)}
                                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium"
                              >
                                Explanation
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-sm text-slate-500">
                Complete a practice, drill, or mock session to review your question-by-question breakdown here.
              </div>
            )}
          </div>
        )}

        {/* SUB-VIEW 3: FULL HISTORY */}
        {activeSubView === 'history' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-500" />
                Past Tests & Score Reports
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Uncheck any test or practice session below if you don&apos;t want it included in your score estimate.
              </p>
            </div>

            {/* Imported Official Score Reports */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Imported SAT / PSAT Score Reports ({importedReports.length})
              </h3>
              <div className="space-y-2">
                {importedReports.map((rep) => (
                  <label
                    key={rep.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={rep.includedInDiagnostics}
                        onChange={() => onToggleReportInclusion(rep.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {rep.label} ({rep.testType})
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {rep.testDate} · Total: {rep.totalScore} ({rep.rwScore} R&W / {rep.mathScore} Math)
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      {rep.includedInDiagnostics ? 'Included' : 'Excluded'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Completed Sessions History */}
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Completed Practice, Drills & Mock Exams ({sessions.length})
              </h3>
              <div className="space-y-2.5">
                {sessions.map((sess) => {
                  const aiCount = sess.attempts.filter((a) => a.usedAiBeforeSubmit).length;
                  const repCount = sess.attempts.filter((a) => a.isRepeatAttempt).length;

                  return (
                    <div
                      key={sess.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sess.includedInDiagnostics}
                            disabled={sess.mode === 'id_search'}
                            onChange={() => onToggleSessionInclusion(sess.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {sess.title}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {sess.mode.toUpperCase()} · {new Date(sess.completedAt).toLocaleDateString()} ·{' '}
                              {sess.attempts.filter((a) => a.isCorrect).length}/{sess.attempts.length} Correct
                            </div>
                          </div>
                        </label>

                        <div className="flex items-center gap-3 text-xs font-mono">
                          {aiCount > 0 && (
                            <span className="text-amber-600 dark:text-amber-400">
                              {aiCount} AI Help
                            </span>
                          )}
                          {repCount > 0 && (
                            <span className="text-amber-600 dark:text-amber-400">
                              {repCount} Repeat
                            </span>
                          )}
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {sess.includedInDiagnostics ? 'Included' : 'Excluded'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SUB-VIEW 4: STARRED QUESTIONS */}
        {activeSubView === 'starred' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-rose-500 fill-rose-500" />
                  Starred Questions ({starredQuestionsList.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Review explanations for questions you marked for review or open them in the testing screen.
                </p>
              </div>
            </div>

            {starredQuestionsList.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No starred questions yet. Click &ldquo;Mark for Review&rdquo; while practicing to save questions here.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {starredQuestionsList.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          ID: {q.id} · {q.domainName} ({q.difficulty})
                        </span>
                        <button
                          type="button"
                          onClick={() => onToggleStarQuestion(q.id)}
                          className="text-rose-500 hover:underline text-[11px]"
                        >
                          Remove Star
                        </button>
                      </div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {q.skill}
                      </div>
                      <div
                        className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2"
                        dangerouslySetInnerHTML={{
                          __html: formatMathHtml(q.stemHtml),
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setSelectedStarredModalQuestion(q)}
                        className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-center transition-colors"
                      >
                        View Explanation
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenQuestionInTestingScreen(q)}
                        className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-center transition-colors"
                      >
                        Try Question
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Starred Question Explanation Pop-Up Modal */}
      {selectedStarredModalQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  Question ID: {selectedStarredModalQuestion.id} · {selectedStarredModalQuestion.domainName}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {selectedStarredModalQuestion.skill}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStarredModalQuestion(null)}
                className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedStarredModalQuestion.passageHtml && (
              <div
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-xs font-passage leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: formatMathHtml(selectedStarredModalQuestion.passageHtml),
                }}
              />
            )}

            <div
              className="text-sm font-medium text-slate-900 dark:text-slate-100"
              dangerouslySetInnerHTML={{
                __html: formatMathHtml(selectedStarredModalQuestion.stemHtml),
              }}
            />

            {selectedStarredModalQuestion.choices && (
              <div className="space-y-1.5 text-xs">
                {selectedStarredModalQuestion.choices.map((c) => (
                  <div
                    key={c.id}
                    className={`p-2.5 rounded-lg border ${
                      c.id === selectedStarredModalQuestion.correctAnswer
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 font-semibold'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <span className="font-mono font-bold mr-2">{c.id}.</span>
                    <span>{c.text}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 space-y-1.5 text-xs">
              <div className="font-bold text-indigo-700 dark:text-indigo-300">
                Explanation (Correct Answer: {selectedStarredModalQuestion.correctAnswer})
              </div>
              <div
                className="text-slate-700 dark:text-slate-300 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: formatMathHtml(selectedStarredModalQuestion.rationaleHtml),
                }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const q = selectedStarredModalQuestion;
                  setSelectedStarredModalQuestion(null);
                  onOpenQuestionInTestingScreen(q);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Open in Testing Screen
              </button>
              <button
                type="button"
                onClick={() => setSelectedStarredModalQuestion(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

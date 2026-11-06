import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  DifficultyLevel,
  DrillSuggestion,
  InProgressSession,
  SATDomainId,
  SATQuestion,
  TestStartConfig,
} from '../types';
import { SAT_DOMAINS } from '../data/satQuestionBank';
import { calculateAndSelectQuestionPool } from '../utils/poolCalculator';
import {
  getInitialTestStartMenuState,
  isMobileViewport,
  triggerHaptic,
} from '../utils/haptics';
import {
  Play,
  Clock,
  Zap,
  Search,
  Sparkles,
  CheckSquare,
  Square,
  AlertTriangle,
  ShieldCheck,
  Layers,
  ChevronDown,
  RotateCcw,
  Trash2,
} from 'lucide-react';

interface TestStartScreenProps {
  allQuestions: SATQuestion[];
  answeredQuestionIds: Set<string>;
  config: TestStartConfig;
  onChangeConfig: (newConfig: TestStartConfig) => void;
  onStartSession: (selectedQuestions: SATQuestion[], finalConfig: TestStartConfig) => void;
  drillSuggestions: DrillSuggestion[];
  onApplySuggestion: (suggestion: DrillSuggestion) => void;
  inProgressSessions?: InProgressSession[];
  onResumeInProgress?: (session: InProgressSession) => void;
  onDeleteInProgress?: (sessionId: string) => void;
}

type ExpandableMode = 'practice' | 'mock' | 'drill';

export const TestStartScreen: React.FC<TestStartScreenProps> = ({
  allQuestions,
  answeredQuestionIds,
  config,
  onChangeConfig,
  onStartSession,
  drillSuggestions,
  onApplySuggestion,
  inProgressSessions = [],
  onResumeInProgress,
  onDeleteInProgress,
}) => {

  const initialMenuState = useMemo(
    () =>
      getInitialTestStartMenuState(
        isMobileViewport(),
        config.mode === 'mock' || config.mode === 'drill' ? config.mode : 'practice'
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // On mobile (< 768px), all 3 mode cards start collapsed (null); on desktop, Practice Mode opens initially
  const [expandedMode, setExpandedMode] = useState<ExpandableMode | null>(
    initialMenuState.expandedMode
  );

  // Collapsible Suggested Topics dropdown category inside the Topic & Subtopic Multi-Select (collapsed by default on mobile)
  const [suggestedDropdownOpen, setSuggestedDropdownOpen] = useState<boolean>(
    initialMenuState.suggestedDropdownOpen
  );

  // Track which individual domain cards have their subtopics expanded (all collapsed by default on mobile)
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>(
    initialMenuState.expandedDomains
  );

  // Sync collapsed state when viewport crosses mobile breakpoint (< 768px)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 767px)');
    const handleViewportChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        const mobileState = getInitialTestStartMenuState(true, 'practice');
        setExpandedMode(mobileState.expandedMode);
        setSuggestedDropdownOpen(mobileState.suggestedDropdownOpen);
        setExpandedDomains(mobileState.expandedDomains);
      }
    };
    if (mq.matches) {
      handleViewportChange(mq);
    }
    mq.addEventListener?.('change', handleViewportChange);
    return () => mq.removeEventListener?.('change', handleViewportChange);
  }, []);

  // Sync expandedMode when redirected from Diagnostics or Aster AI with a pre-filled suggestion
  useEffect(() => {
    if (
      config.prefilledSuggestionId &&
      (config.mode === 'practice' || config.mode === 'mock' || config.mode === 'drill')
    ) {
      setExpandedMode(config.mode);
    }
  }, [config.prefilledSuggestionId, config.mode]);

  const poolCalc = useMemo(
    () => calculateAndSelectQuestionPool(allQuestions, answeredQuestionIds, config),
    [allQuestions, answeredQuestionIds, config]
  );

  const updateConfigWithOverrideCheck = (patch: Partial<TestStartConfig>) => {
    const isOverridingPrefill =
      Boolean(config.prefilledSuggestionId) &&
      (patch.mode !== undefined ||
        patch.selectedDomains !== undefined ||
        patch.selectedSkills !== undefined ||
        patch.drillLength !== undefined ||
        patch.difficulties !== undefined);

    onChangeConfig({
      ...config,
      ...patch,
      userOverrodeSuggestion: config.userOverrodeSuggestion || isOverridingPrefill,
    });
  };

  const handleToggleCard = (modeId: ExpandableMode) => {
    triggerHaptic('menu_toggle');
    if (expandedMode === modeId) {
      setExpandedMode(null);
    } else {
      setExpandedMode(modeId);
      if (config.mode !== modeId) {
        updateConfigWithOverrideCheck({ mode: modeId });
      }
    }
  };

  const toggleDomain = (domainId: SATDomainId) => {
    const exists = config.selectedDomains.includes(domainId);
    const domainObj = SAT_DOMAINS.find((d) => d.id === domainId);
    const nextDomains = exists
      ? config.selectedDomains.filter((d) => d !== domainId)
      : [...config.selectedDomains, domainId];

    let nextSkills = config.selectedSkills;
    if (exists && domainObj && config.selectedSkills.length > 0) {
      nextSkills = config.selectedSkills.filter((s) => !domainObj.skills.includes(s));
    }

    updateConfigWithOverrideCheck({
      selectedDomains: nextDomains,
      selectedSkills: nextSkills,
    });
  };

  const toggleSkill = (domainId: SATDomainId, skill: string) => {
    let currentActiveSkills: string[];
    if (config.selectedSkills.length === 0) {
      currentActiveSkills = SAT_DOMAINS.filter((d) =>
        config.selectedDomains.includes(d.id)
      ).flatMap((d) => d.skills);
    } else {
      currentActiveSkills = [...config.selectedSkills];
    }

    const isCurrentlySelected = currentActiveSkills.includes(skill);
    const nextSkills = isCurrentlySelected
      ? currentActiveSkills.filter((s) => s !== skill)
      : [...currentActiveSkills, skill];

    const nextDomains = SAT_DOMAINS.filter((d) =>
      d.skills.some((s) => nextSkills.includes(s))
    ).map((d) => d.id);

    if (!isCurrentlySelected && !nextDomains.includes(domainId)) {
      nextDomains.push(domainId);
    }

    updateConfigWithOverrideCheck({
      selectedDomains: nextDomains,
      selectedSkills: nextSkills,
    });
  };

  const isSkillSelected = (domainId: SATDomainId, skill: string): boolean => {
    const domainSelected = config.selectedDomains.includes(domainId);
    if (!domainSelected) return false;
    if (config.selectedSkills.length === 0) return true;
    return config.selectedSkills.includes(skill);
  };

  const suggestedSkillItems = useMemo(() => {
    const items: {
      skill: string;
      domainId: SATDomainId;
      domainName: string;
      reason: string;
      estimatedGainPts: number;
    }[] = [];
    const seen = new Set<string>();

    drillSuggestions.forEach((sug) => {
      sug.skills.forEach((sk) => {
        if (seen.has(sk)) return;
        const dom =
          SAT_DOMAINS.find((d) => d.skills.includes(sk)) ||
          SAT_DOMAINS.find((d) => sug.domains.includes(d.id));
        if (dom) {
          seen.add(sk);
          items.push({
            skill: sk,
            domainId: dom.id,
            domainName: dom.name,
            reason: sug.title,
            estimatedGainPts: sug.estimatedGainPts,
          });
        }
      });
    });

    if (items.length === 0) {
      const defaults: { domainId: SATDomainId; skill: string; gain: number }[] = [
        { domainId: 'INI', skill: 'Inferences', gain: 30 },
        { domainId: 'CAS', skill: 'Words in Context', gain: 20 },
        { domainId: 'ALG', skill: 'Systems of two linear equations in two variables', gain: 30 },
        { domainId: 'ADV', skill: 'Nonlinear functions', gain: 30 },
      ];
      defaults.forEach((d) => {
        const dom = SAT_DOMAINS.find((x) => x.id === d.domainId)!;
        items.push({
          skill: d.skill,
          domainId: dom.id,
          domainName: dom.name,
          reason: 'Recommended Skill',
          estimatedGainPts: d.gain,
        });
      });
    }

    return items;
  }, [drillSuggestions]);

  const toggleDifficulty = (diff: DifficultyLevel) => {
    const exists = config.difficulties.includes(diff);
    if (exists && config.difficulties.length === 1) return;
    const nextDiffs = exists
      ? config.difficulties.filter((d) => d !== diff)
      : [...config.difficulties, diff];
    updateConfigWithOverrideCheck({ difficulties: nextDiffs });
  };

  const selectAllTopics = () => {
    updateConfigWithOverrideCheck({
      selectedDomains: SAT_DOMAINS.map((d) => d.id),
      selectedSkills: [],
    });
  };

  const selectOnlySuggestedTopics = () => {
    const sugSkills = suggestedSkillItems.map((i) => i.skill);
    const sugDomains = Array.from(new Set(suggestedSkillItems.map((i) => i.domainId)));
    updateConfigWithOverrideCheck({
      selectedDomains: sugDomains,
      selectedSkills: sugSkills,
    });
  };

  const mockTimingInfo = useMemo(() => {
    const rwMult =
      config.accommodations.rwTimeMultiplier ??
      config.accommodations.timeMultiplier ??
      1;
    const mathMult =
      config.accommodations.mathTimeMultiplier ??
      config.accommodations.timeMultiplier ??
      1;
    const rwModMins = Math.round(32 * rwMult);
    const mathModMins = Math.round(35 * mathMult);
    const rwTotalMins = rwModMins * 2;
    const mathTotalMins = mathModMins * 2;

    const totalMinutes =
      config.mockSections === 'reading_writing'
        ? rwTotalMins
        : config.mockSections === 'math'
        ? mathTotalMins
        : rwTotalMins + mathTotalMins;

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const formattedLarge =
      hours > 0 ? `${hours} hr ${mins} min` : `${totalMinutes} min`;

    const breakMins = config.accommodations.extendedBreaks ? 15 : 10;
    const breakCount =
      config.mockSections === 'both'
        ? config.accommodations.extraBreaks
          ? 3
          : 1
        : 1;

    const moduleBreakdown =
      config.mockSections === 'reading_writing'
        ? `2 Reading & Writing Modules (${rwModMins}m each · 54 Qs) + ${breakMins}m break`
        : config.mockSections === 'math'
        ? `2 Math Modules (${mathModMins}m each · 44 Qs) + ${breakMins}m break`
        : `4 Modules (${rwTotalMins}m R&W + ${mathTotalMins}m Math · 98 Qs) + ${breakCount} × ${breakMins}m break${
            breakCount > 1 ? 's' : ''
          }`;

    const formatMult = (m: 1 | 1.5 | 2) =>
      m === 1 ? 'Standard (1x)' : m === 1.5 ? 'Time and One-Half (+50%)' : 'Double Time (+100%)';

    const multLabel =
      rwMult === mathMult
        ? formatMult(rwMult)
        : `R&W: ${formatMult(rwMult)} · Math: ${formatMult(mathMult)}`;

    return {
      totalMinutes,
      formattedLarge,
      moduleBreakdown,
      multLabel,
      rwModMins,
      mathModMins,
      rwTotalMins,
      mathTotalMins,
      rwMult,
      mathMult,
      breakMins,
      breakCount,
    };
  }, [config.mockSections, config.accommodations]);

  const expandableCards: {
    id: ExpandableMode;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'practice',
      title: 'Practice Mode',
      subtitle:
        'Untimed practice with instant answer explanations, question navigator, and AI help',
      icon: <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />,
    },
    {
      id: 'mock',
      title: 'Timed Mock Exam',
      subtitle:
        'Full or section-length timed SAT simulation with Bluebook tools and accommodations',
      icon: <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />,
    },
    {
      id: 'drill',
      title: 'Quick Study Drill',
      subtitle:
        'Short, focused sets on specific skills using unseen questions',
      icon: <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />,
    },
  ];

  const trimmedSearchId = (config.searchQuestionId || '').trim();
  const handleLaunchIdSearch = () => {
    if (!trimmedSearchId) return;
    triggerHaptic('start_test');
    const idCfg: TestStartConfig = {
      ...config,
      mode: 'id_search',
      searchQuestionId: trimmedSearchId,
    };
    const idPool = calculateAndSelectQuestionPool(
      allQuestions,
      answeredQuestionIds,
      idCfg
    );
    onStartSession(idPool.selectedQuestions, idCfg);
  };

  const formatRemainingTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}m ${String(secs).padStart(2, '0')}s left`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Pre-filled Redirect Notification Banner (from AI or Diagnostics) */}
      {config.prefilledSuggestionId && (
        <div className="rounded-xl border border-indigo-400/50 dark:border-indigo-500/40 bg-indigo-50/70 dark:bg-indigo-950/30 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <Sparkles className="w-4 h-4" />
              <span>
                Recommended Session Ready:{' '}
                {config.prefilledSuggestionTitle || 'Custom Practice Set'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Your topics and settings are pre-filled below. Click{' '}
              <strong>Start</strong> when you&apos;re ready, or adjust any setting first.
              {config.userOverrodeSuggestion && (
                <span className="ml-2 font-semibold text-amber-600 dark:text-amber-400">
                  · Custom changes applied
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onChangeConfig({
                ...config,
                prefilledSuggestionId: undefined,
                prefilledSuggestionTitle: undefined,
                userOverrodeSuggestion: false,
              })
            }
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            Clear
          </button>
        </div>
      )}

      {/* Header + Question Bank Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">
            Practice & Test Studio
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
              {allQuestions.length.toLocaleString()}
            </span>{' '}
            SAT questions in built-in bank ·{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
              {answeredQuestionIds.size.toLocaleString()}
            </span>{' '}
            completed so far
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            Full Question Bank Loaded ({allQuestions.length.toLocaleString()} items)
          </span>
        </div>
      </div>

      {/* IN PROGRESS SECTION (Saved Mock Exams or Replaced Drills & Practices) */}
      {inProgressSessions.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                In Progress ({inProgressSessions.length})
              </h2>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Saved tests and paused practice sessions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {inProgressSessions.map((sess) => {
              const answeredCount = Object.values(sess.answers || {}).filter(
                (v) => v && v.trim() !== ''
              ).length;
              const totalCount = sess.questions.length;

              return (
                <div
                  key={sess.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {sess.mode === 'mock'
                          ? 'Mock Exam'
                          : sess.mode === 'drill'
                          ? 'Drill'
                          : 'Practice'}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {sess.title}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>
                        {answeredCount} / {totalCount} answered
                      </span>
                      <span>·</span>
                      <span>On Q#{sess.currentIndex + 1}</span>
                      {(sess.mode === 'mock' || sess.mode === 'drill') && (
                        <>
                          <span>·</span>
                          <span>{formatRemainingTime(sess.remainingSeconds)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {onResumeInProgress && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('start_test');
                          onResumeInProgress(sess);
                        }}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                        <span>Resume</span>
                      </button>
                    )}
                    {onDeleteInProgress && (
                      <button
                        type="button"
                        onClick={() => onDeleteInProgress(sess.id)}
                        aria-label={`Remove ${sess.title}`}
                        title="Remove from In Progress"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vertically Stacked Smooth-Sliding Mode Cards (3 Dropdowns + 1 Compressed Card) */}
      <motion.div layout className="space-y-4">
        {expandableCards.map((card) => {
          const isOpen = expandedMode === card.id;

          return (
            <motion.div
              layout
              key={card.id}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className={`rounded-2xl border overflow-hidden transition-colors duration-200 ${
                isOpen
                  ? 'border-indigo-500/80 bg-indigo-50/70 dark:bg-indigo-950/35 ring-1 ring-indigo-500/50 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Dropdown Card Header */}
              <button
                type="button"
                onClick={() => handleToggleCard(card.id)}
                aria-expanded={isOpen}
                className="w-full text-left px-4 sm:px-6 py-4 flex items-center justify-between gap-4 focus:outline-none"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    {card.icon}
                    <span
                      className={`text-base font-bold tracking-tight font-display ${
                        isOpen
                          ? 'text-indigo-950 dark:text-indigo-100'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {card.title}
                    </span>
                  </div>
                  <p
                    className={`text-xs leading-relaxed ${
                      isOpen
                        ? 'text-indigo-900/80 dark:text-indigo-200/80'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {card.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {isOpen && (
                    <span className="hidden sm:inline-block text-xs font-mono tabular-nums text-indigo-700 dark:text-indigo-300">
                      {poolCalc.selectedQuestions.length} Questions
                    </span>
                  )}
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className={`p-1.5 rounded-lg ${
                      isOpen
                        ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-500/10'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </div>
              </button>

              {/* Smooth-Sliding Expanded Content */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key={`${card.id}-content`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 sm:px-6 pb-6 pt-2 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                      {/* LEFT AREA (2/3 width) */}
                      <div className="lg:col-span-2 space-y-4">
                        {card.id === 'mock' ? (
                          <div className="space-y-5">
                            {/* Section Selection */}
                            <div className="space-y-2">
                              <div>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                  Test Sections
                                </h2>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  The digital SAT is multistage adaptive (difficulty of Module 2 adjusts based on Module 1 performance).
                                </p>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                  {
                                    id: 'both',
                                    label: 'Full Digital SAT',
                                    meta: '4 Modules · 98 Questions · 134m',
                                  },
                                  {
                                    id: 'reading_writing',
                                    label: 'Reading & Writing Only',
                                    meta: '2 Modules · 54 Questions · 64m',
                                  },
                                  {
                                    id: 'math',
                                    label: 'Math Only',
                                    meta: '2 Modules · 44 Questions · 70m',
                                  },
                                ].map((sec) => {
                                  const active = config.mockSections === sec.id;
                                  return (
                                    <button
                                      key={sec.id}
                                      type="button"
                                      onClick={() =>
                                        updateConfigWithOverrideCheck({
                                          mockSections:
                                            sec.id as TestStartConfig['mockSections'],
                                          selectedDomains:
                                            sec.id === 'reading_writing'
                                              ? ['INI', 'CAS', 'EOI', 'SEC']
                                              : sec.id === 'math'
                                              ? ['ALG', 'ADV', 'PSD', 'GEO']
                                              : SAT_DOMAINS.map((d) => d.id),
                                        })
                                      }
                                      className={`p-3.5 rounded-xl border text-left transition-colors ${
                                        active
                                          ? 'border-indigo-600 dark:border-indigo-400 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                                          : 'border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900'
                                      }`}
                                    >
                                      <div className="text-xs font-bold">{sec.label}</div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                        {sec.meta}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Official Digital SAT Test Structure Breakdown Table */}
                            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 overflow-hidden">
                              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                  Test Structure Breakdown
                                </span>
                                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                  Multistage Adaptive · {mockTimingInfo.breakCount} × {mockTimingInfo.breakMins}-min break{mockTimingInfo.breakCount > 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400">
                                      <th className="py-2 px-3.5 font-semibold">Section</th>
                                      <th className="py-2 px-3.5 font-semibold">Time Allotted</th>
                                      <th className="py-2 px-3.5 font-semibold">Modules &amp; Length</th>
                                      <th className="py-2 px-3.5 font-semibold">Number of Questions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-slate-800 dark:text-slate-200">
                                    {(config.mockSections === 'both' ||
                                      config.mockSections === 'reading_writing') && (
                                      <tr>
                                        <td className="py-2.5 px-3.5 font-semibold">
                                          Reading and Writing
                                        </td>
                                        <td className="py-2.5 px-3.5 font-mono">
                                          {mockTimingInfo.rwTotalMins} minutes
                                        </td>
                                        <td className="py-2.5 px-3.5">
                                          Two {mockTimingInfo.rwModMins}-minute modules
                                        </td>
                                        <td className="py-2.5 px-3.5 font-mono">
                                          54 questions (27 per module)
                                        </td>
                                      </tr>
                                    )}
                                    {(config.mockSections === 'both' ||
                                      config.mockSections === 'math') && (
                                      <tr>
                                        <td className="py-2.5 px-3.5 font-semibold">Math</td>
                                        <td className="py-2.5 px-3.5 font-mono">
                                          {mockTimingInfo.mathTotalMins} minutes
                                        </td>
                                        <td className="py-2.5 px-3.5">
                                          Two {mockTimingInfo.mathModMins}-minute modules
                                        </td>
                                        <td className="py-2.5 px-3.5 font-mono">
                                          44 questions (22 per module)
                                        </td>
                                      </tr>
                                    )}
                                    <tr className="bg-indigo-50/50 dark:bg-indigo-950/30 font-bold text-slate-900 dark:text-white">
                                      <td className="py-2.5 px-3.5">Total</td>
                                      <td className="py-2.5 px-3.5 font-mono">
                                        {mockTimingInfo.totalMinutes} minutes
                                      </td>
                                      <td className="py-2.5 px-3.5">
                                        {config.mockSections === 'both'
                                          ? '4 modules'
                                          : '2 modules'}
                                      </td>
                                      <td className="py-2.5 px-3.5 font-mono">
                                        {config.mockSections === 'both'
                                          ? '98 questions'
                                          : config.mockSections === 'reading_writing'
                                          ? '54 questions'
                                          : '44 questions'}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Official Bluebook Practice Test Accommodations (Timing Dropdowns + Breaks) */}
                            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-4 space-y-4">
                              <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                  Accommodations
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  Configure section timing and break accommodations for your Bluebook practice test.
                                </p>
                              </div>

                              {/* Timing Dropdowns: Reading and Writing + Math */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="block space-y-1.5">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Reading and Writing
                                  </span>
                                  <select
                                    aria-label="Reading and Writing timing accommodation"
                                    value={mockTimingInfo.rwMult}
                                    onChange={(e) => {
                                      const nextRw = Number(e.target.value) as 1 | 1.5 | 2;
                                      updateConfigWithOverrideCheck({
                                        accommodations: {
                                          ...config.accommodations,
                                          rwTimeMultiplier: nextRw,
                                          timeMultiplier: nextRw,
                                        },
                                      });
                                    }}
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  >
                                    <option value={1}>
                                      Standard Time (64 mins · 32 min/module)
                                    </option>
                                    <option value={1.5}>
                                      Reading and Writing: Time and one-half (+50%)
                                    </option>
                                    <option value={2}>
                                      Reading and Writing: Double time (+100%)
                                    </option>
                                  </select>
                                </label>

                                <label className="block space-y-1.5">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Math
                                  </span>
                                  <select
                                    aria-label="Math timing accommodation"
                                    value={mockTimingInfo.mathMult}
                                    onChange={(e) => {
                                      const nextMath = Number(e.target.value) as 1 | 1.5 | 2;
                                      updateConfigWithOverrideCheck({
                                        accommodations: {
                                          ...config.accommodations,
                                          mathTimeMultiplier: nextMath,
                                        },
                                      });
                                    }}
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  >
                                    <option value={1}>
                                      Standard Time (70 mins · 35 min/module)
                                    </option>
                                    <option value={1.5}>
                                      Math: Time and one-half (+50%)
                                    </option>
                                    <option value={2}>
                                      Math: Double time (+100%)
                                    </option>
                                  </select>
                                </label>
                              </div>

                              {/* Breaks Accommodations */}
                              <div className="space-y-2 pt-1">
                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                  Breaks
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/60 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={config.accommodations.extraBreaks}
                                      onChange={(e) =>
                                        updateConfigWithOverrideCheck({
                                          accommodations: {
                                            ...config.accommodations,
                                            extraBreaks: e.target.checked,
                                          },
                                        })
                                      }
                                      className="mt-0.5 rounded border-slate-300 text-indigo-600"
                                    />
                                    <div>
                                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                        Extra breaks
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Breaks between all 4 modules (3 breaks instead of 1)
                                      </div>
                                    </div>
                                  </label>

                                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/60 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(config.accommodations.extendedBreaks)}
                                      onChange={(e) =>
                                        updateConfigWithOverrideCheck({
                                          accommodations: {
                                            ...config.accommodations,
                                            extendedBreaks: e.target.checked,
                                          },
                                        })
                                      }
                                      className="mt-0.5 rounded border-slate-300 text-indigo-600"
                                    />
                                    <div>
                                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                        Extended breaks
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        15-minute scheduled breaks instead of 10 minutes
                                      </div>
                                    </div>
                                  </label>

                                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/60 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(config.accommodations.breaksAsNeeded)}
                                      onChange={(e) =>
                                        updateConfigWithOverrideCheck({
                                          accommodations: {
                                            ...config.accommodations,
                                            breaksAsNeeded: e.target.checked,
                                          },
                                        })
                                      }
                                      className="mt-0.5 rounded border-slate-300 text-indigo-600"
                                    />
                                    <div>
                                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                        Breaks as needed
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Take untimed breaks at any time via header button
                                      </div>
                                    </div>
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* PRACTICE & DRILL LEFT AREA */
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                  Topics & Skills
                                </h2>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  Pick from your suggested focus areas or choose any SAT topics below.
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={selectAllTopics}
                                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                                >
                                  All Topics
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateConfigWithOverrideCheck({
                                      selectedDomains: ['INI', 'CAS', 'EOI', 'SEC'],
                                      selectedSkills: [],
                                    })
                                  }
                                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                                >
                                  R&W Only
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateConfigWithOverrideCheck({
                                      selectedDomains: ['ALG', 'ADV', 'PSD', 'GEO'],
                                      selectedSkills: [],
                                    })
                                  }
                                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                                >
                                  Math Only
                                </button>
                                <button
                                  type="button"
                                  onClick={selectOnlySuggestedTopics}
                                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-indigo-400/70 dark:border-indigo-500/60 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 whitespace-nowrap shrink-0"
                                >
                                  Suggested Only
                                </button>
                              </div>
                            </div>

                            {/* Suggested Topics Dropdown Category */}
                            <div className="rounded-xl border border-indigo-400/60 dark:border-indigo-500/50 bg-white/90 dark:bg-slate-900/90 overflow-hidden">
                              <div className="flex items-center justify-between gap-2 px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('menu_toggle');
                                    setSuggestedDropdownOpen((prev) => !prev);
                                  }}
                                  className="flex items-center gap-2 text-left flex-1"
                                >
                                  <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                    Suggested Topics for You
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('menu_toggle');
                                    setSuggestedDropdownOpen((prev) => !prev);
                                  }}
                                  aria-label="Toggle Suggested Topics Dropdown"
                                  className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                >
                                  <motion.div
                                    animate={{ rotate: suggestedDropdownOpen ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </motion.div>
                                </button>
                              </div>

                              <AnimatePresence initial={false}>
                                {suggestedDropdownOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-4 pb-3.5 pt-1 space-y-2.5">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {suggestedSkillItems.map((item) => {
                                          const checked = isSkillSelected(
                                            item.domainId,
                                            item.skill
                                          );
                                          return (
                                            <button
                                              key={`${item.domainId}-${item.skill}`}
                                              type="button"
                                              onClick={() =>
                                                toggleSkill(item.domainId, item.skill)
                                              }
                                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                                                checked
                                                  ? 'bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-100 font-medium'
                                                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                                              }`}
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                {checked ? (
                                                  <CheckSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                                ) : (
                                                  <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                )}
                                                <span className="truncate">{item.skill}</span>
                                              </div>
                                              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 shrink-0">
                                                {item.domainId}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>

                                      {drillSuggestions.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                            Quick Sets:
                                          </span>
                                          {drillSuggestions.slice(0, 3).map((sug) => (
                                            <button
                                              key={sug.id}
                                              type="button"
                                              onClick={() => onApplySuggestion(sug)}
                                              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-indigo-500 transition-colors"
                                            >
                                              {sug.title} ({sug.suggestedLength} Qs)
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* 8 Standard SAT Domain Dropdown Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {SAT_DOMAINS.map((dom) => {
                                const domainSelected = config.selectedDomains.includes(
                                  dom.id
                                );
                                const isDomOpen =
                                  expandedDomains[dom.id] ?? !isMobileViewport();

                                return (
                                  <div
                                    key={dom.id}
                                    className={`rounded-xl border p-3.5 transition-colors ${
                                      domainSelected
                                        ? 'border-indigo-500/60 bg-white dark:bg-slate-900'
                                        : 'border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => toggleDomain(dom.id)}
                                        className="flex items-center gap-2 text-left min-w-0"
                                      >
                                        {domainSelected ? (
                                          <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                        ) : (
                                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                        )}
                                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                          {dom.name} ({dom.id})
                                        </span>
                                      </button>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                          {dom.section === 'reading_writing' ? 'R&W' : 'Math'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            triggerHaptic('menu_toggle');
                                            setExpandedDomains((prev) => ({
                                              ...prev,
                                              [dom.id]: !isDomOpen,
                                            }));
                                          }}
                                          aria-label={`Toggle ${dom.name} skills`}
                                          className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                        >
                                          <motion.div
                                            animate={{ rotate: isDomOpen ? 180 : 0 }}
                                            transition={{ duration: 0.18 }}
                                          >
                                            <ChevronDown className="w-3.5 h-3.5" />
                                          </motion.div>
                                        </button>
                                      </div>
                                    </div>

                                    <AnimatePresence initial={false}>
                                      {isDomOpen && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.2 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="pl-6 pt-2 space-y-1">
                                            {dom.skills.map((skill) => {
                                              const skillChecked = isSkillSelected(
                                                dom.id,
                                                skill
                                              );
                                              const isSuggested = suggestedSkillItems.some(
                                                (s) => s.skill === skill
                                              );
                                              return (
                                                <button
                                                  key={skill}
                                                  type="button"
                                                  onClick={() => toggleSkill(dom.id, skill)}
                                                  className="flex items-center justify-between gap-2 text-left text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 w-full py-0.5"
                                                >
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    <span
                                                      className={`w-2.5 h-2.5 rounded-xs border flex items-center justify-center shrink-0 ${
                                                        skillChecked
                                                          ? 'bg-indigo-600 border-indigo-600'
                                                          : 'border-slate-400'
                                                      }`}
                                                    />
                                                    <span className="truncate">{skill}</span>
                                                  </div>
                                                  {isSuggested && (
                                                    <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 shrink-0">
                                                      Suggested
                                                    </span>
                                                  )}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* RIGHT AREA (1/3 width): Session Settings & Start Button */}
                      <div className="space-y-4">
                        {card.id === 'mock' && (
                          <div className="rounded-xl border border-indigo-500/40 bg-white dark:bg-slate-900 p-4 space-y-1.5">
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              Total Exam Time
                            </div>
                            <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
                              {mockTimingInfo.formattedLarge}{' '}
                              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                                ({mockTimingInfo.totalMinutes} mins)
                              </span>
                            </div>
                            <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                              {mockTimingInfo.multLabel}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              {mockTimingInfo.moduleBreakdown}
                            </div>
                          </div>
                        )}

                        {/* Exclude Active Bluebook Practice Test Questions */}
                        <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 bg-white/90 dark:bg-slate-900/90">
                          <input
                            type="checkbox"
                            checked={config.excludeActivePracticeTests}
                            onChange={(e) =>
                              updateConfigWithOverrideCheck({
                                excludeActivePracticeTests: e.target.checked,
                              })
                            }
                            className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>Hide Active Practice Tests 1–6</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Saves official Bluebook practice test questions so you don&apos;t see them early.
                            </p>
                          </div>
                        </label>

                        {/* Difficulty Filter */}
                        {card.id !== 'mock' && (
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Difficulty
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                              {(
                                [
                                  { id: 'E', label: 'Easy' },
                                  { id: 'M', label: 'Medium' },
                                  { id: 'H', label: 'Hard' },
                                ] as const
                              ).map((d) => {
                                const active = config.difficulties.includes(d.id);
                                return (
                                  <button
                                    key={d.id}
                                    type="button"
                                    onClick={() => toggleDifficulty(d.id)}
                                    className={`py-1.5 px-2.5 text-xs font-semibold rounded-lg border transition-colors ${
                                      active
                                        ? 'border-indigo-500 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300'
                                        : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 text-slate-500'
                                    }`}
                                  >
                                    {d.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Drill Specific Controls */}
                        {card.id === 'drill' && (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Number of Questions
                              </span>
                              <div className="grid grid-cols-4 gap-2">
                                {[5, 8, 10, 15].map((len) => (
                                  <button
                                    key={len}
                                    type="button"
                                    onClick={() =>
                                      updateConfigWithOverrideCheck({ drillLength: len })
                                    }
                                    className={`py-1.5 text-xs font-mono font-semibold rounded-lg border ${
                                      config.drillLength === len
                                        ? 'border-indigo-500 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300'
                                        : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    {len} Qs
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Question Filter
                              </span>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateConfigWithOverrideCheck({
                                      questionPoolFilter: 'unanswered_only',
                                    })
                                  }
                                  className={`p-2 text-xs font-semibold rounded-lg border ${
                                    config.questionPoolFilter === 'unanswered_only'
                                      ? 'border-indigo-500 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300'
                                      : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  Unseen Only
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateConfigWithOverrideCheck({
                                      questionPoolFilter: 'any_questions',
                                    })
                                  }
                                  className={`p-2 text-xs font-semibold rounded-lg border ${
                                    config.questionPoolFilter === 'any_questions'
                                      ? 'border-indigo-500 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300'
                                      : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  All Questions
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Practice Mode Specific Controls */}
                        {card.id === 'practice' && (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Completed Questions
                              </span>
                              <div className="grid grid-cols-1 gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateConfigWithOverrideCheck({
                                      practiceCompletedBehavior: 'plain_run_through',
                                    })
                                  }
                                  className={`p-2.5 text-left text-xs font-semibold rounded-lg border ${
                                    config.practiceCompletedBehavior === 'plain_run_through'
                                      ? 'border-indigo-500 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300'
                                      : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  Include All Matching Questions
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateConfigWithOverrideCheck({
                                      practiceCompletedBehavior:
                                        'remove_completed_before_session',
                                    })
                                  }
                                  className={`p-2.5 text-left text-xs font-semibold rounded-lg border ${
                                    config.practiceCompletedBehavior ===
                                    'remove_completed_before_session'
                                      ? 'border-indigo-500 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300'
                                      : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  Skip Previously Completed Questions
                                </button>
                              </div>
                            </div>

                            <label className="block space-y-1">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Start at Question # (1 to{' '}
                                {Math.max(1, poolCalc.selectedQuestions.length)})
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={Math.max(1, poolCalc.selectedQuestions.length)}
                                value={config.startAtQuestionNumber || 1}
                                onChange={(e) =>
                                  updateConfigWithOverrideCheck({
                                    startAtQuestionNumber: Math.max(
                                      1,
                                      Number(e.target.value) || 1
                                    ),
                                  })
                                }
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                              />
                            </label>
                          </div>
                        )}

                        {/* Unseen Pool Exhaustion Notice */}
                        {poolCalc.exhaustionMessage && (
                          <div className="rounded-xl border border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/40 p-3.5 space-y-2">
                            <div className="flex items-start gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>Running Low on Unseen Questions</span>
                            </div>
                            <p className="text-[11px] text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                              {poolCalc.exhaustionMessage}
                            </p>
                            <label className="flex items-center gap-2 text-xs font-semibold text-amber-950 dark:text-amber-100 cursor-pointer pt-1">
                              <input
                                type="checkbox"
                                checked={config.allowPoolExhaustionFallback}
                                onChange={(e) =>
                                  onChangeConfig({
                                    ...config,
                                    allowPoolExhaustionFallback: e.target.checked,
                                  })
                                }
                                className="rounded border-amber-500 text-amber-600"
                              />
                              <span>
                                Include previously answered questions
                              </span>
                            </label>
                          </div>
                        )}

                        {/* Ready Session Pool + Start Action Button */}
                        <div className="pt-2 space-y-2.5">
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span>Questions Ready:</span>
                            <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                              {poolCalc.selectedQuestions.length} Questions
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={poolCalc.selectedQuestions.length === 0}
                            onClick={() => {
                              triggerHaptic('start_test');
                              onStartSession(poolCalc.selectedQuestions, {
                                ...config,
                                mode: card.id,
                              });
                            }}
                            className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 min-h-[44px] text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shadow-sm transition-colors cursor-pointer"
                          >
                            <Play className="w-4 h-4" />
                            {card.id === 'mock'
                              ? 'Start Timed Mock Exam'
                              : card.id === 'drill'
                              ? 'Start Quick Drill'
                              : 'Start Practice'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* Card 4: Compressed Single-Row "Search by Question ID" Card */}
        <motion.div
          layout
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className={`rounded-2xl border px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-200 ${
            trimmedSearchId.length > 0
              ? 'border-indigo-500/80 bg-indigo-50/70 dark:bg-indigo-950/35 ring-1 ring-indigo-500/40'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Search className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-display">
                Search by Question ID
              </span>
              <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400 ml-2.5">
                Look up any question by its ID without affecting your score
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:w-auto w-full justify-end">
            <div className="relative flex-1 sm:w-64 sm:flex-initial">
              <input
                type="text"
                value={config.searchQuestionId || ''}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    searchQuestionId: e.target.value,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && trimmedSearchId.length > 0) {
                    handleLaunchIdSearch();
                  }
                }}
                placeholder="Question ID (e.g. b8c322b1)..."
                aria-label="Enter Question ID"
                className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <AnimatePresence initial={false}>
              {trimmedSearchId.length > 0 && (
                <motion.button
                  key="morph-start-id-btn"
                  type="button"
                  initial={{ width: 0, opacity: 0, scale: 0.85 }}
                  animate={{ width: 'auto', opacity: 1, scale: 1 }}
                  exit={{ width: 0, opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  onClick={handleLaunchIdSearch}
                  className="overflow-hidden inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 shrink-0" />
                  <span>Start</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  InProgressSession,
  QuestionAttempt,
  SATQuestion,
  TestSession,
  TestStartConfig,
} from '../types';
import { formatMathHtml } from '../utils/formatMathHtml';
import { triggerHaptic } from '../utils/haptics';
import {
  applySprKeypadKey,
  buildMockExamModules,
  eliminateMcqChoice,
  formatSprPreviewParts,
  getBreakScreenState,
  getQuestionTileState,
  getScheduledBreakDurationSeconds,
  sanitizeSprAnswer,
  selectMcqChoice,
  shouldTriggerScheduledBreakAfterModule,
  shouldUseSingleColumnLayout,
  SprKeypadKey,
  undoEliminateMcqChoice,
} from '../utils/bluebookRules';
import { AsterOrbLogo } from './AsterOrbLogo';
import { BluebookCalculatorModal } from './BluebookCalculatorModal';
import { BluebookReferenceModal } from './BluebookReferenceModal';
import { BluebookNotesModal } from './BluebookNotesModal';
import {
  Bookmark,
  Calculator,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  AlertCircle,
  Send,
  MoreVertical,
  HelpCircle,
  Keyboard,
  Wand2,
  ScanLine,
  LogOut,
  MapPin,
  Delete,
  GripHorizontal,
  FileText,
  PauseCircle,
} from 'lucide-react';

interface BluebookTestingScreenProps {
  questions: SATQuestion[];
  config: TestStartConfig;
  studentName: string;
  previouslyCompletedIds: Set<string>;
  starredQuestionIds: Set<string>;
  onToggleStarQuestion: (questionId: string) => void;
  onCompleteSession: (session: TestSession) => void;
  onSaveAndExit: (inProgress: InProgressSession) => void;
  onSyncProgress?: (inProgress: InProgressSession) => void;
  initialSession?: InProgressSession | null;
  onExitWithoutSaving: () => void;
}

export const BluebookTestingScreen: React.FC<BluebookTestingScreenProps> = ({
  questions: initialQuestions,
  config,
  studentName,
  previouslyCompletedIds,
  starredQuestionIds,
  onToggleStarQuestion,
  onCompleteSession,
  onSaveAndExit,
  onSyncProgress,
  initialSession,
  onExitWithoutSaving,
}) => {
  const [hidePreviouslyCompleted, setHidePreviouslyCompleted] = useState(
    config.practiceCompletedBehavior === 'remove_completed_before_session'
  );

  const visibleQuestions = useMemo(() => {
    if (config.mode === 'practice' && hidePreviouslyCompleted) {
      const filtered = initialQuestions.filter(
        (q) => !previouslyCompletedIds.has(q.id)
      );
      return filtered.length > 0 ? filtered : initialQuestions;
    }
    return initialQuestions;
  }, [
    initialQuestions,
    config.mode,
    hidePreviouslyCompleted,
    previouslyCompletedIds,
  ]);

  const mockModules = useMemo(
    () => buildMockExamModules(visibleQuestions, config),
    [visibleQuestions, config]
  );

  const [currentModuleIndex, setCurrentModuleIndex] = useState<number>(() => {
    if (
      initialSession &&
      typeof initialSession.currentModuleIndex === 'number'
    ) {
      return Math.max(
        0,
        Math.min(mockModules.length - 1, initialSession.currentModuleIndex)
      );
    }
    return 0;
  });

  const [isOnBreak, setIsOnBreak] = useState<boolean>(() =>
    Boolean(initialSession?.isOnBreak)
  );
  const [breakIsAsNeeded, setBreakIsAsNeeded] = useState<boolean>(() =>
    Boolean(initialSession?.breakIsAsNeeded)
  );
  const [breakRemainingSeconds, setBreakRemainingSeconds] = useState<number>(
    () =>
      initialSession && typeof initialSession.breakRemainingSeconds === 'number'
        ? initialSession.breakRemainingSeconds
        : getScheduledBreakDurationSeconds(config.accommodations)
  );
  const breakRemainingRef = useRef<number>(breakRemainingSeconds);
  breakRemainingRef.current = breakRemainingSeconds;

  const [nextModuleRemainingSeconds, setNextModuleRemainingSeconds] =
    useState<number>(() => {
      if (
        initialSession &&
        typeof initialSession.nextModuleRemainingSeconds === 'number'
      ) {
        return initialSession.nextModuleRemainingSeconds;
      }
      const nextMod =
        mockModules[(initialSession?.currentModuleIndex ?? 0) + 1];
      return nextMod?.durationSeconds ?? 1920;
    });
  const [showEarlyBreakEndModal, setShowEarlyBreakEndModal] =
    useState<boolean>(false);

  const activeMockModule = mockModules[currentModuleIndex] || mockModules[0];

  const moduleQuestions = useMemo(() => {
    if (config.mode === 'mock' && activeMockModule) {
      return activeMockModule.questions;
    }
    return visibleQuestions;
  }, [config.mode, activeMockModule, visibleQuestions]);

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (initialSession && typeof initialSession.currentIndex === 'number') {
      return Math.max(
        0,
        Math.min(moduleQuestions.length - 1, initialSession.currentIndex)
      );
    }
    if (config.mode === 'practice' && config.startAtQuestionNumber) {
      return Math.max(
        0,
        Math.min(moduleQuestions.length - 1, config.startAtQuestionNumber - 1)
      );
    }
    return 0;
  });

  const currentQuestion =
    moduleQuestions[currentIndex] ||
    moduleQuestions[0] ||
    visibleQuestions[0];

  const [answers, setAnswers] = useState<Record<string, string>>(
    () => initialSession?.answers || {}
  );
  const [submittedQuestionIds, setSubmittedQuestionIds] = useState<Set<string>>(
    () => new Set(initialSession?.submittedQuestionIds || [])
  );
  const [usedAiBeforeSubmitIds, setUsedAiBeforeSubmitIds] = useState<
    Set<string>
  >(() => new Set(initialSession?.usedAiBeforeSubmitIds || []));
  const [eliminatedMap, setEliminatedMap] = useState<Record<string, string[]>>(
    () => initialSession?.eliminatedMap || {}
  );
  const [annotationsMap, setAnnotationsMap] = useState<Record<string, string>>(
    () => initialSession?.annotationsMap || {}
  );
  const [timeSpentMap, setTimeSpentMap] = useState<Record<string, number>>(
    () => initialSession?.timeSpentMap || {}
  );

  // Bluebook chrome & interactive tool states
  const [showDirections, setShowDirections] = useState(false);
  const [hideTimer, setHideTimer] = useState(false);
  const [eliminatorActive, setEliminatorActive] = useState(true);
  const [showAbcTooltip, setShowAbcTooltip] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showReferenceSheet, setShowReferenceSheet] = useState(false);
  const [showAnnotateBox, setShowAnnotateBox] = useState(false);
  const [lineReaderActive, setLineReaderActive] = useState(
    config.accommodations.lineReaderDefault
  );
  const [lineReaderY, setLineReaderY] = useState(280);
  const [largeZoom, setLargeZoom] = useState(
    config.accommodations.largeTextZoom
  );

  // Question Selector Popover & Review Page states (00:13-00:15, 00:29-00:32)
  const [showQuestionNavigator, setShowQuestionNavigator] = useState(false);
  const [showReviewPage, setShowReviewPage] = useState(false);
  const [jumpToNumberInput, setJumpToNumberInput] = useState('1');

  // Top-right "More" menu & modals (00:56 - 00:58)
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSaveAndExitModal, setShowSaveAndExitModal] = useState(false);
  const [activeInfoModal, setActiveInfoModal] = useState<
    'help' | 'shortcuts' | 'assistive' | null
  >(null);

  // Draggable On-Screen SPR Keypad (00:06 - 00:12)
  const [showSprKeypad, setShowSprKeypad] = useState(false);
  const [keypadPos, setKeypadPos] = useState({ x: 880, y: 260 });
  const draggingKeypadRef = useRef(false);
  const keypadDragOffsetRef = useRef({ x: 0, y: 0 });

  // Split pane width percentage on desktop
  const [leftPanePct, setLeftPanePct] = useState(50);
  const isDraggingDivider = useRef(false);

  // In-Exam AI Tutor Drawer (available in Practice & Drill modes)
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [aiMessages, setAiMessages] = useState<
    Record<string, { role: 'user' | 'assistant'; text: string }[]>
  >({});
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const initialSeconds = useMemo(() => {
    if (initialSession && typeof initialSession.remainingSeconds === 'number') {
      return initialSession.remainingSeconds;
    }
    if (config.mode === 'mock' && activeMockModule) {
      return activeMockModule.durationSeconds;
    }
    const baseSec =
      config.mode === 'drill' ? visibleQuestions.length * 75 : 2650;
    return Math.round(baseSec);
  }, [
    initialSession,
    config.mode,
    activeMockModule,
    visibleQuestions.length,
  ]);

  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timeExpiredModal, setTimeExpiredModal] = useState(false);
  const [fiveMinAlertShown, setFiveMinAlertShown] = useState(false);
  const [showFiveMinBanner, setShowFiveMinBanner] = useState(false);
  const sessionStartedAt = useRef(
    initialSession?.startedAt || new Date().toISOString()
  );
  const sessionIdRef = useRef(initialSession?.id || `inprog-${Date.now()}`);

  const sessionTitle = useMemo(() => {
    if (initialSession?.title) return initialSession.title;
    if (config.mode === 'mock') {
      const secLabel =
        config.mockSections === 'reading_writing'
          ? 'Reading & Writing'
          : config.mockSections === 'math'
          ? 'Math'
          : 'Full Exam';
      return `SAT Practice Test (${secLabel})`;
    }
    if (config.mode === 'drill') {
      return (
        config.prefilledSuggestionTitle ||
        `Quick Drill (${visibleQuestions.length} Questions)`
      );
    }
    if (config.mode === 'id_search') {
      return `Question Lookup (${currentQuestion?.id || ''})`;
    }
    return `Practice Session (${visibleQuestions.length} Questions)`;
  }, [
    initialSession?.title,
    config.mode,
    config.mockSections,
    config.prefilledSuggestionTitle,
    visibleQuestions.length,
    currentQuestion?.id,
  ]);

  const buildSnapshot = (): InProgressSession => ({
    id: sessionIdRef.current,
    title: sessionTitle,
    mode: config.mode,
    startedAt: sessionStartedAt.current,
    savedAt: new Date().toISOString(),
    config,
    questions: visibleQuestions,
    currentIndex,
    currentModuleIndex,
    isOnBreak,
    breakRemainingSeconds,
    nextModuleRemainingSeconds,
    breakIsAsNeeded,
    answers,
    submittedQuestionIds: Array.from(submittedQuestionIds),
    usedAiBeforeSubmitIds: Array.from(usedAiBeforeSubmitIds),
    eliminatedMap,
    annotationsMap,
    timeSpentMap,
    remainingSeconds,
  });

  // Sync live progress to App.tsx
  useEffect(() => {
    if (!onSyncProgress || config.mode === 'id_search') return;
    onSyncProgress(buildSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentIndex,
    currentModuleIndex,
    isOnBreak,
    breakRemainingSeconds,
    nextModuleRemainingSeconds,
    breakIsAsNeeded,
    answers,
    submittedQuestionIds,
    usedAiBeforeSubmitIds,
    eliminatedMap,
    annotationsMap,
    remainingSeconds,
  ]);

  // Countdown (mock), Suggested Break + Next-Section Auto-Start countdown, & Elapsed (drill) timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (config.mode === 'mock' && isOnBreak) {
        if (!breakIsAsNeeded) {
          if (breakRemainingRef.current > 0) {
            const nextBreakSec = Math.max(0, breakRemainingRef.current - 1);
            breakRemainingRef.current = nextBreakSec;
            setBreakRemainingSeconds(nextBreakSec);
          } else {
            setNextModuleRemainingSeconds((prev) => Math.max(0, prev - 1));
          }
        }
        return;
      }

      if (currentQuestion) {
        setTimeSpentMap((prev) => ({
          ...prev,
          [currentQuestion.id]: (prev[currentQuestion.id] || 0) + 1,
        }));
      }

      if (config.mode === 'drill') {
        setElapsedSeconds((prev) => prev + 1);
      } else if (config.mode === 'mock') {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            setTimeExpiredModal(true);
            return 0;
          }
          const next = prev - 1;
          if (next === 300 && !fiveMinAlertShown) {
            setFiveMinAlertShown(true);
            setShowFiveMinBanner(true);
          }
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [
    currentQuestion,
    fiveMinAlertShown,
    config.mode,
    isOnBreak,
    breakIsAsNeeded,
  ]);

  // Handle mouse drag for split-pane resizer and draggable SPR Keypad
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isDraggingDivider.current) {
        const pct = Math.max(
          28,
          Math.min(72, (e.clientX / window.innerWidth) * 100)
        );
        setLeftPanePct(pct);
      }
      if (draggingKeypadRef.current) {
        const nextX = Math.max(
          8,
          Math.min(
            window.innerWidth - 260,
            e.clientX - keypadDragOffsetRef.current.x
          )
        );
        const nextY = Math.max(
          56,
          Math.min(
            window.innerHeight - 240,
            e.clientY - keypadDragOffsetRef.current.y
          )
        );
        setKeypadPos({ x: nextX, y: nextY });
      }
    };
    const onUp = () => {
      isDraggingDivider.current = false;
      draggingKeypadRef.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (!currentQuestion) {
    return null;
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // SPR Input & Keypad handlers (enforces 5/6 character rule)
  const handleSprInputChange = (rawVal: string) => {
    const sanitized = sanitizeSprAnswer(rawVal);
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: sanitized }));
  };

  const handleSprKeypadPress = (key: SprKeypadKey) => {
    const currentVal = answers[currentQuestion.id] || '';
    const nextVal = applySprKeypadKey(currentVal, key);
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: nextVal }));
  };

  // MCQ Selection, Elimination (clears answer if selected!), & Undo handlers (00:18 - 00:26)
  const handleSelectMcqChoice = (choiceId: string) => {
    const currentSelected = answers[currentQuestion.id] || '';
    const currentEliminated = eliminatedMap[currentQuestion.id] || [];
    const nextState = selectMcqChoice(
      currentSelected,
      currentEliminated,
      choiceId
    );
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: nextState.selectedAnswer,
    }));
    setEliminatedMap((prev) => ({
      ...prev,
      [currentQuestion.id]: nextState.eliminatedChoices,
    }));
  };

  const handleEliminateMcqChoice = (choiceId: string) => {
    const currentSelected = answers[currentQuestion.id] || '';
    const currentEliminated = eliminatedMap[currentQuestion.id] || [];
    const nextState = eliminateMcqChoice(
      currentSelected,
      currentEliminated,
      choiceId
    );
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: nextState.selectedAnswer,
    }));
    setEliminatedMap((prev) => ({
      ...prev,
      [currentQuestion.id]: nextState.eliminatedChoices,
    }));
  };

  const handleUndoEliminateMcqChoice = (choiceId: string) => {
    const currentSelected = answers[currentQuestion.id] || '';
    const currentEliminated = eliminatedMap[currentQuestion.id] || [];
    const nextState = undoEliminateMcqChoice(
      currentSelected,
      currentEliminated,
      choiceId
    );
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: nextState.selectedAnswer,
    }));
    setEliminatedMap((prev) => ({
      ...prev,
      [currentQuestion.id]: nextState.eliminatedChoices,
    }));
  };

  const handleCheckOrSubmitCurrentQuestion = () => {
    setSubmittedQuestionIds((prev) => {
      const next = new Set(prev);
      next.add(currentQuestion.id);
      return next;
    });
  };

  const handleOpenAiDrawerForQuestion = async (customPrompt?: string) => {
    if (config.mode !== 'practice' && config.mode !== 'drill') return;

    if (!submittedQuestionIds.has(currentQuestion.id)) {
      setUsedAiBeforeSubmitIds((prev) => {
        const next = new Set(prev);
        next.add(currentQuestion.id);
        return next;
      });
    }

    setShowAiDrawer(true);
    const qId = currentQuestion.id;
    const existingThread = aiMessages[qId] || [];

    if (existingThread.length === 0 || customPrompt) {
      const userPrompt =
        customPrompt ||
        `Walk me through the strategy for Question ${qId} (${currentQuestion.domainName} — ${currentQuestion.skill}).`;

      const nextThread = [
        ...existingThread,
        { role: 'user' as const, text: userPrompt },
      ];
      setAiMessages((prev) => ({ ...prev, [qId]: nextThread }));
      setAiLoading(true);

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userPrompt,
            history: existingThread.map((m) => ({
              role: m.role,
              content: m.text,
            })),
            rolePersona: 'concept_tutor',
            modelTier: 'general',
            linkedQuestion: currentQuestion,
            allowAiSettingsAccess: false,
          }),
        });
        const data = await res.json();
        const baseReply =
          data?.text ||
          currentQuestion.rationaleHtml.replace(/<[^>]+>/g, '') ||
          'Check the main relationship in the question stem and rule out choices that add extra assumptions.';
        const reply = data?.fallbackNotice
          ? `[${data.fallbackNotice}]\n\n${baseReply}`
          : baseReply;

        setAiMessages((prev) => ({
          ...prev,
          [qId]: [...nextThread, { role: 'assistant', text: reply }],
        }));
      } catch {
        const fallback = currentQuestion.rationaleHtml.replace(/<[^>]+>/g, '');
        setAiMessages((prev) => ({
          ...prev,
          [qId]: [
            ...nextThread,
            {
              role: 'assistant',
              text: `Explanation: ${fallback}`,
            },
          ],
        }));
      } finally {
        setAiLoading(false);
      }
    }
  };

  const handleFinishAndSaveSession = () => {
    const nowIso = new Date().toISOString();
    const attempts: QuestionAttempt[] = visibleQuestions.map((q) => {
      const selected = (answers[q.id] ?? '').trim();
      const isCorrect =
        selected.toLowerCase() === q.correctAnswer.trim().toLowerCase();
      const usedAi = usedAiBeforeSubmitIds.has(q.id);
      const isRepeat = previouslyCompletedIds.has(q.id);
      const countsTowardDiagnostics =
        config.mode !== 'id_search' &&
        selected !== '' &&
        !usedAi &&
        !isRepeat;

      return {
        questionId: q.id,
        sessionId: `sess-${Date.now()}`,
        timestamp: nowIso,
        mode: config.mode,
        section: q.section,
        domain: q.domain,
        skill: q.skill,
        difficulty: q.difficulty,
        irtDifficulty: q.irtDifficulty,
        selectedAnswer: selected || 'UNANSWERED',
        isCorrect,
        timeSpentSec: timeSpentMap[q.id] || 15,
        usedAiBeforeSubmit: usedAi,
        isRepeatAttempt: isRepeat,
        countsTowardDiagnostics,
        eliminatedChoices: eliminatedMap[q.id],
        highlightNotes: annotationsMap[q.id],
      };
    });

    const rwAttempts = attempts.filter((a) => a.section === 'reading_writing');
    const mathAttempts = attempts.filter((a) => a.section === 'math');

    const rwAcc =
      rwAttempts.length > 0
        ? rwAttempts.filter((a) => a.isCorrect).length / rwAttempts.length
        : 0.72;
    const mathAcc =
      mathAttempts.length > 0
        ? mathAttempts.filter((a) => a.isCorrect).length / mathAttempts.length
        : 0.75;

    const rwScaled = Math.round((240 + rwAcc * 560) / 10) * 10;
    const mathScaled = Math.round((240 + mathAcc * 560) / 10) * 10;

    const session: TestSession = {
      id: `sess-${Date.now()}`,
      title: sessionTitle,
      mode: config.mode,
      startedAt: sessionStartedAt.current,
      completedAt: nowIso,
      config,
      questionIds: visibleQuestions.map((q) => q.id),
      attempts,
      annotationsMap,
      scaledScore: {
        total: rwScaled + mathScaled,
        rw: rwScaled,
        math: mathScaled,
        rwModule2Tier: rwAcc >= 0.62 ? 'harder' : 'easier',
        mathModule2Tier: mathAcc >= 0.62 ? 'harder' : 'easier',
      },
      includedInDiagnostics: config.mode !== 'id_search',
    };

    onCompleteSession(session);
  };

  const advanceToNextModule = (useRunningNextModuleTimer = false) => {
    triggerHaptic('module_transition');
    const nextModIdx = currentModuleIndex + 1;
    if (nextModIdx >= mockModules.length) {
      setShowEarlyBreakEndModal(false);
      setIsOnBreak(false);
      setBreakIsAsNeeded(false);
      handleFinishAndSaveSession();
      return;
    }
    const nextMod = mockModules[nextModIdx];
    const targetDuration =
      useRunningNextModuleTimer && nextModuleRemainingSeconds > 0
        ? nextModuleRemainingSeconds
        : nextMod.durationSeconds;
    setCurrentModuleIndex(nextModIdx);
    setCurrentIndex(0);
    setRemainingSeconds(targetDuration);
    setFiveMinAlertShown(false);
    setShowFiveMinBanner(false);
    setShowReviewPage(false);
    setShowQuestionNavigator(false);
    setTimeExpiredModal(false);
    setShowEarlyBreakEndModal(false);
    setIsOnBreak(false);
    setBreakIsAsNeeded(false);
  };

  const handleCompleteCurrentModule = () => {
    triggerHaptic('module_transition');
    if (
      config.mode !== 'mock' ||
      currentModuleIndex >= mockModules.length - 1
    ) {
      handleFinishAndSaveSession();
      return;
    }

    const shouldBreak = shouldTriggerScheduledBreakAfterModule(
      currentModuleIndex,
      mockModules.length,
      config.accommodations.extraBreaks
    );

    if (shouldBreak) {
      const nextMod = mockModules[currentModuleIndex + 1];
      const scheduledBreakSec = getScheduledBreakDurationSeconds(
        config.accommodations
      );
      setShowReviewPage(false);
      setShowQuestionNavigator(false);
      setTimeExpiredModal(false);
      setShowEarlyBreakEndModal(false);
      setBreakIsAsNeeded(false);
      breakRemainingRef.current = scheduledBreakSec;
      setBreakRemainingSeconds(scheduledBreakSec);
      setNextModuleRemainingSeconds(nextMod?.durationSeconds ?? 1920);
      setIsOnBreak(true);
    } else {
      advanceToNextModule(false);
    }
  };

  const isStarred = starredQuestionIds.has(currentQuestion.id);
  const isCurrentSubmitted = submittedQuestionIds.has(currentQuestion.id);
  const currentAnswer = answers[currentQuestion.id] || '';
  const currentEliminated = eliminatedMap[currentQuestion.id] || [];
  const currentUsedAiBeforeSubmit = usedAiBeforeSubmitIds.has(
    currentQuestion.id
  );
  const sprPreview = formatSprPreviewParts(currentAnswer);
  const isSingleColumn = shouldUseSingleColumnLayout(currentQuestion);

  const fallbackModuleNumber =
    currentIndex >= Math.ceil(moduleQuestions.length / 2) &&
    moduleQuestions.length > 10
      ? 2
      : 1;

  const sectionHeaderTitle =
    config.mode === 'mock' && activeMockModule
      ? activeMockModule.headerTitle
      : currentQuestion.section === 'reading_writing'
      ? `Section 1, Module ${fallbackModuleNumber}: Reading and Writing`
      : `Section 2, Module ${fallbackModuleNumber}: Math`;

  const selectorModalTitle =
    config.mode === 'mock' && activeMockModule
      ? activeMockModule.selectorTitle
      : currentQuestion.section === 'reading_writing'
      ? `Section 1, Module ${fallbackModuleNumber}: Reading and Writing Questions`
      : `Section 2, Module ${fallbackModuleNumber}: Math Questions`;

  const containerLayoutClass =
    config.mode === 'mock'
      ? 'fixed inset-0 z-40 flex flex-col'
      : 'min-h-[calc(100vh-4.25rem)] flex flex-col rounded-2xl border-2 border-[#D6CBB9] dark:border-slate-800 overflow-hidden mb-6 shadow-md';

  // Reusable Question Header Strip (1 | Mark for Review ... [ABC] + dashed line)
  const renderQuestionHeaderStrip = () => (
    <div className="space-y-0">
      <div className="flex items-center justify-between bg-[#EFE9DD] dark:bg-slate-900 px-2.5 py-1.5 rounded-t-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center min-w-7 h-7 px-1.5 bg-[#1E1B18] dark:bg-slate-100 text-white dark:text-slate-950 font-sans text-sm font-bold">
            {currentIndex + 1}
          </span>

          <button
            type="button"
            onClick={() => onToggleStarQuestion(currentQuestion.id)}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-stone-800 dark:text-slate-200 hover:text-stone-950 dark:hover:text-white cursor-pointer"
          >
            <Bookmark
              className={`w-4 h-4 transition-colors ${
                isStarred
                  ? 'text-[#C81E1E] fill-[#C81E1E]'
                  : 'text-stone-700 dark:text-slate-300'
              }`}
            />
            <span className={isStarred ? 'font-bold text-stone-900 dark:text-white' : ''}>
              {isStarred ? 'Marked for Review' : 'Mark for Review'}
            </span>
          </button>
        </div>

        {currentQuestion.type === 'mcq' && (
          <div className="relative">
            {showAbcTooltip && (
              <div
                role="tooltip"
                className="absolute bottom-full right-0 mb-2 w-48 rounded-lg bg-[#1E1E1E] text-white text-[11px] font-medium px-3 py-2 text-center shadow-lg pointer-events-none z-30 leading-snug"
              >
                Cross out answer choices you think are wrong.
                <div className="absolute top-full right-3 -mt-1 border-4 border-transparent border-t-[#1E1E1E]" />
              </div>
            )}
            <button
              type="button"
              onClick={() => setEliminatorActive((prev) => !prev)}
              onMouseEnter={() => setShowAbcTooltip(true)}
              onMouseLeave={() => setShowAbcTooltip(false)}
              aria-label="Cross out answer choices you think are wrong"
              aria-pressed={eliminatorActive}
              className={`relative inline-flex items-center justify-center px-2 py-0.5 text-xs font-mono font-bold rounded border-[1.5px] transition-all cursor-pointer ${
                eliminatorActive
                  ? 'border-[#1E1B18] bg-[#1E1B18] text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-950'
                  : 'border-stone-700 bg-white text-stone-900 hover:bg-stone-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              <span className="relative">
                ABC
                <span className="aistudio-abc-slash absolute left-[-2px] right-[-2px] top-1/2 h-[1.5px] bg-current -rotate-12" />
              </span>
            </button>
          </div>
        )}
      </div>
      <div className="bluebook-question-dashed-line" />
    </div>
  );

  // Reusable Question Stem + SPR / MCQ Interactive Body
  const renderQuestionInteractiveBody = () => (
    <div className="space-y-5 pt-3">
      {/* AI Flag Notice if AI was used prior to submitting */}
      {currentUsedAiBeforeSubmit && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            You used Aster AI before submitting this question, so it won&apos;t
            count toward your score estimate.
          </span>
        </div>
      )}

      {/* Question Stem */}
      <div
        className="font-passage text-stone-900 dark:text-slate-100 leading-relaxed space-y-2.5 text-[16px]"
        dangerouslySetInnerHTML={{
          __html: formatMathHtml(currentQuestion.stemHtml),
        }}
      />

      {/* MCQ Choices OR SPR Input + Answer Preview + Show Keypad */}
      {currentQuestion.type === 'mcq' && currentQuestion.choices ? (
        <div className="space-y-3 pt-1">
          {currentQuestion.choices.map((choice) => {
            const isSelected = currentAnswer === choice.id;
            const isEliminated = currentEliminated.includes(choice.id);

            return (
              <div key={choice.id} className="flex items-center gap-3">
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => handleSelectMcqChoice(choice.id)}
                    className={`w-full flex items-center gap-3.5 text-left rounded-lg border px-4 py-3.5 transition-all cursor-pointer ${
                      isEliminated
                        ? 'opacity-45 border-stone-400 dark:border-slate-700 bg-[#F7F3EB] dark:bg-slate-900'
                        : isSelected
                        ? 'border-2 border-[#1D4ED8] dark:border-blue-400 bg-white dark:bg-slate-900 ring-2 ring-[#1D4ED8]/15 shadow-xs'
                        : 'border-stone-500 dark:border-slate-700 hover:bg-[#F3EDE1] dark:hover:bg-slate-800/70 bg-[#FCF9F4] dark:bg-slate-900'
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full border-[1.5px] font-sans text-xs font-bold shrink-0 transition-colors ${
                        isSelected && !isEliminated
                          ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                          : 'border-stone-700 dark:border-slate-400 text-stone-800 dark:text-slate-200'
                      }`}
                    >
                      {choice.id}
                    </span>
                    <span
                      className="font-passage text-[15px] leading-relaxed text-stone-900 dark:text-slate-100"
                      dangerouslySetInnerHTML={{
                        __html: formatMathHtml(choice.text),
                      }}
                    />
                  </button>

                  {/* Full-width horizontal strikethrough bar when choice is eliminated (00:22 in video) */}
                  {isEliminated && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[2px] bg-stone-900 dark:bg-slate-200"
                    />
                  )}
                </div>

                {/* Right-side Eliminate Circle OR Underlined "Undo" Button (00:18 - 00:26) */}
                {eliminatorActive && (
                  <div className="w-12 flex items-center justify-center shrink-0">
                    {isEliminated ? (
                      <button
                        type="button"
                        onClick={() => handleUndoEliminateMcqChoice(choice.id)}
                        aria-label={`Undo eliminating choice ${choice.id}`}
                        className="text-xs font-bold text-stone-900 dark:text-slate-100 underline hover:text-[#1D4ED8] cursor-pointer"
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEliminateMcqChoice(choice.id)}
                        aria-label={`Eliminate choice ${choice.id}`}
                        title={`Cross out choice ${choice.id}`}
                        className="relative w-6 h-6 rounded-full border border-stone-600 dark:border-slate-400 text-[11px] font-bold text-stone-700 dark:text-slate-300 hover:bg-stone-200 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                      >
                        <span>{choice.id}</span>
                        <span className="absolute left-[-3px] right-[-3px] top-1/2 h-[1.5px] bg-stone-800 dark:bg-slate-200" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* STUDENT-PRODUCED RESPONSE (SPR) INPUT, LIVE PREVIEW & SHOW KEYPAD (00:00 - 00:13) */
        <div className="space-y-5 pt-2">
          <div>
            <input
              type="text"
              value={currentAnswer}
              onChange={(e) => handleSprInputChange(e.target.value)}
              aria-label="Student-produced response answer"
              maxLength={currentAnswer.startsWith('-') ? 6 : 5}
              className="w-40 h-12 rounded-md border-[1.5px] border-stone-600 dark:border-slate-500 bg-white dark:bg-slate-900 px-3.5 text-lg font-sans text-stone-900 dark:text-slate-100 focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-3 text-base">
            <span className="font-bold text-stone-900 dark:text-slate-100">
              Answer Preview:
            </span>
            {!sprPreview.isEmpty && (
              <span
                className="font-passage text-lg font-medium text-stone-900 dark:text-slate-100 inline-flex items-center"
                style={{
                  fontFamily: "'Times New Roman', 'Source Serif 4', serif",
                }}
              >
                {sprPreview.isFraction ? (
                  <>
                    {sprPreview.isNegative && <span className="mr-0.5">−</span>}
                    <span className="inline-flex flex-col items-center justify-center align-middle text-sm leading-none">
                      <span className="border-b border-current px-1 pb-0.5">
                        {sprPreview.numerator}
                      </span>
                      <span className="px-1 pt-0.5">
                        {sprPreview.denominator}
                      </span>
                    </span>
                  </>
                ) : (
                  <span>{sprPreview.plainDisplay}</span>
                )}
              </span>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowSprKeypad((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-400 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-[#F3EDE1] dark:hover:bg-slate-800 text-xs font-semibold text-stone-800 dark:text-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              <span className="px-1.5 py-0.5 rounded border border-stone-500 font-mono text-[10px] font-bold leading-none">
                123
              </span>
              <span>{showSprKeypad ? 'Hide Keypad' : 'Show Keypad'}</span>
            </button>
          </div>
        </div>
      )}

      {/* In Practice / Drill / ID Search: Allow Checking Current Question or Asking Aster AI */}
      {config.mode !== 'mock' && (
        <div className="pt-4 border-t border-[#D6CBB9] dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={!currentAnswer}
              onClick={handleCheckOrSubmitCurrentQuestion}
              className="px-4 py-2 text-xs font-bold rounded-full border border-stone-800 bg-[#1E1B18] dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-40 shadow-xs hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              {isCurrentSubmitted ? 'Answer Checked' : 'Check Answer'}
            </button>

            {(config.mode === 'practice' || config.mode === 'drill') && (
              <button
                type="button"
                onClick={() => handleOpenAiDrawerForQuestion()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full border border-[#1B3152]/40 dark:border-indigo-700 bg-[#EFE9DD] dark:bg-slate-900 text-[#1B3152] dark:text-indigo-300 hover:bg-[#E5DEC9] transition-all cursor-pointer"
              >
                <AsterOrbLogo size={14} interactive={false} />
                <span>Ask Aster AI</span>
              </button>
            )}
          </div>

          {isCurrentSubmitted && (
            <div
              className={`rounded-xl border p-4 space-y-2 text-xs ${
                currentAnswer.trim().toLowerCase() ===
                currentQuestion.correctAnswer.trim().toLowerCase()
                  ? 'border-emerald-600/50 bg-emerald-50/70 dark:bg-emerald-950/25'
                  : 'border-rose-500/50 bg-rose-50/70 dark:bg-rose-950/25'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-slate-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  Correct Answer: {currentQuestion.correctAnswer} (Your Answer:{' '}
                  {currentAnswer})
                </span>
              </div>
              <div
                className="text-stone-700 dark:text-slate-300 leading-relaxed space-y-1 font-passage"
                dangerouslySetInnerHTML={{
                  __html: formatMathHtml(currentQuestion.rationaleHtml),
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Official Bluebook Dark Break Screen (Suggested Break Timer + Always-Visible Start Button + 9:00 Red Warning + 10:00 Next Section Timer Auto-Start + Early Stop Warning Modal)
  if (config.mode === 'mock' && isOnBreak) {
    const nextModule = mockModules[currentModuleIndex + 1];
    const totalBreakSeconds = getScheduledBreakDurationSeconds(
      config.accommodations
    );
    const breakScreenState = getBreakScreenState({
      breakIsAsNeeded,
      totalBreakSeconds,
      breakRemainingSeconds,
      nextModuleRemainingSeconds,
      currentSectionTitle: sectionHeaderTitle,
      nextModuleTitle: nextModule?.headerTitle || 'Next Module',
    });

    const handleRequestEndBreak = () => {
      if (breakIsAsNeeded) {
        setShowEarlyBreakEndModal(false);
        setIsOnBreak(false);
        setBreakIsAsNeeded(false);
        return;
      }
      if (breakScreenState.requiresEarlyStopWarning) {
        setShowEarlyBreakEndModal(true);
        return;
      }
      // Suggested break time (10:00) has finished and next section timer is already counting down
      advanceToNextModule(true);
    };

    return (
      <div className="fixed inset-0 z-50 bg-[#1D1D1D] text-white flex flex-col justify-between p-6 sm:p-10 select-none">
        {/* Top Row: Practice Test Break Status + Top-Right Skip Break Button */}
        <div className="flex items-center justify-between gap-4">
          <div
            className={`text-xs font-mono uppercase tracking-wider ${
              breakScreenState.isWarningRed ? 'text-rose-400 font-bold' : 'text-stone-400'
            }`}
          >
            {breakScreenState.topStatusText}
          </div>

          {!breakIsAsNeeded && (
            <button
              type="button"
              onClick={handleRequestEndBreak}
              className="px-3.5 py-1.5 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              Skip Break
            </button>
          )}
        </div>

        {/* Center Two-Column Bluebook Break Layout + Always-Visible Start / Resume Button */}
        <div className="max-w-4xl w-full mx-auto my-auto flex flex-col items-center gap-6">
          {/* Red Warning Alert Banner at 9:00 Elapsed (<= 1:00 left) and 10:00 Elapsed (Next Section Timer Running) */}
          {breakScreenState.warningBannerText && (
            <div
              role="alert"
              className="w-full rounded-xl border-2 border-rose-500 bg-rose-950/60 px-4 py-3 text-xs sm:text-sm font-bold text-rose-200 flex items-center gap-3 shadow-lg"
            >
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{breakScreenState.warningBannerText}</span>
            </div>
          )}

          <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
            {/* Left Column: Suggested Break Timer Box (Turns Red at 9:00; Switches to Next Section Timer at 10:00) + Always-Visible Start Button */}
            <div className="md:col-span-5 flex flex-col items-center justify-center space-y-5">
              {!breakIsAsNeeded && (
                <div
                  className={`border-2 rounded-xl px-7 py-6 text-center min-w-[255px] shadow-xl transition-colors ${
                    breakScreenState.isWarningRed
                      ? 'border-rose-500 bg-rose-950/35 shadow-rose-950/40'
                      : 'border-white/80 bg-[#141414]'
                  }`}
                >
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider mb-2 ${
                      breakScreenState.isWarningRed
                        ? 'bg-rose-500/25 text-rose-200 border border-rose-400/50'
                        : 'bg-white/10 text-stone-300 border border-white/15'
                    }`}
                  >
                    {breakScreenState.timerBoxBadge}
                  </div>
                  <div
                    className={`text-xs sm:text-sm font-semibold ${
                      breakScreenState.isWarningRed
                        ? 'text-rose-200'
                        : 'text-stone-200'
                    }`}
                  >
                    {breakScreenState.timerBoxLabel}
                  </div>
                  <div
                    className={`text-4xl sm:text-5xl font-bold font-sans tabular-nums tracking-tight mt-2 ${
                      breakScreenState.isWarningRed
                        ? 'text-rose-400'
                        : 'text-white'
                    }`}
                  >
                    {formatTimer(breakScreenState.displayedTimerSeconds)}
                  </div>
                  <div
                    className={`text-[11px] font-mono mt-2.5 ${
                      breakScreenState.isWarningRed
                        ? 'text-rose-300'
                        : 'text-stone-400'
                    }`}
                  >
                    {breakScreenState.isNextSectionTimerRunning
                      ? `${nextModule?.headerTitle || 'Next Module'} clock is actively running`
                      : `Break Elapsed: ${formatTimer(
                          breakScreenState.elapsedBreakSeconds
                        )} / ${formatTimer(breakScreenState.totalBreakSeconds)}`}
                  </div>
                </div>
              )}

              {/* Start / Resume Button is ALWAYS present on the Break Screen */}
              <button
                type="button"
                onClick={handleRequestEndBreak}
                className="px-8 py-3 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-stone-950 font-bold text-sm sm:text-base shadow-lg transition-transform hover:-translate-y-0.5 cursor-pointer"
              >
                {breakIsAsNeeded ? 'Resume Testing' : 'Start Next Module'}
              </button>

              {!breakIsAsNeeded && (
                <p className="text-[11px] text-stone-400 text-center max-w-[250px] leading-snug">
                  {breakScreenState.requiresEarlyStopWarning
                    ? 'Break timer is a suggestion. Starting early will ask you to confirm.'
                    : 'Suggested break has ended. Click above to enter the running section.'}
                </p>
              )}
            </div>

            {/* Right Column: Official Bluebook "Take a Break" Instructions & Dynamic Description Header */}
            <div className="md:col-span-7 space-y-5 text-left">
              <div className="space-y-2">
                <h1
                  className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                    breakScreenState.isNextSectionTimerRunning
                      ? 'text-rose-400'
                      : 'text-white'
                  }`}
                >
                  {breakScreenState.descriptionHeader}
                </h1>
                <p className="text-sm text-stone-300 leading-relaxed">
                  {breakScreenState.descriptionBody}
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <h2 className="text-base font-bold text-[#FACC15]">
                  Follow these rules during the break:
                </h2>
                <ol className="list-decimal pl-5 space-y-2 text-xs sm:text-sm text-stone-200 leading-relaxed">
                  <li>Do not disturb students who are still testing.</li>
                  <li>Do not exit the app or close your laptop.</li>
                  <li>
                    Do not access phones, smartwatches, textbooks, notes, or the
                    internet.
                  </li>
                  <li>Do not eat or drink in the test room.</li>
                  <li>
                    Do not speak in the test room; outside the room, do not
                    discuss the exam with anyone.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Student Name */}
        <div className="border-t border-white/15 pt-4 flex items-center justify-between text-xs sm:text-sm font-bold text-stone-200">
          <span>{studentName || 'Armaan Sidana'}</span>
          <span className="text-xs font-mono text-stone-400">
            {breakIsAsNeeded
              ? 'Untimed Break (Breaks as Needed)'
              : config.accommodations.extendedBreaks
              ? 'Suggested Extended Break (15 Minutes)'
              : 'Suggested Standard Break (10 Minutes)'}
          </span>
        </div>

        {/* Early Break Stop Confirmation Warning Popup Modal */}
        {showEarlyBreakEndModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="early-break-modal-title"
            className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="max-w-md w-full rounded-2xl border-2 border-amber-400/70 bg-[#24211E] text-white p-6 shadow-2xl space-y-5">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                <div className="space-y-1.5">
                  <h2
                    id="early-break-modal-title"
                    className="text-lg font-bold text-white"
                  >
                    End Suggested Break Early?
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                    You still have{' '}
                    <span className="font-mono font-bold text-amber-300">
                      {formatTimer(breakRemainingSeconds)}
                    </span>{' '}
                    remaining in your suggested break (
                    <span className="font-mono">
                      {formatTimer(breakScreenState.elapsedBreakSeconds)}
                    </span>{' '}
                    elapsed). Are you sure you want to stop the break early and
                    start{' '}
                    <span className="font-semibold text-white">
                      {nextModule?.headerTitle || 'the next module'}
                    </span>{' '}
                    now?
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowEarlyBreakEndModal(false)}
                  className="px-4 py-2 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 text-xs sm:text-sm font-bold text-white transition-colors cursor-pointer"
                >
                  Continue Break
                </button>
                <button
                  type="button"
                  onClick={() => advanceToNextModule(false)}
                  className="px-5 py-2 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-stone-950 text-xs sm:text-sm font-bold shadow-md transition-colors cursor-pointer"
                >
                  End Break & Start Module
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onMouseMove={(e) => {
        if (lineReaderActive) {
          setLineReaderY(e.clientY);
        }
      }}
      className={`${containerLayoutClass} bg-[#FCF9F4] dark:bg-slate-950 text-stone-900 dark:text-slate-100 select-none ${
        largeZoom ? 'text-lg' : 'text-base'
      }`}
    >
      {/* Top Bluebook Exam Header Bar (Warm Beige Complimentary Chrome) */}
      <header className="min-h-15 py-2 px-4 sm:px-6 bg-[#EAE2D3] dark:bg-slate-900 border-b border-[#D6CBB9] dark:border-slate-800 grid grid-cols-3 items-center gap-2 shrink-0">
        {/* Left: Section & Module Title + Directions Dropdown Button */}
        <div className="flex flex-col items-start min-w-0">
          <div className="text-xs sm:text-[15px] font-bold text-stone-900 dark:text-slate-100 truncate">
            {sectionHeaderTitle}
          </div>
          <button
            type="button"
            onClick={() => setShowDirections((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 dark:text-slate-300 hover:text-stone-950 dark:hover:text-white cursor-pointer mt-0.5"
          >
            <span>Directions</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Timer / Stopwatch (Mock countdown, Drill elapsed, Practice none) */}
        <div className="flex flex-col items-center justify-center">
          {config.mode === 'practice' ? (
            <div />
          ) : config.mode === 'drill' ? (
            <div className="flex flex-col items-center">
              <span className="text-base sm:text-[21px] font-sans font-semibold tracking-tight tabular-nums leading-tight text-stone-900 dark:text-slate-100">
                {formatTimer(elapsedSeconds)}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500">
                Elapsed
              </span>
            </div>
          ) : (
            <>
              {!hideTimer ? (
                <span
                  className={`text-base sm:text-[21px] font-sans font-semibold tracking-tight tabular-nums leading-tight ${
                    remainingSeconds <= 300
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-stone-900 dark:text-slate-100'
                  }`}
                >
                  {formatTimer(remainingSeconds)}
                </span>
              ) : (
                <div className="h-[25px] flex items-center justify-center">
                  <Clock className="w-4 h-4 text-stone-700 dark:text-slate-300" />
                </div>
              )}
              <div className="mt-0.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHideTimer((prev) => !prev)}
                  className="px-3.5 py-0.5 text-[11px] font-bold rounded-full border-[1.5px] border-stone-800 dark:border-slate-300 text-stone-900 dark:text-slate-100 bg-white/75 dark:bg-slate-900 hover:bg-white transition-colors cursor-pointer"
                >
                  {hideTimer ? 'Show' : 'Hide'}
                </button>
                {config.accommodations.breaksAsNeeded && (
                  <button
                    type="button"
                    onClick={() => {
                      setBreakIsAsNeeded(true);
                      setIsOnBreak(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-0.5 text-[11px] font-bold rounded-full border-[1.5px] border-[#1B3152] dark:border-indigo-400 text-[#1B3152] dark:text-indigo-200 bg-white/90 dark:bg-slate-900 hover:bg-[#1B3152] hover:text-white transition-colors cursor-pointer"
                  >
                    <PauseCircle className="w-3 h-3" />
                    <span>Take a Break</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: Icon-Above-Label Toolbar (Calculator | Reference | Notes (English only) | More) */}
        <div className="flex items-center justify-end gap-1 sm:gap-3 shrink-0">
          {currentQuestion.section === 'reading_writing' && (
            <button
              type="button"
              onClick={() => setShowAnnotateBox((prev) => !prev)}
              aria-label="Notes"
              aria-pressed={showAnnotateBox}
              className={`relative flex flex-col items-center justify-center px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                showAnnotateBox
                  ? 'bg-[#1B3152] text-white'
                  : 'text-stone-800 dark:text-slate-200 hover:bg-stone-300/50 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-4 h-4 mb-0.5" />
              <span>Notes</span>
              {Boolean(annotationsMap[currentQuestion.id]?.trim()) && (
                <span
                  aria-hidden="true"
                  className={`w-1.5 h-1.5 rounded-full absolute top-1 right-1.5 ${
                    showAnnotateBox
                      ? 'bg-amber-300'
                      : 'bg-[#1B3152] dark:bg-indigo-400'
                  }`}
                />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCalculator((prev) => !prev)}
            className={`flex flex-col items-center justify-center px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              showCalculator
                ? 'bg-[#1B3152] text-white'
                : 'text-stone-800 dark:text-slate-200 hover:bg-stone-300/50 dark:hover:bg-slate-800'
            }`}
          >
            <Calculator className="w-4 h-4 mb-0.5" />
            <span>Calculator</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReferenceSheet((prev) => !prev)}
            className={`flex flex-col items-center justify-center px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              showReferenceSheet
                ? 'bg-[#1B3152] text-white'
                : 'text-stone-800 dark:text-slate-200 hover:bg-stone-300/50 dark:hover:bg-slate-800'
            }`}
          >
            <span className="font-serif font-bold text-sm leading-none mb-0.5">
              X²
            </span>
            <span>Reference</span>
          </button>

          {/* More (⋮) Menu Trigger (00:56) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              aria-label="More options"
              aria-expanded={showMoreMenu}
              className={`flex flex-col items-center justify-center px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                showMoreMenu
                  ? 'bg-[#1B3152] text-white'
                  : 'text-stone-800 dark:text-slate-200 hover:bg-stone-300/50 dark:hover:bg-slate-800'
              }`}
            >
              <MoreVertical className="w-4 h-4 mb-0.5" />
              <span>More</span>
            </button>

            {/* More Dropdown Card (00:56 in video) */}
            {showMoreMenu && (
              <>
                <div
                  onClick={() => setShowMoreMenu(false)}
                  className="fixed inset-0 z-40"
                />
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-2 z-50 text-stone-900 dark:text-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setActiveInfoModal('help');
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold flex items-center gap-3 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4 text-stone-700 dark:text-slate-300" />
                    <span>Help</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setActiveInfoModal('shortcuts');
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold flex items-center gap-3 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Keyboard className="w-4 h-4 text-stone-700 dark:text-slate-300" />
                    <span>Shortcuts</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setActiveInfoModal('assistive');
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold flex items-center gap-3 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Wand2 className="w-4 h-4 text-stone-700 dark:text-slate-300" />
                    <span>Assistive Technology</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setLineReaderActive((prev) => !prev);
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold flex items-center justify-between hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <span className="flex items-center gap-3">
                      <ScanLine className="w-4 h-4 text-stone-700 dark:text-slate-300" />
                      <span>Line Reader</span>
                    </span>
                    {lineReaderActive && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700">
                        ON
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      if (config.mode === 'id_search') {
                        onExitWithoutSaving();
                      } else {
                        setShowSaveAndExitModal(true);
                      }
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold flex items-center gap-3 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer border-t border-stone-200 dark:border-slate-800 mt-1 pt-2.5"
                  >
                    <LogOut className="w-4 h-4 text-stone-700 dark:text-slate-300" />
                    <span>Save and Exit</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Full-Width "THIS IS A PRACTICE TEST" Navy Banner Strip (00:00 - 00:58) */}
      <div className="px-2 sm:px-4 shrink-0">
        <div className="w-full bg-[#1B3152] text-white text-center py-1.5 rounded-b-2xl text-[11px] font-bold tracking-wider uppercase shadow-2xs">
          THIS IS A PRACTICE TEST
        </div>
      </div>

      {/* 5-Minute Warning Banner */}
      {showFiveMinBanner && (
        <div className="bg-rose-600 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-between">
          <span>5 minutes remaining in this module.</span>
          <button
            type="button"
            onClick={() => setShowFiveMinBanner(false)}
            className="underline text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Directions Popover */}
      {showDirections && (
        <div className="bg-[#EFE9DD] dark:bg-slate-900 border-b border-[#D6CBB9] dark:border-slate-800 px-4 sm:px-6 py-4 text-xs text-stone-800 dark:text-slate-300 flex items-start justify-between gap-4 shadow-sm">
          <div className="max-w-3xl space-y-1.5">
            <div className="font-bold text-stone-950 dark:text-slate-100 text-sm">
              Section Directions
            </div>
            {currentQuestion.section === 'reading_writing' ? (
              <p className="leading-relaxed">
                The questions in this section address a number of important
                reading and writing skills. Each question includes one or more
                passages, which may include a table or graph. Read each passage
                and question carefully, and then choose the best answer to the
                question based on the passage(s).
              </p>
            ) : (
              <p className="leading-relaxed">
                The questions in this section address a number of important math
                skills. Use of a calculator is permitted for all questions. A
                reference sheet, calculator, and these directions can be
                accessed throughout the test.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowDirections(false)}
            className="px-4 py-1.5 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-stone-950 font-bold border border-stone-900/20 shrink-0 cursor-pointer"
          >
            Close
          </button>
        </div>
      )}

      {/* Line Reader Focus Mask Overlay */}
      {lineReaderActive && (
        <div
          aria-hidden="true"
          style={{ top: Math.max(60, lineReaderY - 36) }}
          className="pointer-events-none fixed left-0 right-0 h-20 z-30 border-y-2 border-[#1B3152] bg-amber-500/5 shadow-[0_0_0_9999px_rgba(20,18,15,0.48)]"
        />
      )}

      {/* MAIN CONTENT WORKSPACE: Module Review Page OR Single-Column OR Split-Pane */}
      {showReviewPage ? (
        <div className="flex-1 overflow-y-auto p-6 sm:p-10">
          <div className="max-w-3xl mx-auto space-y-6 text-center">
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-slate-100 font-display">
                Check Your Work
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-slate-400">
                On test day, you won&apos;t be able to move on to the next
                module until time expires. Click any question square below to
                review it, or submit your module now.
              </p>
            </div>

            <div className="rounded-2xl border border-[#D6CBB9] dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 dark:border-slate-800 pb-3">
                <span className="text-sm font-bold text-stone-900 dark:text-slate-100">
                  {selectorModalTitle}
                </span>
                <div className="flex items-center gap-5 text-xs text-stone-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-dashed border-stone-600 inline-block" />
                    Unanswered
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-[#C81E1E] fill-[#C81E1E]" />
                    For Review
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-3 pt-1">
                {moduleQuestions.map((q, idx) => {
                  const tile = getQuestionTileState(
                    q.id,
                    idx,
                    currentIndex,
                    answers,
                    starredQuestionIds
                  );
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setShowReviewPage(false);
                      }}
                      className={`relative h-10 rounded-xs font-sans text-sm font-bold flex items-center justify-center transition-all cursor-pointer ${
                        tile.isAnswered
                          ? 'bg-[#1D4ED8] text-white shadow-2xs'
                          : 'border-2 border-dashed border-stone-600 dark:border-slate-500 text-[#1D4ED8] dark:text-blue-400 bg-white dark:bg-slate-900 hover:bg-stone-50'
                      }`}
                    >
                      <span>{tile.questionNumber}</span>
                      {tile.isFlagged && (
                        <Bookmark className="w-3.5 h-3.5 text-[#C81E1E] fill-[#C81E1E] absolute -top-1.5 -right-1.5 bg-white dark:bg-slate-900 rounded-xs" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : isSingleColumn ? (
        /* SINGLE-COLUMN CENTERED WORKSPACE (For Passage-Free Math MCQs — Matches 00:15 - 00:56) */
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10 select-text">
          <div className="max-w-2xl mx-auto space-y-4">
            {renderQuestionHeaderStrip()}
            {renderQuestionInteractiveBody()}
          </div>
        </div>
      ) : (
        /* TWO-COLUMN SPLIT-PANE WORKSPACE (For Reading Passages & SPR Questions — Matches 00:00 - 00:14) */
        <div
          style={{ '--left-pane-w': `${leftPanePct}%` } as React.CSSProperties}
          className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative"
        >
          {/* Left Pane: Passage OR Official Student-Produced Response Directions */}
          <div className="w-full lg:w-[var(--left-pane-w)] lg:flex-none lg:overflow-y-auto p-5 sm:p-7 lg:p-9 border-b lg:border-b-0 lg:border-r border-stone-400/70 dark:border-slate-800 select-text">
            <div className="max-w-xl mx-auto space-y-4">
              {currentQuestion.passageHtml ? (
                <div
                  className="font-passage leading-relaxed text-stone-900 dark:text-slate-100 space-y-3 text-[16px]"
                  dangerouslySetInnerHTML={{
                    __html: formatMathHtml(currentQuestion.passageHtml),
                  }}
                />
              ) : (
                /* Exact Official Bluebook Student-Produced Response Directions & Examples Table (00:00 - 00:13) */
                <div className="font-passage text-stone-900 dark:text-slate-100 space-y-4 text-[15px] leading-relaxed">
                  <h2 className="text-lg font-bold font-sans text-stone-950 dark:text-white">
                    Student-produced response directions
                  </h2>

                  <ul className="list-disc pl-5 space-y-2.5">
                    <li>
                      If you find <strong>more than one correct answer</strong>,
                      enter only one answer.
                    </li>
                    <li>
                      You can enter up to 5 characters for a{' '}
                      <strong>positive</strong> answer and up to 6 characters
                      (including the negative sign) for a{' '}
                      <strong>negative</strong> answer.
                    </li>
                    <li>
                      If your answer is a <strong>fraction</strong> that
                      doesn&apos;t fit in the provided space, enter the decimal
                      equivalent.
                    </li>
                    <li>
                      If your answer is a <strong>decimal</strong> that
                      doesn&apos;t fit in the provided space, enter it by
                      truncating or rounding at the fourth digit.
                    </li>
                    <li>
                      If your answer is a <strong>mixed number</strong> (such as
                      3 1/2), enter it as an improper fraction (7/2) or its
                      decimal equivalent (3.5).
                    </li>
                    <li>
                      Don&apos;t enter <strong>symbols</strong> such as a
                      percent sign, comma, or dollar sign.
                    </li>
                  </ul>

                  <div className="pt-2 space-y-2">
                    <div className="text-center font-sans text-sm text-stone-700 dark:text-slate-300">
                      Examples
                    </div>
                    <table className="w-full border-collapse border border-stone-400 dark:border-slate-700 text-xs sm:text-sm text-center font-sans">
                      <thead>
                        <tr className="border-b border-stone-400 dark:border-slate-700 bg-[#EFE9DD]/60 dark:bg-slate-900">
                          <th className="border-r border-stone-400 dark:border-slate-700 p-2.5 font-medium">
                            Answer
                          </th>
                          <th className="border-r border-stone-400 dark:border-slate-700 p-2.5 font-medium">
                            Acceptable ways to
                            <br />
                            enter answer
                          </th>
                          <th className="p-2.5 font-medium">
                            Unacceptable: will
                            <br />
                            NOT receive credit
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-stone-400 dark:border-slate-700">
                          <td className="border-r border-stone-400 dark:border-slate-700 p-3 font-medium">
                            3.5
                          </td>
                          <td className="border-r border-stone-400 dark:border-slate-700 p-3 space-y-1.5">
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded bg-stone-200 dark:bg-slate-800 font-mono text-xs">
                                3.5
                              </span>
                            </div>
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded bg-stone-200 dark:bg-slate-800 font-mono text-xs">
                                3.50
                              </span>
                            </div>
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded bg-stone-200 dark:bg-slate-800 font-mono text-xs">
                                7/2
                              </span>
                            </div>
                          </td>
                          <td className="p-3 space-y-1.5">
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded bg-stone-200 dark:bg-slate-800 font-mono text-xs">
                                31/2
                              </span>
                            </div>
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded bg-stone-200 dark:bg-slate-800 font-mono text-xs">
                                3 1/2
                              </span>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td className="border-r border-stone-400 dark:border-slate-700 p-3 font-medium">
                            2/3
                          </td>
                          <td className="border-r border-stone-400 dark:border-slate-700 p-3 space-y-1">
                            {['2/3', '.6666', '.6667', '0.666', '0.667'].map(
                              (ex) => (
                                <div key={ex}>
                                  <span className="inline-block px-2 py-0.5 rounded bg-stone-200 dark:bg-slate-800 font-mono text-xs">
                                    {ex}
                                  </span>
                                </div>
                              )
                            )}
                          </td>
                          <td className="p-3 space-y-1">
                            {['0.66', '.66', '0.67', '.67'].map((bad) => (
                              <div key={bad}>
                                <span className="inline-block px-2 py-0.5 rounded bg-stone-200 dark:bg-slate-800 font-mono text-xs">
                                  {bad}
                                </span>
                              </div>
                            ))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center Draggable Divider (Desktop) */}
          <div
            onMouseDown={() => {
              isDraggingDivider.current = true;
            }}
            className="hidden lg:flex w-2 bg-[#E3DAC8] dark:bg-slate-800 hover:bg-[#1B3152] cursor-col-resize items-center justify-center transition-colors shrink-0"
            title="Drag to resize panes"
          >
            <div className="w-0.5 h-8 bg-stone-500 dark:bg-slate-500 rounded-full" />
          </div>

          {/* Right Pane: Question Header Strip + Stem + SPR/MCQ Body */}
          <div className="flex-1 lg:overflow-y-auto p-5 sm:p-7 lg:p-9 select-text">
            <div className="max-w-xl mx-auto">
              {renderQuestionHeaderStrip()}
              {renderQuestionInteractiveBody()}
            </div>
          </div>
        </div>
      )}

      {/* DRAGGABLE ON-SCREEN SPR KEYPAD MODAL (00:06 - 00:12 in Video) */}
      {showSprKeypad && currentQuestion.type === 'spr' && (
        <div
          style={{
            left: `${keypadPos.x}px`,
            top: `${keypadPos.y}px`,
          }}
          role="dialog"
          aria-label="Keypad"
          className="fixed z-50 w-64 rounded-xl border border-stone-400 bg-[#F3F3F3] text-stone-900 shadow-2xl overflow-hidden select-none"
        >
          {/* Draggable Dark Header Bar */}
          <div
            onMouseDown={(e) => {
              draggingKeypadRef.current = true;
              keypadDragOffsetRef.current = {
                x: e.clientX - keypadPos.x,
                y: e.clientY - keypadPos.y,
              };
            }}
            className="bg-[#1E1E1E] text-white px-3.5 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing"
          >
            <span className="text-xs font-bold">Keypad</span>
            <GripHorizontal className="w-3.5 h-3.5 text-stone-400" />
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setShowSprKeypad(false)}
              aria-label="Close Keypad"
              className="p-0.5 rounded hover:bg-white/15 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 4-Row Keypad Grid (Matches 00:06 - 00:11) */}
          <div className="p-3 grid grid-cols-4 gap-2 text-base font-medium">
            {/* Row 1: 1, 2, 3, Backspace */}
            {(['1', '2', '3'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleSprKeypadPress(k)}
                className="h-11 rounded-lg bg-white hover:bg-stone-50 border border-stone-300 shadow-2xs font-semibold cursor-pointer active:translate-y-0.5"
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleSprKeypadPress('BACKSPACE')}
              aria-label="Backspace"
              className="h-11 rounded-lg bg-white hover:bg-stone-50 border border-stone-300 shadow-2xs flex items-center justify-center cursor-pointer active:translate-y-0.5"
            >
              <Delete className="w-4 h-4" />
            </button>

            {/* Row 2: 4, 5, 6, Clear */}
            {(['4', '5', '6'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleSprKeypadPress(k)}
                className="h-11 rounded-lg bg-white hover:bg-stone-50 border border-stone-300 shadow-2xs font-semibold cursor-pointer active:translate-y-0.5"
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleSprKeypadPress('CLEAR')}
              className="h-11 rounded-lg bg-white hover:bg-stone-50 border border-stone-300 shadow-2xs text-xs font-semibold cursor-pointer active:translate-y-0.5"
            >
              Clear
            </button>

            {/* Row 3: 7, 8, 9, / */}
            {(['7', '8', '9', '/'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleSprKeypadPress(k)}
                className="h-11 rounded-lg bg-white hover:bg-stone-50 border border-stone-300 shadow-2xs font-semibold cursor-pointer active:translate-y-0.5"
              >
                {k}
              </button>
            ))}

            {/* Row 4: -, 0, ., empty */}
            {(['-', '0', '.'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleSprKeypadPress(k)}
                className="h-11 rounded-lg bg-white hover:bg-stone-50 border border-stone-300 shadow-2xs font-semibold cursor-pointer active:translate-y-0.5"
              >
                {k}
              </button>
            ))}
            <div />
          </div>
        </div>
      )}

      {/* DRAGGABLE GRAPHING & SCIENTIFIC CALCULATOR MODAL (00:36 - 00:50) */}
      {showCalculator && (
        <BluebookCalculatorModal onClose={() => setShowCalculator(false)} />
      )}

      {/* DRAGGABLE & FULLSCREEN LATEX + SVG REFERENCE SHEET MODAL */}
      {showReferenceSheet && (
        <BluebookReferenceModal onClose={() => setShowReferenceSheet(false)} />
      )}

      {/* DRAGGABLE NOTES SCRATCHPAD MODAL (English / Reading & Writing Section Only) */}
      {showAnnotateBox && currentQuestion.section === 'reading_writing' && (
        <BluebookNotesModal
          questionNumber={currentIndex + 1}
          value={annotationsMap[currentQuestion.id] || ''}
          onChange={(nextText) =>
            setAnnotationsMap((prev) => ({
              ...prev,
              [currentQuestion.id]: nextText,
            }))
          }
          onClose={() => setShowAnnotateBox(false)}
        />
      )}

      {/* MOCK TEST TIME EXPIRED MODAL WITH EXTEND TIME OPTION */}
      {timeExpiredModal && config.mode === 'mock' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="time-expired-title"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-stone-300 dark:border-slate-700 shadow-2xl p-6 space-y-4 text-center">
            <h3
              id="time-expired-title"
              className="text-lg font-bold text-stone-900 dark:text-slate-100"
            >
              Time is Up
            </h3>
            <p className="text-xs text-stone-600 dark:text-slate-400 leading-relaxed">
              The time limit for {sectionHeaderTitle} has expired. You can extend your time by 15 minutes or finish this module now.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRemainingSeconds(900);
                  setTimeExpiredModal(false);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#1B3152] text-white cursor-pointer hover:bg-[#24416B]"
              >
                Extend Time (+15 Mins)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeExpiredModal(false);
                  handleCompleteCurrentModule();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-slate-200 cursor-pointer hover:bg-stone-100 dark:hover:bg-slate-800"
              >
                {currentModuleIndex < mockModules.length - 1
                  ? 'Finish Module & Continue'
                  : 'Finish & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SLIDE-OVER ASTER AI TUTOR DRAWER (Practice & Drill Modes Only) */}
      {showAiDrawer &&
        (config.mode === 'practice' || config.mode === 'drill') && (
          <div className="fixed right-0 bottom-14 top-15 w-96 max-w-[92vw] border-l border-[#D6CBB9] dark:border-slate-800 bg-[#FCF9F4] dark:bg-slate-900 flex flex-col shadow-2xl z-40">
            <div className="p-3.5 border-b border-[#D6CBB9] dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AsterOrbLogo
                  size={24}
                  active={aiLoading}
                  interactive={false}
                />
                <div>
                  <div className="text-xs font-bold text-stone-900 dark:text-slate-100">
                    Aster AI Tutor
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-slate-400 font-mono">
                    Question {currentQuestion.id} ({currentQuestion.domain})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiDrawer(false)}
                className="p-1 text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {(aiMessages[currentQuestion.id] || []).map((m, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-3 leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#1B3152] text-white ml-6'
                      : 'bg-[#EFE9DD] dark:bg-slate-800 text-stone-900 dark:text-slate-100 mr-4'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {aiLoading && (
                <div className="text-xs text-[#1B3152] dark:text-indigo-400 animate-pulse">
                  Thinking...
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!aiInput.trim()) return;
                const qText = aiInput.trim();
                setAiInput('');
                handleOpenAiDrawerForQuestion(qText);
              }}
              className="p-3 border-t border-[#D6CBB9] dark:border-slate-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask for a hint or why a choice is wrong..."
                className="flex-1 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-stone-900 dark:text-slate-100 focus:outline-none"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="p-2 rounded-lg bg-[#1B3152] hover:bg-[#24416B] text-white cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

      {/* QUESTION SELECTOR POPUP (Exact Mirror of 00:13 - 00:15 & 00:29 - 00:32) */}
      {showQuestionNavigator && (
        <div
          role="dialog"
          aria-label="Question Selector"
          className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 w-[500px] max-w-[95vw] rounded-2xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-bold text-stone-950 dark:text-slate-100 leading-snug">
              {selectorModalTitle}
            </h3>
            <button
              type="button"
              onClick={() => setShowQuestionNavigator(false)}
              aria-label="Close question selector"
              className="p-1 text-stone-600 hover:text-stone-950 dark:text-slate-400 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Legend Row Between Horizontal Dividers */}
          <div className="border-y border-stone-300 dark:border-slate-700 py-2.5 flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-stone-800 dark:text-slate-200">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-stone-900 dark:text-white" />
              <span>Current</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 border-2 border-dashed border-stone-600 dark:border-slate-400 inline-block" />
              <span>Unanswered</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-[#C81E1E] fill-[#C81E1E]" />
              <span>For Review</span>
            </span>
          </div>

          {/* 10-Column Bluebook Square Number Grid (Exact Mirror of 00:14 & 00:29) */}
          {(() => {
            const moduleSize =
              moduleQuestions.length <= 44 ? moduleQuestions.length : 22;
            const moduleStart =
              moduleQuestions.length <= 44
                ? 0
                : Math.floor(currentIndex / moduleSize) * moduleSize;
            const moduleSlice = moduleQuestions.slice(
              moduleStart,
              moduleStart + moduleSize
            );

            return (
              <div className="space-y-3">
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-x-2.5 gap-y-4 pt-2 pb-1 max-h-60 overflow-y-auto px-1">
                  {moduleSlice.map((q, offset) => {
                    const idx = moduleStart + offset;
                    const tile = getQuestionTileState(
                      q.id,
                      idx,
                      currentIndex,
                      answers,
                      starredQuestionIds
                    );

                    return (
                      <div
                        key={q.id}
                        className="relative flex flex-col items-center pt-3"
                      >
                        {/* Current Pin Marker Perched Above Tile (00:14 & 00:29) */}
                        {tile.isCurrent && (
                          <MapPin
                            aria-hidden="true"
                            className="w-3.5 h-3.5 text-stone-900 dark:text-white absolute -top-0.5 left-1/2 -translate-x-1/2"
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setCurrentIndex(idx);
                            setShowReviewPage(false);
                            setShowQuestionNavigator(false);
                          }}
                          aria-label={`Question ${tile.questionNumber}${
                            tile.isAnswered ? ', Answered' : ', Unanswered'
                          }${tile.isFlagged ? ', Marked for Review' : ''}`}
                          className={`relative w-8 h-8 rounded-xs font-sans text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                            tile.isAnswered
                              ? 'bg-[#1D4ED8] text-white'
                              : 'border-[1.5px] border-dashed border-stone-600 dark:border-slate-500 text-[#1D4ED8] dark:text-blue-400 bg-white dark:bg-slate-900 hover:bg-stone-100'
                          }`}
                        >
                          <span className={tile.isCurrent ? 'underline' : ''}>
                            {tile.questionNumber}
                          </span>

                          {/* Red Bookmark Badge in Top-Right Corner when Flagged (00:29) */}
                          {tile.isFlagged && (
                            <Bookmark className="w-3 h-3 text-[#C81E1E] fill-[#C81E1E] absolute -top-1.5 -right-1.5 bg-white dark:bg-slate-900 rounded-xs" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Compact Bank Page / Jump Bar when browsing large Practice Pools (> 44 items) */}
                {moduleQuestions.length > 44 && (
                  <div className="pt-2 border-t border-stone-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={moduleStart === 0}
                        onClick={() =>
                          setCurrentIndex(Math.max(0, moduleStart - moduleSize))
                        }
                        className="px-2 py-1 rounded border border-stone-300 dark:border-slate-700 disabled:opacity-40 hover:bg-stone-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                      >
                        Prev 22
                      </button>
                      <span className="text-stone-600 dark:text-slate-400 font-mono text-[11px]">
                        #{moduleStart + 1}–
                        {Math.min(
                          moduleQuestions.length,
                          moduleStart + moduleSize
                        )}{' '}
                        of {moduleQuestions.length}
                      </span>
                      <button
                        type="button"
                        disabled={
                          moduleStart + moduleSize >= moduleQuestions.length
                        }
                        onClick={() =>
                          setCurrentIndex(
                            Math.min(
                              moduleQuestions.length - 1,
                              moduleStart + moduleSize
                            )
                          )
                        }
                        className="px-2 py-1 rounded border border-stone-300 dark:border-slate-700 disabled:opacity-40 hover:bg-stone-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                      >
                        Next 22
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={moduleQuestions.length}
                        value={jumpToNumberInput}
                        onChange={(e) => setJumpToNumberInput(e.target.value)}
                        placeholder="Jump #"
                        className="w-16 rounded border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 px-2 py-1 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const target = Math.max(
                            1,
                            Math.min(
                              moduleQuestions.length,
                              Number(jumpToNumberInput) || 1
                            )
                          );
                          setCurrentIndex(target - 1);
                          setShowReviewPage(false);
                          setShowQuestionNavigator(false);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-[#1B3152] text-white cursor-pointer"
                      >
                        Jump
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Go to Review Page Button (00:14 & 00:29) */}
          <div className="pt-1 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setShowQuestionNavigator(false);
                setShowReviewPage(true);
              }}
              className="px-5 py-1.5 rounded-full border-[1.5px] border-[#1D4ED8] text-[#1D4ED8] dark:border-blue-400 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-bold transition-colors cursor-pointer"
            >
              Go to Review Page
            </button>
          </div>

          {/* Bottom Pointer Triangle */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-r border-b border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
        </div>
      )}

      {/* "DO YOU WANT TO EXIT THIS PRACTICE TEST?" MODAL (Exact Mirror of 00:57 - 00:58) */}
      {showSaveAndExitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-practice-test-title"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-stone-300 dark:border-slate-700 shadow-2xl p-6 sm:p-7 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <h2
                id="exit-practice-test-title"
                className="text-lg sm:text-xl font-bold text-stone-950 dark:text-white font-display"
              >
                Do You Want to Exit This Practice Test?
              </h2>
              <button
                type="button"
                onClick={() => setShowSaveAndExitModal(false)}
                aria-label="Close exit confirmation"
                className="p-1 text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-stone-700 dark:text-slate-300 leading-relaxed">
              If you exit now, we&apos;ll save your progress and you can resume
              this practice test within 90 days.
            </p>

            <div className="flex items-center justify-end gap-5 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveAndExitModal(false)}
                className="text-xs sm:text-sm font-bold text-stone-900 dark:text-slate-200 underline hover:text-[#1D4ED8] cursor-pointer"
              >
                Continue Practice Test
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaveAndExitModal(false);
                  onSaveAndExit(buildSnapshot());
                }}
                className="px-5 py-2.5 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-stone-950 font-bold text-xs sm:text-sm border border-stone-900/20 shadow-xs transition-colors cursor-pointer"
              >
                Save and Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HELP / SHORTCUTS / ASSISTIVE TECHNOLOGY MODAL */}
      {activeInfoModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#FCF9F4] dark:bg-slate-900 border border-[#D6CBB9] dark:border-slate-700 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-950 dark:text-white">
                {activeInfoModal === 'help'
                  ? 'Testing Help & Tools'
                  : activeInfoModal === 'shortcuts'
                  ? 'Keyboard Shortcuts'
                  : 'Assistive Technology & Display'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveInfoModal(null)}
                className="p-1 text-stone-500 hover:text-stone-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeInfoModal === 'help' && (
              <div className="text-xs text-stone-700 dark:text-slate-300 space-y-2 leading-relaxed">
                <p>
                  • Use <strong>Mark for Review</strong> to flag any question you
                  want to revisit before finishing the module.
                </p>
                <p>
                  • Use the <strong>ABC</strong> cross-out button to eliminate
                  answer choices you know are incorrect.
                </p>
                <p>
                  • Drag the <strong>Calculator</strong>,{' '}
                  <strong>Reference Sheet</strong>, or <strong>Keypad</strong>{' '}
                  anywhere on screen by grabbing their top bar.
                </p>
              </div>
            )}

            {activeInfoModal === 'shortcuts' && (
              <div className="text-xs text-stone-700 dark:text-slate-300 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span>Select Choice A / B / C / D</span>
                  <strong>1 / 2 / 3 / 4</strong>
                </div>
                <div className="flex justify-between">
                  <span>Next / Back Question</span>
                  <strong>Right / Left Arrow</strong>
                </div>
                <div className="flex justify-between">
                  <span>Close Active Popup</span>
                  <strong>Esc</strong>
                </div>
              </div>
            )}

            {activeInfoModal === 'assistive' && (
              <div className="space-y-3 text-xs text-stone-700 dark:text-slate-300">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="font-semibold">Large Text Zoom</span>
                  <input
                    type="checkbox"
                    checked={largeZoom}
                    onChange={(e) => setLargeZoom(e.target.checked)}
                    className="rounded border-stone-400"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="font-semibold">Guided Line Reader</span>
                  <input
                    type="checkbox"
                    checked={lineReaderActive}
                    onChange={(e) => setLineReaderActive(e.target.checked)}
                    className="rounded border-stone-400"
                  />
                </label>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveInfoModal(null)}
                className="px-4 py-1.5 rounded-full bg-[#1B3152] text-white text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Bluebook Dashed Border Strip Above Footer (00:00 - 00:58) */}
      <div className="bluebook-dashed-border shrink-0" />

      {/* Bottom Bluebook Navigation Bar */}
      <footer className="min-h-15 py-2.5 px-4 sm:px-6 bg-[#EAE2D3] dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0">
        {/* Left: Student Name */}
        <div className="text-xs sm:text-sm font-bold text-stone-900 dark:text-slate-100 truncate">
          {studentName || 'Armaan Sidana'}
        </div>

        {/* Center: Question Selector Button ("Question X of Y ^") */}
        {!showReviewPage ? (
          <button
            type="button"
            onClick={() => setShowQuestionNavigator((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E1E1E] hover:bg-stone-800 text-white text-xs sm:text-sm font-sans font-bold shadow-xs transition-colors cursor-pointer"
          >
            <span>
              Question {currentIndex + 1} of {moduleQuestions.length}
            </span>
            {showQuestionNavigator ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="text-xs font-bold text-stone-700 dark:text-slate-300">
            Review Page · {moduleQuestions.length} Questions
          </div>
        )}

        {/* Right: Back & Next Pill Buttons (On Q1 only Next is shown, matching 00:00-00:13!) */}
        <div className="flex items-center gap-2.5">
          {(currentIndex > 0 || showReviewPage) && (
            <button
              type="button"
              onClick={() => {
                if (showReviewPage) {
                  setShowReviewPage(false);
                } else {
                  setCurrentIndex((i) => Math.max(0, i - 1));
                }
              }}
              className="px-5 py-2 text-xs sm:text-sm font-bold rounded-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white border border-[#1E3A8A]/40 shadow-[0_2px_0_rgba(27,49,82,0.22)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            >
              Back
            </button>
          )}

          {!showReviewPage && currentIndex < moduleQuestions.length - 1 ? (
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((i) =>
                  Math.min(moduleQuestions.length - 1, i + 1)
                )
              }
              className="px-5 py-2 text-xs sm:text-sm font-bold rounded-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white border border-[#1E3A8A]/40 shadow-[0_2px_0_rgba(27,49,82,0.22)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            >
              Next
            </button>
          ) : !showReviewPage &&
            currentIndex === moduleQuestions.length - 1 &&
            config.mode !== 'id_search' ? (
            <button
              type="button"
              onClick={() => setShowReviewPage(true)}
              className="px-5 py-2 text-xs sm:text-sm font-bold rounded-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white border border-[#1E3A8A]/40 shadow-[0_2px_0_rgba(27,49,82,0.22)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={
                config.mode === 'id_search'
                  ? onExitWithoutSaving
                  : handleCompleteCurrentModule
              }
              className="px-5 py-2 text-xs sm:text-sm font-bold rounded-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white border border-[#1E3A8A]/40 shadow-[0_2px_0_rgba(27,49,82,0.22)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            >
              {config.mode === 'id_search'
                ? 'Done'
                : config.mode === 'mock' &&
                  currentModuleIndex < mockModules.length - 1
                ? 'Next Module'
                : 'Submit & Score'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

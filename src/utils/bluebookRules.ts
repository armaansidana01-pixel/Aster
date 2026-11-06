import {
  SATQuestion,
  SATSection,
  TestAccommodations,
  TestStartConfig,
} from '../types';

export interface MockExamModule {
  moduleIndex: number;
  section: SATSection;
  sectionNumber: 1 | 2;
  moduleNumber: 1 | 2;
  headerTitle: string;
  selectorTitle: string;
  questions: SATQuestion[];
  durationSeconds: number;
}

export function getRwTimeMultiplier(
  accommodations: TestAccommodations
): 1 | 1.5 | 2 {
  return accommodations.rwTimeMultiplier ?? accommodations.timeMultiplier ?? 1;
}

export function getMathTimeMultiplier(
  accommodations: TestAccommodations
): 1 | 1.5 | 2 {
  return (
    accommodations.mathTimeMultiplier ?? accommodations.timeMultiplier ?? 1
  );
}

export function getRwModuleMinutes(
  accommodations: TestAccommodations
): number {
  return Math.round(32 * getRwTimeMultiplier(accommodations));
}

export function getMathModuleMinutes(
  accommodations: TestAccommodations
): number {
  return Math.round(35 * getMathTimeMultiplier(accommodations));
}

export function getScheduledBreakDurationSeconds(
  accommodations: TestAccommodations
): number {
  return accommodations.extendedBreaks ? 15 * 60 : 10 * 60;
}

export interface BreakTimerTickState {
  breakRemainingSeconds: number;
  nextModuleRemainingSeconds: number;
}

export function tickBreakTimers(
  state: BreakTimerTickState
): BreakTimerTickState {
  if (state.breakRemainingSeconds > 0) {
    return {
      breakRemainingSeconds: Math.max(0, state.breakRemainingSeconds - 1),
      nextModuleRemainingSeconds: state.nextModuleRemainingSeconds,
    };
  }
  return {
    breakRemainingSeconds: 0,
    nextModuleRemainingSeconds: Math.max(
      0,
      state.nextModuleRemainingSeconds - 1
    ),
  };
}

export interface BreakScreenComputedState {
  phase:
    | 'untimed_as_needed'
    | 'suggested_nominal'
    | 'suggested_warning_red'
    | 'next_section_timer_running';
  totalBreakSeconds: number;
  elapsedBreakSeconds: number;
  isWarningRed: boolean;
  isNextSectionTimerRunning: boolean;
  requiresEarlyStopWarning: boolean;
  topStatusText: string;
  timerBoxBadge: string;
  timerBoxLabel: string;
  displayedTimerSeconds: number;
  descriptionHeader: string;
  descriptionBody: string;
  warningBannerText: string | null;
}

export function getBreakScreenState(params: {
  breakIsAsNeeded: boolean;
  totalBreakSeconds: number;
  breakRemainingSeconds: number;
  nextModuleRemainingSeconds: number;
  currentSectionTitle: string;
  nextModuleTitle: string;
}): BreakScreenComputedState {
  const {
    breakIsAsNeeded,
    totalBreakSeconds,
    breakRemainingSeconds,
    nextModuleRemainingSeconds,
    currentSectionTitle,
    nextModuleTitle,
  } = params;

  if (breakIsAsNeeded) {
    return {
      phase: 'untimed_as_needed',
      totalBreakSeconds,
      elapsedBreakSeconds: 0,
      isWarningRed: false,
      isNextSectionTimerRunning: false,
      requiresEarlyStopWarning: false,
      topStatusText: `Break as Needed · ${currentSectionTitle} Paused`,
      timerBoxBadge: 'Untimed Break',
      timerBoxLabel: 'Untimed Break',
      displayedTimerSeconds: 0,
      descriptionHeader: 'Take a Break: Do Not Close Your Device',
      descriptionBody:
        'Your module timer is paused. Click the Resume Testing button on the left whenever you are ready to return to your test.',
      warningBannerText: null,
    };
  }

  const elapsedBreakSeconds = Math.max(
    0,
    totalBreakSeconds - breakRemainingSeconds
  );
  const totalBreakMinutes = Math.max(1, Math.round(totalBreakSeconds / 60));
  const warningMinuteMark = Math.max(1, totalBreakMinutes - 1);

  if (breakRemainingSeconds <= 0) {
    return {
      phase: 'next_section_timer_running',
      totalBreakSeconds,
      elapsedBreakSeconds: totalBreakSeconds,
      isWarningRed: true,
      isNextSectionTimerRunning: true,
      requiresEarlyStopWarning: false,
      topStatusText: `Break Time Ended (${totalBreakMinutes}:00) · Next Section Timer Running: ${nextModuleTitle}`,
      timerBoxBadge: `${totalBreakMinutes}:00 Reached · Next Timer Active`,
      timerBoxLabel: 'Next Section Time Remaining:',
      displayedTimerSeconds: nextModuleRemainingSeconds,
      descriptionHeader:
        'Suggested Break Ended: Next Section Timer Has Started',
      descriptionBody: `Your ${totalBreakMinutes}-minute suggested break has ended (${totalBreakMinutes}:00 elapsed). The timer for ${nextModuleTitle} has automatically started and is counting down on the left, but the section will not open until you click Start Next Module.`,
      warningBannerText: `At ${totalBreakMinutes}:00 elapsed, the timer for ${nextModuleTitle} automatically started! Click Start Next Module immediately.`,
    };
  }

  if (breakRemainingSeconds <= 60) {
    return {
      phase: 'suggested_warning_red',
      totalBreakSeconds,
      elapsedBreakSeconds,
      isWarningRed: true,
      isNextSectionTimerRunning: false,
      requiresEarlyStopWarning: true,
      topStatusText: `Suggested Break Warning (${warningMinuteMark}:00+ Elapsed) · Next: ${nextModuleTitle}`,
      timerBoxBadge: `${warningMinuteMark}:00 Warning · 1 Min Left`,
      timerBoxLabel: 'Suggested Break Time Remaining:',
      displayedTimerSeconds: breakRemainingSeconds,
      descriptionHeader: 'Take a Suggested Break: Do Not Close Your Device',
      descriptionBody: `1 minute or less of your suggested break remains (${warningMinuteMark}:00 elapsed). At ${totalBreakMinutes}:00, the timer for ${nextModuleTitle} will automatically start counting down while you are on this screen.`,
      warningBannerText: `Warning (${warningMinuteMark}:00 elapsed): Under 1 minute of suggested break remaining. At ${totalBreakMinutes}:00, the next section timer will automatically start!`,
    };
  }

  return {
    phase: 'suggested_nominal',
    totalBreakSeconds,
    elapsedBreakSeconds,
    isWarningRed: false,
    isNextSectionTimerRunning: false,
    requiresEarlyStopWarning: true,
    topStatusText: `Suggested Practice Test Break · Next: ${nextModuleTitle}`,
    timerBoxBadge: `Suggested Break (${totalBreakMinutes}:00)`,
    timerBoxLabel: 'Suggested Break Time Remaining:',
    displayedTimerSeconds: breakRemainingSeconds,
    descriptionHeader: 'Take a Suggested Break: Do Not Close Your Device',
    descriptionBody: `This ${totalBreakMinutes}-minute break timer is a suggestion—the Start Next Module button is always available on the left (stopping early will ask for confirmation). At ${warningMinuteMark}:00 a red warning will appear, and at ${totalBreakMinutes}:00 the next section timer will automatically start without leaving this screen.`,
    warningBannerText: null,
  };
}

export function shouldTriggerScheduledBreakAfterModule(
  completedModuleIndex: number,
  totalModules: number,
  extraBreaks: boolean
): boolean {
  if (completedModuleIndex < 0 || completedModuleIndex >= totalModules - 1) {
    return false;
  }
  if (extraBreaks) {
    return true;
  }
  // Standard timing: 1 break at the halfway point (between Mod 2 and Mod 3 in a 4-module exam, or between Mod 1 and Mod 2 in a 2-module exam)
  if (totalModules === 4) {
    return completedModuleIndex === 1;
  }
  if (totalModules === 2) {
    return completedModuleIndex === 0;
  }
  return completedModuleIndex === Math.floor(totalModules / 2) - 1;
}

export function buildMockExamModules(
  questions: SATQuestion[],
  config: TestStartConfig
): MockExamModule[] {
  const rwDurationSec = getRwModuleMinutes(config.accommodations) * 60;
  const mathDurationSec = getMathModuleMinutes(config.accommodations) * 60;

  const rwAll = questions.filter((q) => q.section === 'reading_writing');
  const mathAll = questions.filter((q) => q.section === 'math');

  const modules: MockExamModule[] = [];

  if (
    config.mockSections === 'both' ||
    config.mockSections === 'reading_writing'
  ) {
    const sourceRw = rwAll.length > 0 ? rwAll : questions;
    const halfRw = Math.max(1, Math.ceil(sourceRw.length / 2));
    const rwMod1 = sourceRw.slice(0, halfRw);
    const rwMod2 =
      sourceRw.slice(halfRw).length > 0 ? sourceRw.slice(halfRw) : rwMod1;

    modules.push({
      moduleIndex: modules.length,
      section: 'reading_writing',
      sectionNumber: 1,
      moduleNumber: 1,
      headerTitle: 'Section 1, Module 1: Reading and Writing',
      selectorTitle: 'Section 1, Module 1: Reading and Writing Questions',
      questions: rwMod1,
      durationSeconds: rwDurationSec,
    });

    modules.push({
      moduleIndex: modules.length,
      section: 'reading_writing',
      sectionNumber: 1,
      moduleNumber: 2,
      headerTitle: 'Section 1, Module 2: Reading and Writing',
      selectorTitle: 'Section 1, Module 2: Reading and Writing Questions',
      questions: rwMod2,
      durationSeconds: rwDurationSec,
    });
  }

  if (config.mockSections === 'both' || config.mockSections === 'math') {
    const sourceMath = mathAll.length > 0 ? mathAll : questions;
    const halfMath = Math.max(1, Math.ceil(sourceMath.length / 2));
    const mathMod1 = sourceMath.slice(0, halfMath);
    const mathMod2 =
      sourceMath.slice(halfMath).length > 0
        ? sourceMath.slice(halfMath)
        : mathMod1;
    const secNum: 1 | 2 = config.mockSections === 'math' ? 1 : 2;

    modules.push({
      moduleIndex: modules.length,
      section: 'math',
      sectionNumber: secNum,
      moduleNumber: 1,
      headerTitle: `Section ${secNum}, Module 1: Math`,
      selectorTitle: `Section ${secNum}, Module 1: Math Questions`,
      questions: mathMod1,
      durationSeconds: mathDurationSec,
    });

    modules.push({
      moduleIndex: modules.length,
      section: 'math',
      sectionNumber: secNum,
      moduleNumber: 2,
      headerTitle: `Section ${secNum}, Module 2: Math`,
      selectorTitle: `Section ${secNum}, Module 2: Math Questions`,
      questions: mathMod2,
      durationSeconds: mathDurationSec,
    });
  }

  return modules;
}


/**
 * Enforces official Bluebook Student-Produced Response (SPR) character rules:
 * - Up to 5 characters for a positive answer
 * - Up to 6 characters (including the negative sign) for a negative answer
 * - Only digits (0-9), decimal point (.), fraction slash (/), and leading negative sign (-)
 */
export function sanitizeSprAnswer(rawInput: string): string {
  if (!rawInput) return '';

  let result = '';
  let hasDecimal = false;
  let hasSlash = false;

  for (let i = 0; i < rawInput.length; i++) {
    const ch = rawInput[i];
    if (ch === '-' && result.length === 0) {
      result += '-';
    } else if (ch >= '0' && ch <= '9') {
      result += ch;
    } else if (ch === '.' && !hasDecimal) {
      hasDecimal = true;
      result += '.';
    } else if (ch === '/' && !hasSlash && result.length > 0 && result !== '-') {
      hasSlash = true;
      result += '/';
    }
  }

  const maxLen = result.startsWith('-') ? 6 : 5;
  return result.slice(0, maxLen);
}

export type SprKeypadKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | '/'
  | '-'
  | 'BACKSPACE'
  | 'CLEAR';

export function applySprKeypadKey(
  currentValue: string,
  key: SprKeypadKey
): string {
  if (key === 'CLEAR') return '';
  if (key === 'BACKSPACE') return currentValue.slice(0, -1);
  if (key === '-') {
    if (currentValue.length === 0) return '-';
    return currentValue;
  }
  return sanitizeSprAnswer(currentValue + key);
}

export interface SprPreviewFormatted {
  isEmpty: boolean;
  isFraction: boolean;
  isNegative: boolean;
  numerator?: string;
  denominator?: string;
  plainDisplay: string;
}

export function formatSprPreviewParts(val: string): SprPreviewFormatted {
  const trimmed = (val || '').trim();
  if (!trimmed) {
    return {
      isEmpty: true,
      isFraction: false,
      isNegative: false,
      plainDisplay: '',
    };
  }

  const isNegative = trimmed.startsWith('-');
  const unsigned = isNegative ? trimmed.slice(1) : trimmed;

  if (unsigned.includes('/')) {
    const [num, den] = unsigned.split('/');
    return {
      isEmpty: false,
      isFraction: true,
      isNegative,
      numerator: num || '',
      denominator: den || '',
      plainDisplay: `${isNegative ? '−' : ''}${num || ''}/${den || ''}`,
    };
  }

  return {
    isEmpty: false,
    isFraction: false,
    isNegative,
    plainDisplay: isNegative ? `−${unsigned}` : unsigned,
  };
}

export interface McqEliminationResult {
  selectedAnswer: string;
  eliminatedChoices: string[];
}

/**
 * Eliminating an MCQ choice in Bluebook:
 * - Adds choiceId to eliminatedChoices
 * - CRITICAL (00:21-00:22 in video): If choiceId was the currently selected answer,
 *   clears selectedAnswer to '' so the question becomes Unanswered!
 */
export function eliminateMcqChoice(
  currentSelectedAnswer: string,
  currentEliminatedChoices: string[],
  choiceId: string
): McqEliminationResult {
  const nextEliminated = currentEliminatedChoices.includes(choiceId)
    ? currentEliminatedChoices
    : [...currentEliminatedChoices, choiceId];

  const nextSelected =
    currentSelectedAnswer === choiceId ? '' : currentSelectedAnswer;

  return {
    selectedAnswer: nextSelected,
    eliminatedChoices: nextEliminated,
  };
}

/**
 * Clicking "Undo" next to an eliminated choice:
 * - Removes choiceId from eliminatedChoices
 * - Keeps selectedAnswer as-is (does NOT re-select the previously cleared answer)
 */
export function undoEliminateMcqChoice(
  currentSelectedAnswer: string,
  currentEliminatedChoices: string[],
  choiceId: string
): McqEliminationResult {
  return {
    selectedAnswer: currentSelectedAnswer,
    eliminatedChoices: currentEliminatedChoices.filter((c) => c !== choiceId),
  };
}

/**
 * Selecting an MCQ choice card directly:
 * - Sets selectedAnswer to choiceId
 * - If choiceId was eliminated, removes it from eliminatedChoices
 */
export function selectMcqChoice(
  _currentSelectedAnswer: string,
  currentEliminatedChoices: string[],
  choiceId: string
): McqEliminationResult {
  return {
    selectedAnswer: choiceId,
    eliminatedChoices: currentEliminatedChoices.filter((c) => c !== choiceId),
  };
}

/**
 * Determines whether a question uses the single-column centered layout (00:15-00:56)
 * or the 2-column split-pane layout (00:00-00:14).
 * - SPR questions ALWAYS use split-pane (left pane shows "Student-produced response directions").
 * - Questions with passageHtml use split-pane.
 * - MCQ questions with no passageHtml use the single-column centered layout.
 */
export function shouldUseSingleColumnLayout(question: SATQuestion): boolean {
  if (question.type === 'spr') return false;
  const hasPassage = Boolean(
    question.passageHtml && question.passageHtml.trim().length > 0
  );
  return !hasPassage;
}

export interface QuestionTileState {
  questionNumber: number;
  isCurrent: boolean;
  isAnswered: boolean;
  isFlagged: boolean;
}

export function getQuestionTileState(
  questionId: string,
  index: number,
  currentIndex: number,
  answersMap: Record<string, string>,
  starredSet: Set<string>
): QuestionTileState {
  const ans = (answersMap[questionId] ?? '').trim();
  return {
    questionNumber: index + 1,
    isCurrent: index === currentIndex,
    isAnswered: ans.length > 0,
    isFlagged: starredSet.has(questionId),
  };
}

/**
 * Evaluates an expression in the Bluebook Scientific Calculator (00:48-00:49).
 */
export function evaluateScientificExpression(
  expr: string,
  angleMode: 'RAD' | 'DEG' = 'RAD',
  lastAns = 0
): string {
  const trimmed = expr.trim();
  if (!trimmed) return '';

  try {
    const toRad = (x: number) =>
      angleMode === 'DEG' ? (x * Math.PI) / 180 : x;

    const scope = {
      sin: (x: number) => Math.sin(toRad(x)),
      cos: (x: number) => Math.cos(toRad(x)),
      tan: (x: number) => Math.tan(toRad(x)),
      sqrt: (x: number) => Math.sqrt(x),
      nthroot: (n: number, x: number) => Math.pow(x, 1 / n),
      abs: (x: number) => Math.abs(x),
      PI: Math.PI,
      ANS: lastAns,
    };

    const normalized = trimmed
      .replace(/π/g, 'PI')
      .replace(/\bans\b/gi, 'ANS')
      .replace(/√\(/g, 'sqrt(')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/\^/g, '**');

    // Reject any unsafe characters outside math tokens
    if (/[^0-9+\-*/().,\sA-Za-z_]/.test(normalized)) {
      return '';
    }

    // eslint-disable-next-line no-new-func
    const fn = new Function(
      'scope',
      `with (scope) { return (${normalized}); }`
    );
    const val = fn(scope);
    if (typeof val === 'number' && Number.isFinite(val)) {
      return String(Number(val.toFixed(8)));
    }
    return '';
  } catch {
    return '';
  }
}

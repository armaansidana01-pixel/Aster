import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeSprAnswer,
  applySprKeypadKey,
  formatSprPreviewParts,
  eliminateMcqChoice,
  undoEliminateMcqChoice,
  selectMcqChoice,
  shouldUseSingleColumnLayout,
  getQuestionTileState,
  evaluateScientificExpression,
  getRwModuleMinutes,
  getMathModuleMinutes,
  getScheduledBreakDurationSeconds,
  getBreakScreenState,
  tickBreakTimers,
  shouldTriggerScheduledBreakAfterModule,
  buildMockExamModules,
} from './bluebookRules';
import { SATQuestion, TestStartConfig } from '../types';

test('SPR character limit: max 5 chars for positive, max 6 chars for negative', () => {
  assert.equal(sanitizeSprAnswer('1234567'), '12345');
  assert.equal(sanitizeSprAnswer('-1234567'), '-12345');
  assert.equal(sanitizeSprAnswer('3.50'), '3.50');
  assert.equal(sanitizeSprAnswer('7/2'), '7/2');
  assert.equal(sanitizeSprAnswer('$12,3%'), '123');
});

test('SPR keypad actions: digits, backspace, clear, and negative sign', () => {
  let val = '';
  val = applySprKeypadKey(val, '-');
  val = applySprKeypadKey(val, '2');
  val = applySprKeypadKey(val, '1');
  assert.equal(val, '-21');

  val = applySprKeypadKey(val, 'BACKSPACE');
  assert.equal(val, '-2');

  val = applySprKeypadKey(val, 'CLEAR');
  assert.equal(val, '');
});

test('SPR live preview formatting handles negative numbers and fractions', () => {
  const neg = formatSprPreviewParts('-21');
  assert.equal(neg.isNegative, true);
  assert.equal(neg.plainDisplay, '−21');

  const frac = formatSprPreviewParts('7/2');
  assert.equal(frac.isFraction, true);
  assert.equal(frac.numerator, '7');
  assert.equal(frac.denominator, '2');
});

test('Eliminating a selected MCQ choice clears the selected answer, and Undo keeps it unselected', () => {
  // User selects Choice C
  const step1 = selectMcqChoice('', [], 'C');
  assert.equal(step1.selectedAnswer, 'C');
  assert.deepEqual(step1.eliminatedChoices, []);

  // User clicks cross-out next to Choice C (00:21 in video) -> clears selection!
  const step2 = eliminateMcqChoice(
    step1.selectedAnswer,
    step1.eliminatedChoices,
    'C'
  );
  assert.equal(step2.selectedAnswer, '');
  assert.deepEqual(step2.eliminatedChoices, ['C']);

  // User clicks Undo next to Choice C (00:22 in video) -> restores C as unselected
  const step3 = undoEliminateMcqChoice(
    step2.selectedAnswer,
    step2.eliminatedChoices,
    'C'
  );
  assert.equal(step3.selectedAnswer, '');
  assert.deepEqual(step3.eliminatedChoices, []);
});

test('Question Selector tile state tracks current, answered, and flagged states accurately', () => {
  const answers = { q1: '21', q2: '', q3: 'B' };
  const starred = new Set(['q3']);

  const t1 = getQuestionTileState('q1', 0, 2, answers, starred);
  assert.equal(t1.isAnswered, true);
  assert.equal(t1.isCurrent, false);
  assert.equal(t1.isFlagged, false);

  const t3 = getQuestionTileState('q3', 2, 2, answers, starred);
  assert.equal(t3.isAnswered, true);
  assert.equal(t3.isCurrent, true);
  assert.equal(t3.isFlagged, true);
});

test('Adaptive layout uses split-pane for SPR & passage items, single-column for passage-free Math MCQs', () => {
  const sprQ = {
    id: 'q1',
    type: 'spr',
    passageHtml: '',
  } as SATQuestion;
  const mathMcqNoPassage = {
    id: 'q3',
    type: 'mcq',
    passageHtml: '',
  } as SATQuestion;
  const rwMcqWithPassage = {
    id: 'q4',
    type: 'mcq',
    passageHtml: '<p>Some passage text</p>',
  } as SATQuestion;

  assert.equal(shouldUseSingleColumnLayout(sprQ), false);
  assert.equal(shouldUseSingleColumnLayout(mathMcqNoPassage), true);
  assert.equal(shouldUseSingleColumnLayout(rwMcqWithPassage), false);
});

test('Scientific calculator evaluator supports RAD/DEG trig, powers, and pi', () => {
  assert.equal(evaluateScientificExpression('1 + 2 * 3'), '7');
  assert.equal(evaluateScientificExpression('sin(30)', 'DEG'), '0.5');
  assert.equal(evaluateScientificExpression('sqrt(81)'), '9');
});

test('Mock Exam section time multipliers and break durations follow Digital SAT rules', () => {
  const baseAccommodations = {
    timeMultiplier: 1 as const,
    rwTimeMultiplier: 1 as const,
    mathTimeMultiplier: 1.5 as const,
    extraBreaks: false,
    extendedBreaks: false,
    breaksAsNeeded: false,
    lineReaderDefault: false,
    largeTextZoom: false,
  };

  assert.equal(getRwModuleMinutes(baseAccommodations), 32);
  assert.equal(getMathModuleMinutes(baseAccommodations), 53);
  assert.equal(getScheduledBreakDurationSeconds(baseAccommodations), 600);
  assert.equal(
    getScheduledBreakDurationSeconds({
      ...baseAccommodations,
      extendedBreaks: true,
    }),
    900
  );
});

test('shouldTriggerScheduledBreakAfterModule triggers 1 break at halfway point or 3 breaks with Extra Breaks', () => {
  // Standard 4-module test: only after Module 2 (index 1)
  assert.equal(shouldTriggerScheduledBreakAfterModule(0, 4, false), false);
  assert.equal(shouldTriggerScheduledBreakAfterModule(1, 4, false), true);
  assert.equal(shouldTriggerScheduledBreakAfterModule(2, 4, false), false);
  assert.equal(shouldTriggerScheduledBreakAfterModule(3, 4, false), false);

  // Extra breaks on 4-module test: after Mod 1 (0), Mod 2 (1), and Mod 3 (2) -> 3 breaks total
  assert.equal(shouldTriggerScheduledBreakAfterModule(0, 4, true), true);
  assert.equal(shouldTriggerScheduledBreakAfterModule(1, 4, true), true);
  assert.equal(shouldTriggerScheduledBreakAfterModule(2, 4, true), true);
  assert.equal(shouldTriggerScheduledBreakAfterModule(3, 4, true), false);

  // Single-section 2-module test: break between Module 1 (0) and Module 2 (1)
  assert.equal(shouldTriggerScheduledBreakAfterModule(0, 2, false), true);
  assert.equal(shouldTriggerScheduledBreakAfterModule(1, 2, false), false);
});

test('buildMockExamModules splits 98 questions into 4 modules (27 R&W, 27 R&W, 22 Math, 22 Math)', () => {
  const questions: SATQuestion[] = [
    ...Array.from({ length: 54 }, (_, i) => ({
      id: `rw-${i + 1}`,
      section: 'reading_writing' as const,
      type: 'mcq' as const,
    } as unknown as SATQuestion)),
    ...Array.from({ length: 44 }, (_, i) => ({
      id: `math-${i + 1}`,
      section: 'math' as const,
      type: 'mcq' as const,
    } as unknown as SATQuestion)),
  ];

  const config = {
    mode: 'mock',
    mockSections: 'both',
    accommodations: {
      timeMultiplier: 1,
      rwTimeMultiplier: 1,
      mathTimeMultiplier: 1,
      extraBreaks: false,
      extendedBreaks: false,
      breaksAsNeeded: false,
      lineReaderDefault: false,
      largeTextZoom: false,
    },
  } as unknown as TestStartConfig;

  const modules = buildMockExamModules(questions, config);
  assert.equal(modules.length, 4);
  assert.equal(modules[0].headerTitle, 'Section 1, Module 1: Reading and Writing');
  assert.equal(modules[0].questions.length, 27);
  assert.equal(modules[0].durationSeconds, 32 * 60);

  assert.equal(modules[1].headerTitle, 'Section 1, Module 2: Reading and Writing');
  assert.equal(modules[1].questions.length, 27);
  assert.equal(modules[1].durationSeconds, 32 * 60);

  assert.equal(modules[2].headerTitle, 'Section 2, Module 1: Math');
  assert.equal(modules[2].questions.length, 22);
  assert.equal(modules[2].durationSeconds, 35 * 60);

  assert.equal(modules[3].headerTitle, 'Section 2, Module 2: Math');
  assert.equal(modules[3].questions.length, 22);
  assert.equal(modules[3].durationSeconds, 35 * 60);
});

test('Break Screen state: nominal suggested break, 9:00 red warning, 10:00 auto-starting next section timer, and early-stop warning flag', () => {
  // 1. Start of 10-minute break (600s remaining, 0s elapsed)
  const initial = getBreakScreenState({
    breakIsAsNeeded: false,
    totalBreakSeconds: 600,
    breakRemainingSeconds: 600,
    nextModuleRemainingSeconds: 2100,
    currentSectionTitle: 'Section 1, Module 2: Reading and Writing',
    nextModuleTitle: 'Section 2, Module 1: Math',
  });
  assert.equal(initial.phase, 'suggested_nominal');
  assert.equal(initial.isWarningRed, false);
  assert.equal(initial.isNextSectionTimerRunning, false);
  assert.equal(initial.requiresEarlyStopWarning, true);
  assert.equal(initial.displayedTimerSeconds, 600);
  assert.equal(initial.warningBannerText, null);
  assert.equal(
    initial.descriptionHeader,
    'Take a Suggested Break: Do Not Close Your Device'
  );

  // 2. At 9:00 elapsed (60s remaining out of 600s) -> Red Warning Appears
  const atNineMin = getBreakScreenState({
    breakIsAsNeeded: false,
    totalBreakSeconds: 600,
    breakRemainingSeconds: 60,
    nextModuleRemainingSeconds: 2100,
    currentSectionTitle: 'Section 1, Module 2: Reading and Writing',
    nextModuleTitle: 'Section 2, Module 1: Math',
  });
  assert.equal(atNineMin.phase, 'suggested_warning_red');
  assert.equal(atNineMin.isWarningRed, true);
  assert.equal(atNineMin.isNextSectionTimerRunning, false);
  assert.equal(atNineMin.requiresEarlyStopWarning, true);
  assert.equal(atNineMin.displayedTimerSeconds, 60);
  assert.equal(atNineMin.elapsedBreakSeconds, 540);
  assert.ok(atNineMin.warningBannerText?.includes('9:00 elapsed'));

  // 3. At 10:00 elapsed (0s remaining on break) -> Next Section Timer Automatically Starts & Description Header Changes
  const tick1 = tickBreakTimers({
    breakRemainingSeconds: 0,
    nextModuleRemainingSeconds: 2100,
  });
  assert.equal(tick1.breakRemainingSeconds, 0);
  assert.equal(tick1.nextModuleRemainingSeconds, 2099);

  const atTenMin = getBreakScreenState({
    breakIsAsNeeded: false,
    totalBreakSeconds: 600,
    breakRemainingSeconds: tick1.breakRemainingSeconds,
    nextModuleRemainingSeconds: tick1.nextModuleRemainingSeconds,
    currentSectionTitle: 'Section 1, Module 2: Reading and Writing',
    nextModuleTitle: 'Section 2, Module 1: Math',
  });
  assert.equal(atTenMin.phase, 'next_section_timer_running');
  assert.equal(atTenMin.isWarningRed, true);
  assert.equal(atTenMin.isNextSectionTimerRunning, true);
  assert.equal(atTenMin.requiresEarlyStopWarning, false);
  assert.equal(atTenMin.displayedTimerSeconds, 2099);
  assert.equal(atTenMin.timerBoxLabel, 'Next Section Time Remaining:');
  assert.equal(
    atTenMin.descriptionHeader,
    'Suggested Break Ended: Next Section Timer Has Started'
  );
});

test('Mobile breakpoint (<768px) collapses all menus by default on TestStartScreen', async () => {
  const {
    getInitialTestStartMenuState,
    isMobileViewport,
    getHapticPattern,
  } = await import('./haptics');

  assert.equal(isMobileViewport(390), true);
  assert.equal(isMobileViewport(767), true);
  assert.equal(isMobileViewport(768), false);
  assert.equal(isMobileViewport(1440), false);

  const mobileState = getInitialTestStartMenuState(true, 'practice');
  assert.equal(mobileState.expandedMode, null);
  assert.equal(mobileState.suggestedDropdownOpen, false);
  assert.equal(
    Object.values(mobileState.expandedDomains).every((v) => v === false),
    true
  );

  const desktopState = getInitialTestStartMenuState(false, 'practice');
  assert.equal(desktopState.expandedMode, 'practice');
  assert.equal(desktopState.suggestedDropdownOpen, true);
  assert.equal(
    Object.values(desktopState.expandedDomains).every((v) => v === true),
    true
  );

  assert.deepEqual(getHapticPattern('start_test'), [18, 35, 28]);
  assert.equal(getHapticPattern('intro_step'), 14);
  assert.equal(getHapticPattern('tab_switch'), 10);
});


import test from 'node:test';
import assert from 'node:assert/strict';
import { BUNDLED_SAT_QUESTIONS } from '../data/satQuestionBank';
import { calculateAndSelectQuestionPool } from './poolCalculator';
import {
  computeComprehensiveDiagnostics,
  DEFAULT_DIAGNOSTIC_WEIGHTS,
} from './diagnosticEngine';
import { ImportedScoreReport, TestSession, TestStartConfig } from '../types';

const baseConfig: TestStartConfig = {
  mode: 'drill',
  mockSections: 'both',
  selectedDomains: ['INI', 'ALG'],
  selectedSkills: [],
  difficulties: ['E', 'M', 'H'],
  excludeActivePracticeTests: true,
  questionPoolFilter: 'unanswered_only',
  allowPoolExhaustionFallback: false,
  practiceCompletedBehavior: 'plain_run_through',
  drillLength: 4,
  accommodations: {
    timeMultiplier: 1,
    extraBreaks: false,
    lineReaderDefault: false,
    largeTextZoom: false,
  },
};

test('poolCalculator excludes active practice test questions when requested', () => {
  const result = calculateAndSelectQuestionPool(
    BUNDLED_SAT_QUESTIONS,
    new Set(),
    baseConfig
  );
  assert.ok(result.selectedQuestions.length > 0);
  for (const q of result.selectedQuestions) {
    assert.equal(q.isActivePracticeTest, false);
  }
});

test('poolCalculator detects unseen pool exhaustion and respects fallback decision', () => {
  const allIniIds = new Set(
    BUNDLED_SAT_QUESTIONS.filter((q) => q.domain === 'INI').map((q) => q.id)
  );
  const exhaustedConfig: TestStartConfig = {
    ...baseConfig,
    selectedDomains: ['INI'],
    drillLength: 4,
    allowPoolExhaustionFallback: false,
  };

  const resWithoutFallback = calculateAndSelectQuestionPool(
    BUNDLED_SAT_QUESTIONS,
    allIniIds,
    exhaustedConfig
  );
  assert.equal(resWithoutFallback.isUnseenSufficientForRepresentativeSession, false);
  assert.equal(resWithoutFallback.selectedQuestions.length, 0);
  assert.ok(resWithoutFallback.exhaustionMessage);

  const resWithFallback = calculateAndSelectQuestionPool(
    BUNDLED_SAT_QUESTIONS,
    allIniIds,
    { ...exhaustedConfig, allowPoolExhaustionFallback: true }
  );
  assert.equal(resWithFallback.usedFallbackToAnswered, true);
  assert.ok(resWithFallback.selectedQuestions.length > 0);
});

test('diagnosticEngine excludes AI-assisted and repeat attempts and respects deselected data points', () => {
  const mockSession: TestSession = {
    id: 'sess-1',
    title: 'Full Adaptive Mock Exam 1',
    mode: 'mock',
    startedAt: '2026-10-20T10:00:00.000Z',
    completedAt: '2026-10-20T12:00:00.000Z',
    config: { ...baseConfig, mode: 'mock' },
    questionIds: ['b8c322b1', 'm101a8b2'],
    includedInDiagnostics: true,
    attempts: [
      {
        questionId: 'b8c322b1',
        sessionId: 'sess-1',
        timestamp: '2026-10-20T10:05:00.000Z',
        mode: 'mock',
        section: 'reading_writing',
        domain: 'INI',
        skill: 'Inferences',
        difficulty: 'H',
        irtDifficulty: 1.45,
        selectedAnswer: 'A',
        isCorrect: true,
        timeSpentSec: 75,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
    ],
  };

  const drillWithAiAndRepeat: TestSession = {
    id: 'sess-2',
    title: 'Targeted Drill',
    mode: 'drill',
    startedAt: '2026-10-25T10:00:00.000Z',
    completedAt: '2026-10-25T10:20:00.000Z',
    config: baseConfig,
    questionIds: ['b8c322b1', 'm101a8b2'],
    includedInDiagnostics: true,
    attempts: [
      {
        // Repeat of b8c322b1 from sess-1 -> must be excluded as repeat
        questionId: 'b8c322b1',
        sessionId: 'sess-2',
        timestamp: '2026-10-25T10:05:00.000Z',
        mode: 'drill',
        section: 'reading_writing',
        domain: 'INI',
        skill: 'Inferences',
        difficulty: 'H',
        irtDifficulty: 1.45,
        selectedAnswer: 'A',
        isCorrect: true,
        timeSpentSec: 40,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: true,
        countsTowardDiagnostics: false,
      },
      {
        // Used AI before submit in drill -> must be excluded
        questionId: 'm101a8b2',
        sessionId: 'sess-2',
        timestamp: '2026-10-25T10:10:00.000Z',
        mode: 'drill',
        section: 'math',
        domain: 'ALG',
        skill: 'Systems of two linear equations in two variables',
        difficulty: 'H',
        irtDifficulty: 1.4,
        selectedAnswer: '-14',
        isCorrect: true,
        timeSpentSec: 95,
        usedAiBeforeSubmit: true,
        isRepeatAttempt: false,
        countsTowardDiagnostics: false,
      },
    ],
  };

  const importedReport: ImportedScoreReport = {
    id: 'imp-1',
    testType: 'SAT',
    testDate: '2026-09-15',
    label: 'Official October SAT Report',
    importMethod: 'pdf_report',
    totalScore: 1480,
    rwScore: 730,
    mathScore: 750,
    includedInDiagnostics: true,
    domainBands: {} as ImportedScoreReport['domainBands'],
  };

  const diag = computeComprehensiveDiagnostics(
    [mockSession, drillWithAiAndRepeat],
    [importedReport],
    DEFAULT_DIAGNOSTIC_WEIGHTS,
    new Date('2026-11-01T00:00:00Z').getTime()
  );

  assert.equal(diag.totalValidAttempts, 1);
  assert.equal(diag.totalExcludedAiAttempts, 1);
  assert.equal(diag.totalExcludedRepeatAttempts, 1);
  assert.ok(diag.predictedTotalScore >= 1200 && diag.predictedTotalScore <= 1600);
});

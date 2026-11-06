/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChatMessage,
  ChatThread,
  DiagnosticWeights,
  DrillSuggestion,
  ImportedScoreReport,
  InProgressSession,
  ReimportJobStatus,
  SATQuestion,
  TestSession,
  TestStartConfig,
  UserProfileAndSettings,
} from './types';
import { BUNDLED_SAT_QUESTIONS, SAT_DOMAINS } from './data/satQuestionBank';
import {
  computeComprehensiveDiagnostics,
  DEFAULT_DIAGNOSTIC_WEIGHTS,
} from './utils/diagnosticEngine';
import {
  auth,
  onAuthStateChanged,
  User,
  saveWorkspaceToFirestore,
  loadWorkspaceFromFirestore,
  deleteUserAccount,
} from './firebase';
import { AsterOrbLogo } from './components/AsterOrbLogo';
import {
  FIRST_OPEN_OVERLAY_STORAGE_KEY,
  FirstOpenWelcomeOverlay,
} from './components/FirstOpenWelcomeOverlay';
import { IntroductionTab } from './components/IntroductionTab';
import { TestStartScreen } from './components/TestStartScreen';
import { BluebookTestingScreen } from './components/BluebookTestingScreen';
import { DiagnosticsScreen } from './components/DiagnosticsScreen';
import { AiStudioTab } from './components/AiStudioTab';
import { SettingsTab } from './components/SettingsTab';
import { buildDefaultDomainBands } from './components/ScoreReportImporter';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { triggerHaptic } from './utils/haptics';
import {
  Play,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  X,
  Compass,
  Layers,
  BarChart2,
  Sparkles,
  Sliders,
} from 'lucide-react';

type ActiveTab =
  | 'intro'
  | 'test_start'
  | 'testing'
  | 'diagnostics'
  | 'ai'
  | 'settings';

const STORAGE_KEY = 'aster_sat_studio_v1';

const INITIAL_PROFILE: UserProfileAndSettings = {
  hasCompletedOnboarding: false,
  name: 'Armaan Sidana',
  nextTestDate: '2026-12-05',
  intendedTotalScore: 1540,
  intendedRwScore: 760,
  intendedMathScore: 780,
  studyGoal: 'balanced_1500',
  theme: 'light',
  allowAiSettingsAccess: true,
  defaultExcludePracticeTests: true,
  defaultAccommodations: {
    timeMultiplier: 1,
    extraBreaks: false,
    lineReaderDefault: false,
    largeTextZoom: false,
  },
  notifications: {
    dailyStudyReminder: true,
    reminderTime: '18:00',
    testDateCountdownAlerts: true,
    weeklyDiagnosticDigest: true,
  },
};

const INITIAL_IMPORTED_REPORTS: ImportedScoreReport[] = [
  {
    id: 'official-oct-sat',
    testType: 'SAT',
    testDate: '2026-10-03',
    label: 'Official October Digital SAT Score Report',
    importMethod: 'pdf_report',
    totalScore: 1440,
    rwScore: 710,
    mathScore: 730,
    percentile: 96,
    domainBands: (() => {
      const b = buildDefaultDomainBands(710, 730);
      b.INI.scoreBand = '680–740 (6/7 bars)';
      b.INI.estimatedMasteryPct = 85;
      b.CAS.scoreBand = '700–760 (7/7 bars)';
      b.CAS.estimatedMasteryPct = 90;
      b.EOI.scoreBand = '650–710 (5/7 bars)';
      b.EOI.estimatedMasteryPct = 76;
      b.SEC.scoreBand = '710–770 (7/7 bars)';
      b.SEC.estimatedMasteryPct = 91;
      b.ALG.scoreBand = '730–790 (7/7 bars)';
      b.ALG.estimatedMasteryPct = 93;
      b.ADV.scoreBand = '690–750 (6/7 bars)';
      b.ADV.estimatedMasteryPct = 84;
      b.PSD.scoreBand = '700–760 (6/7 bars)';
      b.PSD.estimatedMasteryPct = 87;
      b.GEO.scoreBand = '630–690 (5/7 bars)';
      b.GEO.estimatedMasteryPct = 72;
      return b;
    })(),
    rawSummaryNotes:
      'Strong performance in Algebra and Standard English Conventions; best opportunity for extra points in Geometry & Trigonometry (Circles) and Expression of Ideas.',
    includedInDiagnostics: true,
  },
];

const INITIAL_SESSIONS: TestSession[] = [
  {
    id: 'seed-drill-0',
    title: 'Baseline Study Drill #1',
    mode: 'drill',
    startedAt: '2026-10-05T15:00:00.000Z',
    completedAt: '2026-10-05T15:25:00.000Z',
    config: {
      mode: 'drill',
      mockSections: 'both',
      selectedDomains: SAT_DOMAINS.map((d) => d.id),
      selectedSkills: [],
      difficulties: ['E', 'M', 'H'],
      excludeActivePracticeTests: true,
      questionPoolFilter: 'unanswered_only',
      allowPoolExhaustionFallback: false,
      practiceCompletedBehavior: 'plain_run_through',
      drillLength: 8,
      accommodations: {
        timeMultiplier: 1,
        extraBreaks: false,
        lineReaderDefault: false,
        largeTextZoom: false,
      },
    },
    questionIds: ['b8c322b1', '55a891e0', 'm302b4e9', 'm401a2c9'],
    attempts: [
      {
        questionId: 'b8c322b1',
        sessionId: 'seed-drill-0',
        timestamp: '2026-10-05T15:05:00.000Z',
        mode: 'drill',
        section: 'reading_writing',
        domain: 'INI',
        skill: 'Inferences',
        difficulty: 'H',
        irtDifficulty: 1.45,
        selectedAnswer: 'A',
        isCorrect: true,
        timeSpentSec: 78,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: '55a891e0',
        sessionId: 'seed-drill-0',
        timestamp: '2026-10-05T15:10:00.000Z',
        mode: 'drill',
        section: 'reading_writing',
        domain: 'EOI',
        skill: 'Transitions',
        difficulty: 'M',
        irtDifficulty: 0.4,
        selectedAnswer: 'C',
        isCorrect: false,
        timeSpentSec: 70,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: 'm302b4e9',
        sessionId: 'seed-drill-0',
        timestamp: '2026-10-05T15:16:00.000Z',
        mode: 'drill',
        section: 'math',
        domain: 'PSD',
        skill: 'Percentages',
        difficulty: 'M',
        irtDifficulty: 0.4,
        selectedAnswer: 'A',
        isCorrect: true,
        timeSpentSec: 65,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: 'm401a2c9',
        sessionId: 'seed-drill-0',
        timestamp: '2026-10-05T15:22:00.000Z',
        mode: 'drill',
        section: 'math',
        domain: 'GEO',
        skill: 'Circles',
        difficulty: 'H',
        irtDifficulty: 1.6,
        selectedAnswer: '36',
        isCorrect: false,
        timeSpentSec: 95,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
    ],
    scaledScore: {
      total: 1390,
      rw: 690,
      math: 700,
      rwModule2Tier: 'harder',
      mathModule2Tier: 'harder',
    },
    includedInDiagnostics: true,
  },
  {
    id: 'seed-practice-1',
    title: 'R&W & Algebra Practice Set',
    mode: 'practice',
    startedAt: '2026-10-12T17:00:00.000Z',
    completedAt: '2026-10-12T17:40:00.000Z',
    config: {
      mode: 'practice',
      mockSections: 'both',
      selectedDomains: ['CAS', 'SEC', 'ALG', 'ADV'],
      selectedSkills: [],
      difficulties: ['M', 'H'],
      excludeActivePracticeTests: true,
      questionPoolFilter: 'unanswered_only',
      allowPoolExhaustionFallback: false,
      practiceCompletedBehavior: 'plain_run_through',
      drillLength: 10,
      accommodations: {
        timeMultiplier: 1,
        extraBreaks: false,
        lineReaderDefault: false,
        largeTextZoom: false,
      },
    },
    questionIds: ['d2019fa8', '33f019b7', 'm101a8b2', 'm201d4c8'],
    attempts: [
      {
        questionId: 'd2019fa8',
        sessionId: 'seed-practice-1',
        timestamp: '2026-10-12T17:08:00.000Z',
        mode: 'practice',
        section: 'reading_writing',
        domain: 'CAS',
        skill: 'Words in Context',
        difficulty: 'H',
        irtDifficulty: 1.35,
        selectedAnswer: 'A',
        isCorrect: true,
        timeSpentSec: 60,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: '33f019b7',
        sessionId: 'seed-practice-1',
        timestamp: '2026-10-12T17:16:00.000Z',
        mode: 'practice',
        section: 'reading_writing',
        domain: 'SEC',
        skill: 'Boundaries',
        difficulty: 'H',
        irtDifficulty: 1.5,
        selectedAnswer: 'A',
        isCorrect: true,
        timeSpentSec: 52,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: 'm101a8b2',
        sessionId: 'seed-practice-1',
        timestamp: '2026-10-12T17:25:00.000Z',
        mode: 'practice',
        section: 'math',
        domain: 'ALG',
        skill: 'Systems of two linear equations in two variables',
        difficulty: 'H',
        irtDifficulty: 1.4,
        selectedAnswer: '-14',
        isCorrect: true,
        timeSpentSec: 84,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: 'm201d4c8',
        sessionId: 'seed-practice-1',
        timestamp: '2026-10-12T17:35:00.000Z',
        mode: 'practice',
        section: 'math',
        domain: 'ADV',
        skill: 'Nonlinear equations in one variable and systems of equations in two variables',
        difficulty: 'H',
        irtDifficulty: 1.65,
        selectedAnswer: '12',
        isCorrect: false,
        timeSpentSec: 91,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
    ],
    scaledScore: {
      total: 1430,
      rw: 710,
      math: 720,
      rwModule2Tier: 'harder',
      mathModule2Tier: 'harder',
    },
    includedInDiagnostics: true,
  },
  {
    id: 'seed-mock-1',
    title: 'Digital SAT Practice Exam #1',
    mode: 'mock',
    startedAt: '2026-10-18T14:00:00.000Z',
    completedAt: '2026-10-18T16:10:00.000Z',
    config: {
      mode: 'mock',
      mockSections: 'both',
      selectedDomains: SAT_DOMAINS.map((d) => d.id),
      selectedSkills: [],
      difficulties: ['E', 'M', 'H'],
      excludeActivePracticeTests: true,
      questionPoolFilter: 'unanswered_only',
      allowPoolExhaustionFallback: false,
      practiceCompletedBehavior: 'plain_run_through',
      drillLength: 10,
      accommodations: {
        timeMultiplier: 1,
        extraBreaks: false,
        lineReaderDefault: false,
        largeTextZoom: false,
      },
    },
    questionIds: ['b8c322b1', 'd2019fa8', '55a891e0', '33f019b7', 'm101a8b2', 'm201d4c8', 'm302b4e9', 'm401a2c9'],
    attempts: [
      {
        questionId: 'b8c322b1',
        sessionId: 'seed-mock-1',
        timestamp: '2026-10-18T14:05:00.000Z',
        mode: 'mock',
        section: 'reading_writing',
        domain: 'INI',
        skill: 'Inferences',
        difficulty: 'H',
        irtDifficulty: 1.45,
        selectedAnswer: 'A',
        isCorrect: true,
        timeSpentSec: 72,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: 'd2019fa8',
        sessionId: 'seed-mock-1',
        timestamp: '2026-10-18T14:08:00.000Z',
        mode: 'mock',
        section: 'reading_writing',
        domain: 'CAS',
        skill: 'Words in Context',
        difficulty: 'H',
        irtDifficulty: 1.35,
        selectedAnswer: 'A',
        isCorrect: true,
        timeSpentSec: 54,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: '55a891e0',
        sessionId: 'seed-mock-1',
        timestamp: '2026-10-18T14:12:00.000Z',
        mode: 'mock',
        section: 'reading_writing',
        domain: 'EOI',
        skill: 'Transitions',
        difficulty: 'M',
        irtDifficulty: 0.4,
        selectedAnswer: 'B',
        isCorrect: false,
        timeSpentSec: 68,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: '33f019b7',
        sessionId: 'seed-mock-1',
        timestamp: '2026-10-18T14:15:00.000Z',
        mode: 'mock',
        section: 'reading_writing',
        domain: 'SEC',
        skill: 'Boundaries',
        difficulty: 'H',
        irtDifficulty: 1.5,
        selectedAnswer: 'A',
        isCorrect: true,
        timeSpentSec: 49,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: 'm101a8b2',
        sessionId: 'seed-mock-1',
        timestamp: '2026-10-18T15:05:00.000Z',
        mode: 'mock',
        section: 'math',
        domain: 'ALG',
        skill: 'Systems of two linear equations in two variables',
        difficulty: 'H',
        irtDifficulty: 1.4,
        selectedAnswer: '-14',
        isCorrect: true,
        timeSpentSec: 88,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: 'm201d4c8',
        sessionId: 'seed-mock-1',
        timestamp: '2026-10-18T15:10:00.000Z',
        mode: 'mock',
        section: 'math',
        domain: 'ADV',
        skill: 'Nonlinear equations in one variable and systems of equations in two variables',
        difficulty: 'H',
        irtDifficulty: 1.65,
        selectedAnswer: '15',
        isCorrect: true,
        timeSpentSec: 95,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: 'm302b4e9',
        sessionId: 'seed-mock-1',
        timestamp: '2026-10-18T15:15:00.000Z',
        mode: 'mock',
        section: 'math',
        domain: 'PSD',
        skill: 'Percentages',
        difficulty: 'M',
        irtDifficulty: 0.4,
        selectedAnswer: 'A',
        isCorrect: true,
        timeSpentSec: 61,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: 'm401a2c9',
        sessionId: 'seed-mock-1',
        timestamp: '2026-10-18T15:20:00.000Z',
        mode: 'mock',
        section: 'math',
        domain: 'GEO',
        skill: 'Circles',
        difficulty: 'H',
        irtDifficulty: 1.6,
        selectedAnswer: '49',
        isCorrect: false,
        timeSpentSec: 102,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
    ],
    scaledScore: {
      total: 1470,
      rw: 730,
      math: 740,
      rwModule2Tier: 'harder',
      mathModule2Tier: 'harder',
    },
    includedInDiagnostics: true,
  },
  {
    id: 'seed-mock-2',
    title: 'Digital SAT Practice Exam #2',
    mode: 'mock',
    startedAt: '2026-10-29T14:00:00.000Z',
    completedAt: '2026-10-29T16:05:00.000Z',
    config: {
      mode: 'mock',
      mockSections: 'both',
      selectedDomains: SAT_DOMAINS.map((d) => d.id),
      selectedSkills: [],
      difficulties: ['E', 'M', 'H'],
      excludeActivePracticeTests: true,
      questionPoolFilter: 'unanswered_only',
      allowPoolExhaustionFallback: false,
      practiceCompletedBehavior: 'plain_run_through',
      drillLength: 10,
      accommodations: {
        timeMultiplier: 1,
        extraBreaks: false,
        lineReaderDefault: false,
        largeTextZoom: false,
      },
    },
    questionIds: ['f3821cb9', 'a9120bc4', '91c402a1', '77b120e4', 'm102c9f1', 'm202e7a1', 'm301f8a2', 'm402d1b7'],
    attempts: [
      {
        questionId: 'f3821cb9',
        sessionId: 'seed-mock-2',
        timestamp: '2026-10-29T14:06:00.000Z',
        mode: 'mock',
        section: 'reading_writing',
        domain: 'INI',
        skill: 'Command of Evidence (Quantitative)',
        difficulty: 'M',
        irtDifficulty: 0.35,
        selectedAnswer: 'B',
        isCorrect: true,
        timeSpentSec: 64,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: 'a9120bc4',
        sessionId: 'seed-mock-2',
        timestamp: '2026-10-29T14:12:00.000Z',
        mode: 'mock',
        section: 'reading_writing',
        domain: 'CAS',
        skill: 'Cross-Text Connections',
        difficulty: 'H',
        irtDifficulty: 1.55,
        selectedAnswer: 'C',
        isCorrect: true,
        timeSpentSec: 71,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: '91c402a1',
        sessionId: 'seed-mock-2',
        timestamp: '2026-10-29T14:18:00.000Z',
        mode: 'mock',
        section: 'reading_writing',
        domain: 'EOI',
        skill: 'Rhetorical Synthesis',
        difficulty: 'M',
        irtDifficulty: 0.25,
        selectedAnswer: 'B',
        isCorrect: true,
        timeSpentSec: 58,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: '77b120e4',
        sessionId: 'seed-mock-2',
        timestamp: '2026-10-29T14:24:00.000Z',
        mode: 'mock',
        section: 'reading_writing',
        domain: 'SEC',
        skill: 'Form, Structure, and Sense',
        difficulty: 'M',
        irtDifficulty: 0.5,
        selectedAnswer: 'B',
        isCorrect: true,
        timeSpentSec: 46,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: 'm102c9f1',
        sessionId: 'seed-mock-2',
        timestamp: '2026-10-29T15:05:00.000Z',
        mode: 'mock',
        section: 'math',
        domain: 'ALG',
        skill: 'Linear functions',
        difficulty: 'M',
        irtDifficulty: 0.3,
        selectedAnswer: 'B',
        isCorrect: true,
        timeSpentSec: 59,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: 'm202e7a1',
        sessionId: 'seed-mock-2',
        timestamp: '2026-10-29T15:12:00.000Z',
        mode: 'mock',
        section: 'math',
        domain: 'ADV',
        skill: 'Nonlinear functions',
        difficulty: 'H',
        irtDifficulty: 1.5,
        selectedAnswer: 'C',
        isCorrect: true,
        timeSpentSec: 82,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: 'm301f8a2',
        sessionId: 'seed-mock-2',
        timestamp: '2026-10-29T15:18:00.000Z',
        mode: 'mock',
        section: 'math',
        domain: 'PSD',
        skill: 'Two-variable data: Models and scatterplots',
        difficulty: 'M',
        irtDifficulty: 0.45,
        selectedAnswer: 'B',
        isCorrect: true,
        timeSpentSec: 63,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
      {
        questionId: 'm402d1b7',
        sessionId: 'seed-mock-2',
        timestamp: '2026-10-29T15:25:00.000Z',
        mode: 'mock',
        section: 'math',
        domain: 'GEO',
        skill: 'Right triangles and trigonometry',
        difficulty: 'H',
        irtDifficulty: 1.45,
        selectedAnswer: 'A',
        isCorrect: true,
        timeSpentSec: 79,
        usedAiBeforeSubmit: false,
        isRepeatAttempt: false,
        countsTowardDiagnostics: true,
      },
    ],
    scaledScore: {
      total: 1510,
      rw: 750,
      math: 760,
      rwModule2Tier: 'harder',
      mathModule2Tier: 'harder',
    },
    includedInDiagnostics: true,
  },
];

export default function App() {
  const isAutostart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);

  const [showFirstOpenOverlay, setShowFirstOpenOverlay] = useState<boolean>(() => {
    if (isAutostart) return false;
    try {
      return localStorage.getItem(FIRST_OPEN_OVERLAY_STORAGE_KEY) !== 'true';
    } catch {
      return true;
    }
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Load persisted state from localStorage
  const savedState = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }, []);

  const [profile, setProfile] = useState<UserProfileAndSettings>(() => {
    const base = savedState?.profile || INITIAL_PROFILE;
    // Activate the Warm Beige main theme by default on upgrade
    if (!savedState?.warmBeigeThemeDefaultApplied) {
      return { ...base, theme: 'light' };
    }
    return base;
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (isAutostart) return 'test_start';
    return savedState?.profile?.hasCompletedOnboarding ? 'test_start' : 'intro';
  });

  const [allQuestions, setAllQuestions] = useState<SATQuestion[]>(
    BUNDLED_SAT_QUESTIONS
  );
  const [sessions, setSessions] = useState<TestSession[]>(() => {
    if (
      savedState?.sessions &&
      Array.isArray(savedState.sessions) &&
      savedState.sessions.length > 1
    ) {
      return savedState.sessions;
    }
    return INITIAL_SESSIONS;
  });
  const [importedReports, setImportedReports] = useState<ImportedScoreReport[]>(
    savedState?.importedReports || INITIAL_IMPORTED_REPORTS
  );
  const [weights, setWeights] = useState<DiagnosticWeights>(
    savedState?.weights || DEFAULT_DIAGNOSTIC_WEIGHTS
  );
  const [starredIdsList, setStarredIdsList] = useState<string[]>(
    savedState?.starredIdsList || ['m401a2c9', '55a891e0', 'b8c322b1']
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    savedState?.chatMessages || []
  );
  const [chatThreads, setChatThreads] = useState<ChatThread[]>(
    savedState?.chatThreads || []
  );
  const [activeThreadId, setActiveThreadId] = useState<string>(
    savedState?.activeThreadId || 'current-draft'
  );
  const [currentDraftTitle, setCurrentDraftTitle] = useState<string>(
    savedState?.currentDraftTitle || 'New SAT Study Thread'
  );

  // In-Progress Sessions saved from Mock Exam exits or replaced Practice/Drills
  const [inProgressSessions, setInProgressSessions] = useState<InProgressSession[]>(
    savedState?.inProgressSessions || []
  );

  // Active Bluebook testing session state (lives inside the Testing tab)
  const [activeTestingQuestions, setActiveTestingQuestions] = useState<
    SATQuestion[] | null
  >(() => savedState?.activeSessionSnapshot?.questions || null);
  const [activeInitialSession, setActiveInitialSession] =
    useState<InProgressSession | null>(
      () => savedState?.activeSessionSnapshot || null
    );
  const [activeSessionSnapshot, setActiveSessionSnapshot] =
    useState<InProgressSession | null>(
      () => savedState?.activeSessionSnapshot || null
    );

  const [testStartConfig, setTestStartConfig] = useState<TestStartConfig>({
    mode: 'practice',
    mockSections: 'both',
    selectedDomains: SAT_DOMAINS.map((d) => d.id),
    selectedSkills: [],
    difficulties: ['E', 'M', 'H'],
    excludeActivePracticeTests: profile.defaultExcludePracticeTests,
    questionPoolFilter: 'unanswered_only',
    allowPoolExhaustionFallback: false,
    practiceCompletedBehavior: 'plain_run_through',
    startAtQuestionNumber: 1,
    drillLength: 10,
    accommodations: profile.defaultAccommodations,
  });

  const [reimportStatus, setReimportStatus] = useState<ReimportJobStatus>({
    state: 'idle',
    totalQuestions: 3770,
    importedCount: 0,
    rwTotal: 1845,
    rwImported: 0,
    mathTotal: 1925,
    mathImported: 0,
    currentSection: 'Ready',
    currentDomain: 'All Domains',
    rateLimitStatus: 'nominal',
    rateLimitMessage: null,
    backoffEventsCount: 0,
    startedAt: null,
    completedAt: null,
    lastError: null,
  });
  const [reimportCompletionNotice, setReimportCompletionNotice] = useState<string | null>(
    null
  );
  const prevReimportStateRef = useRef<ReimportJobStatus['state']>('idle');

  // Load the full built-in 3,770+ question bank from the server on mount
  useEffect(() => {
    let cancelled = false;
    const loadFullBank = async () => {
      try {
        const res = await fetch('/api/eqb/bank');
        const data = await res.json();
        if (
          !cancelled &&
          Array.isArray(data?.questions) &&
          data.questions.length > 0
        ) {
          setAllQuestions(data.questions);
        }
      } catch {
        // Fallback to bundled seed questions if offline
      }
    };
    const checkInitialReimportStatus = async () => {
      try {
        const res = await fetch('/api/eqb/reimport-status');
        const data = await res.json();
        if (!cancelled && data?.status) {
          prevReimportStateRef.current = data.status.state;
          setReimportStatus(data.status);
        }
      } catch {}
    };
    loadFullBank();
    checkInitialReimportStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll reimport progress in the background while a full reimport is running
  useEffect(() => {
    if (reimportStatus.state !== 'running') return;
    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/eqb/reimport-status');
        const data = await res.json();
        if (!active || !data?.status) return;
        const nextStatus: ReimportJobStatus = data.status;
        const prevState = prevReimportStateRef.current;
        prevReimportStateRef.current = nextStatus.state;
        setReimportStatus(nextStatus);

        if (prevState === 'running' && nextStatus.state === 'completed') {
          // Refresh full question bank in memory
          const bankRes = await fetch('/api/eqb/bank');
          const bankData = await bankRes.json();
          if (Array.isArray(bankData?.questions) && bankData.questions.length > 0) {
            setAllQuestions(bankData.questions);
          }
          setReimportCompletionNotice(
            `Question bank reimport finished: ${nextStatus.importedCount.toLocaleString()} official SAT questions (${nextStatus.rwImported.toLocaleString()} R&W, ${nextStatus.mathImported.toLocaleString()} Math) are now ready.`
          );
        }
      } catch {}
    }, 900);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [reimportStatus.state]);

  // Sync theme class onto <html> and <body>
  useEffect(() => {
    const root = document.documentElement;
    if (profile.theme === 'dark') {
      root.classList.add('dark');
      document.body.className =
        'bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30';
    } else {
      root.classList.remove('dark');
      document.body.className =
        'bg-[#F5EFE6] text-[#1C1814] antialiased selection:bg-[#1B3152]/20';
    }
  }, [profile.theme]);

  // Listen to Firebase Auth state & load cloud workspace if available
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const remote = await loadWorkspaceFromFirestore(user);
          if (remote) {
            if (remote.profile) setProfile(remote.profile as UserProfileAndSettings);
            if (Array.isArray(remote.sessions))
              setSessions(remote.sessions as TestSession[]);
            if (Array.isArray(remote.importedReports))
              setImportedReports(remote.importedReports as ImportedScoreReport[]);
            if (remote.weights) setWeights(remote.weights as DiagnosticWeights);
            if (Array.isArray(remote.starredIdsList))
              setStarredIdsList(remote.starredIdsList as string[]);
            if (Array.isArray((remote as any).chatThreads))
              setChatThreads((remote as any).chatThreads as ChatThread[]);
            if (Array.isArray((remote as any).inProgressSessions))
              setInProgressSessions(
                (remote as any).inProgressSessions as InProgressSession[]
              );
          }
        } catch (err) {
          console.warn('Cloud workspace fetch skipped or new user:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  // Save state to localStorage and sync to Firestore if authenticated & verified
  useEffect(() => {
    const snapshot = {
      warmBeigeThemeDefaultApplied: true,
      profile,
      sessions,
      importedReports,
      weights,
      starredIdsList,
      chatMessages: chatMessages.slice(-20),
      chatThreads: chatThreads.slice(0, 25),
      activeThreadId,
      currentDraftTitle,
      inProgressSessions: inProgressSessions.slice(0, 15),
      activeSessionSnapshot,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {}

    if (currentUser && currentUser.emailVerified) {
      saveWorkspaceToFirestore(
        currentUser,
        profile.name,
        profile.intendedTotalScore,
        profile.studyGoal,
        profile.theme,
        snapshot
      ).catch(() => {});
    }
  }, [
    profile,
    sessions,
    importedReports,
    weights,
    starredIdsList,
    chatMessages,
    chatThreads,
    activeThreadId,
    currentDraftTitle,
    inProgressSessions,
    activeSessionSnapshot,
    currentUser,
  ]);

  const starredQuestionIds = useMemo(
    () => new Set(starredIdsList),
    [starredIdsList]
  );

  const answeredQuestionIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      if (s.mode === 'id_search') continue;
      for (const a of s.attempts) {
        if (a.selectedAnswer && a.selectedAnswer !== 'UNANSWERED') {
          set.add(a.questionId);
        }
      }
    }
    return set;
  }, [sessions]);

  const diagnosticReport = useMemo(
    () =>
      computeComprehensiveDiagnostics(
        sessions,
        importedReports,
        weights
      ),
    [sessions, importedReports, weights]
  );

  const handleUpdateProfile = (patch: Partial<UserProfileAndSettings>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  };

  const handleToggleStarQuestion = (questionId: string) => {
    setStarredIdsList((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    );
  };

  // Upsert a session into In Progress list
  const archiveSessionToInProgress = (sessionToSave: InProgressSession) => {
    if (sessionToSave.mode === 'id_search') return;
    setInProgressSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionToSave.id);
      return [
        { ...sessionToSave, savedAt: new Date().toISOString() },
        ...filtered,
      ];
    });
  };

  const handleStartNewSession = (
    selectedQs: SATQuestion[],
    finalCfg: TestStartConfig
  ) => {
    // If there was a previous Practice/Drill session open that the user navigated away from and is now replacing, save it to In Progress
    if (
      activeSessionSnapshot &&
      activeTestingQuestions &&
      activeTestingQuestions.length > 0 &&
      activeSessionSnapshot.mode !== 'id_search'
    ) {
      archiveSessionToInProgress(activeSessionSnapshot);
    }

    setTestStartConfig(finalCfg);
    setActiveInitialSession(null);
    setActiveSessionSnapshot(null);
    setActiveTestingQuestions(selectedQs);
    setActiveTab('testing');
  };

  const handleResumeInProgressSession = (sessionToResume: InProgressSession) => {
    // If there is currently another session open in Testing and it's different, move that one into In Progress
    if (
      activeSessionSnapshot &&
      activeTestingQuestions &&
      activeTestingQuestions.length > 0 &&
      activeSessionSnapshot.id !== sessionToResume.id &&
      activeSessionSnapshot.mode !== 'id_search'
    ) {
      archiveSessionToInProgress(activeSessionSnapshot);
    }

    setInProgressSessions((prev) =>
      prev.filter((s) => s.id !== sessionToResume.id)
    );
    setTestStartConfig(sessionToResume.config);
    setActiveInitialSession(sessionToResume);
    setActiveSessionSnapshot(sessionToResume);
    setActiveTestingQuestions(sessionToResume.questions);
    setActiveTab('testing');
  };

  const handleDeleteInProgressSession = (sessionId: string) => {
    setInProgressSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleApplyDrillSuggestion = (suggestion: DrillSuggestion) => {
    setTestStartConfig((prev) => ({
      ...prev,
      mode: suggestion.mode,
      selectedDomains: suggestion.domains,
      selectedSkills: suggestion.skills,
      difficulties:
        suggestion.difficulties.length > 0 ? suggestion.difficulties : ['M', 'H'],
      drillLength: suggestion.suggestedLength,
      prefilledSuggestionId: suggestion.id,
      prefilledSuggestionTitle: suggestion.title,
      userOverrodeSuggestion: false,
    }));
    setActiveTab('test_start');
  };

  const handleOpenQuestionInTestingScreen = (question: SATQuestion) => {
    if (
      activeSessionSnapshot &&
      activeTestingQuestions &&
      activeTestingQuestions.length > 0 &&
      activeSessionSnapshot.mode !== 'id_search'
    ) {
      archiveSessionToInProgress(activeSessionSnapshot);
    }

    setTestStartConfig((prev) => ({
      ...prev,
      mode: 'id_search',
      searchQuestionId: question.id,
    }));
    setActiveInitialSession(null);
    setActiveSessionSnapshot(null);
    setActiveTestingQuestions([question]);
    setActiveTab('testing');
  };

  const handleStartFullReimport = async () => {
    setReimportCompletionNotice(null);
    try {
      const res = await fetch('/api/eqb/reimport-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data?.status) {
        prevReimportStateRef.current = data.status.state;
        setReimportStatus(data.status);
      }
    } catch {}
  };

  const handleCancelFullReimport = async () => {
    try {
      const res = await fetch('/api/eqb/reimport-cancel', {
        method: 'POST',
      });
      const data = await res.json();
      if (data?.status) {
        prevReimportStateRef.current = data.status.state;
        setReimportStatus(data.status);
      }
    } catch {}
  };

  const handleResetAllData = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('aster_email_auth_session');
    } catch {}
    setProfile(INITIAL_PROFILE);
    setSessions(INITIAL_SESSIONS);
    setImportedReports(INITIAL_IMPORTED_REPORTS);
    setWeights(DEFAULT_DIAGNOSTIC_WEIGHTS);
    setStarredIdsList(['m401a2c9', '55a891e0', 'b8c322b1']);
    setChatMessages([]);
    setChatThreads([]);
    setActiveThreadId('current-draft');
    setCurrentDraftTitle('New SAT Study Thread');
    setInProgressSessions([]);
    setActiveTestingQuestions(null);
    setActiveInitialSession(null);
    setActiveSessionSnapshot(null);
    setActiveTab('intro');
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteUserAccount();
    } catch (err: any) {
      console.warn('Delete account warning:', err);
    }
    handleResetAllData();
  };

  const hasActiveSession =
    Boolean(activeTestingQuestions) && (activeTestingQuestions?.length || 0) > 0;

  const handleSelectTab = (nextTab: ActiveTab) => {
    if (nextTab !== activeTab) {
      triggerHaptic('tab_switch');
      setActiveTab(nextTab);
    }
  };

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: boolean;
  }[] = [
    ...(!profile.hasCompletedOnboarding
      ? [
          {
            id: 'intro' as ActiveTab,
            label: 'Introduction',
            icon: Compass,
          },
        ]
      : []),
    {
      id: 'test_start',
      label: 'Test Start',
      icon: Layers,
    },
    {
      id: 'testing',
      label: 'Testing',
      icon: BookOpen,
      badge: hasActiveSession,
    },
    {
      id: 'diagnostics',
      label: 'Diagnostics',
      icon: BarChart2,
    },
    {
      id: 'ai',
      label: 'Aster AI',
      icon: Sparkles,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Sliders,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <OfflineIndicator />

      {showFirstOpenOverlay && (
        <FirstOpenWelcomeOverlay
          totalQuestionsCount={allQuestions.length}
          onDismissToIntro={() => {
            setShowFirstOpenOverlay(false);
            setActiveTab('intro');
          }}
        />
      )}

      {/* Compact Top Brand & PWA Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
        <button
          type="button"
          onClick={() => handleSelectTab('test_start')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer"
        >
          <AsterOrbLogo size={28} interactive={false} />
          <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">
            Aster — SAT Studio
          </span>
        </button>

        <div className="flex items-center gap-2">
          <PWAInstallButton compact />
        </div>
      </header>

      {/* Background Reimport Status / Completion Notification Banner (Outside Settings) */}
      {reimportStatus.state === 'running' && activeTab !== 'settings' && (
        <div className="bg-indigo-600/95 text-white px-4 sm:px-6 py-2 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>
              Reimporting full SAT question bank in background:{' '}
              <strong className="font-mono">
                {reimportStatus.importedCount.toLocaleString()} /{' '}
                {(reimportStatus.totalQuestions || 3770).toLocaleString()}
              </strong>{' '}
              questions
              {reimportStatus.rateLimitStatus === 'backing_off'
                ? ' (Pacing for rate limit...)'
                : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="underline font-semibold text-xs whitespace-nowrap cursor-pointer"
          >
            View in Settings
          </button>
        </div>
      )}

      {reimportCompletionNotice && (
        <div className="bg-emerald-600 text-white px-4 sm:px-6 py-2.5 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{reimportCompletionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setReimportCompletionNotice(null)}
            aria-label="Dismiss reimport completion notification"
            className="p-1 hover:bg-emerald-700 rounded cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 px-3 sm:px-6 pt-3 sm:pt-5 pb-20 sm:pb-24">
        {activeTab === 'intro' && (
          <IntroductionTab
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            importedReports={importedReports}
            onAddReport={(rep) =>
              setImportedReports((prev) => [rep, ...prev])
            }
            onToggleReportInclusion={(id) =>
              setImportedReports((prev) =>
                prev.map((r) =>
                  r.id === id
                    ? { ...r, includedInDiagnostics: !r.includedInDiagnostics }
                    : r
                )
              )
            }
            onDeleteReport={(id) =>
              setImportedReports((prev) => prev.filter((r) => r.id !== id))
            }
            currentUser={currentUser}
            onCompleteSetup={() => {
              handleUpdateProfile({ hasCompletedOnboarding: true });
              setActiveTab('test_start');
            }}
          />
        )}

        {activeTab === 'test_start' && (
          <TestStartScreen
            allQuestions={allQuestions}
            answeredQuestionIds={answeredQuestionIds}
            config={testStartConfig}
            onChangeConfig={setTestStartConfig}
            onStartSession={handleStartNewSession}
            drillSuggestions={diagnosticReport.drillSuggestions}
            onApplySuggestion={handleApplyDrillSuggestion}
            inProgressSessions={inProgressSessions}
            onResumeInProgress={handleResumeInProgressSession}
            onDeleteInProgress={handleDeleteInProgressSession}
          />
        )}

        {/*Keep BluebookTestingScreen mounted when a session is active so switching tabs during Practice/Drills preserves state */}
        {hasActiveSession && activeTestingQuestions && (
          <div className={activeTab === 'testing' ? 'block' : 'hidden'}>
            <BluebookTestingScreen
              key={activeInitialSession?.id || `active-${testStartConfig.mode}-${activeTestingQuestions.length}`}
              questions={activeTestingQuestions}
              config={testStartConfig}
              studentName={profile.name}
              previouslyCompletedIds={answeredQuestionIds}
              starredQuestionIds={starredQuestionIds}
              onToggleStarQuestion={handleToggleStarQuestion}
              initialSession={activeInitialSession}
              onSyncProgress={(snapshot) => setActiveSessionSnapshot(snapshot)}
              onSaveAndExit={(savedSession) => {
                archiveSessionToInProgress(savedSession);
                setActiveTestingQuestions(null);
                setActiveInitialSession(null);
                setActiveSessionSnapshot(null);
                setActiveTab('test_start');
              }}
              onCompleteSession={(completedSession) => {
                if (completedSession.mode !== 'id_search') {
                  setSessions((prev) => [completedSession, ...prev]);
                }
                if (activeInitialSession) {
                  setInProgressSessions((prev) =>
                    prev.filter((s) => s.id !== activeInitialSession.id)
                  );
                }
                setActiveTestingQuestions(null);
                setActiveInitialSession(null);
                setActiveSessionSnapshot(null);
                setActiveTab(
                  completedSession.mode !== 'id_search'
                    ? 'diagnostics'
                    : 'test_start'
                );
              }}
              onExitWithoutSaving={() => {
                setActiveTestingQuestions(null);
                setActiveInitialSession(null);
                setActiveSessionSnapshot(null);
                setActiveTab('test_start');
              }}
            />
          </div>
        )}

        {/* Empty state when user clicks the Testing tab with no active session open */}
        {activeTab === 'testing' && !hasActiveSession && (
          <div className="max-w-2xl mx-auto my-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-display">
                No Active Session Open
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                Start a Practice set, Quick Drill, or Timed Mock Exam from Test Start—or resume one of your saved sessions below.
              </p>
            </div>

            {inProgressSessions.length > 0 && (
              <div className="pt-2 space-y-2 text-left">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Saved In Progress ({inProgressSessions.length})
                </div>
                {inProgressSessions.slice(0, 3).map((sess) => (
                  <div
                    key={sess.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {sess.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        On Q#{sess.currentIndex + 1} of {sess.questions.length}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResumeInProgressSession(sess)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 cursor-pointer"
                    >
                      Resume
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('test_start')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Go to Test Start</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosticsScreen
            diagnosticReport={diagnosticReport}
            sessions={sessions}
            importedReports={importedReports}
            weights={weights}
            onUpdateWeights={setWeights}
            onToggleSessionInclusion={(id) =>
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === id
                    ? { ...s, includedInDiagnostics: !s.includedInDiagnostics }
                    : s
                )
              )
            }
            onToggleReportInclusion={(id) =>
              setImportedReports((prev) =>
                prev.map((r) =>
                  r.id === id
                    ? { ...r, includedInDiagnostics: !r.includedInDiagnostics }
                    : r
                )
              )
            }
            starredQuestionIds={starredQuestionIds}
            onToggleStarQuestion={handleToggleStarQuestion}
            allQuestions={allQuestions}
            onOpenQuestionInTestingScreen={handleOpenQuestionInTestingScreen}
            onSelectDrillSuggestion={handleApplyDrillSuggestion}
            intendedTotalScore={profile.intendedTotalScore}
          />
        )}

        {activeTab === 'ai' && (
          <AiStudioTab
            messages={
              activeThreadId === 'current-draft'
                ? chatMessages
                : chatThreads.find((t) => t.id === activeThreadId)?.messages ||
                  chatMessages
            }
            onAddMessage={(msg) => {
              if (activeThreadId === 'current-draft') {
                setChatMessages((prev) => [...prev, msg]);
              } else {
                setChatThreads((prev) =>
                  prev.map((t) =>
                    t.id === activeThreadId
                      ? {
                          ...t,
                          updatedAt: new Date().toISOString(),
                          messages: [...t.messages, msg],
                        }
                      : t
                  )
                );
              }
            }}
            threads={chatThreads}
            activeThreadId={activeThreadId}
            currentDraftTitle={currentDraftTitle}
            onUpdateThreadTitle={(newTitle, targetId) => {
              const idToUpdate = targetId || activeThreadId;
              if (idToUpdate === 'current-draft') {
                setCurrentDraftTitle(newTitle);
              } else {
                setChatThreads((prev) =>
                  prev.map((t) =>
                    t.id === idToUpdate
                      ? { ...t, title: newTitle, updatedAt: new Date().toISOString() }
                      : t
                  )
                );
              }
            }}
            onSelectThread={(threadId) => setActiveThreadId(threadId)}
            onStartNewThread={({ saveCurrent, threadTitle, nextThreadTitle }) => {
              const nowIso = new Date().toISOString();
              const currentMsgs =
                activeThreadId === 'current-draft'
                  ? chatMessages
                  : chatThreads.find((t) => t.id === activeThreadId)?.messages || [];

              if (saveCurrent && currentMsgs.length > 0) {
                const cleanTitle =
                  (threadTitle || '').trim() ||
                  currentDraftTitle ||
                  `SAT Study Thread (${new Date().toLocaleDateString()})`;

                if (activeThreadId === 'current-draft') {
                  const newSavedThread: ChatThread = {
                    id: `thread-${Date.now()}`,
                    title: cleanTitle,
                    createdAt: currentMsgs[0]?.timestamp || nowIso,
                    updatedAt: nowIso,
                    messages: currentMsgs,
                    saved: true,
                  };
                  setChatThreads((prev) => [newSavedThread, ...prev]);
                } else {
                  setChatThreads((prev) =>
                    prev.map((t) =>
                      t.id === activeThreadId
                        ? { ...t, title: cleanTitle, updatedAt: nowIso, saved: true }
                        : t
                    )
                  );
                }
              }

              const customNextTitle = (nextThreadTitle || '').trim();
              setChatMessages([]);
              setActiveThreadId('current-draft');
              setCurrentDraftTitle(customNextTitle || 'New SAT Study Thread');
            }}
            onDeleteThread={(threadId) => {
              setChatThreads((prev) => prev.filter((t) => t.id !== threadId));
              if (activeThreadId === threadId) {
                setActiveThreadId('current-draft');
              }
            }}
            allQuestions={allQuestions}
            starredQuestionIds={starredQuestionIds}
            sessions={sessions}
            importedReports={importedReports}
            onAddReport={(rep) =>
              setImportedReports((prev) => [rep, ...prev])
            }
            diagnosticReport={diagnosticReport}
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            weights={weights}
            onUpdateWeights={setWeights}
            onToggleSessionInclusion={(id) =>
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === id
                    ? { ...s, includedInDiagnostics: !s.includedInDiagnostics }
                    : s
                )
              )
            }
            onToggleReportInclusion={(id) =>
              setImportedReports((prev) =>
                prev.map((r) =>
                  r.id === id
                    ? { ...r, includedInDiagnostics: !r.includedInDiagnostics }
                    : r
                )
              )
            }
            onSelectDrillSuggestion={handleApplyDrillSuggestion}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            importedReports={importedReports}
            onAddReport={(rep) =>
              setImportedReports((prev) => [rep, ...prev])
            }
            onToggleReportInclusion={(id) =>
              setImportedReports((prev) =>
                prev.map((r) =>
                  r.id === id
                    ? { ...r, includedInDiagnostics: !r.includedInDiagnostics }
                    : r
                )
              )
            }
            onDeleteReport={(id) =>
              setImportedReports((prev) => prev.filter((r) => r.id !== id))
            }
            sessions={sessions}
            weights={weights}
            currentUser={currentUser}
            totalQuestionsCount={allQuestions.length}
            reimportStatus={reimportStatus}
            onStartFullReimport={handleStartFullReimport}
            onCancelFullReimport={handleCancelFullReimport}
            onResetAllData={handleResetAllData}
            onDeleteAccount={handleDeleteAccount}
          />
        )}
      </main>

      {/* Sleek Single-Color Bottom Navigation Bar (Brilliant / Duolingo Style) */}
      <nav
        aria-label="Primary Workspace Navigation"
        data-testid="bottom-nav-bar"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-xl mx-auto px-2 py-1.5 flex items-center justify-around gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`relative flex-1 min-h-[48px] px-1.5 py-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer select-none ${
                  isActive
                    ? 'text-slate-900 dark:text-white bg-slate-900/8 dark:bg-white/10 font-bold'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-150 ${
                      isActive ? 'scale-105 stroke-[2.4]' : 'stroke-[1.9]'
                    }`}
                  />
                  {item.badge && (
                    <span
                      className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-current"
                      title="Active session open"
                    />
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] leading-none tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

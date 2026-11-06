export type SATSection = 'reading_writing' | 'math';

export type SATDomainId =
  | 'INI' // Information and Ideas
  | 'CAS' // Craft and Structure
  | 'EOI' // Expression of Ideas
  | 'SEC' // Standard English Conventions
  | 'ALG' // Algebra
  | 'ADV' // Advanced Math
  | 'PSD' // Problem-Solving and Data Analysis
  | 'GEO'; // Geometry and Trigonometry

export type DifficultyLevel = 'E' | 'M' | 'H';

export type QuestionType = 'mcq' | 'spr';

export interface QuestionChoice {
  id: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface SATQuestion {
  id: string;
  externalId: string;
  section: SATSection;
  domain: SATDomainId;
  domainName: string;
  skill: string;
  difficulty: DifficultyLevel;
  irtDifficulty: number; // -2.0 (easiest) to +2.0 (hardest)
  passageHtml?: string;
  stemHtml: string;
  type: QuestionType;
  choices?: QuestionChoice[];
  correctAnswer: string;
  rationaleHtml: string;
  isActivePracticeTest: boolean; // True if currently used in active Bluebook practice tests 1-6
  source: 'eqb_live' | 'eqb_bundled';
}

export type TestMode = 'practice' | 'mock' | 'drill' | 'id_search';

export type MockSectionSelection = 'both' | 'reading_writing' | 'math';

export interface TestAccommodations {
  timeMultiplier: 1 | 1.5 | 2;
  rwTimeMultiplier?: 1 | 1.5 | 2;
  mathTimeMultiplier?: 1 | 1.5 | 2;
  extraBreaks: boolean;
  extendedBreaks?: boolean;
  breaksAsNeeded?: boolean;
  lineReaderDefault: boolean;
  largeTextZoom: boolean;
}

export interface TestStartConfig {
  mode: TestMode;
  mockSections: MockSectionSelection;
  selectedDomains: SATDomainId[];
  selectedSkills: string[];
  difficulties: DifficultyLevel[];
  excludeActivePracticeTests: boolean;
  // Drill & Mock unseen pool behavior
  questionPoolFilter: 'unanswered_only' | 'any_questions';
  allowPoolExhaustionFallback: boolean;
  // Practice mode completed behavior
  practiceCompletedBehavior: 'plain_run_through' | 'remove_completed_before_session';
  startAtQuestionNumber?: number;
  drillLength: number;
  accommodations: TestAccommodations;
  searchQuestionId?: string;
  // Pre-fill tracking from AI or Diagnostics
  prefilledSuggestionId?: string;
  prefilledSuggestionTitle?: string;
  userOverrodeSuggestion?: boolean;
}

export interface QuestionAttempt {
  questionId: string;
  sessionId: string;
  timestamp: string;
  mode: TestMode;
  section: SATSection;
  domain: SATDomainId;
  skill: string;
  difficulty: DifficultyLevel;
  irtDifficulty: number;
  selectedAnswer: string;
  isCorrect: boolean;
  timeSpentSec: number;
  usedAiBeforeSubmit: boolean;
  isRepeatAttempt: boolean;
  countsTowardDiagnostics: boolean;
  eliminatedChoices?: string[];
  highlightNotes?: string;
}

export interface TestSession {
  id: string;
  title: string;
  mode: TestMode;
  startedAt: string;
  completedAt: string;
  config: TestStartConfig;
  questionIds: string[];
  attempts: QuestionAttempt[];
  annotationsMap?: Record<string, string>;
  scaledScore?: {
    total: number;
    rw: number;
    math: number;
    rwModule2Tier?: 'easier' | 'harder';
    mathModule2Tier?: 'easier' | 'harder';
  };
  includedInDiagnostics: boolean;
}

export interface InProgressSession {
  id: string;
  title: string;
  mode: TestMode;
  startedAt: string;
  savedAt: string;
  config: TestStartConfig;
  questions: SATQuestion[];
  currentIndex: number;
  currentModuleIndex?: number;
  isOnBreak?: boolean;
  breakRemainingSeconds?: number;
  nextModuleRemainingSeconds?: number;
  breakIsAsNeeded?: boolean;
  answers: Record<string, string>;
  submittedQuestionIds: string[];
  usedAiBeforeSubmitIds: string[];
  eliminatedMap: Record<string, string[]>;
  annotationsMap: Record<string, string>;
  timeSpentMap: Record<string, number>;
  remainingSeconds: number;
}

export interface DomainPerformanceBand {
  domainId: SATDomainId;
  domainName: string;
  scoreBand: string; // e.g., "680-740" or "6/7 bars"
  estimatedMasteryPct: number; // 0 to 100
  percentile?: number;
}

export interface ImportedScoreReport {
  id: string;
  testType: 'SAT' | 'PSAT';
  testDate: string;
  label: string;
  importMethod: 'plain_score' | 'score_split' | 'pdf_report';
  totalScore: number;
  rwScore: number;
  mathScore: number;
  percentile?: number;
  domainBands: Record<SATDomainId, DomainPerformanceBand>;
  rawSummaryNotes?: string;
  includedInDiagnostics: boolean;
}

export interface DiagnosticWeights {
  mockExamWeight: number;       // Default 1.00
  drillWeight: number;          // Default 0.45
  practiceWeight: number;       // Default 0.25
  importedScoreWeight: number;  // Default 0.85
  recencyHalfLifeDays: number;  // Default 21
  priorAnchorStrength: number;  // Default 0.35
}

export interface DrillSuggestion {
  id: string;
  title: string;
  rationale: string;
  source: 'diagnostics' | 'ai';
  mode: 'drill' | 'practice';
  domains: SATDomainId[];
  skills: string[];
  difficulties: DifficultyLevel[];
  suggestedLength: number;
  estimatedGainPts: number;
}

export type StudyGoalId =
  | 'balanced_1500'
  | 'math_quant_surge'
  | 'rw_comprehension_mastery'
  | 'rapid_weakness_elimination';

export interface NotificationPreferences {
  dailyStudyReminder: boolean;
  reminderTime: string;
  testDateCountdownAlerts: boolean;
  weeklyDiagnosticDigest: boolean;
}

export interface UserProfileAndSettings {
  hasCompletedOnboarding: boolean;
  name: string;
  email?: string;
  nextTestDate: string;
  intendedTotalScore: number;
  intendedRwScore: number;
  intendedMathScore: number;
  studyGoal: StudyGoalId;
  theme: 'dark' | 'light';
  allowAiSettingsAccess: boolean;
  defaultExcludePracticeTests: boolean;
  defaultAccommodations: TestAccommodations;
  notifications: NotificationPreferences;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  linkedQuestionId?: string;
  linkedSessionId?: string;
  drillSuggestions?: DrillSuggestion[];
  appliedSettingChanges?: string[];
  decodedReport?: ImportedScoreReport;
  requestedModel?: string;
  modelUsed?: string;
  fallbackNotice?: string;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  saved: boolean;
}

export interface ReimportJobStatus {
  state: 'idle' | 'running' | 'completed' | 'cancelled' | 'error';
  totalQuestions: number;
  importedCount: number;
  rwTotal: number;
  rwImported: number;
  mathTotal: number;
  mathImported: number;
  currentSection: string;
  currentDomain: string;
  rateLimitStatus: 'nominal' | 'backing_off';
  rateLimitMessage: string | null;
  backoffEventsCount: number;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
}



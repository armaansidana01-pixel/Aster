import React from 'react';
import {
  DiagnosticWeights,
  ImportedScoreReport,
  ReimportJobStatus,
  TestSession,
  UserProfileAndSettings,
} from '../types';
import { User } from '../firebase';
import { AuthPanel } from './AuthPanel';
import { ScoreReportImporter } from './ScoreReportImporter';
import { STUDY_GOALS } from './IntroductionTab';
import {
  Sun,
  Moon,
  Bell,
  Download,
  Sparkles,
  UserCheck,
  Sliders,
  Database,
  RefreshCw,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';

interface SettingsTabProps {
  profile: UserProfileAndSettings;
  onUpdateProfile: (patch: Partial<UserProfileAndSettings>) => void;
  importedReports: ImportedScoreReport[];
  onAddReport: (report: ImportedScoreReport) => void;
  onToggleReportInclusion: (reportId: string) => void;
  onDeleteReport: (reportId: string) => void;
  sessions: TestSession[];
  weights: DiagnosticWeights;
  currentUser: User | null;
  totalQuestionsCount: number;
  reimportStatus: ReimportJobStatus;
  onStartFullReimport: () => void;
  onCancelFullReimport: () => void;
  onResetAllData: () => void;
  onDeleteAccount: () => Promise<void>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  profile,
  onUpdateProfile,
  importedReports,
  onAddReport,
  onToggleReportInclusion,
  onDeleteReport,
  sessions,
  weights,
  currentUser,
  totalQuestionsCount,
  reimportStatus,
  onStartFullReimport,
  onCancelFullReimport,
  onResetAllData,
  onDeleteAccount,
}) => {
  const [resetConfirm, setResetConfirm] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);

  const isReimporting = reimportStatus.state === 'running';
  const progressPct =
    reimportStatus.totalQuestions > 0
      ? Math.min(
          100,
          Math.round(
            (reimportStatus.importedCount / reimportStatus.totalQuestions) * 100
          )
        )
      : 0;

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'Aster — SAT Studio',
      profile,
      diagnosticWeights: weights,
      importedScoreReports: importedReports,
      testSessions: sessions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aster-sat-studio-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const rows = [
      [
        'Session ID',
        'Title',
        'Mode',
        'Date',
        'Question ID',
        'Section',
        'Domain',
        'Skill',
        'Difficulty',
        'Selected Answer',
        'Correct',
        'Time Spent (s)',
        'AI Used Before Submit',
        'Repeat Attempt',
        'Counts Toward Diagnostics',
      ].join(','),
    ];

    for (const sess of sessions) {
      for (const att of sess.attempts) {
        rows.push(
          [
            sess.id,
            `"${sess.title.replace(/"/g, '""')}"`,
            sess.mode,
            sess.completedAt,
            att.questionId,
            att.section,
            att.domain,
            `"${att.skill.replace(/"/g, '""')}"`,
            att.difficulty,
            att.selectedAnswer,
            att.isCorrect,
            att.timeSpentSec,
            att.usedAiBeforeSubmit,
            att.isRepeatAttempt,
            att.countsTowardDiagnostics,
          ].join(',')
        );
      }
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aster-sat-attempts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-14">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">
          Settings, Account & Data
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Update your profile, target scores, appearance, question bank, notifications, and score exports.
        </p>
      </div>

      {/* 1. Account & Authentication (Email/Password + Verification + Reset + Google Sign-In) */}
      <AuthPanel currentUser={currentUser} />

      {/* 1.5 Built-In SAT Question Bank & Full API Reimport */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-500 shrink-0" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Built-In SAT Question Bank & Full API Reimport
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All{' '}
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {totalQuestionsCount.toLocaleString()}
              </span>{' '}
              questions (including all 3,770 official Reading & Writing and Math items across{' '}
              <span className="font-mono">external_id</span> and disclosed{' '}
              <span className="font-mono">ibn</span> endpoints) are built in with no item limit.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isReimporting ? (
              <button
                type="button"
                onClick={onCancelFullReimport}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Reimport</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartFullReimport}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reimport Whole Bank</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Progress Bar, Item Count, and Rate-Limit Status when Reimporting */}
        {isReimporting ? (
          <div className="rounded-xl border border-indigo-400/50 dark:border-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-950/25 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin shrink-0" />
                <span>
                  Reimporting Entire Question Bank... ({progressPct}%)
                </span>
              </div>

              <div className="font-mono font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
                {reimportStatus.importedCount.toLocaleString()} /{' '}
                {(reimportStatus.totalQuestions || 3770).toLocaleString()} questions
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                style={{ width: `${progressPct}%` }}
                className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
              />
            </div>

            {/* Section Counts & Rate Limit Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-600 dark:text-slate-400">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  R&amp;W: {reimportStatus.rwImported.toLocaleString()} /{' '}
                  {(reimportStatus.rwTotal || 1845).toLocaleString()}
                </span>
                <span>·</span>
                <span>
                  Math: {reimportStatus.mathImported.toLocaleString()} /{' '}
                  {(reimportStatus.mathTotal || 1925).toLocaleString()}
                </span>
                {reimportStatus.currentDomain && (
                  <>
                    <span>·</span>
                    <span>
                      Active Domain: <strong>{reimportStatus.currentDomain}</strong>
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {reimportStatus.rateLimitStatus === 'backing_off' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">
                    <AlertTriangle className="w-3 h-3" />
                    <span>
                      {reimportStatus.rateLimitMessage ||
                        'Adhering to rate limit backoff...'}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold">
                    <ShieldCheck className="w-3 h-3" />
                    <span>
                      Rate Limit: Nominal
                      {reimportStatus.backoffEventsCount > 0
                        ? ` (${reimportStatus.backoffEventsCount} backoff pauses handled)`
                        : ''}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              You can leave Settings and continue using any tab—the reimport will finish in the background and notify you when complete.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{totalQuestionsCount.toLocaleString()} Total Questions Ready</span>
              </span>
              <span>1,845 Reading &amp; Writing</span>
              <span>·</span>
              <span>1,925 Math (1,466 Digital + 459 IBN)</span>
            </div>

            {reimportStatus.state === 'completed' && reimportStatus.completedAt && (
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                Last full reimport completed at{' '}
                {new Date(reimportStatus.completedAt).toLocaleTimeString()}
              </span>
            )}
            {reimportStatus.state === 'cancelled' && (
              <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                Last reimport cancelled ({reimportStatus.importedCount.toLocaleString()} items fetched)
              </span>
            )}
            {reimportStatus.state === 'error' && reimportStatus.lastError && (
              <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400">
                Reimport error: {reimportStatus.lastError}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. Theme Customization & AI Settings Permission */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Appearance
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose between dark and light mode.
              </p>
            </div>
            {profile.theme === 'dark' ? (
              <Moon className="w-4 h-4 text-indigo-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onUpdateProfile({ theme: 'light' })}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                profile.theme === 'light'
                  ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              Warm Beige (Main)
            </button>
            <button
              type="button"
              onClick={() => onUpdateProfile({ theme: 'dark' })}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                profile.theme === 'dark'
                  ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              Obsidian Dark
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Let Aster AI Update Settings
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Allow Aster AI to adjust your target scores, theme, and score weights when you ask in chat.
            </p>
          </div>

          <label className="inline-flex items-center gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={profile.allowAiSettingsAccess}
              onChange={(e) =>
                onUpdateProfile({ allowAiSettingsAccess: e.target.checked })
              }
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {profile.allowAiSettingsAccess
                ? 'Enabled (AI can update settings & weights)'
                : 'Disabled (Read-only AI mode)'}
            </span>
          </label>
        </div>
      </div>

      {/* 3. Student Profile, Target Scores, Next Test Date & Study Goal */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <UserCheck className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Student Profile & Target Scores
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Student Name
            </span>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => onUpdateProfile({ name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Next SAT Test Date
            </span>
            <input
              type="date"
              value={profile.nextTestDate}
              onChange={(e) => onUpdateProfile({ nextTestDate: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Intended R&W Score
            </span>
            <input
              type="number"
              min={200}
              max={800}
              step={10}
              value={profile.intendedRwScore}
              onChange={(e) => {
                const rw = Math.max(200, Math.min(800, Number(e.target.value) || 750));
                onUpdateProfile({
                  intendedRwScore: rw,
                  intendedTotalScore: rw + profile.intendedMathScore,
                });
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Intended Math Score
            </span>
            <input
              type="number"
              min={200}
              max={800}
              step={10}
              value={profile.intendedMathScore}
              onChange={(e) => {
                const math = Math.max(200, Math.min(800, Number(e.target.value) || 770));
                onUpdateProfile({
                  intendedMathScore: math,
                  intendedTotalScore: profile.intendedRwScore + math,
                });
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Personalized Study Goal
            </span>
            <select
              value={profile.studyGoal}
              onChange={(e) =>
                onUpdateProfile({
                  studyGoal: e.target.value as UserProfileAndSettings['studyGoal'],
                })
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              {STUDY_GOALS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Default Bluebook Time Accommodation
            </span>
            <select
              value={profile.defaultAccommodations.timeMultiplier}
              onChange={(e) =>
                onUpdateProfile({
                  defaultAccommodations: {
                    ...profile.defaultAccommodations,
                    timeMultiplier: Number(e.target.value) as 1 | 1.5 | 2,
                  },
                })
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
            >
              <option value={1}>Standard Time (1.0x)</option>
              <option value={1.5}>Time and One-Half (1.5x)</option>
              <option value={2}>Double Time (2.0x)</option>
            </select>
          </label>
        </div>
      </div>

      {/* 4. Score Reports Importer & Manager */}
      <ScoreReportImporter
        reports={importedReports}
        onAddReport={onAddReport}
        onToggleReportInclusion={onToggleReportInclusion}
        onDeleteReport={onDeleteReport}
      />

      {/* 5. Notification Preferences & Progress Data Export */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Notification Preferences
            </h2>
          </div>

          <div className="space-y-2 text-xs">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-700 dark:text-slate-300">
                Daily Practice Drill Reminder
              </span>
              <input
                type="checkbox"
                checked={profile.notifications.dailyStudyReminder}
                onChange={(e) =>
                  onUpdateProfile({
                    notifications: {
                      ...profile.notifications,
                      dailyStudyReminder: e.target.checked,
                    },
                  })
                }
                className="rounded border-slate-300 text-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-700 dark:text-slate-300">
                Test Date Countdown Milestones
              </span>
              <input
                type="checkbox"
                checked={profile.notifications.testDateCountdownAlerts}
                onChange={(e) =>
                  onUpdateProfile({
                    notifications: {
                      ...profile.notifications,
                      testDateCountdownAlerts: e.target.checked,
                    },
                  })
                }
                className="rounded border-slate-300 text-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-700 dark:text-slate-300">
                Weekly Progress Summary
              </span>
              <input
                type="checkbox"
                checked={profile.notifications.weeklyDiagnosticDigest}
                onChange={(e) =>
                  onUpdateProfile({
                    notifications: {
                      ...profile.notifications,
                      weeklyDiagnosticDigest: e.target.checked,
                    },
                  })
                }
                className="rounded border-slate-300 text-indigo-600"
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Progress Tracking Data Export
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Export your complete test history, question logs, imported score reports, and diagnostic weights as JSON or CSV.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportJson}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export Full JSON
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              Export Attempts CSV
            </button>
          </div>
        </div>
      </div>

      {/* Data Management & Account Deletion */}
      <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-5 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <h2 className="text-sm font-bold text-rose-900 dark:text-rose-100">
              Data Management &amp; Account Deletion
            </h2>
          </div>
          <p className="text-xs text-rose-700 dark:text-rose-300/80">
            Quickly reset all local and cloud data, or permanently delete your account and associated workspace records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {!resetConfirm ? (
            <button
              type="button"
              onClick={() => setResetConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset All Data
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-rose-300 shadow-sm">
              <span className="text-xs font-medium text-rose-900 dark:text-rose-200">
                Are you sure? All progress will be lost.
              </span>
              <button
                type="button"
                onClick={() => {
                  setResetConfirm(false);
                  onResetAllData();
                }}
                className="px-3 py-1 text-xs font-bold rounded-lg bg-rose-600 text-white cursor-pointer"
              >
                Yes, Reset All
              </button>
              <button
                type="button"
                onClick={() => setResetConfirm(false)}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {currentUser && (
            <>
              {!deleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Delete Account
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-rose-300 shadow-sm">
                  <span className="text-xs font-medium text-rose-900 dark:text-rose-200">
                    Permanently delete account &amp; cloud data?
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      setDeleteConfirm(false);
                      try {
                        await onDeleteAccount();
                      } catch (err: any) {
                        alert(err?.message || 'Failed to delete account.');
                      }
                    }}
                    className="px-3 py-1 text-xs font-bold rounded-lg bg-rose-700 text-white cursor-pointer"
                  >
                    Yes, Delete Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(false)}
                    className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

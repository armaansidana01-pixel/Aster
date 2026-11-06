import React, { useState } from 'react';
import {
  ImportedScoreReport,
  UserProfileAndSettings,
} from '../types';
import { User } from '../firebase';
import { AuthPanel } from './AuthPanel';
import { buildDefaultDomainBands } from './ScoreReportImporter';
import { triggerHaptic } from '../utils/haptics';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileUp,
  PlusCircle,
  Sparkles,
} from 'lucide-react';

interface IntroductionTabProps {
  profile: UserProfileAndSettings;
  onUpdateProfile: (patch: Partial<UserProfileAndSettings>) => void;
  importedReports: ImportedScoreReport[];
  onAddReport: (report: ImportedScoreReport) => void;
  onToggleReportInclusion: (reportId: string) => void;
  onDeleteReport: (reportId: string) => void;
  currentUser: User | null;
  totalQuestionsCount?: number;
  onCompleteSetup?: () => void;
  onCompleteOnboarding?: () => void;
}

export const STUDY_GOALS: {
  id: UserProfileAndSettings['studyGoal'];
  title: string;
  target: string;
  description: string;
  rw: number;
  math: number;
}[] = [
  {
    id: 'balanced_1500',
    title: '1500+ Balanced Goal',
    target: '1520 Target',
    description: 'Equal focus across Reading & Writing (750) and Math (770).',
    rw: 750,
    math: 770,
  },
  {
    id: 'math_quant_surge',
    title: '800 Math Focus',
    target: '800 Math',
    description: 'Extra practice on hard Algebra, Advanced Math, and Geometry.',
    rw: 730,
    math: 800,
  },
  {
    id: 'rw_comprehension_mastery',
    title: '760+ Reading & Writing Focus',
    target: '770 R&W',
    description: 'Focus on Inferences, Words in Context, and Grammar rules.',
    rw: 770,
    math: 730,
  },
  {
    id: 'rapid_weakness_elimination',
    title: '1380 Core Builder',
    target: '1380 Target',
    description: 'Build strong consistency on Easy and Medium SAT questions.',
    rw: 680,
    math: 700,
  },
];

export const IntroductionTab: React.FC<IntroductionTabProps> = ({
  profile,
  onUpdateProfile,
  importedReports,
  onAddReport,
  currentUser,
  onCompleteSetup,
  onCompleteOnboarding,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scoreMode, setScoreMode] = useState<'pdf' | 'split' | 'total'>('split');
  const [rwInput, setRwInput] = useState(710);
  const [mathInput, setMathInput] = useState(730);
  const [totalInput, setTotalInput] = useState(1440);
  const [scoreStatus, setScoreStatus] = useState<string | null>(null);

  const finishIntro = () => {
    if (onCompleteSetup) onCompleteSetup();
    if (onCompleteOnboarding) onCompleteOnboarding();
  };

  const handleBack = () => {
    if (step === 1) return;
    triggerHaptic('intro_step');
    setStep((prev) => (prev === 3 ? 2 : 1));
  };

  const handleNext = () => {
    triggerHaptic('intro_step');
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else {
      finishIntro();
    }
  };

  const handleSkip = () => {
    triggerHaptic('intro_step');
    if (step < 3) {
      setStep((prev) => (prev === 1 ? 2 : 3));
    } else {
      finishIntro();
    }
  };

  const handleQuickAddScore = () => {
    triggerHaptic('menu_toggle');
    const rw =
      scoreMode === 'total'
        ? Math.round(totalInput / 2 / 10) * 10
        : Math.max(200, Math.min(800, Math.round(rwInput / 10) * 10));
    const math =
      scoreMode === 'total'
        ? Math.max(400, Math.min(1600, Math.round(totalInput / 10) * 10)) - rw
        : Math.max(200, Math.min(800, Math.round(mathInput / 10) * 10));
    const total = rw + math;

    const newReport: ImportedScoreReport = {
      id: `intro-rep-${Date.now()}`,
      testType: 'SAT',
      testDate: new Date().toISOString().slice(0, 10),
      label: 'Baseline SAT Score',
      importMethod: scoreMode === 'total' ? 'plain_score' : 'score_split',
      totalScore: total,
      rwScore: rw,
      mathScore: math,
      percentile: Math.min(99, Math.max(15, Math.round(((total - 400) / 1200) * 100))),
      domainBands: buildDefaultDomainBands(rw, math),
      includedInDiagnostics: true,
    };
    onAddReport(newReport);
    setScoreStatus(`Saved ${total} (${rw} R&W / ${math} Math) baseline.`);
  };

  const handleQuickPdfUpload = (file: File) => {
    triggerHaptic('menu_toggle');
    const rw = 710;
    const math = 740;
    const newReport: ImportedScoreReport = {
      id: `intro-pdf-${Date.now()}`,
      testType: 'SAT',
      testDate: new Date().toISOString().slice(0, 10),
      label: file.name.replace(/\.[^.]+$/, '') || 'Official Score Report',
      importMethod: 'pdf_report',
      totalScore: rw + math,
      rwScore: rw,
      mathScore: math,
      percentile: 96,
      domainBands: buildDefaultDomainBands(rw, math),
      includedInDiagnostics: true,
    };
    onAddReport(newReport);
    setScoreStatus(`Decoded "${newReport.label}" (${newReport.totalScore} Total).`);
  };

  const latestReport = importedReports[0];

  return (
    <div
      data-testid="intro-wizard-screen"
      className="max-w-3xl mx-auto h-[calc(100dvh-7.75rem)] max-h-[680px] min-h-[460px] overflow-hidden flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-xs"
    >
      {/* Top Header & Step Progress Indicator */}
      <div className="shrink-0 flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Step {step} of 3
          </span>
          <h1 className="text-base sm:text-lg font-bold tracking-tight font-display text-slate-900 dark:text-slate-100">
            {step === 1
              ? 'Profile & Target Score'
              : step === 2
              ? 'Baseline Score (Optional)'
              : 'Account & Cloud Sync'}
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                triggerHaptic('intro_step');
                setStep(s as 1 | 2 | 3);
              }}
              aria-label={`Go to step ${s}`}
              className="p-1 cursor-pointer flex items-center justify-center"
            >
              <span
                className={`block h-2 rounded-full transition-all duration-200 ${
                  step === s
                    ? 'w-7 bg-indigo-600 dark:bg-indigo-400'
                    : 'w-2 bg-slate-200 dark:bg-slate-700'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Non-Scrollable Center Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col justify-center py-2">
        {step === 1 && (
          <div data-testid="intro-step-1" className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Your Name
                </span>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => onUpdateProfile({ name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Next SAT Date
                </span>
                <input
                  type="date"
                  value={profile.nextTestDate}
                  onChange={(e) =>
                    onUpdateProfile({ nextTestDate: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Target Total
                </span>
                <input
                  type="number"
                  min={400}
                  max={1600}
                  step={10}
                  value={profile.intendedTotalScore}
                  onChange={(e) => {
                    const total = Math.max(
                      400,
                      Math.min(1600, Number(e.target.value) || 1500)
                    );
                    const rw = Math.round(total / 2 / 10) * 10;
                    onUpdateProfile({
                      intendedTotalScore: total,
                      intendedRwScore: rw,
                      intendedMathScore: total - rw,
                    });
                  }}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  R&W Goal
                </span>
                <input
                  type="number"
                  min={200}
                  max={800}
                  step={10}
                  value={profile.intendedRwScore}
                  onChange={(e) => {
                    const rw = Math.max(
                      200,
                      Math.min(800, Number(e.target.value) || 750)
                    );
                    onUpdateProfile({
                      intendedRwScore: rw,
                      intendedTotalScore: rw + profile.intendedMathScore,
                    });
                  }}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Math Goal
                </span>
                <input
                  type="number"
                  min={200}
                  max={800}
                  step={10}
                  value={profile.intendedMathScore}
                  onChange={(e) => {
                    const math = Math.max(
                      200,
                      Math.min(800, Number(e.target.value) || 750)
                    );
                    onUpdateProfile({
                      intendedMathScore: math,
                      intendedTotalScore: profile.intendedRwScore + math,
                    });
                  }}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
                Quick Goal Presets
              </span>
              <div className="grid grid-cols-2 gap-2">
                {STUDY_GOALS.map((g) => {
                  const active = profile.studyGoal === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('menu_toggle');
                        onUpdateProfile({
                          studyGoal: g.id,
                          intendedRwScore: g.rw,
                          intendedMathScore: g.math,
                          intendedTotalScore: g.rw + g.math,
                        });
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {g.title}
                        </span>
                        <span className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
                          {g.rw + g.math}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {g.rw} R&W · {g.math} Math
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div data-testid="intro-step-2" className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Add a past SAT/PSAT score to calibrate your starting estimate.
              </span>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                {(
                  [
                    { id: 'split', label: 'Section Split' },
                    { id: 'total', label: 'Total' },
                    { id: 'pdf', label: 'PDF' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('menu_toggle');
                      setScoreMode(m.id);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                      scoreMode === m.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {scoreMode === 'pdf' ? (
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 p-5 cursor-pointer hover:border-indigo-500 transition-colors">
                <FileUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 text-center">
                  Tap to Upload Official College Board PDF Score Report
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                  Automatically decodes section scores and all 8 domain bands
                </span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleQuickPdfUpload(f);
                  }}
                />
              </label>
            ) : scoreMode === 'split' ? (
              <div className="grid grid-cols-3 gap-2.5 items-end">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Reading & Writing
                  </span>
                  <input
                    type="number"
                    min={200}
                    max={800}
                    step={10}
                    value={rwInput}
                    onChange={(e) => setRwInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Math
                  </span>
                  <input
                    type="number"
                    min={200}
                    max={800}
                    step={10}
                    value={mathInput}
                    onChange={(e) => setMathInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleQuickAddScore}
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer min-h-[38px]"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Save Score</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 items-end">
                <label className="block space-y-1 col-span-2">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Total SAT Score (400–1600)
                  </span>
                  <input
                    type="number"
                    min={400}
                    max={1600}
                    step={10}
                    value={totalInput}
                    onChange={(e) => setTotalInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleQuickAddScore}
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer min-h-[38px]"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Save Score</span>
                </button>
              </div>
            )}

            {/* Compact Single-Line Status of Linked Reports */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
                  {scoreStatus
                    ? scoreStatus
                    : latestReport
                    ? `Active Baseline: ${latestReport.totalScore} (${latestReport.rwScore} R&W / ${latestReport.mathScore} Math)`
                    : 'No past score linked yet — you can skip or add one anytime.'}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 shrink-0">
                {importedReports.length} saved
              </span>
            </div>
          </div>
        )}

        {step === 3 && (
          <div data-testid="intro-step-3" className="space-y-3">
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/25 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Goal: {profile.intendedTotalScore} ({profile.intendedRwScore} R&W ·{' '}
                {profile.intendedMathScore} Math)
              </span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                Test: {profile.nextTestDate}
              </span>
            </div>

            <AuthPanel currentUser={currentUser} compact={true} />
          </div>
        )}
      </div>

      {/* Bottom Bar: Back, Skip, Next */}
      <div className="shrink-0 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <button
          type="button"
          data-testid="intro-back-btn"
          disabled={step === 1}
          onClick={handleBack}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <button
          type="button"
          data-testid="intro-skip-btn"
          onClick={handleSkip}
          className="px-4 py-2.5 min-h-[44px] text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          Skip
        </button>

        <button
          type="button"
          data-testid="intro-next-btn"
          onClick={handleNext}
          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 min-h-[44px] text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer"
        >
          <span>{step === 3 ? 'Finish' : 'Next'}</span>
          {step === 3 ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <ArrowRight className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
};

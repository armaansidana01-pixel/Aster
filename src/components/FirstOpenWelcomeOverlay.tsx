import React from 'react';
import { motion } from 'motion/react';
import { AsterOrbLogo } from './AsterOrbLogo';
import { ArrowRight, BookOpen, Compass, LineChart, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

export const FIRST_OPEN_OVERLAY_STORAGE_KEY = 'aster_first_open_overlay_seen_v1';

export interface FirstOpenWelcomeOverlayProps {
  totalQuestionsCount: number;
  onDismissToIntro: () => void;
}

const WELCOME_CARDS = [
  {
    index: '01',
    badge: 'Question Bank',
    title: '3,800+ SAT Questions',
    description:
      'Practice with official College Board questions across all 8 Reading & Writing and Math domains.',
    icon: BookOpen,
  },
  {
    index: '02',
    badge: 'Bluebook Mode',
    title: 'Realistic Test Interface',
    description:
      'Take untimed practice, quick topic drills, or full timed adaptive mock exams with Desmos and scratchpad notes.',
    icon: Compass,
  },
  {
    index: '03',
    badge: 'Score Tracking',
    title: 'Smart Diagnostics',
    description:
      'Track your predicted score, pinpoint weak skills, and decode official SAT or PSAT PDF score reports.',
    icon: LineChart,
  },
  {
    index: '04',
    badge: 'Aster AI',
    title: 'AI Study Coach',
    description:
      'Get step-by-step explanations on any question or generate custom practice drills tailored to your goals.',
    icon: Sparkles,
  },
];

export const FirstOpenWelcomeOverlay: React.FC<FirstOpenWelcomeOverlayProps> = ({
  totalQuestionsCount,
  onDismissToIntro,
}) => {
  const handleNext = () => {
    triggerHaptic('welcome_dismiss');
    try {
      localStorage.setItem(FIRST_OPEN_OVERLAY_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage quota errors
    }
    onDismissToIntro();
  };

  return (
    <div
      data-testid="first-open-welcome-overlay"
      className="fixed inset-0 z-50 flex flex-col justify-between bg-[#F5EFE6] dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-4 sm:px-8 py-5 sm:py-8 overflow-y-auto"
    >
      <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col justify-center space-y-5 sm:space-y-7">
        {/* Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3.5"
        >
          <AsterOrbLogo size={48} active={true} interactive={false} />
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-semibold">
              Welcome to Aster
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display text-slate-900 dark:text-white">
              Your Digital SAT Studio
            </h1>
          </div>
        </motion.div>

        {/* 4 Feature Cards Fading In One by One */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {WELCOME_CARDS.map((card, idx) => {
            const Icon = card.icon;
            const dynamicTitle =
              idx === 0
                ? `${Math.max(3800, totalQuestionsCount).toLocaleString()}+ SAT Questions`
                : card.title;

            return (
              <motion.div
                key={card.index}
                data-testid={`welcome-card-${card.index}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.42,
                  delay: 0.15 + idx * 0.2,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-2xs flex flex-col justify-between gap-2"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {card.index}. {card.badge}
                    </span>
                    <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight font-display text-slate-900 dark:text-slate-100">
                    {dynamicTitle}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.95 }}
        className="max-w-4xl w-full mx-auto pt-4 flex items-center justify-between gap-4 border-t border-slate-200/80 dark:border-slate-800/80 shrink-0"
      >
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Set up your target score and study preferences next.
        </span>
        <button
          type="button"
          data-testid="welcome-overlay-next-btn"
          onClick={handleNext}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors cursor-pointer"
        >
          <span>Next</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
};

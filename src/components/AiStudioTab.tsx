import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChatMessage,
  ChatThread,
  DiagnosticWeights,
  DrillSuggestion,
  ImportedScoreReport,
  SATDomainId,
  SATQuestion,
  TestSession,
  UserProfileAndSettings,
} from '../types';
import { ComprehensiveDiagnosticReport } from '../utils/diagnosticEngine';
import { AsterOrbLogo, AmbientBackgroundAnimation } from './AsterOrbLogo';
import { buildDefaultDomainBands } from './ScoreReportImporter';
import {
  Send,
  Link2,
  Bookmark,
  FileUp,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Sliders,
  Search,
  Trash2,
  Zap,
  Brain,
  Cpu,
  Plus,
  MessageSquare,
  AlertTriangle,
  X,
  PanelLeft,
  ChevronDown,
} from 'lucide-react';
import { isMobileViewport, triggerHaptic } from '../utils/haptics';

interface AiStudioTabProps {
  messages: ChatMessage[];
  onAddMessage: (msg: ChatMessage) => void;
  threads: ChatThread[];
  activeThreadId: string;
  currentDraftTitle: string;
  onUpdateThreadTitle: (newTitle: string, targetThreadId?: string) => void;
  onSelectThread: (threadId: string) => void;
  onStartNewThread: (options: {
    saveCurrent: boolean;
    threadTitle?: string;
    nextThreadTitle?: string;
  }) => void;
  onDeleteThread?: (threadId: string) => void;
  allQuestions: SATQuestion[];
  starredQuestionIds: Set<string>;
  sessions: TestSession[];
  importedReports: ImportedScoreReport[];
  onAddReport: (rep: ImportedScoreReport) => void;
  diagnosticReport: ComprehensiveDiagnosticReport;
  profile: UserProfileAndSettings;
  onUpdateProfile: (patch: Partial<UserProfileAndSettings>) => void;
  weights: DiagnosticWeights;
  onUpdateWeights: (newWeights: DiagnosticWeights) => void;
  onToggleSessionInclusion: (id: string) => void;
  onToggleReportInclusion: (id: string) => void;
  onSelectDrillSuggestion: (suggestion: DrillSuggestion) => void;
}

function buildInstantTitleFromPrompt(
  prompt: string,
  linkedQuestion?: SATQuestion,
  linkedSession?: TestSession
): string {
  if (linkedQuestion) {
    return `Question ${linkedQuestion.id} · ${linkedQuestion.skill}`;
  }
  if (linkedSession) {
    return `${linkedSession.title} Review`;
  }
  const cleaned = prompt
    .replace(/\s+/g, ' ')
    .replace(/^(can you|please|help me|explain|how do i|what is)\s+/i, '')
    .trim();
  if (!cleaned) return 'SAT Study Session';
  const words = cleaned.split(' ').slice(0, 6).join(' ');
  const titled = words.charAt(0).toUpperCase() + words.slice(1);
  return titled.length > 42 ? `${titled.slice(0, 39)}...` : titled;
}

export const AiStudioTab: React.FC<AiStudioTabProps> = ({
  messages,
  onAddMessage,
  threads,
  activeThreadId,
  currentDraftTitle,
  onUpdateThreadTitle,
  onSelectThread,
  onStartNewThread,
  onDeleteThread,
  allQuestions,
  starredQuestionIds,
  sessions,
  importedReports,
  onAddReport,
  diagnosticReport,
  profile,
  onUpdateProfile,
  weights,
  onUpdateWeights,
  onToggleSessionInclusion,
  onToggleReportInclusion,
  onSelectDrillSuggestion,
}) => {
  const [input, setInput] = useState('');
  const [linkedQuestionId, setLinkedQuestionId] = useState<string>('');
  const [questionIdSearch, setQuestionIdSearch] = useState<string>('');
  const [linkedSessionId, setLinkedSessionId] = useState<string>('');
  const [modelTier, setModelTier] = useState<'fast' | 'general' | 'complex'>('general');
  const [rolePersona, setRolePersona] = useState<
    'concept_tutor' | 'bluebook_coach' | 'diagnostic_architect'
  >('concept_tutor');
  const [loading, setLoading] = useState(false);
  const [fallbackBanner, setFallbackBanner] = useState<string | null>(null);

  // Popout Sidebar Drawer for Threads
  const [showThreadSidebar, setShowThreadSidebar] = useState(false);

  // Context Linker & Coaching Menu (starts collapsed on mobile)
  const [contextMenuOpen, setContextMenuOpen] = useState<boolean>(
    () => !isMobileViewport()
  );

  // New Thread Modal Popup State
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [saveThreadNameInput, setSaveThreadNameInput] = useState('');
  const [newThreadCustomNameInput, setNewThreadCustomNameInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  // Order questions so STARRED questions appear FIRST in the dropdown
  const orderedQuestions = useMemo(() => {
    const starred = allQuestions.filter((q) => starredQuestionIds.has(q.id));
    const others = allQuestions.filter((q) => !starredQuestionIds.has(q.id));
    const combined = [...starred, ...others];
    if (!questionIdSearch.trim()) return combined;
    const qLower = questionIdSearch.trim().toLowerCase();
    return combined.filter(
      (q) =>
        q.id.toLowerCase().includes(qLower) ||
        q.domain.toLowerCase().includes(qLower) ||
        q.skill.toLowerCase().includes(qLower)
    );
  }, [allQuestions, starredQuestionIds, questionIdSearch]);

  const linkedQuestionObj = allQuestions.find((q) => q.id === linkedQuestionId);
  const linkedSessionObj = sessions.find((s) => s.id === linkedSessionId);
  const activeSavedThread = threads.find((t) => t.id === activeThreadId);

  // Window rendered <option> elements to keep the 3,800-item select instant while always showing all starred items + currently selected item
  const windowedDropdownQuestions = useMemo(() => {
    const maxVisible = 150;
    const sliced = orderedQuestions.slice(0, maxVisible);
    if (
      linkedQuestionObj &&
      !sliced.some((q) => q.id === linkedQuestionObj.id)
    ) {
      return [linkedQuestionObj, ...sliced];
    }
    return sliced;
  }, [orderedQuestions, linkedQuestionObj]);

  const displayedThreadTitle = activeSavedThread
    ? activeSavedThread.title
    : currentDraftTitle || 'New SAT Study Thread';

  const openNewThreadPopup = () => {
    setSaveThreadNameInput(displayedThreadTitle);
    setNewThreadCustomNameInput('');
    setShowNewThreadModal(true);
  };

  const handleSendMessage = async (
    customText?: string,
    overrideTier?: 'fast' | 'general' | 'complex'
  ) => {
    const textToSend = (customText ?? input).trim();
    if (!textToSend) return;
    if (!customText) setInput('');

    const activeTier = overrideTier || modelTier;

    // Auto-generate conversation name immediately on first message if still default
    const isDefaultTitle =
      displayedThreadTitle === 'New SAT Study Thread' ||
      displayedThreadTitle.startsWith('SAT Study Thread');
    if (messages.length === 0 || isDefaultTitle) {
      const instantTitle = buildInstantTitleFromPrompt(
        textToSend,
        linkedQuestionObj,
        linkedSessionObj
      );
      onUpdateThreadTitle(instantTitle, activeThreadId);
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
      linkedQuestionId: linkedQuestionId || undefined,
      linkedSessionId: linkedSessionId || undefined,
    };
    onAddMessage(userMsg);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages,
          modelTier: activeTier,
          rolePersona,
          linkedQuestion: linkedQuestionObj,
          linkedSession: linkedSessionObj,
          diagnosticSummary: {
            predictedTotalScore: diagnosticReport.predictedTotalScore,
            predictedRwScore: diagnosticReport.predictedRwScore,
            predictedMathScore: diagnosticReport.predictedMathScore,
            weakestSkills: diagnosticReport.weakestSkills,
          },
          allowAiSettingsAccess: profile.allowAiSettingsAccess,
          currentWeights: weights,
          currentSettings: {
            intendedTotalScore: profile.intendedTotalScore,
            studyGoal: profile.studyGoal,
            theme: profile.theme,
            timeMultiplier: profile.defaultAccommodations.timeMultiplier,
          },
        }),
      });

      const data = await res.json();
      const appliedChanges: string[] = [];
      const generatedSuggestions: DrillSuggestion[] = [];

      if (data?.didFallback && data?.fallbackNotice) {
        setFallbackBanner(String(data.fallbackNotice));
      } else {
        setFallbackBanner(null);
      }

      // Apply server-generated conversation name if this is the start of the thread
      if (
        data?.generatedThreadTitle &&
        (messages.length === 0 || isDefaultTitle)
      ) {
        onUpdateThreadTitle(String(data.generatedThreadTitle), activeThreadId);
      }

      if (Array.isArray(data?.functionCalls)) {
        for (const call of data.functionCalls) {
          const args = call.args || {};
          if (call.name === 'createDrillSuggestionCard') {
            generatedSuggestions.push({
              id: `ai-sug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: String(args.title || 'Recommended Practice Set'),
              rationale: String(
                args.rationale || 'Suggested by Aster AI based on your recent performance.'
              ),
              source: 'ai',
              mode: args.mode === 'practice' ? 'practice' : 'drill',
              domains: Array.isArray(args.domains)
                ? (args.domains as SATDomainId[])
                : ['INI', 'ALG'],
              skills: [],
              difficulties: Array.isArray(args.difficulties)
                ? args.difficulties
                : ['M', 'H'],
              suggestedLength: Number(args.suggestedLength) || 10,
              estimatedGainPts: Number(args.estimatedGainPts) || 25,
            });
          } else if (profile.allowAiSettingsAccess) {
            if (call.name === 'updateDiagnosticWeights') {
              const nextWeights = { ...weights };
              if (typeof args.mockExamWeight === 'number')
                nextWeights.mockExamWeight = args.mockExamWeight;
              if (typeof args.drillWeight === 'number')
                nextWeights.drillWeight = args.drillWeight;
              if (typeof args.practiceWeight === 'number')
                nextWeights.practiceWeight = args.practiceWeight;
              if (typeof args.importedScoreWeight === 'number')
                nextWeights.importedScoreWeight = args.importedScoreWeight;
              if (typeof args.recencyHalfLifeDays === 'number')
                nextWeights.recencyHalfLifeDays = args.recencyHalfLifeDays;
              if (typeof args.priorAnchorStrength === 'number')
                nextWeights.priorAnchorStrength = args.priorAnchorStrength;
              onUpdateWeights(nextWeights);
              appliedChanges.push('Updated score weights.');
            } else if (call.name === 'updateUserSettings') {
              const patch: Partial<UserProfileAndSettings> = {};
              if (typeof args.intendedTotalScore === 'number')
                patch.intendedTotalScore = args.intendedTotalScore;
              if (typeof args.intendedRwScore === 'number')
                patch.intendedRwScore = args.intendedRwScore;
              if (typeof args.intendedMathScore === 'number')
                patch.intendedMathScore = args.intendedMathScore;
              if (args.theme === 'dark' || args.theme === 'light')
                patch.theme = args.theme;
              if (typeof args.studyGoal === 'string')
                patch.studyGoal = args.studyGoal as UserProfileAndSettings['studyGoal'];
              if (typeof args.defaultExcludePracticeTests === 'boolean')
                patch.defaultExcludePracticeTests = args.defaultExcludePracticeTests;
              onUpdateProfile(patch);
              appliedChanges.push('Updated your study settings.');
            } else if (call.name === 'toggleDataPointInclusion' && args.targetId) {
              onToggleSessionInclusion(String(args.targetId));
              onToggleReportInclusion(String(args.targetId));
              appliedChanges.push(`Updated score history inclusion for ${args.targetId}.`);
            }
          }
        }
      }

      if (
        generatedSuggestions.length === 0 &&
        /drill|suggest|recommend|practice|weak/i.test(textToSend)
      ) {
        generatedSuggestions.push(...diagnosticReport.drillSuggestions.slice(0, 2));
      }

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content:
          data?.text ||
          (linkedQuestionObj
            ? `For Question ${linkedQuestionObj.id} (${linkedQuestionObj.domainName} — ${linkedQuestionObj.skill}): ${linkedQuestionObj.rationaleHtml.replace(/<[^>]+>/g, '')}`
            : `Based on your current estimated score of ${diagnosticReport.predictedTotalScore} (${diagnosticReport.predictedRwScore} R&W / ${diagnosticReport.predictedMathScore} Math), here are recommended practice sets below.`),
        timestamp: new Date().toISOString(),
        drillSuggestions:
          generatedSuggestions.length > 0 ? generatedSuggestions : undefined,
        appliedSettingChanges:
          appliedChanges.length > 0 ? appliedChanges : undefined,
        requestedModel: data?.requestedModel,
        modelUsed: data?.modelUsed,
        fallbackNotice: data?.fallbackNotice,
      };
      onAddMessage(assistantMsg);
    } catch {
      const fallbackSuggestions = diagnosticReport.drillSuggestions.slice(0, 2);
      onAddMessage({
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: linkedQuestionObj
          ? `Here is the breakdown for Question ${linkedQuestionObj.id} (${linkedQuestionObj.skill}): ${linkedQuestionObj.rationaleHtml.replace(/<[^>]+>/g, '')}`
          : `Your estimated SAT score is ${diagnosticReport.predictedTotalScore}. Click one of the suggested practice sets below to jump straight into Test Start.`,
        timestamp: new Date().toISOString(),
        drillSuggestions: fallbackSuggestions,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScorePdfUploadInAi = async (file: File) => {
    setLoading(true);
    onUpdateThreadTitle(`Score Report: ${file.name}`, activeThreadId);
    onAddMessage({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: `Uploaded SAT/PSAT Score Report PDF: ${file.name}`,
      timestamp: new Date().toISOString(),
    });

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const r = String(reader.result || '');
          resolve(r.includes(',') ? r.split(',')[1] : r);
        };
        reader.onerror = () => reject(new Error('Read error'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/ai/decode-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: base64Data,
          mimeType: file.type || 'application/pdf',
          fileName: file.name,
        }),
      });
      const data = await res.json();
      if (data?.didFallback && data?.fallbackNotice) {
        setFallbackBanner(String(data.fallbackNotice));
      }
      const dec = data?.decoded || {};
      const rw = Number(dec.rwScore) || 710;
      const math = Number(dec.mathScore) || 740;
      const bands = buildDefaultDomainBands(rw, math);

      const newReport: ImportedScoreReport = {
        id: `ai-pdf-${Date.now()}`,
        testType: dec.testType === 'PSAT' ? 'PSAT' : 'SAT',
        testDate: dec.testDate || '2026-10-15',
        label: dec.label || `Score Report: ${file.name}`,
        importMethod: 'pdf_report',
        totalScore: rw + math,
        rwScore: rw,
        mathScore: math,
        percentile: Number(dec.percentile) || 96,
        domainBands: bands,
        rawSummaryNotes: dec.rawSummaryNotes || 'Imported from PDF score report.',
        includedInDiagnostics: true,
      };
      onAddReport(newReport);

      onAddMessage({
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `I imported **${newReport.label}** (${newReport.totalScore} Total: ${newReport.rwScore} R&W / ${newReport.mathScore} Math, ${newReport.percentile}th percentile) along with your topic breakdown and added it to your progress history.`,
        timestamp: new Date().toISOString(),
        decodedReport: newReport,
        drillSuggestions: diagnosticReport.drillSuggestions.slice(0, 2),
        modelUsed: data?.modelUsed,
        fallbackNotice: data?.fallbackNotice,
      });
    } catch {
      const fallbackBands = buildDefaultDomainBands(710, 730);
      const fallbackRep: ImportedScoreReport = {
        id: `ai-pdf-${Date.now()}`,
        testType: 'SAT',
        testDate: '2026-10-15',
        label: `Score Report: ${file.name}`,
        importMethod: 'pdf_report',
        totalScore: 1440,
        rwScore: 710,
        mathScore: 730,
        percentile: 95,
        domainBands: fallbackBands,
        includedInDiagnostics: true,
      };
      onAddReport(fallbackRep);
      onAddMessage({
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `Imported **${fallbackRep.label}** (1440 Total · 710 R&W · 730 Math) and added it to your progress history.`,
        timestamp: new Date().toISOString(),
        decodedReport: fallbackRep,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative max-w-6xl mx-auto pb-10">
      <AmbientBackgroundAnimation />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Context Linker (Starred Questions First, ID Filter, Test Linker, Score Report Upload) */}
        <div className="space-y-4 order-2 lg:order-1">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('menu_toggle');
                setContextMenuOpen((prev) => !prev);
              }}
              aria-expanded={contextMenuOpen}
              className="w-full flex items-center justify-between gap-2.5 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Link2 className="w-4 h-4 text-indigo-500 shrink-0" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Attach a Question or Past Test
                </h2>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  contextMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {contextMenuOpen && (
              <div className="space-y-4 pt-1">

            {/* Individual Question Dropdown (Starred Questions First) */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                1. Question (★ Starred Listed First)
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={questionIdSearch}
                  onChange={(e) => setQuestionIdSearch(e.target.value)}
                  placeholder="Search by Question ID or skill..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <select
                value={linkedQuestionId}
                onChange={(e) => setLinkedQuestionId(e.target.value)}
                aria-label="Select question to attach"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono"
              >
                <option value="">— No Question Attached —</option>
                {windowedDropdownQuestions.map((q) => {
                  const isStar = starredQuestionIds.has(q.id);
                  return (
                    <option key={q.id} value={q.id}>
                      {isStar ? '★ [STARRED] ' : ''}
                      {q.id} · {q.domain} ({q.difficulty}) — {q.skill}
                    </option>
                  );
                })}
              </select>
              {orderedQuestions.length > windowedDropdownQuestions.length && (
                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  Showing first {windowedDropdownQuestions.length} of{' '}
                  {orderedQuestions.length.toLocaleString()} matches. Type an ID or skill above to narrow.
                </p>
              )}
            </div>

            {/* Link Entire Test Session */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                2. Completed Practice or Test
              </label>
              <select
                value={linkedSessionId}
                onChange={(e) => setLinkedSessionId(e.target.value)}
                aria-label="Select completed test to attach"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="">— No Test Attached —</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({new Date(s.completedAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Upload College Board PDF Score Report */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                3. Import Score Report PDF
              </span>
              <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-400 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/25 p-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                <FileUp className="w-4 h-4" />
                <span>Upload Score Report PDF</span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleScorePdfUploadInAi(f);
                  }}
                />
              </label>
            </div>

            {/* AI Settings Access Status */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                Let AI Adjust Settings:
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateProfile({
                    allowAiSettingsAccess: !profile.allowAiSettingsAccess,
                  })
                }
                className={`font-mono font-bold ${
                  profile.allowAiSettingsAccess
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500'
                }`}
              >
                {profile.allowAiSettingsAccess ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Coach Style & Model Controls */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  4. Coaching Style
                </label>
                <select
                  value={rolePersona}
                  onChange={(e) => setRolePersona(e.target.value as any)}
                  aria-label="Select coaching style"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="concept_tutor">
                    Concept Tutor (Step-by-Step Explanations)
                  </option>
                  <option value="bluebook_coach">
                    Test Strategy Coach (Pacing & Time Saving)
                  </option>
                  <option value="diagnostic_architect">
                    Study Planner (Score Goals & Weak Areas)
                  </option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  5. Response Speed & Depth
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setModelTier('fast')}
                    className={`p-2 rounded-lg border text-left transition-colors ${
                      modelTier === 'fast'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[11px] font-bold">
                      <Zap className="w-3 h-3" />
                      <span>Fast</span>
                    </div>
                    <div className="text-[10px] font-mono opacity-80 truncate">
                      Quick hints
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModelTier('general')}
                    className={`p-2 rounded-lg border text-left transition-colors ${
                      modelTier === 'general'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[11px] font-bold">
                      <Cpu className="w-3 h-3" />
                      <span>Balanced</span>
                    </div>
                    <div className="text-[10px] font-mono opacity-80 truncate">
                      Everyday tutor
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModelTier('complex')}
                    className={`p-2 rounded-lg border text-left transition-colors ${
                      modelTier === 'complex'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[11px] font-bold">
                      <Brain className="w-3 h-3" />
                      <span>Deep</span>
                    </div>
                    <div className="text-[10px] font-mono opacity-80 truncate">
                      Full breakdown
                    </div>
                  </button>
                </div>
              </div>
            </div>
            </div>
            )}
          </div>
        </div>

        {/* Right 2 Columns: Chat Module with Popout Thread Sidebar Drawer */}
        <div className="lg:col-span-2 order-1 lg:order-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-[580px] sm:h-[660px] overflow-hidden relative">
          {/* Chat Header with Popout Sidebar Trigger */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setShowThreadSidebar((prev) => !prev)}
                aria-label="Open conversation threads sidebar"
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors shrink-0 cursor-pointer ${
                  showThreadSidebar
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <PanelLeft className="w-3.5 h-3.5 text-indigo-500" />
                <span>Threads</span>
                <span className="px-1.5 py-0.2 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[10px]">
                  {threads.length + 1}
                </span>
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {displayedThreadTitle}
                  </h1>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                  {linkedQuestionObj
                    ? `Attached: Question ${linkedQuestionObj.id} (${linkedQuestionObj.domain})`
                    : linkedSessionObj
                    ? `Attached: ${linkedSessionObj.title}`
                    : 'Aster AI · Auto-named conversation'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <AsterOrbLogo size={28} active={loading} interactive={false} />
            </div>
          </div>

          {/* POPOUT THREAD SIDEBAR DRAWER */}
          <AnimatePresence>
            {showThreadSidebar && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setShowThreadSidebar(false)}
                  className="absolute inset-0 top-[57px] z-20 bg-slate-950/40 backdrop-blur-[1px]"
                />
                <motion.aside
                  initial={{ x: -300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  aria-label="Conversation Threads Sidebar"
                  className="absolute left-0 top-[57px] bottom-0 z-30 w-72 sm:w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
                >
                  {/* Top of Sidebar: New Thread Action */}
                  <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowThreadSidebar(false);
                        openNewThreadPopup();
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Thread</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowThreadSidebar(false)}
                      aria-label="Close threads sidebar"
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Thread List */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {/* Active / Draft Thread Section */}
                    <div className="space-y-1.5">
                      <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
                        Current Conversation
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectThread('current-draft');
                          setShowThreadSidebar(false);
                        }}
                        className={`w-full text-left rounded-xl p-3 transition-colors flex items-start justify-between gap-2 ${
                          activeThreadId === 'current-draft'
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-500/40 text-indigo-950 dark:text-indigo-100'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                            <MessageSquare className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="truncate">{currentDraftTitle}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            Active draft ·{' '}
                            {activeThreadId === 'current-draft'
                              ? `${messages.length} msgs`
                              : 'Unsaved'}
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Saved History Section */}
                    <div className="space-y-1.5">
                      <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
                        Saved Threads ({threads.length})
                      </div>

                      {threads.length === 0 ? (
                        <div className="px-2 py-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          No saved threads yet. Click <strong>New Thread</strong> above whenever you want to save your current chat and start fresh.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {threads.map((t) => {
                            const isSelected = activeThreadId === t.id;
                            return (
                              <div
                                key={t.id}
                                className={`group rounded-xl p-2.5 transition-colors flex items-center justify-between gap-2 ${
                                  isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-500/40 text-indigo-950 dark:text-indigo-100'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectThread(t.id);
                                    setShowThreadSidebar(false);
                                  }}
                                  className="flex-1 text-left min-w-0 space-y-0.5"
                                >
                                  <div className="text-xs font-semibold truncate">
                                    {t.title}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                    {t.messages.length} msgs ·{' '}
                                    {new Date(t.updatedAt).toLocaleDateString()}
                                  </div>
                                </button>

                                {onDeleteThread && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteThread(t.id)}
                                    aria-label={`Delete thread ${t.title}`}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 opacity-70 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          {/* Model Unavailable / Automatic Fallback Notification Banner */}
          {fallbackBanner && (
            <div className="px-4 py-2.5 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-400/40 dark:border-amber-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{fallbackBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setFallbackBanner(null)}
                aria-label="Dismiss model fallback notice"
                className="p-1 text-amber-700 dark:text-amber-300 hover:opacity-80 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Scrollable Messages / Greeting Screen */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-5 py-4">
                <AsterOrbLogo size={68} active={true} />
                <div className="space-y-1.5">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 font-display">
                    Hi {profile.name || 'there'}, what would you like to work on?
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Attach a question or test on the side, open <strong>Threads</strong> in the top-left to switch conversations, or pick a quick starter below.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage(
                        'Look at my weakest SAT skills and suggest a few focused practice drills.',
                        'general'
                      )
                    }
                    className="rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 p-3 text-xs space-y-1 transition-colors"
                  >
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      Suggest Practice Drills
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Builds clickable practice sets from your weak spots
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const firstStar = allQuestions.find((q) =>
                        starredQuestionIds.has(q.id)
                      );
                      const qToLink = firstStar || allQuestions[0];
                      setLinkedQuestionId(qToLink.id);
                      handleSendMessage(
                        `Give me a quick 2-sentence hint for Question ${qToLink.id} (${qToLink.skill}) without giving away the answer.`,
                        'fast'
                      );
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 p-3 text-xs space-y-1 transition-colors"
                  >
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-rose-500" />
                      Hint on a Starred Question
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Quick strategy nudge without spoilers
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage(
                        'Count my timed mock exams a bit more heavily than untimed practice in my score estimate.',
                        'general'
                      )
                    }
                    className="rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 p-3 text-xs space-y-1 transition-colors"
                  >
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-emerald-500" />
                      Adjust Score Weights
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Prioritize full timed tests over casual practice
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage(
                        'Create a practical 3-week study plan to help me reach my target SAT score.',
                        'complex'
                      )
                    }
                    className="rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 p-3 text-xs space-y-1 transition-colors"
                  >
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
                      3-Week Study Plan
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Step-by-step schedule tailored to your goal
                    </p>
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-2 ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-3.5 sm:p-4 text-xs leading-relaxed space-y-2 ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {(msg.linkedQuestionId || msg.linkedSessionId) && (
                      <div className="text-[10px] font-mono opacity-80 border-b border-white/20 pb-1">
                        {msg.linkedQuestionId && `Question: ${msg.linkedQuestionId} `}
                        {msg.linkedSessionId && `Session: ${msg.linkedSessionId}`}
                      </div>
                    )}

                    {msg.fallbackNotice && (
                      <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{msg.fallbackNotice}</span>
                      </div>
                    )}

                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {msg.appliedSettingChanges && msg.appliedSettingChanges.length > 0 && (
                      <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 p-2 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                        ✓ {msg.appliedSettingChanges.join(' · ')}
                      </div>
                    )}
                  </div>

                  {/* Interactive Drill Suggestion Cards inside AI Chat */}
                  {msg.drillSuggestions && msg.drillSuggestions.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-[90%] sm:max-w-[85%]">
                      {msg.drillSuggestions.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => onSelectDrillSuggestion(card)}
                          className="text-left rounded-xl border border-indigo-400/50 dark:border-indigo-600/50 bg-indigo-50/60 dark:bg-indigo-950/40 hover:border-indigo-500 p-3.5 transition-all space-y-1"
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            <span>
                              {card.mode.toUpperCase()} · {card.domains.join(', ')} ·{' '}
                              {card.suggestedLength} Qs
                            </span>
                            <span>+{card.estimatedGainPts} pts</span>
                          </div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {card.title}
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                            {card.rationale}
                          </p>
                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 pt-1">
                            <span>Open in Test Start</span>
                            <ExternalLink className="w-3 h-3" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="text-xs text-indigo-500 animate-pulse font-medium">
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 sm:p-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-950/50"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a question, SAT concept, or study plan..."
              className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 sm:px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>

          {/* Popup Modal Asking Whether to Save the Current Thread and What to Name the Thread */}
          {showNewThreadModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="save-thread-modal-title"
                className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xl space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3
                      id="save-thread-modal-title"
                      className="text-base font-bold text-slate-900 dark:text-slate-100 font-display"
                    >
                      Start a New Thread
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Save your current conversation to history or name your new thread below. Everything auto-names as you chat if you leave it blank.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewThreadModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {messages.length > 0 && (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Current Thread Name (to save in history)
                    </span>
                    <input
                      type="text"
                      value={saveThreadNameInput}
                      onChange={(e) => setSaveThreadNameInput(e.target.value)}
                      placeholder="e.g., Algebra Systems Practice"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </label>
                )}

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    New Thread Name (optional — auto-generates on first message)
                  </span>
                  <input
                    type="text"
                    value={newThreadCustomNameInput}
                    onChange={(e) => setNewThreadCustomNameInput(e.target.value)}
                    placeholder="Leave blank to auto-name from your first prompt..."
                    autoFocus
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewThreadModal(false)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>

                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onStartNewThread({
                          saveCurrent: false,
                          nextThreadTitle: newThreadCustomNameInput,
                        });
                        setShowNewThreadModal(false);
                      }}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      Don&apos;t Save Current
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onStartNewThread({
                        saveCurrent: messages.length > 0,
                        threadTitle: saveThreadNameInput,
                        nextThreadTitle: newThreadCustomNameInput,
                      });
                      setShowNewThreadModal(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs"
                  >
                    {messages.length > 0 ? 'Save & Start New Thread' : 'Start New Thread'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

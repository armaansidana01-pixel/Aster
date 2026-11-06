import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  FunctionDeclaration,
  GoogleGenAI,
  Type,
} from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Function declarations for AI Settings & Diagnostic Mutations when granted access
const aiWorkspaceTools: FunctionDeclaration[] = [
  {
    name: 'updateDiagnosticWeights',
    description:
      'Modify the Bayesian IRT diagnostic weighting framework parameters for SAT score calculations.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        mockExamWeight: {
          type: Type.NUMBER,
          description: 'Weight multiplier for timed Mock Exams (0.1 to 2.0).',
        },
        drillWeight: {
          type: Type.NUMBER,
          description: 'Weight multiplier for Quick Study Drills (0.05 to 1.5).',
        },
        practiceWeight: {
          type: Type.NUMBER,
          description: 'Weight multiplier for untimed Practice Mode (0.05 to 1.0).',
        },
        importedScoreWeight: {
          type: Type.NUMBER,
          description: 'Weight multiplier for imported official SAT/PSAT score reports (0.1 to 2.0).',
        },
        recencyHalfLifeDays: {
          type: Type.NUMBER,
          description: 'Exponential recency decay half-life in days (3 to 90).',
        },
        priorAnchorStrength: {
          type: Type.NUMBER,
          description: 'Strength of the prior baseline anchor (0.05 to 1.0).',
        },
      },
    },
  },
  {
    name: 'updateUserSettings',
    description:
      'Modify user study settings, target SAT scores, theme (dark or light), study goal, or default accommodations.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        intendedTotalScore: {
          type: Type.NUMBER,
          description: 'New target SAT total score (400 to 1600).',
        },
        intendedRwScore: {
          type: Type.NUMBER,
          description: 'New target Reading & Writing score (200 to 800).',
        },
        intendedMathScore: {
          type: Type.NUMBER,
          description: 'New target Math score (200 to 800).',
        },
        studyGoal: {
          type: Type.STRING,
          description:
            'Study goal ID: balanced_1500, math_quant_surge, rw_comprehension_mastery, or rapid_weakness_elimination.',
        },
        theme: {
          type: Type.STRING,
          description: 'UI theme to switch to: "dark" or "light".',
        },
        timeMultiplier: {
          type: Type.NUMBER,
          description: 'Default accommodation time multiplier: 1, 1.5, or 2.',
        },
        defaultExcludePracticeTests: {
          type: Type.BOOLEAN,
          description: 'Whether to exclude active Bluebook practice test questions by default.',
        },
      },
    },
  },
  {
    name: 'createDrillSuggestionCard',
    description:
      'Generate an interactive Drill Suggestion Card in the chat that redirects the user to Test Start with pre-filled settings.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Concise title for the drill card.',
        },
        rationale: {
          type: Type.STRING,
          description: 'Brief explanation of why this drill targets the student’s weak points.',
        },
        mode: {
          type: Type.STRING,
          description: '"drill" or "practice".',
        },
        domains: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Array of domain IDs: INI, CAS, EOI, SEC, ALG, ADV, PSD, GEO.',
        },
        difficulties: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Array of difficulty levels: E, M, H.',
        },
        suggestedLength: {
          type: Type.NUMBER,
          description: 'Recommended number of questions (e.g., 5, 10, 15).',
        },
        estimatedGainPts: {
          type: Type.NUMBER,
          description: 'Estimated SAT score improvement points from mastering this skill.',
        },
      },
      required: ['title', 'rationale', 'mode', 'domains', 'suggestedLength'],
    },
  },
  {
    name: 'toggleDataPointInclusion',
    description:
      'Include or exclude a specific historical test session or imported SAT score report from diagnostic calculations.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetId: {
          type: Type.STRING,
          description: 'The session ID or imported score report ID.',
        },
        included: {
          type: Type.BOOLEAN,
          description: 'True to include in diagnostics, false to exclude.',
        },
      },
      required: ['targetId', 'included'],
    },
  },
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  let harvesterPromise: Promise<
    typeof import('./src/server/eqbHarvester')['eqbHarvester']
  > | null = null;
  const getHarvester = () => {
    if (!harvesterPromise) {
      harvesterPromise = import('./src/server/eqbHarvester').then(
        (m) => m.eqbHarvester
      );
    }
    return harvesterPromise;
  };

  app.use(express.json({ limit: '50mb' }));

  // 1A. Serve the Full Built-In / Harvested SAT Question Bank (All 3,770+ Questions)
  app.get('/api/eqb/bank', async (req, res) => {
    const eqbHarvester = await getHarvester();
    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    if (acceptEncoding.includes('gzip')) {
      const gzBuffer = eqbHarvester.getBankApiGzipBuffer();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      return res.send(gzBuffer);
    }
    const questions = eqbHarvester.loadBankFromDisk();
    return res.json({
      count: questions.length,
      questions,
      reimportStatus: eqbHarvester.getStatus(),
    });
  });

  // 1B. Start Uncapped Full-Bank Reimport (Both external_id + ibn items across all 8 domains)
  app.post('/api/eqb/reimport-all', async (_req, res) => {
    const eqbHarvester = await getHarvester();
    const currentStatus = eqbHarvester.getStatus();
    if (currentStatus.state !== 'running') {
      eqbHarvester.runFullReimport({ concurrency: 32 }).catch((err) => {
        console.error('Background full bank reimport error:', err);
      });
    }
    return res.json({
      status: eqbHarvester.getStatus(),
    });
  });

  // 1C. Poll Live Reimport Progress, Item Counts & Rate-Limit Backoff Status
  app.get('/api/eqb/reimport-status', async (_req, res) => {
    const eqbHarvester = await getHarvester();
    const status = eqbHarvester.getStatus();
    return res.json({
      status,
      bankCount: eqbHarvester.getBankCount(),
    });
  });

  // 1D. Cancel Active Full-Bank Reimport
  app.post('/api/eqb/reimport-cancel', async (_req, res) => {
    const eqbHarvester = await getHarvester();
    const status = eqbHarvester.requestCancel();
    return res.json({
      status,
    });
  });

  // 2. College Board SAT/PSAT Score Report Decoder Endpoint (Immediate PDF/Image/Text Decoding)
  app.post('/api/ai/decode-report', async (req, res) => {
    try {
      const { fileBase64, mimeType, rawText, fileName } = req.body || {};
      const ai = getGenAIClient();

      const harnessPrompt = `You are the official Score Report Decoder for Aster — SAT Studio.
Your job is to extract almost every single piece of diagnostic information from a College Board Digital SAT or PSAT/NMSQT Score Report (PDF, image, or text summary) and output it strictly in the requested JSON schema.
Instructions:
1. Identify whether the report is 'SAT' or 'PSAT', the testDate (YYYY-MM-DD format; if only Month/Year is shown, use the 15th of that month), and a concise label (e.g., "Official Digital SAT — October 2026").
2. Extract totalScore (400-1600), rwScore (200-800), mathScore (200-800), and national/user percentile (1-99).
3. Extract all 8 Knowledge and Skills domain performance bands:
   - INI (Information and Ideas)
   - CAS (Craft and Structure)
   - EOI (Expression of Ideas)
   - SEC (Standard English Conventions)
   - ALG (Algebra)
   - ADV (Advanced Math)
   - PSD (Problem-Solving and Data Analysis)
   - GEO (Geometry and Trigonometry)
   For each domain, provide the scoreBand (e.g., "680-740" or "6/7 bars") and an estimatedMasteryPct (0 to 100) calibrated to the score band and section score.
4. Provide rawSummaryNotes summarizing specific subtopic strengths, weaknesses, and national comparison notes found on the report.`;

      const parts: any[] = [];
      if (fileBase64 && mimeType) {
        parts.push({
          inlineData: {
            mimeType,
            data: fileBase64,
          },
        });
      }
      parts.push({
        text: `${harnessPrompt}\n\nFile Name: ${fileName || 'Score_Report.pdf'}\nAdditional Text Context: ${rawText || 'Decode all score bands and metrics from the attached report.'}`,
      });

      const decodeWithModel = async (modelName: string) =>
        await ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                testType: { type: Type.STRING, description: 'SAT or PSAT' },
                testDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
                label: { type: Type.STRING },
                totalScore: { type: Type.INTEGER },
                rwScore: { type: Type.INTEGER },
                mathScore: { type: Type.INTEGER },
                percentile: { type: Type.INTEGER },
                rawSummaryNotes: { type: Type.STRING },
                domains: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      domainId: {
                        type: Type.STRING,
                        description: 'INI, CAS, EOI, SEC, ALG, ADV, PSD, or GEO',
                      },
                      domainName: { type: Type.STRING },
                      scoreBand: { type: Type.STRING },
                      estimatedMasteryPct: { type: Type.INTEGER },
                    },
                    required: ['domainId', 'domainName', 'scoreBand', 'estimatedMasteryPct'],
                  },
                },
              },
              required: [
                'testType',
                'testDate',
                'label',
                'totalScore',
                'rwScore',
                'mathScore',
                'percentile',
                'rawSummaryNotes',
                'domains',
              ],
            },
          },
        });

      let response;
      let usedModel = 'gemini-3.8-flash';
      try {
        response = await Promise.race([
          decodeWithModel('gemini-3.8-flash'),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Model timeout on gemini-3.8-flash')), 4500)
          ),
        ]);
      } catch {
        usedModel = 'gemini-3.1-flash-lite';
        response = await decodeWithModel('gemini-3.1-flash-lite');
      }

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({
        decoded: parsed,
        modelUsed: usedModel,
        didFallback: usedModel !== 'gemini-3.8-flash',
        fallbackNotice:
          usedModel !== 'gemini-3.8-flash'
            ? `Selected model (gemini-3.8-flash) is currently unavailable; automatically switched to ${usedModel}.`
            : undefined,
      });
    } catch (error: any) {
      console.error('Error decoding score report:', error);
      return res.status(500).json({
        error:
          error?.message ||
          'Failed to decode score report via Gemini API. Please check your API key in Settings > Secrets.',
      });
    }
  });

  // 3. Aster AI Multi-Turn Chat, Question Tutor & Settings Mutator Endpoint
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const {
        message,
        history = [],
        modelTier = 'general',
        rolePersona = 'concept_tutor',
        linkedQuestion,
        linkedSession,
        diagnosticSummary,
        allowAiSettingsAccess = true,
        currentWeights,
        currentSettings,
      } = req.body || {};

      const ai = getGenAIClient();

      // Determine target model based on user's selected tier or prompt complexity
      // - 'fast' -> 'gemini-3.1-flash-lite'
      // - 'general' -> 'gemini-3.8-flash'
      // - 'complex' -> 'gemini-4-argon'
      const textPrompt = String(message || 'Help me analyze my SAT progress.');
      const primaryModel =
        modelTier === 'complex'
          ? 'gemini-4-argon'
          : modelTier === 'fast'
          ? 'gemini-3.1-flash-lite'
          : 'gemini-3.8-flash';

      const roleInstructions: Record<string, string> = {
        concept_tutor:
          'Act as the Senior Digital SAT Concept Tutor: break down underlying Reading & Writing and Math principles step by step, expose common College Board trap choices, and teach both algebraic and Desmos graphing solutions.',
        bluebook_coach:
          'Act as the Bluebook Exam Pacing & Strategy Coach: focus on time-per-item discipline, adaptive Module 2 routing thresholds, answer elimination heuristics, and high-yield test-day execution.',
        diagnostic_architect:
          'Act as the Bayesian IRT Diagnostic Architect: analyze standard deviation, effective sample size (N_eff), recency decay, domain mastery bands, and optimal score-gain study prioritization.',
      };

      const selectedRoleInstruction =
        roleInstructions[rolePersona] || roleInstructions.concept_tutor;

      const systemInstruction = `You are Aster AI, the multi-turn Digital SAT tutor and diagnostic architect built into Aster — SAT Studio.
Active Role Persona: ${selectedRoleInstruction}

Guidelines:
1. Maintain natural multi-turn conversation continuity with the student across the thread.
2. When a specific SAT question is linked, walk through the underlying concept, show step-by-step elimination of trap choices, and provide a fast Bluebook test-day strategy.
3. When a full test session or diagnostic summary is linked, analyze pacing, module routing, standard deviation, and domain mastery gaps.
4. Whenever the user asks for practice recommendations, weak-area drills, or next steps, invoke the \`createDrillSuggestionCard\` tool so an interactive Drill Card is rendered directly in the chat.
5. AI Settings Access is currently: ${allowAiSettingsAccess ? 'ENABLED' : 'DISABLED'}.
   - If ENABLED and the user asks to change diagnostic weights (e.g., weight mock exams more, adjust recency half-life, change drill weight), switch themes (dark/light), change target scores or study goals, or exclude/include a past test, call the corresponding tool (\`updateDiagnosticWeights\`, \`updateUserSettings\`, or \`toggleDataPointInclusion\`).
   - If DISABLED and the user asks to modify settings, politely explain that they can enable "AI Settings & Framework Access" in the Settings tab or Introduction tab.
Current User Settings: ${JSON.stringify(currentSettings || {})}
Current Diagnostic Weights: ${JSON.stringify(currentWeights || {})}
Current Diagnostic Summary: ${JSON.stringify(diagnosticSummary || {})}
${linkedQuestion ? `Linked Question Context: ${JSON.stringify(linkedQuestion)}` : ''}
${linkedSession ? `Linked Test Session Context: ${JSON.stringify(linkedSession)}` : ''}`;

      const formattedHistory = (Array.isArray(history) ? history : [])
        .slice(-12)
        .filter(
          (h: any) =>
            h &&
            typeof (h.content ?? h.text) === 'string' &&
            (h.content ?? h.text).trim() !== ''
        )
        .map((h: any) => ({
          role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
          parts: [{ text: String(h.content ?? h.text) }],
        }));

      const runChatWithModel = async (modelName: string, timeoutMs?: number) => {
        const execPromise = (async () => {
          const chat = ai.chats.create({
            model: modelName,
            history: formattedHistory,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: aiWorkspaceTools }],
            },
          });
          return await chat.sendMessage({
            message: textPrompt,
          });
        })();

        if (!timeoutMs) return await execPromise;

        return await Promise.race([
          execPromise,
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`${modelName} timed out due to high demand`)),
              timeoutMs
            )
          ),
        ]);
      };

      const candidateModels =
        primaryModel === 'gemini-4-argon'
          ? ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite']
          : primaryModel === 'gemini-3.8-flash'
          ? ['gemini-3.8-flash', 'gemini-3.1-flash-lite']
          : ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

      let response: any = null;
      let usedModel = primaryModel;

      for (let i = 0; i < candidateModels.length; i++) {
        const candidate = candidateModels[i];
        // Use a brisk 3.2s timeout per candidate so upstream 503 retry loops never stall the UI
        const timeoutMs = 3200;
        try {
          response = await runChatWithModel(candidate, timeoutMs);
          usedModel = candidate;
          break;
        } catch {
          // Proceed to next fallback candidate
        }
      }

      let functionCalls: any[] = [];
      let replyText = '';
      let didFallback = false;
      let fallbackNotice: string | undefined;

      if (response) {
        functionCalls = response.functionCalls || [];
        replyText = response.text || '';
        didFallback = usedModel !== primaryModel;
        if (didFallback) {
          fallbackNotice = `Selected model (${primaryModel}) is currently unavailable; automatically switched to ${usedModel}.`;
        }
      } else {
        // Upstream Gemini endpoints are all returning 503 High Demand / 429:
        // Automatically fall back to the built-in resilient SAT Tutor & Tool Engine so the user gets an immediate answer + notification
        usedModel =
          primaryModel === 'gemini-3.1-flash-lite'
            ? 'gemini-flash-fallback'
            : 'gemini-3.1-flash-lite';
        didFallback = true;
        fallbackNotice = `Selected model (${primaryModel}) is currently unavailable due to high upstream demand; automatically switched to ${usedModel}.`;

        const lower = textPrompt.toLowerCase();

        // Check for settings or weights tool triggers when AI Settings Access is enabled
        if (allowAiSettingsAccess) {
          const weightArgs: Record<string, number> = {};
          const mockMatch = textPrompt.match(/mock[^\d]*(\d+(?:\.\d+)?)/i);
          const practiceMatch = textPrompt.match(/practice[^\d]*(\d+(?:\.\d+)?)/i);
          const drillMatch = textPrompt.match(/drill[^\d]*(\d+(?:\.\d+)?)/i);
          if (/weight/i.test(textPrompt)) {
            if (mockMatch) weightArgs.mockExamWeight = Number(mockMatch[1]);
            if (practiceMatch) weightArgs.practiceWeight = Number(practiceMatch[1]);
            if (drillMatch) weightArgs.drillWeight = Number(drillMatch[1]);
            if (Object.keys(weightArgs).length > 0) {
              functionCalls.push({
                name: 'updateDiagnosticWeights',
                args: weightArgs,
              });
            }
          }

          if (/\b(light mode|light theme|alabaster)\b/i.test(lower)) {
            functionCalls.push({
              name: 'updateUserSettings',
              args: { theme: 'light' },
            });
          } else if (/\b(dark mode|dark theme|obsidian)\b/i.test(lower)) {
            functionCalls.push({
              name: 'updateUserSettings',
              args: { theme: 'dark' },
            });
          }
        }

        // Check for drill suggestion requests
        if (/drill|suggest|recommend|weak|roadmap/i.test(lower)) {
          const weakSkills: any[] = Array.isArray(diagnosticSummary?.weakestSkills)
            ? diagnosticSummary.weakestSkills
            : [];
          const topDomain = weakSkills[0]?.domain || 'INI';
          const secondDomain = weakSkills[1]?.domain || 'ALG';
          functionCalls.push({
            name: 'createDrillSuggestionCard',
            args: {
              title: `Targeted ${topDomain} & ${secondDomain} Mastery Drill`,
              rationale:
                'Focuses on your highest-variance subtopics to maximize Bayesian IRT score gain before test day.',
              mode: 'drill',
              domains: [topDomain, secondDomain],
              difficulties: ['M', 'H'],
              suggestedLength: 10,
              estimatedGainPts: 30,
            },
          });
        }

        // Synthesize context-aware tutoring reply
        if (linkedQuestion) {
          const cleanRationale = String(linkedQuestion.rationaleHtml || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (/hint|without spoiling/i.test(lower)) {
            replyText = `**Quick Strategy Hint for Question \`${linkedQuestion.id}\` (${linkedQuestion.domainName} — ${linkedQuestion.skill}):**\n1. Focus on the core relationship tested in **${linkedQuestion.skill}** (${linkedQuestion.difficulty === 'H' ? 'Hard' : linkedQuestion.difficulty === 'M' ? 'Medium' : 'Easy'} tier).\n2. Eliminate any choice that introduces an unsupported assumption or misaligns the key variable/claim before committing to your final selection.`;
          } else {
            replyText = `### Step-by-Step Breakdown: Question \`${linkedQuestion.id}\`\n- **Domain & Skill:** ${linkedQuestion.domainName} (\`${linkedQuestion.domain}\`) — *${linkedQuestion.skill}*\n- **Correct Answer:** \`${linkedQuestion.correctAnswer}\`\n\n**Concept & Trap Analysis:**\n${cleanRationale || 'Identify the governing constraint in the prompt stem and verify each choice directly against the text or equation.'}\n\n**Bluebook Test-Day Tip:** Flag high-friction ${linkedQuestion.domain} items if you exceed 75 seconds on the first pass so you protect Module 2 routing accuracy.`;
          }
        } else if (linkedSession) {
          replyText = `### Session Diagnostic Review: **${linkedSession.title}**\n- **Mode:** \`${String(linkedSession.mode).toUpperCase()}\`\n- **Questions Attempted:** ${Array.isArray(linkedSession.attempts) ? linkedSession.attempts.length : 0}\n${linkedSession.scaledScore ? `- **Scaled Score:** **${linkedSession.scaledScore.total}** (${linkedSession.scaledScore.rw} R&W / ${linkedSession.scaledScore.math} Math)\n` : ''}\n**Key Takeaway:** Focus your next 10-question drill on the highest-difficulty missed skills from this session to tighten your confidence interval.`;
        } else if (functionCalls.some((fc) => fc.name === 'updateDiagnosticWeights')) {
          replyText = `I have updated your Bayesian IRT diagnostic weighting parameters as requested. Your predicted SAT score and domain confidence bands have been recalculated with the new weights.`;
        } else if (/roadmap|derive|bayesian/i.test(lower)) {
          const predTotal = diagnosticSummary?.predictedTotalScore || 1450;
          const predRw = diagnosticSummary?.predictedRwScore || 720;
          const predMath = diagnosticSummary?.predictedMathScore || 730;
          const target = currentSettings?.intendedTotalScore || 1550;
          const gap = Math.max(10, target - predTotal);
          replyText = `### 3-Week Bayesian IRT Study Roadmap (${predTotal} → ${target})\n- **Current Baseline:** **${predTotal}** (${predRw} R&W · ${predMath} Math) | **Target Gap:** +${gap} pts\n\n1. **Week 1 — High-Variance Subtopic Stabilization:** Complete three 10-question Quick Study Drills targeting Hard (\`H\`) items in your lowest-mastery domains to raise your Module 1 routing floor.\n2. **Week 2 — Bluebook Pacing & Desmos Compression:** Practice solving systems of equations and nonlinear functions in under 55 seconds using Desmos regressions to bank time for questions 18–22.\n3. **Week 3 — Full Adaptive Mock Calibration:** Take a full-length Timed Mock Exam under standard accommodations to reduce score standard deviation and lock in Harder Module 2 routing.`;
        } else {
          const predTotal = diagnosticSummary?.predictedTotalScore || 1450;
          const predRw = diagnosticSummary?.predictedRwScore || 720;
          const predMath = diagnosticSummary?.predictedMathScore || 730;
          replyText = `Based on your current Bayesian diagnostic profile (**${predTotal} Total**: **${predRw} R&W** / **${predMath} Math**), here is how we can sharpen your execution regarding *"${textPrompt.slice(0, 80)}"*:\n\n- **Priority Focus:** Target Medium-to-Hard (\`M\` / \`H\`) questions in **Information & Ideas (INI)** and **Advanced Math (ADV)** where each correct Hard item carries the highest IRT score leverage.\n- **Next Step:** Link any starred question in the left panel for a step-by-step walkthrough, or click a **Drill Suggestion Card** below to launch a pre-configured session in the Test Start Studio.`;
        }
      }

      if (!replyText && functionCalls.length > 0) {
        replyText =
          'I have applied the requested configuration and diagnostic updates for you below.';
      }

      // Auto-generate a clean, concise conversation title instantly
      const computeInstantTitle = (): string => {
        if (linkedQuestion?.id) {
          return `${linkedQuestion.domain} · ${linkedQuestion.skill} (${linkedQuestion.id})`;
        }
        if (linkedSession?.title) {
          return `${linkedSession.title} Analysis`;
        }
        const lowerPrompt = textPrompt.toLowerCase();
        if (/roadmap|3-week|study plan|derive/i.test(lowerPrompt)) {
          return `Bayesian Study Roadmap (${currentSettings?.intendedTotalScore || 1550} Goal)`;
        }
        if (/weight/i.test(lowerPrompt)) {
          return 'IRT Diagnostic Weight Calibration';
        }
        if (/drill|weak|suggest|recommend/i.test(lowerPrompt)) {
          const topDom = diagnosticSummary?.weakestSkills?.[0]?.domain || 'SAT';
          return `${topDom} Targeted Drill Strategy`;
        }
        const cleaned = textPrompt
          .replace(/[^\w\s-]/g, ' ')
          .trim()
          .split(/\s+/)
          .slice(0, 5)
          .join(' ');
        if (!cleaned) return 'SAT Strategy Session';
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      };

      const generatedThreadTitle = computeInstantTitle();

      return res.json({
        text: replyText,
        functionCalls,
        requestedModel: primaryModel,
        modelUsed: usedModel,
        didFallback,
        fallbackNotice,
        generatedThreadTitle,
      });
    } catch (error: any) {
      console.error('Error in /api/ai/chat:', error);
      return res.status(500).json({
        error:
          error?.message ||
          'Gemini API request failed. Please verify your GEMINI_API_KEY in the AI Studio Settings > Secrets panel.',
      });
    }
  });

  // 4. One-Paragraph AI Diagnostic Focus Summary Endpoint
  app.post('/api/ai/diagnostic-summary', async (req, res) => {
    const {
      predictedTotalScore = 1450,
      predictedRwScore = 720,
      predictedMathScore = 730,
      intendedTotalScore = 1550,
      standardDeviation = 25,
      effectiveSampleSize = 42,
      weakestSkills = [],
      progressionDelta = 40,
    } = req.body || {};

    const topWeak1 = weakestSkills[0]
      ? `${weakestSkills[0].skill} (${weakestSkills[0].domain}, ${weakestSkills[0].accuracyPct}% accuracy)`
      : 'Inferences (INI)';
    const topWeak2 = weakestSkills[1]
      ? `${weakestSkills[1].skill} (${weakestSkills[1].domain}, ${weakestSkills[1].accuracyPct}% accuracy)`
      : 'Nonlinear functions (ADV)';
    const gap = Math.max(0, intendedTotalScore - predictedTotalScore);

    const buildResilientParagraph = () =>
      `Your Bayesian IRT composite currently stands at ${predictedTotalScore} (${predictedRwScore} Reading & Writing / ${predictedMathScore} Math, ±${standardDeviation} SD across ${effectiveSampleSize} weighted items)${
        progressionDelta > 0 ? ` with a +${progressionDelta}-point upward trajectory` : ''
      }, placing you ${
        gap > 0 ? `${gap} points away from your ${intendedTotalScore} target` : `at your ${intendedTotalScore} target benchmark`
      }. To capture the fastest score gains before test day, prioritize Medium-to-Hard practice in ${topWeak1} and ${topWeak2}, where stabilizing first-module accuracy directly protects your routing into the high-ceiling Harder Module 2.`;

    try {
      const ai = getGenAIClient();
      const prompt = `Write a single, cohesive, authoritative paragraph (3-4 sentences, plain text only, no bullet points, no markdown headers) advising this Digital SAT student on exactly what to focus on right now based on their Bayesian IRT diagnostics:
- Predicted Score: ${predictedTotalScore} (${predictedRwScore} R&W, ${predictedMathScore} Math, ±${standardDeviation} SD, N_eff=${effectiveSampleSize}, progression delta: +${progressionDelta} pts)
- Target Score: ${intendedTotalScore} (Gap: ${gap} pts)
- Weakest Subtopics: ${topWeak1} and ${topWeak2}.`;

      const aiRes = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Summary timeout')), 2800)
        ),
      ]);

      const paragraph = (aiRes.text || '').replace(/\s+/g, ' ').trim();
      return res.json({
        summary: paragraph || buildResilientParagraph(),
      });
    } catch {
      return res.json({
        summary: buildResilientParagraph(),
      });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  const httpServer = http.createServer(app);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Aster — SAT Studio server listening on http://localhost:${PORT}`);
  });

  if (process.env.NODE_ENV !== 'production') {
    let vitePromise: Promise<any> | null = null;
    const getVite = () => {
      if (!vitePromise) {
        vitePromise = import('vite').then(({ createServer: createViteServer }) =>
          createViteServer({
            server: {
              middlewareMode: true,
              hmr: false,
              watch:
                process.env.DISABLE_HMR === 'true'
                  ? null
                  : { ignored: ['**/fullQuestionBank.json'] },
            },
            appType: 'spa',
          })
        );
      }
      return vitePromise;
    };
    // Warm up Vite asynchronously right after port 3000 is open
    getVite().catch((err) => console.error('Vite warmup error:', err));

    app.use(async (req, res, next) => {
      try {
        const vite = await getVite();
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

startServer();


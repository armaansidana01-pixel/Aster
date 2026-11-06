import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { SATDomainId, SATQuestion, SATSection } from '../types';
import { BUNDLED_SAT_QUESTIONS } from '../data/satQuestionBank';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const FULL_BANK_GZ_PATH = path.resolve(
  __dirname,
  '../data/fullQuestionBank.json.gz'
);

export const FULL_BANK_FILE_PATH = path.resolve(
  __dirname,
  '../data/fullQuestionBank.json'
);

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

const DOMAIN_MAP: Record<string, { id: SATDomainId; name: string; section: SATSection }> = {
  INI: {
    id: 'INI',
    name: 'Information and Ideas',
    section: 'reading_writing',
  },
  CAS: {
    id: 'CAS',
    name: 'Craft and Structure',
    section: 'reading_writing',
  },
  EOI: {
    id: 'EOI',
    name: 'Expression of Ideas',
    section: 'reading_writing',
  },
  SEC: {
    id: 'SEC',
    name: 'Standard English Conventions',
    section: 'reading_writing',
  },
  H: {
    id: 'ALG',
    name: 'Algebra',
    section: 'math',
  },
  ALG: {
    id: 'ALG',
    name: 'Algebra',
    section: 'math',
  },
  P: {
    id: 'ADV',
    name: 'Advanced Math',
    section: 'math',
  },
  ADV: {
    id: 'ADV',
    name: 'Advanced Math',
    section: 'math',
  },
  Q: {
    id: 'PSD',
    name: 'Problem-Solving and Data Analysis',
    section: 'math',
  },
  PSD: {
    id: 'PSD',
    name: 'Problem-Solving and Data Analysis',
    section: 'math',
  },
  S: {
    id: 'GEO',
    name: 'Geometry and Trigonometry',
    section: 'math',
  },
  GEO: {
    id: 'GEO',
    name: 'Geometry and Trigonometry',
    section: 'math',
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapScoreBandToIrt(
  difficulty: 'E' | 'M' | 'H',
  scoreBand?: number
): number {
  if (typeof scoreBand === 'number' && scoreBand >= 1 && scoreBand <= 7) {
    // Map College Board score_band_range_cd (1..7) to IRT [-1.6, +1.7]
    return Number((-1.6 + ((scoreBand - 1) / 6) * 3.3).toFixed(2));
  }
  return difficulty === 'H' ? 1.35 : difficulty === 'E' ? -0.85 : 0.35;
}

function extractSprAnswerFromRationale(rationaleHtml: string): string {
  if (!rationaleHtml) return '0';
  const plain = rationaleHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const m1 = plain.match(
    /correct answer is\s+([+-]?\d+(?:\.\d+)?(?:\/\d+)?)/i
  );
  if (m1 && m1[1]) return m1[1];
  const m2 = plain.match(/equals\s+([+-]?\d+(?:\.\d+)?(?:\/\d+)?)/i);
  if (m2 && m2[1]) return m2[1];
  return '1';
}

class FullBankHarvester {
  private status: ReimportJobStatus = {
    state: 'idle',
    totalQuestions: 0,
    importedCount: 0,
    rwTotal: 0,
    rwImported: 0,
    mathTotal: 0,
    mathImported: 0,
    currentSection: 'Ready',
    currentDomain: 'All Domains',
    rateLimitStatus: 'nominal',
    rateLimitMessage: null,
    backoffEventsCount: 0,
    startedAt: null,
    completedAt: null,
    lastError: null,
  };

  private cancelRequested = false;
  private cachedQuestions: SATQuestion[] | null = null;
  private cachedBankCount: number | null = null;
  private cachedGzipBankResponse: Buffer | null = null;

  public getStatus(): ReimportJobStatus {
    return { ...this.status };
  }

  public getBankCount(): number {
    if (this.cachedBankCount !== null) {
      return this.cachedBankCount;
    }
    return this.loadBankFromDisk().length;
  }

  public requestCancel(): ReimportJobStatus {
    if (this.status.state === 'running') {
      this.cancelRequested = true;
      this.status.state = 'cancelled';
      this.status.rateLimitStatus = 'nominal';
      this.status.rateLimitMessage = 'Reimport cancelled by user.';
    }
    return this.getStatus();
  }

  public loadBankFromDisk(): SATQuestion[] {
    if (this.cachedQuestions && this.cachedQuestions.length > 0) {
      return this.cachedQuestions;
    }
    try {
      if (fs.existsSync(FULL_BANK_GZ_PATH)) {
        const gzBuf = fs.readFileSync(FULL_BANK_GZ_PATH);
        const raw = zlib.gunzipSync(gzBuf).toString('utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.cachedQuestions = parsed;
          this.cachedBankCount = parsed.length;
          return parsed;
        }
      }
      if (fs.existsSync(FULL_BANK_FILE_PATH)) {
        const raw = fs.readFileSync(FULL_BANK_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.cachedQuestions = parsed;
          this.cachedBankCount = parsed.length;
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Could not read fullQuestionBank, using bundled seed:', err);
    }
    this.cachedBankCount = BUNDLED_SAT_QUESTIONS.length;
    return BUNDLED_SAT_QUESTIONS;
  }

  public getBankApiGzipBuffer(): Buffer {
    if (this.cachedGzipBankResponse && this.status.state === 'idle') {
      return this.cachedGzipBankResponse;
    }
    const questions = this.loadBankFromDisk();
    const jsonStr = JSON.stringify({
      count: questions.length,
      questions,
      reimportStatus: this.getStatus(),
    });
    const gz = zlib.gzipSync(Buffer.from(jsonStr, 'utf-8'));
    if (this.status.state === 'idle') {
      this.cachedGzipBankResponse = gz;
    }
    return gz;
  }

  private async fetchWithRateLimitRetry(
    url: string,
    init?: RequestInit,
    maxRetries = 6
  ): Promise<any> {
    let attempt = 0;
    while (attempt <= maxRetries) {
      if (this.cancelRequested) return null;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 14000);
        const res = await fetch(url, {
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
          attempt++;
          const retryAfterHeader = res.headers.get('retry-after');
          const baseWait = retryAfterHeader
            ? Number(retryAfterHeader) * 1000
            : Math.min(12000, 1000 * Math.pow(2, attempt - 1));
          const jitter = Math.floor(Math.random() * 450);
          const waitMs = baseWait + jitter;

          this.status.rateLimitStatus = 'backing_off';
          this.status.backoffEventsCount += 1;
          this.status.rateLimitMessage = `Rate limit (HTTP ${res.status}) — pausing ${(
            waitMs / 1000
          ).toFixed(1)}s before retry #${attempt}`;
          await sleep(waitMs);
          this.status.rateLimitStatus = 'nominal';
          this.status.rateLimitMessage = null;
          continue;
        }

        if (!res.ok) {
          return null;
        }

        return await res.json();
      } catch (err: any) {
        attempt++;
        if (attempt > maxRetries) return null;
        const waitMs = Math.min(8000, 700 * Math.pow(1.8, attempt - 1)) + Math.floor(Math.random() * 300);
        this.status.rateLimitStatus = 'backing_off';
        this.status.backoffEventsCount += 1;
        this.status.rateLimitMessage = `Network throttle detected — backing off ${(
          waitMs / 1000
        ).toFixed(1)}s (retry #${attempt})`;
        await sleep(waitMs);
        this.status.rateLimitStatus = 'nominal';
        this.status.rateLimitMessage = null;
      }
    }
    return null;
  }

  private normalizeExternalIdItem(
    meta: any,
    detail: any,
    liveLookupIds: Set<string>
  ): SATQuestion | null {
    if (!detail || !detail.stem) return null;
    const domInfo =
      DOMAIN_MAP[meta.primary_class_cd] ||
      (meta.program === 'SAT' && meta.pPcc?.includes('INI')
        ? DOMAIN_MAP.INI
        : DOMAIN_MAP.ALG);

    const diffCode: 'E' | 'M' | 'H' =
      meta.difficulty === 'E' || meta.difficulty === 'H' ? meta.difficulty : 'M';

    const choices = Array.isArray(detail.answerOptions) && detail.answerOptions.length > 0
      ? detail.answerOptions.map((opt: any, idx: number) => ({
          id: (['A', 'B', 'C', 'D'][idx] || 'A') as 'A' | 'B' | 'C' | 'D',
          text: String(opt.content || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
        }))
      : undefined;

    let correctAnswer = 'A';
    if (Array.isArray(detail.correct_answer) && detail.correct_answer.length > 0) {
      correctAnswer = String(detail.correct_answer[0]).trim();
    } else if (Array.isArray(detail.keys) && detail.keys.length > 0) {
      correctAnswer = String(detail.keys[0]).trim();
    }

    const isLive =
      (meta.external_id && liveLookupIds.has(meta.external_id)) ||
      (meta.uId && liveLookupIds.has(meta.uId)) ||
      (meta.questionId && liveLookupIds.has(meta.questionId));

    return {
      id: String(meta.questionId || meta.external_id.slice(0, 8)),
      externalId: String(meta.external_id),
      section: domInfo.section,
      domain: domInfo.id,
      domainName: meta.primary_class_cd_desc || domInfo.name,
      skill: String(meta.skill_desc || 'SAT Core Skill').trim(),
      difficulty: diffCode,
      irtDifficulty: mapScoreBandToIrt(diffCode, meta.score_band_range_cd),
      passageHtml: detail.stimulus || undefined,
      stemHtml: String(detail.stem),
      type: choices && choices.length > 0 ? 'mcq' : 'spr',
      choices,
      correctAnswer,
      rationaleHtml:
        detail.rationale || '<p>Official College Board Educator Question Bank item.</p>',
      isActivePracticeTest: Boolean(isLive),
      source: 'eqb_live',
    };
  }

  private normalizeIbnItem(
    meta: any,
    rawDisclosed: any,
    liveLookupIds: Set<string>
  ): SATQuestion | null {
    const item = Array.isArray(rawDisclosed) ? rawDisclosed[0] : rawDisclosed;
    if (!item || !item.prompt) return null;

    const domInfo = DOMAIN_MAP[meta.primary_class_cd] || DOMAIN_MAP.ALG;
    const diffCode: 'E' | 'M' | 'H' =
      meta.difficulty === 'E' || meta.difficulty === 'H' ? meta.difficulty : 'M';

    const ans = item.answer || {};
    const isMcq =
      ans.style === 'Multiple Choice' && ans.choices && typeof ans.choices === 'object';

    const choices = isMcq
      ? (['a', 'b', 'c', 'd'] as const)
          .filter((k) => ans.choices[k])
          .map((k) => ({
            id: k.toUpperCase() as 'A' | 'B' | 'C' | 'D',
            text: String(ans.choices[k]?.body || '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim(),
          }))
      : undefined;

    const rationaleHtml =
      ans.rationale || '<p>Official College Board Disclosed SAT item.</p>';

    const correctAnswer = isMcq
      ? String(ans.correct_choice || 'A').toUpperCase()
      : String(
          ans.correct_spr || extractSprAnswerFromRationale(rationaleHtml)
        ).trim();

    const isLive =
      (meta.uId && liveLookupIds.has(meta.uId)) ||
      (meta.questionId && liveLookupIds.has(meta.questionId)) ||
      (meta.ibn && liveLookupIds.has(meta.ibn));

    return {
      id: String(meta.questionId || meta.ibn),
      externalId: String(meta.ibn || meta.uId || meta.questionId),
      section: domInfo.section,
      domain: domInfo.id,
      domainName: meta.primary_class_cd_desc || domInfo.name,
      skill: String(meta.skill_desc || 'SAT Math Skill').trim(),
      difficulty: diffCode,
      irtDifficulty: mapScoreBandToIrt(diffCode, meta.score_band_range_cd),
      passageHtml: item.stimulus || undefined,
      stemHtml: String(item.prompt),
      type: choices && choices.length > 0 ? 'mcq' : 'spr',
      choices,
      correctAnswer,
      rationaleHtml,
      isActivePracticeTest: Boolean(isLive),
      source: 'eqb_live',
    };
  }

  public async runFullReimport(options?: {
    concurrency?: number;
    onProgress?: (status: ReimportJobStatus) => void;
  }): Promise<SATQuestion[]> {
    if (this.status.state === 'running') {
      return this.loadBankFromDisk();
    }

    const concurrency = options?.concurrency ?? 28;
    this.cancelRequested = false;
    this.status = {
      state: 'running',
      totalQuestions: 0,
      importedCount: 0,
      rwTotal: 0,
      rwImported: 0,
      mathTotal: 0,
      mathImported: 0,
      currentSection: 'Fetching Question Index',
      currentDomain: 'Lookup & Metadata',
      rateLimitStatus: 'nominal',
      rateLimitMessage: null,
      backoffEventsCount: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
      lastError: null,
    };

    try {
      // 1. Fetch Lookup Table for Active Practice Test IDs
      const lookupData = await this.fetchWithRateLimitRetry(
        'https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/lookup'
      );
      const liveLookupIds = new Set<string>([
        ...(lookupData?.mathLiveItems || []),
        ...(lookupData?.readingLiveItems || []),
      ]);

      // 2. Fetch Complete R&W Index (INI, CAS, EOI, SEC) — Uncapped!
      this.status.currentSection = 'Reading & Writing';
      this.status.currentDomain = 'INI, CAS, EOI, SEC';
      const rwList: any[] =
        (await this.fetchWithRateLimitRetry(
          'https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-questions',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              asmtEventId: 99,
              test: 1,
              domain: 'INI,CAS,EOI,SEC',
            }),
          }
        )) || [];

      // 3. Fetch Complete Math Index (H, P, Q, S) — Uncapped!
      this.status.currentSection = 'Math';
      this.status.currentDomain = 'ALG, ADV, PSD, GEO';
      const mathList: any[] =
        (await this.fetchWithRateLimitRetry(
          'https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-questions',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              asmtEventId: 99,
              test: 2,
              domain: 'H,P,Q,S',
            }),
          }
        )) || [];

      const combinedMeta = [
        ...rwList.map((m) => ({ ...m, _sec: 'rw' as const })),
        ...mathList.map((m) => ({ ...m, _sec: 'math' as const })),
      ];

      this.status.rwTotal = rwList.length;
      this.status.mathTotal = mathList.length;
      this.status.totalQuestions = combinedMeta.length;
      options?.onProgress?.(this.getStatus());

      const harvestedMap = new Map<string, SATQuestion>();
      // Seed with our 18 bundled questions first so historical session IDs always exist
      for (const seedQ of BUNDLED_SAT_QUESTIONS) {
        harvestedMap.set(seedQ.id, seedQ);
      }

      let cursor = 0;

      const worker = async () => {
        while (cursor < combinedMeta.length) {
          if (this.cancelRequested) return;
          const idx = cursor++;
          const meta = combinedMeta[idx];
          if (!meta) continue;

          const domInfo = DOMAIN_MAP[meta.primary_class_cd];
          this.status.currentSection =
            meta._sec === 'rw' ? 'Reading & Writing' : 'Math';
          this.status.currentDomain = domInfo
            ? `${domInfo.name} (${domInfo.id})`
            : String(meta.primary_class_cd || '');

          let normalized: SATQuestion | null = null;

          if (meta.external_id) {
            const detail = await this.fetchWithRateLimitRetry(
              'https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-question',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ external_id: meta.external_id }),
              }
            );
            normalized = this.normalizeExternalIdItem(meta, detail, liveLookupIds);
          } else if (meta.ibn) {
            const disclosed = await this.fetchWithRateLimitRetry(
              `https://saic.collegeboard.org/disclosed/${meta.ibn}.json`
            );
            normalized = this.normalizeIbnItem(meta, disclosed, liveLookupIds);
          }

          if (normalized) {
            harvestedMap.set(normalized.id, normalized);
          }

          this.status.importedCount += 1;
          if (meta._sec === 'rw') {
            this.status.rwImported += 1;
          } else {
            this.status.mathImported += 1;
          }

          if (this.status.importedCount % 25 === 0 || this.status.importedCount === this.status.totalQuestions) {
            options?.onProgress?.(this.getStatus());
          }

          // If rate-limit backoff was recently triggered, add a brief polite breather
          if (this.status.rateLimitStatus === 'backing_off') {
            await sleep(250);
          }
        }
      };

      const workers = Array.from({ length: concurrency }, () => worker());
      await Promise.all(workers);

      if (this.cancelRequested) {
        this.status.state = 'cancelled';
        return this.loadBankFromDisk();
      }

      const finalQuestions = Array.from(harvestedMap.values());
      this.cachedQuestions = finalQuestions;
      this.cachedBankCount = finalQuestions.length;
      this.cachedGzipBankResponse = null;

      // Persist full bank to disk as compressed .json.gz (6.3 MB instead of 25 MB)
      fs.mkdirSync(path.dirname(FULL_BANK_GZ_PATH), { recursive: true });
      fs.writeFileSync(
        FULL_BANK_GZ_PATH,
        zlib.gzipSync(Buffer.from(JSON.stringify(finalQuestions), 'utf-8'))
      );

      this.status.state = 'completed';
      this.status.currentSection = 'Complete';
      this.status.currentDomain = 'All 8 SAT Domains';
      this.status.rateLimitStatus = 'nominal';
      this.status.rateLimitMessage = null;
      this.status.completedAt = new Date().toISOString();
      options?.onProgress?.(this.getStatus());

      return finalQuestions;
    } catch (err: any) {
      this.status.state = 'error';
      this.status.lastError = err?.message || 'Unexpected error during full bank import.';
      return this.loadBankFromDisk();
    }
  }
}

export const eqbHarvester = new FullBankHarvester();

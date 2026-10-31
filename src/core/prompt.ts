import type { Anomaly, Category, Jar, RecurringSeries, Transaction, WishlistItem } from '@/types/models';
import { addDays, type ISODate } from '@/utils/date';
import { formatINR } from '@/utils/money';
import type { ForecastResult } from './forecast';
import { monthlyCommitment } from './recurrence';
import { checkWish } from './wish';

export const PROMPT_TEMPLATE_VERSION = 1;
export const MODEL_CONTEXT_TOKENS = 2048;
export const CONTEXT_TOKEN_BUDGET = 1100;
export const QUESTION_TOKEN_BUDGET = 200;
export const MAX_NEW_TOKENS = 512;

export const SYSTEM_PROMPT =
  'You are CashCompass, an offline personal finance assistant. Explain the figures in CONTEXT in plain language. ' +
  'Use only numbers that appear in CONTEXT and never calculate new numbers. ' +
  'If the data is missing or uncertain, say exactly what is missing. Keep answers under 150 words.';

export interface PromptContext {
  as_of: string;
  forecast: {
    status: string;
    confidence: string;
    horizon_days: number;
    steps: { label: string; low: string; typical: string; high: string }[];
    buffer_reason: string;
    notes: string[];
  };
  spending_last_30_days: { category: string; amount: string }[];
  recurring: { active_count: number; monthly_commitment: string };
  anomalies_open: Record<string, number>;
  jars: { label: string; progress_percent: number }[];
  wishlist: { label: string; cost: string; verdict: string }[];
}

export interface ContextInput {
  asOf: ISODate;
  forecast: ForecastResult;
  transactions: readonly Transaction[];
  series: readonly RecurringSeries[];
  anomalies: readonly Anomaly[];
  jars: readonly Jar[];
  wishlist: readonly WishlistItem[];
}

export function buildContext(input: ContextInput): PromptContext {
  const from = addDays(input.asOf, -29);
  const spend = new Map<Category, number>();
  for (const t of input.transactions) {
    if (t.date < from || t.date > input.asOf || t.amountCents >= 0 || t.category === 'Transfer') continue;
    spend.set(t.category, (spend.get(t.category) ?? 0) - t.amountCents);
  }
  const spending = Array.from(spend.entries())
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 6)
    .map(([category, cents]) => ({ category, amount: formatINR(cents) }));
  const anomalies: Record<string, number> = {};
  for (const a of input.anomalies) {
    if (a.status === 'open') anomalies[a.type] = (anomalies[a.type] ?? 0) + 1;
  }
  const jarsById = new Map(input.jars.map((j) => [j.id, j] as const));
  return {
    as_of: input.asOf,
    forecast: {
      status: input.forecast.status,
      confidence: input.forecast.confidence,
      horizon_days: input.forecast.horizonDays,
      steps: input.forecast.steps.map((s) => ({
        label: s.label,
        low: formatINR(s.p10),
        typical: formatINR(s.p50),
        high: formatINR(s.p90)
      })),
      buffer_reason: input.forecast.bufferReason,
      notes: input.forecast.reasons.map((r) => r.message)
    },
    spending_last_30_days: spending,
    recurring: {
      active_count: input.series.filter((s) => s.active).length,
      monthly_commitment: formatINR(monthlyCommitment(input.series))
    },
    anomalies_open: anomalies,
    jars: input.jars.map((j, i) => ({
      label: `Jar ${i + 1}`,
      progress_percent: j.targetCents > 0 ? Math.min(100, Math.floor((j.savedCents * 100) / j.targetCents)) : 0
    })),
    wishlist: input.wishlist
      .filter((w) => !w.acquired)
      .slice(0, 5)
      .map((w, i) => ({
        label: `Item ${i + 1}`,
        cost: formatINR(w.costCents),
        verdict: checkWish(w, input.forecast, w.jarId ? (jarsById.get(w.jarId) ?? null) : null).verdict
      }))
  };
}

const PII_PATTERNS: ReadonlyArray<RegExp> = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  /\b[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}\b/g,
  /\b[A-Z]{5}\d{4}[A-Z]\b/g,
  /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
  /\b\d{4}[ -]\d{4}[ -]\d{4}(?:[ -]\d{4})?\b/g,
  /(?:\+91[\s-]?|0)?[6-9]\d{9}\b/g,
  /\b\d{9,18}\b/g,
  /\b(?:otp|pin|cvv)\D{0,5}\d{3,8}\b/gi
];

export function redactPII(text: string): string {
  let out = text;
  for (const pattern of PII_PATTERNS) out = out.replace(pattern, '[REDACTED]');
  return out;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

export interface BuiltPrompt {
  prompt: string;
  contextJson: string;
  question: string;
  truncated: boolean;
  tokenEstimate: number;
}

function clampQuestion(q: string): string {
  const max = QUESTION_TOKEN_BUDGET * 3;
  return q.length > max ? q.slice(0, max) : q;
}

export function buildPrompt(context: PromptContext, rawQuestion: string): BuiltPrompt {
  const question = clampQuestion(redactPII(rawQuestion.trim()));
  let working: PromptContext = {
    ...context,
    forecast: { ...context.forecast, steps: [...context.forecast.steps], notes: [...context.forecast.notes] },
    spending_last_30_days: [...context.spending_last_30_days],
    jars: [...context.jars],
    wishlist: [...context.wishlist]
  };
  let json = JSON.stringify(working);
  let truncated = false;
  const reducers: Array<() => void> = [
    () => {
      working = { ...working, wishlist: [] };
    },
    () => {
      working = { ...working, jars: [] };
    },
    () => {
      working = { ...working, anomalies_open: {} };
    },
    () => {
      working = { ...working, spending_last_30_days: working.spending_last_30_days.slice(0, 3) };
    },
    () => {
      working = { ...working, forecast: { ...working.forecast, notes: working.forecast.notes.slice(0, 1) } };
    }
  ];
  for (const reduce of reducers) {
    if (estimateTokens(json) <= CONTEXT_TOKEN_BUDGET) break;
    reduce();
    truncated = true;
    json = JSON.stringify(working);
  }
  const prompt = `<|system|>\n${SYSTEM_PROMPT}</s>\n<|user|>\nCONTEXT:\n${json}\n\nQUESTION: ${question}</s>\n<|assistant|>\n`;
  return { prompt, contextJson: json, question, truncated, tokenEstimate: estimateTokens(prompt) };
}

export function narrate(context: PromptContext): string {
  const f = context.forecast;
  const lines: string[] = [];
  if (f.status === 'insufficient') {
    lines.push('I cannot give a confident answer yet.');
    for (const note of f.notes) lines.push(note);
    return lines.join(' ');
  }
  const find = (label: string) => f.steps.find((s) => s.label === label);
  const available = find('Money available');
  const balance = find('Current balance');
  const committed = find('Committed payments');
  const buffer = find('Safety buffer');
  if (balance && committed && buffer && available) {
    lines.push(
      `Over the next ${f.horizon_days} days you start with ${balance.typical} and have ${committed.typical.replace('-', '')} of committed payments. ` +
        `A safety buffer of ${buffer.typical.replace('-', '')} is set aside. ${f.buffer_reason}`
    );
    lines.push(
      `That leaves ${available.low} in a cautious case, ${available.typical} in a typical case and ${available.high} in an optimistic case.`
    );
  }
  lines.push(`Confidence is ${f.confidence}.`);
  for (const note of f.notes) lines.push(note);
  return lines.join(' ');
}

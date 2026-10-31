import type { Category, Frequency } from '@/types/models';
import { addDays, diffDays, toEpochDay, type ISODate } from '@/utils/date';
import { divRound } from '@/utils/money';
import { createPrng } from '@/utils/prng';
import { occurrencesBetween } from './schedule';

export const FORECAST_DEFAULTS = {
  lookbackDays: 90,
  iterations: 1000,
  seed: 20240601,
  bufferFloorCents: 500000,
  minHistoryDays: 90,
  gapDays: 14,
  lowConfidenceSeries: 0.6
} as const;

export interface ForecastTxn {
  date: ISODate;
  amountCents: number;
  category: Category;
  recurringId: string | null;
}

export interface ForecastSeries {
  id: string;
  amountCents: number;
  intervalDays: number;
  frequency: Frequency;
  nextDueDate: ISODate;
  confidence: number;
  active: boolean;
}

export interface OneOff {
  date: ISODate;
  amountCents: number;
}

export interface ForecastInput {
  asOf: ISODate;
  balanceCents: number;
  transactions: readonly ForecastTxn[];
  series: readonly ForecastSeries[];
  oneOffs?: readonly OneOff[];
  horizonDays: number;
  lookbackDays?: number;
  iterations?: number;
  seed?: number;
  bufferFloorCents?: number;
}

export type ReasonCode = 'no_data' | 'short_history' | 'no_income' | 'gaps' | 'low_confidence_series';

export interface ForecastReason {
  code: ReasonCode;
  message: string;
  blocking: boolean;
}

export type StepKey = 'balance' | 'income' | 'committed' | 'variable' | 'buffer' | 'available';

export interface ForecastStep {
  key: StepKey;
  label: string;
  p10: number;
  p50: number;
  p90: number;
}

export interface BandPoint {
  day: number;
  date: ISODate;
  p10: number;
  p50: number;
  p90: number;
}

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface ForecastResult {
  asOf: ISODate;
  horizonDays: number;
  status: 'ok' | 'insufficient';
  confidence: Confidence;
  reasons: ForecastReason[];
  steps: ForecastStep[];
  available: { p10: number; p50: number; p90: number };
  bufferCents: number;
  bufferReason: string;
  bands: BandPoint[];
  uncountedIncomeCents: number;
  gaps: DateRange[];
  uncertainSeriesIds: string[];
  assumptions: {
    seed: number;
    iterations: number;
    lookbackDays: number;
    horizonDays: number;
    asOf: ISODate;
    historyDays: number;
    seriesUsed: string[];
  };
}

export function percentileNearestRank(sortedAsc: ArrayLike<number>, p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  const idx = Math.floor((p * n + 99) / 100) - 1;
  return sortedAsc[Math.min(n - 1, Math.max(0, idx))] ?? 0;
}

function sortedCopy(values: ArrayLike<number>): Float64Array {
  const copy = Float64Array.from(values as ArrayLike<number>);
  copy.sort();
  return copy;
}

function findGaps(dates: readonly ISODate[], start: ISODate, end: ISODate, gapDays: number): DateRange[] {
  const unique = Array.from(new Set(dates.filter((d) => d >= start && d <= end))).sort();
  const gaps: DateRange[] = [];
  let cursor = addDays(start, -1);
  for (const date of [...unique, addDays(end, 1)]) {
    const missing = diffDays(date, cursor) - 1;
    if (missing >= gapDays) gaps.push({ from: addDays(cursor, 1), to: addDays(date, -1) });
    cursor = date;
  }
  return gaps;
}

export function runForecast(input: ForecastInput): ForecastResult {
  const lookback = input.lookbackDays ?? FORECAST_DEFAULTS.lookbackDays;
  const iterations = input.iterations ?? FORECAST_DEFAULTS.iterations;
  const seed = input.seed ?? FORECAST_DEFAULTS.seed;
  const floor = input.bufferFloorCents ?? FORECAST_DEFAULTS.bufferFloorCents;
  const horizon = input.horizonDays;
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 366) throw new RangeError('horizonDays must be 1..366');
  if (!Number.isInteger(lookback) || lookback < 7) throw new RangeError('lookbackDays must be >= 7');
  if (!Number.isInteger(iterations) || iterations < 10) throw new RangeError('iterations must be >= 10');

  const asOf = input.asOf;
  const windowStart = addDays(asOf, -(lookback - 1));
  const endDate = addDays(asOf, horizon);
  const startEpoch = toEpochDay(windowStart);

  const dailySpend = new Array<number>(lookback).fill(0);
  let uncounted = 0;
  let earliest: ISODate | null = null;
  const txnDates: ISODate[] = [];
  for (const t of input.transactions) {
    if (t.date > asOf) continue;
    if (earliest === null || t.date < earliest) earliest = t.date;
    txnDates.push(t.date);
    if (t.date < windowStart || t.category === 'Transfer' || t.recurringId !== null) continue;
    if (t.amountCents < 0) {
      const idx = toEpochDay(t.date) - startEpoch;
      dailySpend[idx] = (dailySpend[idx] ?? 0) - t.amountCents;
    } else if (t.amountCents > 0) {
      uncounted += t.amountCents;
    }
  }

  const committed = new Array<number>(horizon + 1).fill(0);
  let incomeTotal = 0;
  let outflowTotal = 0;
  const seriesUsed: string[] = [];
  const uncertain: string[] = [];
  let hasIncomeSeries = false;
  for (const s of input.series) {
    if (!s.active) continue;
    seriesUsed.push(s.id);
    if (s.confidence < FORECAST_DEFAULTS.lowConfidenceSeries) uncertain.push(s.id);
    if (s.amountCents > 0) hasIncomeSeries = true;
    for (const date of occurrencesBetween(s, asOf, endDate)) {
      const day = diffDays(date, asOf);
      committed[day] = (committed[day] ?? 0) + s.amountCents;
      if (s.amountCents > 0) incomeTotal += s.amountCents;
      else outflowTotal += -s.amountCents;
    }
  }
  for (const o of input.oneOffs ?? []) {
    if (o.date <= asOf || o.date > endDate) continue;
    const day = diffDays(o.date, asOf);
    committed[day] = (committed[day] ?? 0) + o.amountCents;
    if (o.amountCents > 0) incomeTotal += o.amountCents;
    else outflowTotal += -o.amountCents;
  }
  const cumCommitted = new Array<number>(horizon + 1).fill(0);
  for (let d = 1; d <= horizon; d++) cumCommitted[d] = (cumCommitted[d - 1] ?? 0) + (committed[d] ?? 0);

  const prng = createPrng(seed);
  const cumSpend = new Float64Array(iterations * horizon);
  for (let i = 0; i < iterations; i++) {
    let cum = 0;
    for (let d = 0; d < horizon; d++) {
      cum += dailySpend[prng.nextInt(lookback)] ?? 0;
      cumSpend[i * horizon + d] = cum;
    }
  }

  const bands: BandPoint[] = [];
  const column = new Float64Array(iterations);
  for (let d = 1; d <= horizon; d++) {
    for (let i = 0; i < iterations; i++) {
      column[i] = input.balanceCents + (cumCommitted[d] ?? 0) - (cumSpend[i * horizon + (d - 1)] ?? 0);
    }
    const sorted = sortedCopy(column);
    bands.push({
      day: d,
      date: addDays(asOf, d),
      p10: percentileNearestRank(sorted, 10),
      p50: percentileNearestRank(sorted, 50),
      p90: percentileNearestRank(sorted, 90)
    });
  }

  const totalSpend = new Float64Array(iterations);
  for (let i = 0; i < iterations; i++) totalSpend[i] = cumSpend[i * horizon + (horizon - 1)] ?? 0;
  const spendSorted = sortedCopy(totalSpend);
  const spendP10 = percentileNearestRank(spendSorted, 10);
  const spendP90 = percentileNearestRank(spendSorted, 90);
  const buffer = Math.max(floor, divRound(spendP90 - spendP10, 2));

  const base = input.balanceCents + (cumCommitted[horizon] ?? 0);
  const finals = new Float64Array(iterations);
  for (let i = 0; i < iterations; i++) finals[i] = base - (totalSpend[i] ?? 0) - buffer;
  const finalSorted = sortedCopy(finals);
  const a10 = percentileNearestRank(finalSorted, 10);
  const a50 = percentileNearestRank(finalSorted, 50);
  const a90 = percentileNearestRank(finalSorted, 90);

  const anchor = input.balanceCents + incomeTotal - outflowTotal - buffer;
  const steps: ForecastStep[] = [
    { key: 'balance', label: 'Current balance', p10: input.balanceCents, p50: input.balanceCents, p90: input.balanceCents },
    { key: 'income', label: 'Expected income', p10: incomeTotal, p50: incomeTotal, p90: incomeTotal },
    { key: 'committed', label: 'Committed payments', p10: -outflowTotal, p50: -outflowTotal, p90: -outflowTotal },
    {
      key: 'variable',
      label: 'Estimated variable spend',
      p10: a10 - anchor,
      p50: a50 - anchor,
      p90: a90 - anchor
    },
    { key: 'buffer', label: 'Safety buffer', p10: -buffer, p50: -buffer, p90: -buffer },
    { key: 'available', label: 'Money available', p10: a10, p50: a50, p90: a90 }
  ];

  const historyDays = earliest === null ? 0 : diffDays(asOf, earliest) + 1;
  const gaps = earliest === null ? [] : findGaps(txnDates, windowStart > earliest ? windowStart : earliest, asOf, FORECAST_DEFAULTS.gapDays);
  const reasons: ForecastReason[] = [];
  if (earliest === null) {
    reasons.push({ code: 'no_data', message: 'No transactions have been imported yet.', blocking: true });
  } else if (historyDays < FORECAST_DEFAULTS.minHistoryDays) {
    reasons.push({
      code: 'short_history',
      message: `Only ${historyDays} days of history are available. At least ${FORECAST_DEFAULTS.minHistoryDays} days (3 months) are needed.`,
      blocking: true
    });
  }
  if (earliest !== null && !hasIncomeSeries) {
    reasons.push({ code: 'no_income', message: 'No regular income could be detected in your history.', blocking: true });
  }
  if (gaps.length > 0) {
    reasons.push({
      code: 'gaps',
      message: `No transactions were found between ${gaps.map((g) => `${g.from} and ${g.to}`).join(', ')}.`,
      blocking: false
    });
  }
  if (uncertain.length > 0) {
    reasons.push({
      code: 'low_confidence_series',
      message: `${uncertain.length} recurring payment(s) are uncertain and may be inaccurate.`,
      blocking: false
    });
  }

  const blocked = reasons.some((r) => r.blocking);
  const spreadPct = divRound((a90 - a10) * 100, Math.max(100000, Math.abs(a50)));
  let confidence: Confidence = 'none';
  if (!blocked) {
    if (reasons.length === 0 && spreadPct <= 40) confidence = 'high';
    else if (spreadPct <= 80) confidence = 'medium';
    else confidence = 'low';
  }

  const bufferReason =
    buffer === floor
      ? 'The minimum safety buffer was applied because your spending was steady.'
      : `Your variable spending changed a lot over the last ${lookback} days, so the buffer is larger.`;

  return {
    asOf,
    horizonDays: horizon,
    status: blocked ? 'insufficient' : 'ok',
    confidence,
    reasons,
    steps,
    available: { p10: a10, p50: a50, p90: a90 },
    bufferCents: buffer,
    bufferReason,
    bands,
    uncountedIncomeCents: uncounted,
    gaps,
    uncertainSeriesIds: uncertain,
    assumptions: { seed, iterations, lookbackDays: lookback, horizonDays: horizon, asOf, historyDays, seriesUsed }
  };
}

export type Verdict = 'yes' | 'maybe' | 'not_safely' | 'no' | 'unknown';

export interface Affordability {
  verdict: Verdict;
  headline: string;
  confidence: Confidence;
  shortfallCents: number;
}

export function judgeAffordability(priceCents: number, forecast: ForecastResult): Affordability {
  if (forecast.status === 'insufficient') {
    return {
      verdict: 'unknown',
      headline: 'Not enough data to answer confidently.',
      confidence: 'none',
      shortfallCents: 0
    };
  }
  const { p10, p50, p90 } = forecast.available;
  let verdict: Verdict;
  let headline: string;
  if (p10 >= priceCents) {
    verdict = 'yes';
    headline = 'Yes. Even the cautious case covers it.';
  } else if (p50 >= priceCents) {
    verdict = 'maybe';
    headline = 'Probably. The typical case covers it, but the cautious case does not.';
  } else if (p90 >= priceCents) {
    verdict = 'not_safely';
    headline = 'Not safely. Only the optimistic case covers it.';
  } else {
    verdict = 'no';
    headline = 'No. Even the optimistic case falls short.';
  }
  return { verdict, headline, confidence: forecast.confidence, shortfallCents: Math.max(0, priceCents - p10) };
}

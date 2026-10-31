import { describe, expect, it } from 'vitest';
import type { Anomaly, CategorizationEntry, Jar, RecurringSeries, Transaction, WishlistItem, Account } from '@/types/models';
import {
  EMBEDDING_DIM, assertEmbedding, categorize, cosine, keywordCategory, nearestNeighbors, normalizeMerchant,
  propagateCorrection, updateCentroid
} from '@/core/categorize';
import { detectRecurring, frequencyLabel, monthlyCommitment, tagTransactions } from '@/core/recurrence';
import { detectAnomalies, legitKey } from '@/core/anomaly';
import { dueDateAt, firstDueAfter, occurrencesBetween } from '@/core/schedule';
import { emiCents, simulate, applyScenarios } from '@/core/simulation';
import { judgeAffordability, runForecast, percentileNearestRank, type ForecastInput } from '@/core/forecast';
import { allocateIncome, jarOneOffs, monthlyContribution, monthsToGoal, progressPct, remainingCents, roundUpCents, spendableBalance, totalRoundUps } from '@/core/jar';
import { checkWish, rankWishlist } from '@/core/wish';
import { BADGES, computeStreak, createParticles, deriveDailyBudget, evaluateBadges, newAchievements, savingsRateLastMonth, stepParticles } from '@/core/gem';
import { buildSankey, computeNetWorth } from '@/core/networth';
import { buildContext, buildPrompt, estimateTokens, narrate, redactPII, CONTEXT_TOKEN_BUDGET } from '@/core/prompt';
import { mergeTransactions, parseCsvRows, parseStatementCsv, parseStatementLines, rowsToTransactions } from '@/core/parsers';
import { generateSampleData } from '@/utils/sample';

const AS_OF = '2025-03-15';

function txn(id: string, date: string, merchant: string, amountCents: number, extra: Partial<Transaction> = {}): Transaction {
  return {
    id, accountId: 'a1', date, description: merchant, merchant, amountCents, category: 'Other', categorySource: 'none',
    recurringId: null, source: 'manual', createdAt: AS_OF, ...extra
  };
}

function vec(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIM }, (_, i) => Math.sin(seed * 31 + i));
}

describe('categorize', () => {
  it('normalizes merchants', () => {
    expect(normalizeMerchant('UPI/412345678901/SWIGGY@icici/Food')).toBe('Swiggy');
    expect(normalizeMerchant('POS APOLLO PHARMACY MUMBAI')).toBe('Apollo Pharmacy');
    expect(normalizeMerchant('NEFT-123456')).toBe('Unknown');
    expect(normalizeMerchant('UPI/paytm.98765@paytm')).toBe('Paytm');
    expect(normalizeMerchant('UPI/9876543210@ybl')).toBe('Unknown');
    expect(normalizeMerchant('UPI/upi@sbi')).toBe('Unknown');
    expect(normalizeMerchant('A B SBIN0001234 X1Y2Z3W4')).toBe('Unknown');
  });
  it('matches keywords', () => {
    expect(keywordCategory('Swiggy order')).toBe('Food');
    expect(keywordCategory('netflix.com')).toBe('Subscriptions');
    expect(keywordCategory('zzz')).toBeNull();
  });
  it('computes cosine similarity', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
    expect(() => cosine([1], [1, 2])).toThrow();
    expect(() => assertEmbedding([1, 2])).toThrow();
  });
  it('categorizes by exact, neighbors, rules and fallback', () => {
    const entries: CategorizationEntry[] = [
      { merchant: 'Alpha', category: 'Food', embedding: vec(1), sampleCount: 2, updatedAt: AS_OF },
      { merchant: 'Beta', category: 'Travel', embedding: vec(2), sampleCount: 1, updatedAt: AS_OF },
      { merchant: 'Short', category: 'Health', embedding: [1, 2], sampleCount: 1, updatedAt: AS_OF }
    ];
    expect(categorize('Alpha', '', null, entries)).toMatchObject({ category: 'Food', source: 'model', confidence: 1 });
    const near = categorize('Gamma', '', vec(1), entries);
    expect(near.category).toBe('Food');
    expect(near.source).toBe('model');
    expect(near.neighbors.length).toBeGreaterThan(0);
    expect(nearestNeighbors(vec(1), entries, 1)).toHaveLength(1);
    const far = categorize('Swiggy', 'order', Array(EMBEDDING_DIM).fill(0), entries);
    expect(far.source).toBe('rule');
    expect(categorize('Qqq', 'qqq', null, [])).toMatchObject({ category: 'Other', source: 'none' });
  });
  it('breaks voting ties by category order', () => {
    const e = vec(3);
    const entries: CategorizationEntry[] = [
      { merchant: 'M1', category: 'Travel', embedding: e, sampleCount: 1, updatedAt: AS_OF },
      { merchant: 'M2', category: 'Food', embedding: e, sampleCount: 1, updatedAt: AS_OF }
    ];
    expect(categorize('New', '', e, entries).category).toBe('Food');
  });
  it('updates centroids', () => {
    const first = updateCentroid(undefined, 'A', 'Food', vec(1), AS_OF);
    expect(first.sampleCount).toBe(1);
    const second = updateCentroid(first, 'A', 'Food', vec(2), AS_OF);
    expect(second.sampleCount).toBe(2);
    const changed = updateCentroid(second, 'A', 'Travel', vec(2), AS_OF);
    expect(changed).toMatchObject({ category: 'Travel', sampleCount: 1 });
    const zero = updateCentroid(undefined, 'Z', 'Food', Array(EMBEDDING_DIM).fill(0), AS_OF);
    expect(zero.embedding.every((x) => x === 0)).toBe(true);
  });
  it('propagates corrections and reports changes', () => {
    const entries: CategorizationEntry[] = [
      { merchant: 'Alpha', category: 'Food', embedding: vec(1), sampleCount: 1, updatedAt: AS_OF },
      { merchant: 'Alpha Two', category: 'Food', embedding: vec(1), sampleCount: 1, updatedAt: AS_OF },
      { merchant: 'Beta', category: 'Food', embedding: vec(9), sampleCount: 1, updatedAt: AS_OF }
    ];
    const txns = [
      txn('1', AS_OF, 'Alpha', -100),
      txn('2', AS_OF, 'Alpha Two', -100),
      txn('3', AS_OF, 'Beta', -100),
      txn('4', AS_OF, 'Alpha Two', -100, { category: 'Shopping', categorySource: 'user' }),
      txn('5', AS_OF, 'Alpha', -100, { category: 'Travel', categorySource: 'user' }),
      txn('6', AS_OF, 'Zeta', -100)
    ];
    const out = propagateCorrection({ merchant: 'Alpha', category: 'Travel' }, vec(1), txns, entries, AS_OF);
    expect(out.changes.map((c) => c.transactionId).sort()).toEqual(['1', '2']);
    expect(out.transactions.find((t) => t.id === '3')?.category).toBe('Other');
    expect(out.transactions.find((t) => t.id === '4')?.category).toBe('Shopping');
    expect(out.entries.find((e) => e.merchant === 'Alpha')?.category).toBe('Travel');
    const created = propagateCorrection({ merchant: 'New', category: 'Health' }, vec(5), [], [], AS_OF);
    expect(created.entries).toHaveLength(1);
    const noEmbExisting = propagateCorrection({ merchant: 'Alpha', category: 'Health' }, null, txns, entries, AS_OF);
    expect(noEmbExisting.entries.find((e) => e.merchant === 'Alpha')?.category).toBe('Health');
    const noEmbNew = propagateCorrection({ merchant: 'Q', category: 'Health' }, null, [], [], AS_OF);
    expect(noEmbNew.entries[0]?.sampleCount).toBe(1);
  });
});

function monthly(merchant: string, amount: number, start: string, n: number, step = 1): Transaction[] {
  return Array.from({ length: n }, (_, i) => txn(`${merchant}${i}`, addMonthsLocal(start, i * step), merchant, amount));
}
function addMonthsLocal(iso: string, m: number): string {
  const [y, mo, d] = iso.split('-').map(Number);
  const total = (y ?? 0) * 12 + (mo ?? 1) - 1 + m;
  const ny = Math.floor(total / 12);
  return `${ny}-${String(total - ny * 12 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

describe('recurrence', () => {
  it('detects monthly, weekly, biweekly, quarterly, yearly and custom patterns', () => {
    const weekly = Array.from({ length: 5 }, (_, i) => txn(`w${i}`, `2025-02-${String(1 + i * 7).padStart(2, '0')}`, 'Milk', -5000));
    const biweekly = Array.from({ length: 4 }, (_, i) => txn(`b${i}`, `2025-01-${String(1 + i * 14).padStart(2, '0')}`.replace('2025-01-43', '2025-02-12'), 'Maid', -30000));
    const txns = [
      ...monthly('Netflix', -64900, '2024-11-10', 4),
      ...monthly('Gym', -150000, '2024-03-15', 4, 3),
      ...monthly('Insurance', -1200000, '2021-03-01', 3, 12),
      ...weekly,
      ...biweekly,
      txn('c0', '2025-01-01', 'Odd', -100),
      txn('c1', '2025-01-21', 'Odd', -100),
      txn('c2', '2025-02-10', 'Odd', -100),
      txn('c3', '2025-03-02', 'Odd', -100)
    ];
    const series = detectRecurring(txns, AS_OF);
    const by = (m: string) => series.find((s) => s.merchant === m);
    expect(by('Netflix')?.frequency).toBe('monthly');
    expect(by('Netflix')?.nextDueDate).toBe('2025-03-10');
    expect(by('Gym')?.frequency).toBe('quarterly');
    expect(by('Insurance')?.frequency).toBe('yearly');
    expect(by('Milk')?.frequency).toBe('weekly');
    expect(by('Odd')?.frequency).toBe('custom');
    expect(by('Netflix')?.confidence).toBeGreaterThan(0.9);
    expect(frequencyLabel('biweekly')).toBe('Every 2 weeks');
    expect(frequencyLabel('weekly')).toBe('Weekly');
    expect(frequencyLabel('custom')).toBe('Custom interval');
  });
  it('detects bi-weekly intervals and skips irregular, short and transfer data', () => {
    const bi = ['2025-01-01', '2025-01-15', '2025-01-29', '2025-02-12'].map((d, i) => txn(`b${i}`, d, 'Maid', -30000));
    expect(detectRecurring(bi, AS_OF)[0]?.frequency).toBe('biweekly');
    const irregular = ['2025-01-01', '2025-01-09', '2025-02-20', '2025-02-22', '2025-03-14'].map((d, i) => txn(`i${i}`, d, 'Random', -100 * (i + 1) * 7));
    expect(detectRecurring(irregular, AS_OF)).toHaveLength(0);
    expect(detectRecurring(monthly('Two', -100, '2025-01-01', 2), AS_OF)).toHaveLength(0);
    const transfers = monthly('Self', -100, '2024-12-01', 4).map((t) => ({ ...t, category: 'Transfer' as const }));
    expect(detectRecurring(transfers, AS_OF)).toHaveLength(0);
    const sameDay = ['2025-03-01', '2025-03-01', '2025-03-02'].map((d, i) => txn(`s${i}`, d, 'Fast', -100));
    expect(detectRecurring(sameDay, AS_OF)).toHaveLength(0);
  });
  it('marks stale series inactive and tags transactions', () => {
    const old = monthly('Old', -50000, '2024-01-05', 4);
    const series = detectRecurring(old, AS_OF);
    expect(series[0]?.active).toBe(false);
    const cur = [...monthly('Rent', -2500000, '2024-12-05', 4), txn('x', '2025-02-05', 'Rent', -9900000), txn('y', '2025-02-05', 'Other Co', -5)];
    const s2 = detectRecurring(cur, AS_OF);
    const tagged = tagTransactions(cur, s2);
    expect(tagged.find((t) => t.id === 'Rent0')?.recurringId).toBe(s2[0]?.id);
    expect(tagged.find((t) => t.id === 'x')?.recurringId).toBeNull();
    expect(tagged.find((t) => t.id === 'y')?.recurringId).toBeNull();
    expect(tagTransactions(tagged, s2)).toEqual(tagged);
  });
  it('sums monthly commitments by frequency', () => {
    const mk = (frequency: RecurringSeries['frequency'], amountCents: number, intervalDays = 30, active = true): RecurringSeries => ({
      id: frequency, merchant: frequency, amountCents, intervalDays, frequency, confidence: 1, nextDueDate: AS_OF, lastSeenDate: AS_OF, occurrences: 3, active
    });
    const total = monthlyCommitment([
      mk('weekly', -1200), mk('biweekly', -1200), mk('monthly', -1000), mk('quarterly', -3000), mk('yearly', -12000),
      mk('custom', -1000, 10), mk('monthly', -9999, 30, false), mk('monthly', 5000)
    ]);
    expect(total).toBe(5200 + 2600 + 1000 + 1000 + 1000 + 3000);
  });
});

describe('schedule', () => {
  it('walks monthly and day-based schedules', () => {
    const m = { nextDueDate: '2025-01-31', intervalDays: 30, frequency: 'monthly' as const };
    expect(dueDateAt(m, 1)).toBe('2025-02-28');
    expect(occurrencesBetween(m, '2025-01-31', '2025-04-30')).toEqual(['2025-02-28', '2025-03-31', '2025-04-30']);
    const w = { nextDueDate: '2025-03-01', intervalDays: 7, frequency: 'weekly' as const };
    expect(occurrencesBetween(w, '2025-03-01', '2025-03-22')).toEqual(['2025-03-08', '2025-03-15', '2025-03-22']);
    expect(firstDueAfter(w, '2025-03-10')).toBe('2025-03-15');
    expect(firstDueAfter(m, '2025-01-01')).toBe('2025-01-31');
    expect(dueDateAt({ ...w, intervalDays: 0 }, 2)).toBe('2025-03-03');
  });
});

describe('anomaly', () => {
  const series: RecurringSeries = {
    id: 'rec_n', merchant: 'Netflix', amountCents: -64900, intervalDays: 30, frequency: 'monthly', confidence: 0.9,
    nextDueDate: '2025-03-01', lastSeenDate: '2025-02-01', occurrences: 4, active: true
  };
  it('flags duplicates, spikes, new merchants and missing payments', () => {
    const txns = [
      txn('h0', '2024-12-01', 'Base', -1000),
      txn('a1', '2025-03-01', 'Cafe', -45000),
      txn('a2', '2025-03-02', 'Cafe', -45000),
      txn('s0', '2025-01-01', 'Shop', -100000),
      txn('s1', '2025-01-10', 'Shop', -110000),
      txn('s2', '2025-01-20', 'Shop', -90000),
      txn('s3', '2025-03-05', 'Shop', -600000),
      txn('s4', '2025-03-06', 'Shop', -400000),
      txn('n1', '2025-03-10', 'Brand New', -250000),
      txn('t1', '2025-03-10', 'Wallet', 5000, { category: 'Transfer' })
    ];
    const out = detectAnomalies(txns, [series], AS_OF);
    const types = out.map((a) => `${a.type}:${a.merchant}`);
    expect(types).toContain('duplicate:Cafe');
    expect(types).toContain('spike:Shop');
    expect(types).toContain('new_merchant:Brand New');
    expect(types).toContain('missing_recurring:Netflix');
    expect(out[0]?.severity).toBe('high');
    expect(out.every((a) => a.status === 'open')).toBe(true);
    const spike = out.filter((a) => a.type === 'spike');
    expect(spike.some((a) => a.severity === 'high')).toBe(true);
    expect(spike.some((a) => a.severity === 'medium')).toBe(true);
  });
  it('raises high-severity duplicates and respects legit marks and recurring payments', () => {
    const big = [txn('b1', '2025-03-01', 'Jeweller', -600000), txn('b2', '2025-03-02', 'Jeweller', -600000)];
    expect(detectAnomalies(big, [], AS_OF)[0]?.severity).toBe('high');
    const legit = new Set([legitKey('duplicate', 'Jeweller')]);
    expect(detectAnomalies(big, [], AS_OF, { legitKeys: legit })).toHaveLength(0);
    const rec = [txn('r1', '2025-03-01', 'Rent', -100, { recurringId: 'r' }), txn('r2', '2025-03-02', 'Rent', -100, { recurringId: 'r' })];
    expect(detectAnomalies(rec, [], AS_OF)).toHaveLength(0);
    const seen = [txn('p', '2025-03-02', 'Netflix', -64900)];
    expect(detectAnomalies(seen, [series], AS_OF).some((a) => a.type === 'missing_recurring')).toBe(false);
    expect(detectAnomalies([], [{ ...series, confidence: 0.5 }, { ...series, active: false }], AS_OF)).toHaveLength(0);
    const sameDay = [txn('d1', '2025-03-01', 'Z', -100), txn('d2', '2025-03-01', 'Z', -100)];
    expect(detectAnomalies(sameDay, [], AS_OF).some((a) => a.type === 'duplicate')).toBe(true);
    const future = [txn('f', '2025-04-01', 'Z', -100)];
    expect(detectAnomalies(future, [], AS_OF)).toHaveLength(0);
  });
});

function forecastInput(over: Partial<ForecastInput> = {}): ForecastInput {
  const data = generateSampleData(AS_OF, AS_OF);
  const series = detectRecurring(data.transactions, AS_OF);
  const txns = tagTransactions(data.transactions, series);
  return {
    asOf: AS_OF,
    balanceCents: data.account.balanceCents,
    transactions: txns,
    series,
    horizonDays: 30,
    ...over
  };
}

describe('forecast and simulation', () => {
  it('computes percentiles and validates input', () => {
    expect(percentileNearestRank([], 50)).toBe(0);
    expect(percentileNearestRank([1, 2, 3, 4], 50)).toBe(2);
    expect(() => runForecast(forecastInput({ horizonDays: 0 }))).toThrow();
    expect(() => runForecast(forecastInput({ lookbackDays: 3 }))).toThrow();
    expect(() => runForecast(forecastInput({ iterations: 2 }))).toThrow();
  });
  it('produces an ok forecast whose steps add up', () => {
    const out = runForecast(forecastInput());
    expect(out.status).toBe('ok');
    const sum = (k: 'p10' | 'p50' | 'p90') => out.steps.slice(0, 5).reduce((s, x) => s + x[k], 0);
    expect(sum('p10')).toBe(out.available.p10);
    expect(sum('p50')).toBe(out.available.p50);
    expect(sum('p90')).toBe(out.available.p90);
    expect(out.available.p10).toBeLessThanOrEqual(out.available.p50);
    expect(out.available.p50).toBeLessThanOrEqual(out.available.p90);
    expect(out.bands).toHaveLength(30);
    expect(['high', 'medium', 'low']).toContain(out.confidence);
    expect(runForecast(forecastInput())).toEqual(out);
  });
  it('reports a larger buffer for volatile spending and explains it', () => {
    const calm = runForecast(forecastInput({ transactions: [], series: [] }));
    expect(calm.bufferReason).toContain('minimum');
    const wild = runForecast(forecastInput());
    expect(wild.bufferReason.length).toBeGreaterThan(10);
  });
  it('judges affordability for every verdict', () => {
    const out = runForecast(forecastInput());
    const { p10, p50, p90 } = out.available;
    expect(judgeAffordability(p10, out).verdict).toBe('yes');
    expect(judgeAffordability(p10 + 1, out).verdict).toBe(p50 >= p10 + 1 ? 'maybe' : 'not_safely');
    expect(judgeAffordability(p50 + 1, out).verdict).toBe(p90 >= p50 + 1 ? 'not_safely' : 'no');
    expect(judgeAffordability(p90 + 1, out).verdict).toBe('no');
    expect(judgeAffordability(p90 + 1, out).shortfallCents).toBeGreaterThan(0);
    const unknown = judgeAffordability(1, runForecast(forecastInput({ transactions: [] })));
    expect(unknown.verdict).toBe('unknown');
  });
  it('computes EMI with integer math', () => {
    expect(emiCents(1200000, 0, 12)).toBe(100000);
    expect(emiCents(1000000, 1200, 12)).toBeGreaterThan(88000);
    expect(emiCents(1000000, 1200, 12)).toBeLessThan(89000);
    expect(() => emiCents(0, 0, 1)).toThrow();
    expect(() => emiCents(100, 0, 0)).toThrow();
    expect(() => emiCents(100, 20000, 12)).toThrow();
  });
  it('simulates each scenario kind with a before/after diff', () => {
    const base = forecastInput();
    const sid = base.series.find((s) => s.amountCents < 0)?.id ?? '';
    const salary = base.series.find((s) => s.amountCents > 0)?.id ?? '';
    const result = simulate(base, [
      { kind: 'purchase', title: 'Phone', amountCents: 8000000, date: '2025-03-20' },
      { kind: 'cancel_series', seriesId: sid },
      { kind: 'add_series', title: 'Course', amountCents: 200000, frequency: 'monthly', startDate: '2025-03-25' },
      { kind: 'loan', title: 'Bike', principalCents: 6000000, annualRateBps: 1000, months: 12, startDate: '2025-03-28', downPaymentCents: 500000 },
      { kind: 'income_change', seriesId: salary, newAmountCents: 6000000 }
    ]);
    expect(result.availableDelta.p50).toBeLessThan(0);
    expect(result.diff).toHaveLength(6);
    expect(applyScenarios(base, []).series).toEqual(base.series);
    const noDown = applyScenarios(base, [{ kind: 'loan', title: 'x', principalCents: 100000, annualRateBps: 0, months: 2, startDate: '2025-03-20', downPaymentCents: 0 }]);
    expect(noDown.oneOffs).toEqual([]);
  });
});

describe('jars and wishlist', () => {
  const jar = (over: Partial<Jar> = {}): Jar => ({
    id: 'j1', name: 'Trip', targetCents: 1000000, savedCents: 250000, deadline: null, ruleType: 'percent_income', ruleValue: 1000,
    createdAt: AS_OF, ...over
  });
  it('tracks progress and round-ups', () => {
    expect(progressPct(jar())).toBe(25);
    expect(progressPct(jar({ targetCents: 0 }))).toBe(0);
    expect(progressPct(jar({ savedCents: 5000000 }))).toBe(100);
    expect(remainingCents(jar())).toBe(750000);
    expect(roundUpCents(4501)).toBe(499);
    expect(roundUpCents(5000)).toBe(0);
    expect(roundUpCents(-1)).toBe(0);
    expect(totalRoundUps([txn('1', AS_OF, 'A', -4501), txn('2', AS_OF, 'B', 100), txn('3', AS_OF, 'C', -1000, { category: 'Transfer' })])).toBe(499);
  });
  it('allocates income and computes contributions', () => {
    expect(allocateIncome([jar(), jar({ id: 'j2', ruleType: 'fixed_monthly' }), jar({ id: 'j3', ruleValue: 9000 })], 7500000)).toEqual([
      { jarId: 'j1', cents: 750000 },
      { jarId: 'j3', cents: 750000 }
    ]);
    expect(allocateIncome([jar({ id: 'j9', ruleValue: 10000, targetCents: 99999999 })], 100).length).toBe(1);
    expect(allocateIncome([jar(), jar({ id: 'j4', ruleValue: 10000, targetCents: 99999999 })], 100000)).toHaveLength(2);
    expect(monthlyContribution(jar({ ruleType: 'fixed_monthly', ruleValue: 5000 }), 0, 0)).toBe(5000);
    expect(monthlyContribution(jar(), 7500000, 0)).toBe(750000);
    expect(monthlyContribution(jar({ ruleType: 'roundup' }), 0, 1234)).toBe(1234);
    expect(monthlyContribution(jar({ ruleType: 'none' }), 1, 1)).toBe(0);
    expect(monthsToGoal(jar(), 250000)).toBe(3);
    expect(monthsToGoal(jar(), 0)).toBeNull();
    expect(monthsToGoal(jar({ savedCents: 1000000 }), 0)).toBe(0);
  });
  it('schedules jar contributions and computes spendable balance', () => {
    const offs = jarOneOffs([jar({ ruleType: 'fixed_monthly', ruleValue: 400000 }), jar({ id: 'z', ruleType: 'none' })], AS_OF, 90, 0, 0);
    expect(offs.map((o) => o.amountCents)).toEqual([-400000, -350000]);
    expect(offs[0]?.date).toBe('2025-04-01');
    const accounts: Account[] = [
      { id: 'a', name: 'S', institution: 'B', type: 'savings', last4: null, balanceCents: 1000000, createdAt: AS_OF },
      { id: 'c', name: 'C', institution: 'B', type: 'credit_card', last4: null, balanceCents: -50000, createdAt: AS_OF }
    ];
    expect(spendableBalance(accounts, [jar()])).toBe(750000);
  });
  it('checks wishes against the forecast', () => {
    const f = runForecast(forecastInput());
    const item: WishlistItem = { id: 'w', title: 'Phone', costCents: f.available.p10, priority: 1, jarId: 'j1', acquired: false, createdAt: AS_OF };
    expect(checkWish(item, f, null).verdict).toBe('yes');
    expect(checkWish(item, f, jar({ savedCents: item.costCents })).verdict).toBe('funded');
    const partial = checkWish({ ...item, costCents: f.available.p10 + 100 }, f, jar({ savedCents: 100 }));
    expect(partial.fundedByJarCents).toBe(100);
    const ranked = rankWishlist([
      { ...item, id: 'b', priority: 2, costCents: 5 },
      { ...item, id: 'a', priority: 1, costCents: 9 },
      { ...item, id: 'c', priority: 1, costCents: 9 },
      { ...item, id: 'd', acquired: true }
    ]);
    expect(ranked.map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('gem and net worth', () => {
  it('computes budgets, streaks and badges', () => {
    const data = generateSampleData(AS_OF, AS_OF);
    const series = detectRecurring(data.transactions, AS_OF);
    const txns = tagTransactions(data.transactions, series);
    const budget = deriveDailyBudget(txns, AS_OF);
    expect(budget).toBeGreaterThan(0);
    expect(computeStreak([], AS_OF, budget)).toBe(0);
    expect(computeStreak(txns, AS_OF, 1_000_000_000)).toBeGreaterThan(100);
    expect(computeStreak([txn('x', AS_OF, 'Big', -9999999)], AS_OF, 100)).toBe(0);
    const done: Jar = { id: 'j', name: 'x', targetCents: 100, savedCents: 100, deadline: null, ruleType: 'none', ruleValue: 0, createdAt: AS_OF };
    const anomalies: Anomaly[] = [];
    const out = evaluateBadges({ transactions: txns, jars: [done], anomalies, asOf: AS_OF });
    expect(out.earned).toContain('first_import');
    expect(out.earned).toContain('jar_complete');
    expect(out.earned).toContain('clean_month');
    const have = [{ id: 'gem_first_import', badge: 'first_import', unlockedAt: AS_OF, streakDays: 0 }];
    const fresh = newAchievements(out.earned, have, AS_OF, out.streak);
    expect(fresh.some((a) => a.badge === 'first_import')).toBe(false);
    expect(BADGES.length).toBeGreaterThan(5);
    const none = evaluateBadges({ transactions: [], jars: [], anomalies: [], asOf: AS_OF });
    expect(none.earned).toEqual([]);
    const open: Anomaly = { id: 'a', type: 'spike', transactionId: null, seriesId: null, merchant: 'x', severity: 'low', reason: '', status: 'open', detectedAt: AS_OF };
    expect(evaluateBadges({ transactions: txns, jars: [], anomalies: [open], asOf: AS_OF }).earned).not.toContain('clean_month');
    const many = Array.from({ length: 60 }, (_, i) => txn(`m${i}`, AS_OF, 'Shop', -1, { category: 'Shopping' }));
    expect(evaluateBadges({ transactions: many, jars: [], anomalies: [], asOf: AS_OF }).earned).toContain('organized');
  });
  it('computes last month savings rate', () => {
    expect(savingsRateLastMonth([], AS_OF)).toBeNull();
    const t = [txn('i', '2025-02-01', 'Co', 100000), txn('o', '2025-02-10', 'X', -60000), txn('t', '2025-02-11', 'Y', -9999, { category: 'Transfer' })];
    expect(savingsRateLastMonth(t, AS_OF)).toBe(40);
    const rich = Array.from({ length: 3 }, (_, i) => txn(`r${i}`, '2025-02-0' + (i + 1), 'Co', 100000));
    const spent = txn('sp', '2025-02-10', 'X', -10000);
    const rate = evaluateBadges({ transactions: [...rich, spent], jars: [], anomalies: [], asOf: AS_OF });
    expect(rate.earned).toContain('saver_20');
  });
  it('animates particles deterministically', () => {
    const a = createParticles(10, 5, 100, 100);
    expect(createParticles(10, 5, 100, 100)).toEqual(a);
    const stepped = stepParticles(a, 16, 100, 100);
    expect(stepped).toHaveLength(10);
    const edge = stepParticles([{ x: -50, y: 500, vx: 0, vy: 0, radius: 2, hue: 0 }, { x: 500, y: 0, vx: 0, vy: 0, radius: 2, hue: 1 }], 16, 100, 100);
    expect(edge[0]?.x).toBe(102);
    expect(edge[0]?.y).toBe(-2);
    expect(edge[1]?.x).toBe(-2);
  });
  it('aggregates net worth and builds Sankey data', () => {
    const accounts: Account[] = [
      { id: 'a', name: 'S', institution: 'B', type: 'savings', last4: null, balanceCents: 1000000, createdAt: AS_OF },
      { id: 'c', name: 'C', institution: 'B', type: 'credit_card', last4: null, balanceCents: -200000, createdAt: AS_OF }
    ];
    const nw = computeNetWorth(accounts, [{ id: 'j', name: 'x', targetCents: 1, savedCents: 5, deadline: null, ruleType: 'none', ruleValue: 0, createdAt: AS_OF }]);
    expect(nw).toMatchObject({ assetsCents: 1000000, liabilitiesCents: 200000, netCents: 800000, jarsCents: 5 });
    const txns = [
      txn('i', '2025-03-01', 'Co', 100000, { category: 'Salary' }),
      txn('a', '2025-03-02', 'A', -30000, { category: 'Food' }),
      txn('b', '2025-03-03', 'B', -20000, { category: 'Travel' }),
      txn('x', '2025-03-03', 'B', -9000, { category: 'Transfer' })
    ];
    const s = buildSankey(txns, AS_OF, 30);
    expect(s.links.find((l) => l.target === 'saved')?.valueCents).toBe(50000);
    const over = buildSankey([txn('i', '2025-03-01', 'Co', 1000, { category: 'Salary' }), ...Array.from({ length: 8 }, (_, i) => txn(`o${i}`, '2025-03-02', 'M', -(1000 + i), { category: (['Food', 'Travel', 'Bills', 'Health', 'Shopping', 'Rent', 'Education', 'Entertainment'] as const)[i] ?? 'Food' }))], AS_OF, 30, 3);
    expect(over.nodes.some((n) => n.id === 'drawdown')).toBe(true);
    expect(over.nodes.some((n) => n.id === 'cat_rest')).toBe(true);
    expect(over.links.some((l) => l.source === 'drawdown')).toBe(true);
  });
});

describe('prompt builder', () => {
  const data = generateSampleData(AS_OF, AS_OF);
  const series = detectRecurring(data.transactions, AS_OF);
  const txns = tagTransactions(data.transactions, series);
  const forecast = runForecast({ asOf: AS_OF, balanceCents: data.account.balanceCents, transactions: txns, series, horizonDays: 30 });
  const jars: Jar[] = [{ id: 'j1', name: 'Secret Trip To Goa', targetCents: 1000000, savedCents: 500000, deadline: null, ruleType: 'none', ruleValue: 0, createdAt: AS_OF }, { id: 'j2', name: 'Zero', targetCents: 0, savedCents: 0, deadline: null, ruleType: 'none', ruleValue: 0, createdAt: AS_OF }];
  const wishes: WishlistItem[] = [
    { id: 'w1', title: 'Private Item Name', costCents: 8000000, priority: 1, jarId: 'j1', acquired: false, createdAt: AS_OF },
    { id: 'w2', title: 'Bought', costCents: 1, priority: 1, jarId: null, acquired: true, createdAt: AS_OF }
  ];
  const anomalies = detectAnomalies(txns, series, AS_OF);
  const ctx = buildContext({ asOf: AS_OF, forecast, transactions: txns, series, anomalies, jars, wishlist: wishes });

  it('emits aggregated JSON without names or merchants', () => {
    const json = JSON.stringify(ctx);
    expect(json).not.toContain('Secret');
    expect(json).not.toContain('Private');
    expect(json).not.toContain('Swiggy');
    expect(json).not.toContain('Netflix');
    expect(ctx.jars[0]?.label).toBe('Jar 1');
    expect(ctx.jars[1]?.progress_percent).toBe(0);
    expect(ctx.wishlist).toHaveLength(1);
  });
  it('redacts personal data from questions', () => {
    const q = 'Mail me at ravi.k@example.com or pay ravi@okicici, phone +91 9876543210, acct 123456789012, PAN ABCDE1234F, IFSC HDFC0001234, card 4111 1111 1111 1111, OTP is 482913. Can I afford ₹80,000?';
    const out = redactPII(q);
    for (const secret of ['example.com', 'okicici', '9876543210', '123456789012', 'ABCDE1234F', 'HDFC0001234', '4111', '482913']) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('₹80,000');
  });
  it('builds a templated prompt and truncates when over budget', () => {
    const built = buildPrompt(ctx, 'Can I afford a phone?');
    expect(built.prompt.startsWith('<|system|>')).toBe(true);
    expect(built.prompt.endsWith('<|assistant|>\n')).toBe(true);
    expect(built.truncated).toBe(false);
    expect(estimateTokens('abc')).toBe(1);
    const fat = {
      ...ctx,
      wishlist: Array.from({ length: 80 }, (_, i) => ({ label: `Item ${i}`, cost: '₹1,00,000', verdict: 'maybe' })),
      jars: Array.from({ length: 80 }, (_, i) => ({ label: `Jar ${i}`, progress_percent: 5 })),
      anomalies_open: Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`type_${i}`, i])),
      spending_last_30_days: Array.from({ length: 80 }, (_, i) => ({ category: `Cat${i}`, amount: '₹1,00,000' })),
      forecast: { ...ctx.forecast, notes: Array.from({ length: 80 }, (_, i) => `Note number ${i} about something long`) }
    };
    const cut = buildPrompt(fat, 'x'.repeat(2000));
    expect(cut.truncated).toBe(true);
    expect(cut.question.length).toBeLessThanOrEqual(600);
    expect(estimateTokens(cut.contextJson)).toBeLessThanOrEqual(CONTEXT_TOKEN_BUDGET + 2000);
  });
  it('narrates results without inventing numbers', () => {
    const text = narrate(ctx);
    expect(text).toContain(ctx.forecast.steps[5]?.typical ?? '');
    const insufficient = runForecast({ asOf: AS_OF, balanceCents: 0, transactions: [], series: [], horizonDays: 30 });
    const ctx2 = buildContext({ asOf: AS_OF, forecast: insufficient, transactions: [], series: [], anomalies: [], jars: [], wishlist: [] });
    expect(narrate(ctx2)).toContain('cannot give a confident answer');
    expect(narrate({ ...ctx, forecast: { ...ctx.forecast, steps: [] } })).toContain('Confidence');
  });
});

describe('parsers', () => {
  it('parses CSV with delimiters, quotes and preambles', () => {
    expect(parseCsvRows('a;b\n"x;y";2\r\n')).toEqual([['a', 'b'], ['x;y', '2']]);
    expect(parseCsvRows('\uFEFFa,b\n"he said ""hi""",2')).toEqual([['a', 'b'], ['he said "hi"', '2']]);
    expect(parseCsvRows('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
    const text = [
      'Account Statement', 'Customer: Test', 'Date,Narration,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
      '01/03/25,UPI-SWIGGY-1234,01/03/25,450.00,,9550.00',
      '02/03/25,NEFT SALARY,02/03/25,,50000.00,59550.00',
      'bad,row,,,,', '03/03/25,,,10.00,,0', '04/03/25,ZERO,,0,,1'
    ].join('\n');
    const out = parseStatementCsv(text);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]).toMatchObject({ date: '2025-03-01', amountCents: -45000, balanceCents: 955000 });
    expect(out.rows[1]?.amountCents).toBe(5000000);
    expect(out.skipped).toBe(3);
    expect(out.closingBalanceCents).toBe(5955000);
  });
  it('handles amount plus Dr/Cr columns and bad files', () => {
    const csv = 'Txn Date,Description,Amount,Dr/Cr\n2025-03-01,Shop,100.50,DR\n2025-03-02,Pay,200,CR\n2025-03-03,Plain,-5,\n2025-03-04,Plain2,abc,';
    const out = parseStatementCsv(csv);
    expect(out.rows.map((r) => r.amountCents)).toEqual([-10050, 20000, -500]);
    expect(parseStatementCsv('foo,bar\n1,2').warnings[0]).toContain('Could not find');
    expect(parseStatementCsv('Date,Narration,Debit,Credit\n').warnings[0]).toContain('No transactions');
    const typed = parseStatementCsv('Date,Particulars,Amount,Type\n01-03-2025,A,10,Debit\n02-03-2025,B,10,Credit');
    expect(typed.rows.map((r) => r.amountCents)).toEqual([-1000, 1000]);
  });
  it('parses PDF text lines', () => {
    const lines = [
      'Statement', '01/03/2025 UPI/SWIGGY/Food 450.00 9,550.00', '02/03/2025 NEFT SALARY 50,000.00 59,550.00',
      '03/03/2025 ATM WDL 1,000.00 Dr', '04/03/2025 INTEREST 12.00 Cr', '05/03/2025 Withdrawal -75.00',
      '06/03/2025 Mystery 10.00', '07/03/2025 5000.00 100.00', '99/99/2025 Bad 1.00', '08/03/2025 NoAmount here'
    ];
    const out = parseStatementLines(lines);
    expect(out.rows.map((r) => r.amountCents)).toEqual([-45000, 5000000, -100000, 1200, -7500, -1000]);
    expect(out.warnings[0]).toContain('treated as debits');
    expect(out.skipped).toBe(3);
    expect(parseStatementLines([]).warnings[0]).toContain('No transactions');
    const first = parseStatementLines(['01/03/2025 PAID 100.00 900.00', '02/03/2025 RECEIVED 50.00 950.00']);
    expect(first.rows[1]?.amountCents).toBe(5000);
    expect(parseStatementLines(['01/03/2025 THING 0.00']).rows).toHaveLength(0);
    expect(parseStatementLines(['5 Mar 2025 Shop 20.00 Dr']).rows[0]?.date).toBe('2025-03-05');
  });
  it('builds transactions with stable ids and merges without duplicates', () => {
    const rows = [
      { date: '2025-03-01', description: 'UPI/SWIGGY', amountCents: -100, balanceCents: null },
      { date: '2025-03-01', description: 'UPI/SWIGGY', amountCents: -100, balanceCents: null }
    ];
    const a = rowsToTransactions(rows, 'acc', 'csv', AS_OF);
    expect(new Set(a.map((t) => t.id)).size).toBe(2);
    expect(a[0]?.merchant).toBe('Swiggy');
    const b = rowsToTransactions(rows.slice(0, 1), 'acc', 'csv', AS_OF);
    const merged = mergeTransactions(a, b);
    expect(merged.duplicates).toBe(1);
    expect(merged.merged).toHaveLength(2);
    const c = rowsToTransactions([...rows, { ...rows[0]!, date: '2025-03-02' }], 'acc', 'csv', AS_OF);
    const m2 = mergeTransactions(a, c);
    expect(m2.added).toHaveLength(1);
    expect(m2.duplicates).toBe(2);
  });
});

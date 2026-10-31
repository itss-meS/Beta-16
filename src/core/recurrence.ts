import type { Frequency, RecurringSeries, Transaction } from '@/types/models';
import { addDays, addMonths, diffDays, type ISODate } from '@/utils/date';
import { stableId } from '@/utils/hash';
import { divRound } from '@/utils/money';

export const MIN_OCCURRENCES = 3;
export const MIN_CONFIDENCE = 0.6;
const AMOUNT_TOLERANCE_BPS = 1500;

interface Classification {
  frequency: Frequency;
  interval: number;
  tolerance: number;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return Math.floor(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

function classify(medianInterval: number): Classification {
  if (medianInterval >= 6 && medianInterval <= 8) return { frequency: 'weekly', interval: 7, tolerance: 1 };
  if (medianInterval >= 13 && medianInterval <= 15) return { frequency: 'biweekly', interval: 14, tolerance: 2 };
  if (medianInterval >= 27 && medianInterval <= 33) return { frequency: 'monthly', interval: 30, tolerance: 3 };
  if (medianInterval >= 85 && medianInterval <= 95) return { frequency: 'quarterly', interval: 91, tolerance: 6 };
  if (medianInterval >= 350 && medianInterval <= 380) return { frequency: 'yearly', interval: 365, tolerance: 10 };
  return { frequency: 'custom', interval: medianInterval, tolerance: Math.max(2, Math.round(medianInterval * 0.15)) };
}

function advance(last: ISODate, frequency: Frequency, interval: number): ISODate {
  if (frequency === 'monthly') return addMonths(last, 1);
  if (frequency === 'quarterly') return addMonths(last, 3);
  if (frequency === 'yearly') return addMonths(last, 12);
  return addDays(last, interval);
}

export function frequencyLabel(frequency: Frequency): string {
  const labels: Record<Frequency, string> = {
    weekly: 'Weekly',
    biweekly: 'Every 2 weeks',
    monthly: 'Monthly',
    quarterly: 'Every 3 months',
    yearly: 'Yearly',
    custom: 'Custom interval'
  };
  return labels[frequency];
}

export function detectRecurring(transactions: readonly Transaction[], asOf: ISODate): RecurringSeries[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.category === 'Transfer' || t.amountCents === 0 || t.date > asOf) continue;
    const key = `${t.merchant}|${t.amountCents < 0 ? 'out' : 'in'}`;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }
  const series: RecurringSeries[] = [];
  const keys = Array.from(groups.keys()).sort();
  for (const key of keys) {
    const list = groups.get(key) ?? [];
    const byDate = new Map<ISODate, Transaction>();
    for (const t of [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1))) {
      if (!byDate.has(t.date)) byDate.set(t.date, t);
    }
    const dated = Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (dated.length < MIN_OCCURRENCES) continue;
    const intervals: number[] = [];
    for (let i = 1; i < dated.length; i++) {
      intervals.push(diffDays(dated[i]?.date ?? '', dated[i - 1]?.date ?? ''));
    }
    const cls = classify(median(intervals));
    if (cls.frequency === 'custom' && cls.interval < 5) continue;
    const hits = intervals.filter((iv) => {
      if (cls.frequency === 'monthly') return iv >= 25 && iv <= 34;
      return Math.abs(iv - cls.interval) <= cls.tolerance;
    }).length;
    const amounts = dated.map((t) => t.amountCents);
    const medAmount = median(amounts);
    const amountHits = amounts.filter(
      (a) => Math.abs(a - medAmount) * 10000 <= Math.abs(medAmount) * AMOUNT_TOLERANCE_BPS
    ).length;
    const confidence = Math.round(((hits / intervals.length) * 0.7 + (amountHits / amounts.length) * 0.3) * 100) / 100;
    if (confidence < MIN_CONFIDENCE) continue;
    const last = dated[dated.length - 1];
    if (!last) continue;
    const merchant = last.merchant;
    const nextDueDate = advance(last.date, cls.frequency, cls.interval);
    const active = diffDays(asOf, last.date) <= cls.interval * 2 + 5;
    series.push({
      id: stableId('rec', merchant, medAmount < 0 ? 'out' : 'in'),
      merchant,
      amountCents: medAmount,
      intervalDays: cls.interval,
      frequency: cls.frequency,
      confidence,
      nextDueDate,
      lastSeenDate: last.date,
      occurrences: dated.length,
      active
    });
  }
  return series.sort((a, b) => (a.nextDueDate < b.nextDueDate ? -1 : a.nextDueDate > b.nextDueDate ? 1 : a.id < b.id ? -1 : 1));
}

export function tagTransactions(transactions: readonly Transaction[], series: readonly RecurringSeries[]): Transaction[] {
  const byKey = new Map<string, RecurringSeries>();
  for (const s of series) byKey.set(`${s.merchant}|${s.amountCents < 0 ? 'out' : 'in'}`, s);
  return transactions.map((t) => {
    const s = byKey.get(`${t.merchant}|${t.amountCents < 0 ? 'out' : 'in'}`);
    const matches = s !== undefined && Math.abs(t.amountCents - s.amountCents) * 10000 <= Math.abs(s.amountCents) * AMOUNT_TOLERANCE_BPS;
    const next = matches && s ? s.id : null;
    return t.recurringId === next ? t : { ...t, recurringId: next };
  });
}

export function monthlyCommitment(series: readonly RecurringSeries[]): number {
  let total = 0;
  for (const s of series) {
    if (!s.active || s.amountCents >= 0) continue;
    const amount = -s.amountCents;
    switch (s.frequency) {
      case 'weekly':
        total += divRound(amount * 52, 12);
        break;
      case 'biweekly':
        total += divRound(amount * 26, 12);
        break;
      case 'monthly':
        total += amount;
        break;
      case 'quarterly':
        total += divRound(amount, 3);
        break;
      case 'yearly':
        total += divRound(amount, 12);
        break;
      default:
        total += divRound(amount * 30, Math.max(1, s.intervalDays));
    }
  }
  return total;
}

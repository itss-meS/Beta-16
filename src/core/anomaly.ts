import type { Anomaly, AnomalyType, RecurringSeries, Severity, Transaction } from '@/types/models';
import { addDays, diffDays, type ISODate } from '@/utils/date';
import { stableId } from '@/utils/hash';
import { formatINR } from '@/utils/money';

export const ANOMALY_RULES = {
  duplicateWindowDays: 2,
  spikeMultiplier: 3,
  spikeMinHistory: 3,
  spikeMinCents: 50000,
  newMerchantMinCents: 100000,
  newMerchantHistoryDays: 60,
  missingGraceDays: 3,
  missingMinConfidence: 0.7,
  highSeverityCents: 500000
} as const;

export interface AnomalyOptions {
  legitKeys?: ReadonlySet<string>;
}

export function legitKey(type: AnomalyType, merchant: string): string {
  return `${type}:${merchant}`;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return Math.floor(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

function byDateThenId(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function detectAnomalies(
  transactions: readonly Transaction[],
  series: readonly RecurringSeries[],
  asOf: ISODate,
  options: AnomalyOptions = {}
): Anomaly[] {
  const legit = options.legitKeys ?? new Set<string>();
  const results: Anomaly[] = [];
  const sorted = transactions
    .filter((t) => t.date <= asOf && t.category !== 'Transfer')
    .sort(byDateThenId);
  const make = (
    type: AnomalyType,
    t: Transaction | null,
    s: RecurringSeries | null,
    merchant: string,
    severity: Severity,
    reason: string
  ): void => {
    if (legit.has(legitKey(type, merchant))) return;
    results.push({
      id: stableId('anm', type, t?.id ?? s?.id ?? merchant, s?.nextDueDate ?? ''),
      type,
      transactionId: t?.id ?? null,
      seriesId: s?.id ?? null,
      merchant,
      severity,
      reason,
      status: 'open',
      detectedAt: asOf
    });
  };

  const byMerchantOut = new Map<string, Transaction[]>();
  for (const t of sorted) {
    if (t.amountCents >= 0) continue;
    const list = byMerchantOut.get(t.merchant);
    if (list) list.push(t);
    else byMerchantOut.set(t.merchant, [t]);
  }

  const firstDate = sorted[0]?.date ?? null;

  for (const [merchant, list] of byMerchantOut) {
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (!t) continue;
      const amount = -t.amountCents;
      const high = amount >= ANOMALY_RULES.highSeverityCents;

      const prior = list.slice(0, i);
      const twin = prior.find(
        (p) => p.amountCents === t.amountCents && diffDays(t.date, p.date) <= ANOMALY_RULES.duplicateWindowDays && p.recurringId === null
      );
      if (twin && t.recurringId === null) {
        make('duplicate', t, null, merchant, high ? 'high' : 'medium', `Same merchant and amount (${formatINR(amount)}) charged twice within ${ANOMALY_RULES.duplicateWindowDays} days.`);
      }

      if (prior.length >= ANOMALY_RULES.spikeMinHistory && t.recurringId === null && amount >= ANOMALY_RULES.spikeMinCents) {
        const typical = median(prior.map((p) => -p.amountCents));
        if (typical > 0 && amount >= typical * ANOMALY_RULES.spikeMultiplier) {
          const times = Math.floor(amount / typical);
          make('spike', t, null, merchant, amount >= typical * 5 ? 'high' : 'medium', `${formatINR(amount)} is about ${times} times your usual ${formatINR(typical)} at ${merchant}.`);
        }
      }

      if (
        i === 0 &&
        firstDate !== null &&
        diffDays(t.date, firstDate) >= ANOMALY_RULES.newMerchantHistoryDays &&
        amount >= ANOMALY_RULES.newMerchantMinCents
      ) {
        make('new_merchant', t, null, merchant, 'low', `First time ${merchant} appears in your history (${formatINR(amount)}).`);
      }
    }
  }

  for (const s of series) {
    if (!s.active || s.confidence < ANOMALY_RULES.missingMinConfidence) continue;
    const overdue = diffDays(asOf, s.nextDueDate);
    if (overdue > ANOMALY_RULES.missingGraceDays) {
      const seen = sorted.some((t) => t.merchant === s.merchant && t.date >= addDays(s.nextDueDate, -ANOMALY_RULES.missingGraceDays));
      if (!seen) {
        make('missing_recurring', null, s, s.merchant, 'medium', `A regular payment to ${s.merchant} was expected around ${s.nextDueDate} but has not appeared.`);
      }
    }
  }

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return results.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.id < b.id ? -1 : 1));
}

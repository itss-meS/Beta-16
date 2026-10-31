import type { Account, Jar, Transaction } from '@/types/models';
import { addDays, addMonths, startOfMonth, type ISODate } from '@/utils/date';
import { percentOf } from '@/utils/money';
import type { OneOff } from './forecast';

export const DEFAULT_ROUNDUP_UNIT_CENTS = 1000;

export interface Allocation {
  jarId: string;
  cents: number;
}

export function remainingCents(jar: Jar): number {
  return Math.max(0, jar.targetCents - jar.savedCents);
}

export function progressPct(jar: Jar): number {
  if (jar.targetCents <= 0) return 0;
  return Math.min(100, Math.floor((jar.savedCents * 100) / jar.targetCents));
}

export function roundUpCents(spendCents: number, unitCents: number = DEFAULT_ROUNDUP_UNIT_CENTS): number {
  if (spendCents <= 0 || unitCents <= 0) return 0;
  const rem = spendCents % unitCents;
  return rem === 0 ? 0 : unitCents - rem;
}

export function totalRoundUps(transactions: readonly Transaction[], unitCents: number = DEFAULT_ROUNDUP_UNIT_CENTS): number {
  let total = 0;
  for (const t of transactions) {
    if (t.amountCents < 0 && t.category !== 'Transfer') total += roundUpCents(-t.amountCents, unitCents);
  }
  return total;
}

export function allocateIncome(jars: readonly Jar[], incomeCents: number): Allocation[] {
  const result: Allocation[] = [];
  let left = Math.max(0, incomeCents);
  for (const jar of jars) {
    if (jar.ruleType !== 'percent_income') continue;
    const want = Math.min(percentOf(incomeCents, jar.ruleValue), remainingCents(jar));
    const give = Math.min(want, left);
    if (give > 0) {
      result.push({ jarId: jar.id, cents: give });
      left -= give;
    }
  }
  return result;
}

export function monthlyContribution(jar: Jar, avgMonthlyIncomeCents: number, avgMonthlyRoundUpCents: number): number {
  switch (jar.ruleType) {
    case 'fixed_monthly':
      return jar.ruleValue;
    case 'percent_income':
      return percentOf(avgMonthlyIncomeCents, jar.ruleValue);
    case 'roundup':
      return avgMonthlyRoundUpCents;
    default:
      return 0;
  }
}

export function monthsToGoal(jar: Jar, monthlyCents: number): number | null {
  const left = remainingCents(jar);
  if (left === 0) return 0;
  if (monthlyCents <= 0) return null;
  return Math.ceil(left / monthlyCents);
}

export function jarOneOffs(
  jars: readonly Jar[],
  asOf: ISODate,
  horizonDays: number,
  avgMonthlyIncomeCents: number,
  avgMonthlyRoundUpCents: number
): OneOff[] {
  const result: OneOff[] = [];
  const end = addDays(asOf, horizonDays);
  for (const jar of jars) {
    let left = remainingCents(jar);
    const monthly = monthlyContribution(jar, avgMonthlyIncomeCents, avgMonthlyRoundUpCents);
    if (monthly <= 0 || left <= 0) continue;
    let k = 1;
    for (;;) {
      const date = addMonths(startOfMonth(asOf), k);
      if (date > end || left <= 0) break;
      const give = Math.min(monthly, left);
      result.push({ date, amountCents: -give });
      left -= give;
      k += 1;
    }
  }
  return result;
}

export function spendableBalance(accounts: readonly Account[], jars: readonly Jar[]): number {
  let total = 0;
  for (const a of accounts) {
    if (a.type === 'credit_card' || a.type === 'loan') continue;
    total += a.balanceCents;
  }
  let reserved = 0;
  for (const j of jars) reserved += j.savedCents;
  return total - reserved;
}

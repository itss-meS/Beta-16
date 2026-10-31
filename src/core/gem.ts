import type { Anomaly, GemAchievement, Jar, Transaction } from '@/types/models';
import { addDays, endOfMonth, startOfMonth, type ISODate } from '@/utils/date';
import { divRound, percentOf } from '@/utils/money';
import { createPrng } from '@/utils/prng';

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
}

export const BADGES: readonly BadgeDef[] = [
  { id: 'first_import', title: 'First import', description: 'Imported your first transactions.' },
  { id: 'streak_3', title: '3-day streak', description: 'Stayed under your daily budget for 3 days.' },
  { id: 'streak_7', title: '7-day streak', description: 'Stayed under your daily budget for 7 days.' },
  { id: 'streak_30', title: '30-day streak', description: 'Stayed under your daily budget for 30 days.' },
  { id: 'saver_20', title: 'Saver', description: 'Saved at least 20% of income last month.' },
  { id: 'jar_complete', title: 'Goal reached', description: 'Filled a jar to its target.' },
  { id: 'clean_month', title: 'Clean slate', description: 'No open anomalies on your account.' },
  { id: 'organized', title: 'Organized', description: 'Categorized at least 50 transactions.' }
];

export function dailyDiscretionary(transactions: readonly Transaction[], from: ISODate, to: ISODate): Map<ISODate, number> {
  const map = new Map<ISODate, number>();
  for (const t of transactions) {
    if (t.date < from || t.date > to) continue;
    if (t.amountCents >= 0 || t.category === 'Transfer' || t.recurringId !== null) continue;
    map.set(t.date, (map.get(t.date) ?? 0) - t.amountCents);
  }
  return map;
}

export function deriveDailyBudget(transactions: readonly Transaction[], asOf: ISODate, lookbackDays = 90): number {
  const from = addDays(asOf, -(lookbackDays - 1));
  let total = 0;
  for (const v of dailyDiscretionary(transactions, from, asOf).values()) total += v;
  return percentOf(divRound(total, lookbackDays), 12500);
}

export function computeStreak(transactions: readonly Transaction[], asOf: ISODate, dailyBudgetCents: number): number {
  if (transactions.length === 0) return 0;
  let earliest = asOf;
  for (const t of transactions) if (t.date < earliest) earliest = t.date;
  const spend = dailyDiscretionary(transactions, earliest, asOf);
  let streak = 0;
  let day = asOf;
  while (day >= earliest && streak < 365) {
    if ((spend.get(day) ?? 0) > dailyBudgetCents) break;
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

export interface BadgeContext {
  transactions: readonly Transaction[];
  jars: readonly Jar[];
  anomalies: readonly Anomaly[];
  asOf: ISODate;
}

export function savingsRateLastMonth(transactions: readonly Transaction[], asOf: ISODate): number | null {
  const prevMonthEnd = addDays(startOfMonth(asOf), -1);
  const from = startOfMonth(prevMonthEnd);
  const to = endOfMonth(prevMonthEnd);
  let income = 0;
  let spend = 0;
  for (const t of transactions) {
    if (t.date < from || t.date > to || t.category === 'Transfer') continue;
    if (t.amountCents > 0) income += t.amountCents;
    else spend += -t.amountCents;
  }
  if (income === 0) return null;
  return divRound((income - spend) * 100, income);
}

export function evaluateBadges(ctx: BadgeContext): { earned: string[]; streak: number } {
  const earned: string[] = [];
  const budget = deriveDailyBudget(ctx.transactions, ctx.asOf);
  const streak = computeStreak(ctx.transactions, ctx.asOf, budget);
  if (ctx.transactions.length > 0) earned.push('first_import');
  if (streak >= 3) earned.push('streak_3');
  if (streak >= 7) earned.push('streak_7');
  if (streak >= 30) earned.push('streak_30');
  const rate = savingsRateLastMonth(ctx.transactions, ctx.asOf);
  if (rate !== null && rate >= 20) earned.push('saver_20');
  if (ctx.jars.some((j) => j.targetCents > 0 && j.savedCents >= j.targetCents)) earned.push('jar_complete');
  if (ctx.transactions.length > 0 && ctx.anomalies.every((a) => a.status !== 'open')) earned.push('clean_month');
  if (ctx.transactions.filter((t) => t.category !== 'Other').length >= 50) earned.push('organized');
  return { earned, streak };
}

export function newAchievements(
  earned: readonly string[],
  existing: readonly GemAchievement[],
  asOf: ISODate,
  streak: number
): GemAchievement[] {
  const have = new Set(existing.map((a) => a.badge));
  return earned
    .filter((b) => !have.has(b))
    .map((badge) => ({ id: `gem_${badge}`, badge, unlockedAt: asOf, streakDays: streak }));
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
}

export function createParticles(count: number, seed: number, width: number, height: number): Particle[] {
  const prng = createPrng(seed);
  const unit = (): number => prng.nextU32() / 4294967296;
  const list: Particle[] = [];
  for (let i = 0; i < count; i++) {
    list.push({
      x: unit() * width,
      y: unit() * height,
      vx: (unit() - 0.5) * 20,
      vy: 20 + unit() * 40,
      radius: 2 + unit() * 3,
      hue: Math.floor(unit() * 3)
    });
  }
  return list;
}

export function stepParticles(particles: readonly Particle[], dtMs: number, width: number, height: number): Particle[] {
  const dt = Math.min(dtMs, 64) / 1000;
  return particles.map((p) => {
    let x = p.x + p.vx * dt;
    let y = p.y + p.vy * dt;
    if (y > height + p.radius) y = -p.radius;
    if (x < -p.radius) x = width + p.radius;
    if (x > width + p.radius) x = -p.radius;
    return { ...p, x, y };
  });
}

import type { Frequency } from '@/types/models';
import type { ISODate } from '@/utils/date';
import { divRound } from '@/utils/money';
import { runForecast, type ForecastInput, type ForecastResult, type ForecastSeries, type OneOff, type StepKey } from './forecast';

export type Scenario =
  | { kind: 'purchase'; title: string; amountCents: number; date: ISODate }
  | { kind: 'cancel_series'; seriesId: string }
  | { kind: 'add_series'; title: string; amountCents: number; frequency: Frequency; startDate: ISODate }
  | { kind: 'loan'; title: string; principalCents: number; annualRateBps: number; months: number; startDate: ISODate; downPaymentCents: number }
  | { kind: 'income_change'; seriesId: string; newAmountCents: number };

export interface StepDiff {
  key: StepKey;
  label: string;
  p10: number;
  p50: number;
  p90: number;
}

export interface SimulationResult {
  before: ForecastResult;
  after: ForecastResult;
  diff: StepDiff[];
  availableDelta: { p10: number; p50: number; p90: number };
}

export function emiCents(principalCents: number, annualRateBps: number, months: number): number {
  if (!Number.isInteger(principalCents) || principalCents <= 0) throw new RangeError('principal must be positive');
  if (!Number.isInteger(months) || months < 1 || months > 480) throw new RangeError('months must be 1..480');
  if (!Number.isInteger(annualRateBps) || annualRateBps < 0 || annualRateBps > 10000) throw new RangeError('rate out of range');
  if (annualRateBps === 0) return Math.floor((principalCents + months - 1) / months);
  const clears = (emi: number): boolean => {
    let balance = principalCents;
    for (let m = 0; m < months; m++) {
      balance = balance + divRound(balance * annualRateBps, 120000) - emi;
      if (balance <= 0) return true;
    }
    return false;
  };
  let lo = 1;
  let hi = principalCents * 2;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (clears(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function intervalFor(frequency: Frequency): number {
  const map: Record<Frequency, number> = { weekly: 7, biweekly: 14, monthly: 30, quarterly: 91, yearly: 365, custom: 30 };
  return map[frequency];
}

export function applyScenarios(base: ForecastInput, scenarios: readonly Scenario[]): ForecastInput {
  let series: ForecastSeries[] = base.series.map((s) => ({ ...s }));
  const oneOffs: OneOff[] = [...(base.oneOffs ?? [])];
  scenarios.forEach((sc, index) => {
    switch (sc.kind) {
      case 'purchase':
        oneOffs.push({ date: sc.date, amountCents: -Math.abs(sc.amountCents) });
        break;
      case 'cancel_series':
        series = series.map((s) => (s.id === sc.seriesId ? { ...s, active: false } : s));
        break;
      case 'income_change':
        series = series.map((s) => (s.id === sc.seriesId ? { ...s, amountCents: sc.newAmountCents } : s));
        break;
      case 'add_series':
        series.push({
          id: `sim_${index}`,
          amountCents: -Math.abs(sc.amountCents),
          intervalDays: intervalFor(sc.frequency),
          frequency: sc.frequency,
          nextDueDate: sc.startDate,
          confidence: 1,
          active: true
        });
        break;
      case 'loan': {
        const emi = emiCents(sc.principalCents, sc.annualRateBps, sc.months);
        series.push({
          id: `sim_${index}`,
          amountCents: -emi,
          intervalDays: 30,
          frequency: 'monthly',
          nextDueDate: sc.startDate,
          confidence: 1,
          active: true
        });
        if (sc.downPaymentCents > 0) oneOffs.push({ date: sc.startDate, amountCents: -sc.downPaymentCents });
        break;
      }
    }
  });
  return { ...base, series, oneOffs };
}

export function simulate(base: ForecastInput, scenarios: readonly Scenario[]): SimulationResult {
  const before = runForecast(base);
  const after = runForecast(applyScenarios(base, scenarios));
  const diff: StepDiff[] = after.steps.map((step, i) => {
    const prev = before.steps[i];
    return {
      key: step.key,
      label: step.label,
      p10: step.p10 - (prev?.p10 ?? 0),
      p50: step.p50 - (prev?.p50 ?? 0),
      p90: step.p90 - (prev?.p90 ?? 0)
    };
  });
  return {
    before,
    after,
    diff,
    availableDelta: {
      p10: after.available.p10 - before.available.p10,
      p50: after.available.p50 - before.available.p50,
      p90: after.available.p90 - before.available.p90
    }
  };
}

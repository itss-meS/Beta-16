import type { Frequency } from '@/types/models';
import { addDays, addMonths, type ISODate } from '@/utils/date';

export interface ScheduledItem {
  nextDueDate: ISODate;
  intervalDays: number;
  frequency: Frequency;
}

export function monthStep(frequency: Frequency): number {
  if (frequency === 'monthly') return 1;
  if (frequency === 'quarterly') return 3;
  if (frequency === 'yearly') return 12;
  return 0;
}

export function dueDateAt(item: ScheduledItem, k: number): ISODate {
  const months = monthStep(item.frequency);
  if (months > 0) return addMonths(item.nextDueDate, months * k);
  return addDays(item.nextDueDate, Math.max(1, item.intervalDays) * k);
}

export function occurrencesBetween(item: ScheduledItem, afterExclusive: ISODate, untilInclusive: ISODate): ISODate[] {
  const result: ISODate[] = [];
  let k = 0;
  let guard = 0;
  while (guard < 5000) {
    guard += 1;
    const date = dueDateAt(item, k);
    if (date > untilInclusive) break;
    if (date > afterExclusive) result.push(date);
    k += 1;
  }
  return result;
}

export function firstDueAfter(item: ScheduledItem, afterExclusive: ISODate): ISODate {
  let k = 0;
  for (let guard = 0; guard < 5000; guard++) {
    const date = dueDateAt(item, k);
    if (date > afterExclusive) return date;
    k += 1;
  }
  return dueDateAt(item, k);
}

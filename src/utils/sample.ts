import type { Account, Transaction } from '@/types/models';
import { addDays, type ISODate } from './date';
import { rowsToTransactions, type ParsedRow } from '@/core/parsers';
import { keywordCategory } from '@/core/categorize';

const VARIABLE: ReadonlyArray<readonly [string, number, number]> = [
  ['UPI/SWIGGY/Food order', 18000, 62000],
  ['UPI/ZOMATO/Food order', 15000, 54000],
  ['UPI/BIGBASKET/Groceries', 90000, 320000],
  ['UPI/UBER INDIA/Ride', 12000, 48000],
  ['AMAZON PAY/Order', 40000, 450000],
  ['APOLLO PHARMACY/POS', 20000, 120000]
];

class Lcg {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(bound: number): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return (this.s >>> 8) % bound;
  }
}

export interface SampleData {
  account: Account;
  transactions: Transaction[];
}

export function generateSampleData(asOf: ISODate, createdAt: string, seed = 7, days = 120): SampleData {
  const rnd = new Lcg(seed);
  const rows: ParsedRow[] = [];
  const start = addDays(asOf, -(days - 1));
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(start, offset);
    const dom = date.slice(8, 10);
    const count = rnd.next(3);
    for (let i = 0; i < count; i++) {
      const pick = VARIABLE[rnd.next(VARIABLE.length)];
      if (!pick) continue;
      const amount = pick[1] + rnd.next(pick[2] - pick[1]);
      rows.push({ date, description: pick[0], amountCents: -amount, balanceCents: null });
    }
    if (dom === '01') rows.push({ date, description: 'NEFT/ACME TECH SALARY', amountCents: 7500000, balanceCents: null });
    if (dom === '05') rows.push({ date, description: 'UPI/LANDLORD RENT', amountCents: -2500000, balanceCents: null });
    if (dom === '10') rows.push({ date, description: 'NETFLIX.COM', amountCents: -64900, balanceCents: null });
    if (dom === '12') rows.push({ date, description: 'AIRTEL BROADBAND BILL', amountCents: -118900, balanceCents: null });
    if (dom === '15' && ['01', '04', '07', '10'].includes(date.slice(5, 7))) {
      rows.push({ date, description: 'CULT FIT GYM MEMBERSHIP', amountCents: -450000, balanceCents: null });
    }
  }
  const last = rows.find((r) => r.description.startsWith('UPI/SWIGGY'));
  if (last) rows.push({ ...last, date: addDays(last.date, 1) });
  const raw = rowsToTransactions(rows, 'acc_sample', 'sample', createdAt);
  const transactions = raw.map((t) => {
    const category = keywordCategory(`${t.merchant} ${t.description}`);
    return category ? { ...t, category, categorySource: 'rule' as const } : t;
  });
  const account: Account = {
    id: 'acc_sample',
    name: 'Salary account',
    institution: 'Sample Bank',
    type: 'savings',
    last4: '0000',
    balanceCents: 12000000,
    createdAt
  };
  return { account, transactions };
}

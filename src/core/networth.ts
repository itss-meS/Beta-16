import type { Account, AccountType, Category, Jar, Transaction } from '@/types/models';
import { addDays, type ISODate } from '@/utils/date';

export interface NetWorth {
  assetsCents: number;
  liabilitiesCents: number;
  netCents: number;
  byType: Record<AccountType, number>;
  jarsCents: number;
}

export function computeNetWorth(accounts: readonly Account[], jars: readonly Jar[]): NetWorth {
  const byType: Record<AccountType, number> = { savings: 0, current: 0, credit_card: 0, loan: 0, wallet: 0, cash: 0 };
  let assets = 0;
  let liabilities = 0;
  for (const a of accounts) {
    byType[a.type] += a.balanceCents;
    if (a.balanceCents >= 0) assets += a.balanceCents;
    else liabilities += -a.balanceCents;
  }
  let jarsCents = 0;
  for (const j of jars) jarsCents += j.savedCents;
  return { assetsCents: assets, liabilitiesCents: liabilities, netCents: assets - liabilities, byType, jarsCents };
}

export interface SankeyNode {
  id: string;
  label: string;
  column: 0 | 1;
}

export interface SankeyLink {
  source: string;
  target: string;
  valueCents: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  totalCents: number;
}

export function buildSankey(transactions: readonly Transaction[], asOf: ISODate, days: number, topN = 6): SankeyData {
  const from = addDays(asOf, -(days - 1));
  let income = 0;
  const spend = new Map<Category, number>();
  for (const t of transactions) {
    if (t.date < from || t.date > asOf || t.category === 'Transfer') continue;
    if (t.amountCents > 0) income += t.amountCents;
    else spend.set(t.category, (spend.get(t.category) ?? 0) - t.amountCents);
  }
  const ranked = Array.from(spend.entries()).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const top = ranked.slice(0, topN);
  const restTotal = ranked.slice(topN).reduce((s, [, v]) => s + v, 0);
  const totalSpend = ranked.reduce((s, [, v]) => s + v, 0);
  const nodes: SankeyNode[] = [{ id: 'income', label: 'Income', column: 0 }];
  const links: SankeyLink[] = [];
  const deficit = Math.max(0, totalSpend - income);
  if (deficit > 0) nodes.push({ id: 'drawdown', label: 'From savings', column: 0 });
  const rows: Array<[string, string, number]> = top.map(([c, v]) => [`cat_${c}`, c, v]);
  if (restTotal > 0) rows.push(['cat_rest', 'Other categories', restTotal]);
  let incomeLeft = income;
  for (const [id, label, value] of rows) {
    nodes.push({ id, label, column: 1 });
    const fromIncome = Math.min(value, incomeLeft);
    if (fromIncome > 0) links.push({ source: 'income', target: id, valueCents: fromIncome });
    incomeLeft -= fromIncome;
    const fromDraw = value - fromIncome;
    if (fromDraw > 0) {
      links.push({ source: 'drawdown', target: id, valueCents: fromDraw });
    }
  }
  if (income > totalSpend) {
    nodes.push({ id: 'saved', label: 'Saved', column: 1 });
    links.push({ source: 'income', target: 'saved', valueCents: income - totalSpend });
  }
  return { nodes, links, totalCents: Math.max(income, totalSpend) };
}

import type { Transaction, TxnSource } from '@/types/models';
import { parseFlexibleDate, type ISODate } from '@/utils/date';
import { stableId } from '@/utils/hash';
import { parseMoneyToCents } from '@/utils/money';
import { normalizeMerchant } from './categorize';

export interface ParsedRow {
  date: ISODate;
  description: string;
  amountCents: number;
  balanceCents: number | null;
}

export interface ParseResult {
  rows: ParsedRow[];
  warnings: string[];
  skipped: number;
  closingBalanceCents: number | null;
}

export function parseCsvRows(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const candidates = [',', ';', '\t', '|'];
  let delimiter = ',';
  let best = -1;
  for (const c of candidates) {
    const count = firstLine.split(c).length - 1;
    if (count > best) {
      best = count;
      delimiter = c;
    }
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (src.charAt(i + 1) === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src.charAt(i + 1) === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

interface Columns {
  date: number;
  description: number;
  debit: number;
  credit: number;
  amount: number;
  kind: number;
  balance: number;
}

function findHeader(rows: string[][]): { index: number; cols: Columns } | null {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = (rows[i] ?? []).map((c) => c.trim().toLowerCase());
    const find = (re: RegExp, skip: RegExp | null = null): number =>
      cells.findIndex((c) => re.test(c) && (skip === null || !skip.test(c)));
    let date = find(/(transaction|txn|posting)\s*date/);
    if (date < 0) date = find(/^date$|date/, /value/);
    if (date < 0) date = find(/date/);
    const description = find(/narration|description|particulars|details|remarks|transaction remarks/);
    const debit = find(/debit|withdrawal|\bdr\b/, /dr\/cr|cr\/dr/);
    const credit = find(/credit|deposit|\bcr\b/, /dr\/cr|cr\/dr/);
    const amount = find(/^amount|amount\s*\(/);
    const kind = find(/dr\/cr|cr\/dr|^type$|txn type|transaction type/);
    const balance = find(/balance/);
    if (date >= 0 && description >= 0 && (debit >= 0 || credit >= 0 || amount >= 0)) {
      return { index: i, cols: { date, description, debit, credit, amount, kind, balance } };
    }
  }
  return null;
}

export function parseStatementCsv(text: string): ParseResult {
  const rows = parseCsvRows(text);
  const header = findHeader(rows);
  const result: ParseResult = { rows: [], warnings: [], skipped: 0, closingBalanceCents: null };
  if (!header) {
    result.warnings.push('Could not find a header row with date, description and amount columns.');
    return result;
  }
  const { cols } = header;
  for (let i = header.index + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const date = parseFlexibleDate(r[cols.date] ?? '');
    const description = (r[cols.description] ?? '').trim();
    if (!date || description === '') {
      result.skipped += 1;
      continue;
    }
    let amount: number | null = null;
    const debit = cols.debit >= 0 ? parseMoneyToCents(r[cols.debit] ?? '') : null;
    const credit = cols.credit >= 0 ? parseMoneyToCents(r[cols.credit] ?? '') : null;
    if (debit !== null && debit !== 0) amount = -Math.abs(debit);
    else if (credit !== null && credit !== 0) amount = Math.abs(credit);
    else if (cols.amount >= 0) {
      const raw = parseMoneyToCents(r[cols.amount] ?? '');
      if (raw !== null) {
        const kind = cols.kind >= 0 ? (r[cols.kind] ?? '').trim().toLowerCase() : '';
        if (/^(dr|debit|d)\b/.test(kind)) amount = -Math.abs(raw);
        else if (/^(cr|credit|c)\b/.test(kind)) amount = Math.abs(raw);
        else amount = raw;
      }
    }
    if (amount === null || amount === 0) {
      result.skipped += 1;
      continue;
    }
    const bal = cols.balance >= 0 ? parseMoneyToCents(r[cols.balance] ?? '') : null;
    result.rows.push({ date, description, amountCents: amount, balanceCents: bal });
    if (bal !== null) result.closingBalanceCents = bal;
  }
  if (result.rows.length === 0) result.warnings.push('No transactions were found in this file.');
  return result;
}

export function parseStatementLines(lines: readonly string[]): ParseResult {
  const result: ParseResult = { rows: [], warnings: [], skipped: 0, closingBalanceCents: null };
  let prevBalance: number | null = null;
  let guessed = 0;
  for (const raw of lines) {
    const line = raw.trim();
    const dateMatch = /^(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[ -][A-Za-z]{3}[ -,]*\d{2,4}|\d{4}-\d{2}-\d{2})\s+(.*)$/.exec(line);
    if (!dateMatch) continue;
    const date = parseFlexibleDate(dateMatch[1] ?? '');
    const rest = dateMatch[2] ?? '';
    const amountRe = /-?\(?\d[\d,]*\.\d{2}\)?(?:\s?(?:Cr|Dr))?/gi;
    const nums = rest.match(amountRe) ?? [];
    if (!date || nums.length < 1) {
      result.skipped += 1;
      continue;
    }
    const first = rest.search(amountRe);
    const description = rest.slice(0, first).trim();
    if (description === '') {
      result.skipped += 1;
      continue;
    }
    const balanceCents = nums.length >= 2 ? parseMoneyToCents(nums[nums.length - 1] ?? '') : null;
    const amountToken = nums.length >= 2 ? (nums[nums.length - 2] ?? '') : (nums[0] ?? '');
    const magnitude = parseMoneyToCents(amountToken);
    if (magnitude === null || magnitude === 0) {
      result.skipped += 1;
      continue;
    }
    const abs = Math.abs(magnitude);
    let amount: number;
    if (/dr\.?$/i.test(amountToken)) amount = -abs;
    else if (/cr\.?$/i.test(amountToken)) amount = abs;
    else if (balanceCents !== null && prevBalance !== null) amount = balanceCents >= prevBalance ? abs : -abs;
    else if (magnitude < 0) amount = -abs;
    else {
      amount = -abs;
      guessed += 1;
    }
    if (balanceCents !== null) {
      prevBalance = balanceCents;
      result.closingBalanceCents = balanceCents;
    }
    result.rows.push({ date, description, amountCents: amount, balanceCents });
  }
  if (guessed > 0) result.warnings.push(`${guessed} row(s) had no debit/credit marker and were treated as debits. Please review them.`);
  if (result.rows.length === 0) result.warnings.push('No transactions were found in this document.');
  return result;
}

export function rowsToTransactions(rows: readonly ParsedRow[], accountId: string, source: TxnSource, createdAt: string): Transaction[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const merchant = normalizeMerchant(row.description);
    const key = `${accountId}|${row.date}|${row.amountCents}|${row.description.trim().toLowerCase()}`;
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    return {
      id: stableId('txn', key, occurrence),
      accountId,
      date: row.date,
      description: row.description.trim(),
      merchant,
      amountCents: row.amountCents,
      category: 'Other',
      categorySource: 'none',
      recurringId: null,
      source,
      createdAt
    };
  });
}

export function mergeTransactions(existing: readonly Transaction[], incoming: readonly Transaction[]): { merged: Transaction[]; added: Transaction[]; duplicates: number } {
  const ids = new Set(existing.map((t) => t.id));
  const added: Transaction[] = [];
  let duplicates = 0;
  for (const t of incoming) {
    if (ids.has(t.id)) duplicates += 1;
    else {
      ids.add(t.id);
      added.push(t);
    }
  }
  return { merged: [...existing, ...added], added, duplicates };
}

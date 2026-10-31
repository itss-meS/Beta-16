import { FinanceNative } from '@plugins/finance-native';
import { parseStatementCsv, parseStatementLines, type ParseResult } from '@/core/parsers';
import { fileToBase64 } from '@/utils/base64';

export type StatementKind = 'csv' | 'pdf' | 'image';

export function detectKind(file: File): StatementKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt') || file.type === 'text/csv') return 'csv';
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(name)) return 'image';
  return null;
}

export async function parseStatementFile(file: File, password?: string): Promise<{ kind: StatementKind; result: ParseResult }> {
  const kind = detectKind(file);
  if (kind === null) throw new Error('Unsupported file type. Choose a CSV, PDF or image.');
  if (kind === 'csv') return { kind, result: parseStatementCsv(await file.text()) };
  const base64 = await fileToBase64(file);
  if (kind === 'pdf') {
    const { lines } = await FinanceNative.parsePdf(password ? { base64, password } : { base64 });
    return { kind, result: parseStatementLines(lines) };
  }
  const { lines } = await FinanceNative.ocrImage({ base64 });
  return { kind, result: parseStatementLines(lines) };
}

export function sourceOf(kind: StatementKind): 'csv' | 'pdf' | 'ocr' {
  return kind === 'csv' ? 'csv' : kind === 'pdf' ? 'pdf' : 'ocr';
}

import { DB_SCHEMA, type EntityMap, type TableDef, type TableName } from '@/types/models';
import type { RawRow, RawValue } from '@plugins/definitions';
import { base64ToBytes, bytesToBase64 } from '@/utils/base64';

const DEFS = new Map<string, TableDef>(DB_SCHEMA.map((t) => [t.table, t] as const));

function definition(table: string): TableDef {
  const found = DEFS.get(table);
  if (!found) throw new Error(`unknown table ${table}`);
  return found;
}

function encodeFloats(values: readonly number[]): string {
  return bytesToBase64(new Uint8Array(Float32Array.from(values).buffer));
}

function decodeFloats(value: string): number[] {
  const bytes = base64ToBytes(value);
  return Array.from(new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4)));
}

export function encodeEntity<T extends TableName>(table: T, entity: EntityMap[T]): RawRow {
  const source = entity as unknown as Record<string, unknown>;
  const row: RawRow = {};
  for (const col of definition(table).columns) {
    const value = source[col.field];
    let out: RawValue;
    if (value === null || value === undefined) out = null;
    else if (col.codec === 'bool') out = value ? 1 : 0;
    else if (col.codec === 'f32') out = encodeFloats(value as number[]);
    else out = value as string | number;
    row[col.column] = out;
  }
  return row;
}

export function decodeRow<T extends TableName>(table: T, row: RawRow): EntityMap[T] {
  const out: Record<string, unknown> = {};
  for (const col of definition(table).columns) {
    const value = row[col.column] ?? null;
    if (value === null) {
      out[col.field] = col.codec === 'f32' ? [] : col.nullable ? null : col.type === 'TEXT' ? '' : 0;
      continue;
    }
    if (col.codec === 'bool') out[col.field] = Number(value) === 1;
    else if (col.codec === 'f32') out[col.field] = typeof value === 'string' ? decodeFloats(value) : [];
    else if (col.type === 'TEXT') out[col.field] = String(value);
    else out[col.field] = Number(value);
  }
  return out as unknown as EntityMap[T];
}

export function tableNames(): string[] {
  return DB_SCHEMA.map((t) => t.table);
}

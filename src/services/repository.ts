import { FinanceNative } from '@plugins/finance-native';
import { decodeRow, encodeEntity } from '@/db/codec';
import type { EntityMap, TableName } from '@/types/models';

const CHUNK = 200;

export async function initDatabase(): Promise<void> {
  await FinanceNative.dbInit();
}

export async function loadTable<T extends TableName>(table: T): Promise<EntityMap[T][]> {
  const { rows } = await FinanceNative.dbGetAll({ table });
  return rows.map((row) => decodeRow(table, row));
}

export async function saveRows<T extends TableName>(table: T, items: readonly EntityMap[T][]): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK) {
    const rows = items.slice(i, i + CHUNK).map((item) => encodeEntity(table, item));
    await FinanceNative.dbUpsert({ table, rows });
  }
}

export async function deleteRows(table: TableName, ids: readonly string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += CHUNK) {
    await FinanceNative.dbDelete({ table, ids: ids.slice(i, i + CHUNK) });
  }
}

export async function replaceRows<T extends TableName>(
  table: T,
  next: readonly EntityMap[T][],
  previousIds: readonly string[],
  idOf: (item: EntityMap[T]) => string
): Promise<void> {
  const keep = new Set(next.map(idOf));
  const gone = previousIds.filter((id) => !keep.has(id));
  if (gone.length > 0) await deleteRows(table, gone);
  await saveRows(table, next);
}

export async function clearDatabase(): Promise<void> {
  await FinanceNative.dbClear();
}

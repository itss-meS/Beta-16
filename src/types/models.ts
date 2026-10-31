export const CONTRACT_VERSION = '1.0.0';
export const SCHEMA_VERSION = 1;

export const CATEGORIES = [
  'Food',
  'Groceries',
  'Rent',
  'Shopping',
  'Travel',
  'Bills',
  'Subscriptions',
  'Health',
  'Education',
  'Entertainment',
  'EMI',
  'Salary',
  'Transfer',
  'Other'
] as const;

export type Category = (typeof CATEGORIES)[number];
export type AccountType = 'savings' | 'current' | 'credit_card' | 'loan' | 'wallet' | 'cash';
export type TxnSource = 'csv' | 'pdf' | 'ocr' | 'messenger' | 'manual' | 'sample';
export type CategorySource = 'model' | 'rule' | 'user' | 'none';
export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type AnomalyType = 'duplicate' | 'spike' | 'new_merchant' | 'missing_recurring';
export type AnomalyStatus = 'open' | 'dismissed' | 'legit';
export type Severity = 'low' | 'medium' | 'high';
export type JarRuleType = 'none' | 'percent_income' | 'fixed_monthly' | 'roundup';

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  last4: string | null;
  balanceCents: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  merchant: string;
  amountCents: number;
  category: Category;
  categorySource: CategorySource;
  recurringId: string | null;
  source: TxnSource;
  createdAt: string;
}

export interface RecurringSeries {
  id: string;
  merchant: string;
  amountCents: number;
  intervalDays: number;
  frequency: Frequency;
  confidence: number;
  nextDueDate: string;
  lastSeenDate: string;
  occurrences: number;
  active: boolean;
}

export interface CategorizationEntry {
  merchant: string;
  category: Category;
  embedding: number[];
  sampleCount: number;
  updatedAt: string;
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  transactionId: string | null;
  seriesId: string | null;
  merchant: string;
  severity: Severity;
  reason: string;
  status: AnomalyStatus;
  detectedAt: string;
}

export interface ForecastRecord {
  id: string;
  createdAt: string;
  horizonDays: number;
  p10Cents: number;
  p50Cents: number;
  p90Cents: number;
  assumptionsJson: string;
}

export interface Jar {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  deadline: string | null;
  ruleType: JarRuleType;
  ruleValue: number;
  createdAt: string;
}

export interface WishlistItem {
  id: string;
  title: string;
  costCents: number;
  priority: number;
  jarId: string | null;
  acquired: boolean;
  createdAt: string;
}

export interface GemAchievement {
  id: string;
  badge: string;
  unlockedAt: string;
  streakDays: number;
}

export interface SettingKV {
  key: string;
  value: string;
}

export type SqlType = 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';
export type Codec = 'bool' | 'f32';

export interface ColumnDef {
  field: string;
  column: string;
  type: SqlType;
  nullable: boolean;
  primary?: boolean;
  codec?: Codec;
}

export interface TableDef {
  table: string;
  entity: string;
  columns: ColumnDef[];
  indices: string[];
}

const text = (field: string, column: string, nullable = false, primary = false): ColumnDef => ({
  field,
  column,
  type: 'TEXT',
  nullable,
  ...(primary ? { primary: true } : {})
});
const int = (field: string, column: string, nullable = false): ColumnDef => ({
  field,
  column,
  type: 'INTEGER',
  nullable
});
const bool = (field: string, column: string): ColumnDef => ({
  field,
  column,
  type: 'INTEGER',
  nullable: false,
  codec: 'bool'
});
const real = (field: string, column: string): ColumnDef => ({
  field,
  column,
  type: 'REAL',
  nullable: false
});

export const DB_SCHEMA: TableDef[] = [
  {
    table: 'accounts',
    entity: 'AccountEntity',
    columns: [
      text('id', 'id', false, true),
      text('name', 'name'),
      text('institution', 'institution'),
      text('type', 'type'),
      text('last4', 'last4', true),
      int('balanceCents', 'balance_cents'),
      text('createdAt', 'created_at')
    ],
    indices: []
  },
  {
    table: 'transactions',
    entity: 'TransactionEntity',
    columns: [
      text('id', 'id', false, true),
      text('accountId', 'account_id'),
      text('date', 'date'),
      text('description', 'description'),
      text('merchant', 'merchant'),
      int('amountCents', 'amount_cents'),
      text('category', 'category'),
      text('categorySource', 'category_source'),
      text('recurringId', 'recurring_id', true),
      text('source', 'source'),
      text('createdAt', 'created_at')
    ],
    indices: ['date', 'merchant', 'category']
  },
  {
    table: 'recurring_series',
    entity: 'RecurringSeriesEntity',
    columns: [
      text('id', 'id', false, true),
      text('merchant', 'merchant'),
      int('amountCents', 'amount_cents'),
      int('intervalDays', 'interval_days'),
      text('frequency', 'frequency'),
      real('confidence', 'confidence'),
      text('nextDueDate', 'next_due_date'),
      text('lastSeenDate', 'last_seen_date'),
      int('occurrences', 'occurrences'),
      bool('active', 'active')
    ],
    indices: []
  },
  {
    table: 'categorization_model',
    entity: 'CategorizationEntity',
    columns: [
      text('merchant', 'merchant', false, true),
      text('category', 'category'),
      { field: 'embedding', column: 'embedding', type: 'BLOB', nullable: false, codec: 'f32' },
      int('sampleCount', 'sample_count'),
      text('updatedAt', 'updated_at')
    ],
    indices: []
  },
  {
    table: 'anomalies',
    entity: 'AnomalyEntity',
    columns: [
      text('id', 'id', false, true),
      text('type', 'type'),
      text('transactionId', 'transaction_id', true),
      text('seriesId', 'series_id', true),
      text('merchant', 'merchant'),
      text('severity', 'severity'),
      text('reason', 'reason'),
      text('status', 'status'),
      text('detectedAt', 'detected_at')
    ],
    indices: []
  },
  {
    table: 'forecasts',
    entity: 'ForecastEntity',
    columns: [
      text('id', 'id', false, true),
      text('createdAt', 'created_at'),
      int('horizonDays', 'horizon_days'),
      int('p10Cents', 'p10_cents'),
      int('p50Cents', 'p50_cents'),
      int('p90Cents', 'p90_cents'),
      text('assumptionsJson', 'assumptions_json')
    ],
    indices: []
  },
  {
    table: 'jars',
    entity: 'JarEntity',
    columns: [
      text('id', 'id', false, true),
      text('name', 'name'),
      int('targetCents', 'target_cents'),
      int('savedCents', 'saved_cents'),
      text('deadline', 'deadline', true),
      text('ruleType', 'rule_type'),
      int('ruleValue', 'rule_value'),
      text('createdAt', 'created_at')
    ],
    indices: []
  },
  {
    table: 'wishlist',
    entity: 'WishlistEntity',
    columns: [
      text('id', 'id', false, true),
      text('title', 'title'),
      int('costCents', 'cost_cents'),
      int('priority', 'priority'),
      text('jarId', 'jar_id', true),
      bool('acquired', 'acquired'),
      text('createdAt', 'created_at')
    ],
    indices: []
  },
  {
    table: 'gem_achievements',
    entity: 'GemAchievementEntity',
    columns: [
      text('id', 'id', false, true),
      text('badge', 'badge'),
      text('unlockedAt', 'unlocked_at'),
      int('streakDays', 'streak_days')
    ],
    indices: []
  },
  {
    table: 'settings_kv',
    entity: 'SettingEntity',
    columns: [text('key', 'key', false, true), text('value', 'value')],
    indices: []
  }
];

export const VIRTUAL_TABLES = ['merchants_fts'] as const;

export interface EntityMap {
  accounts: Account;
  transactions: Transaction;
  recurring_series: RecurringSeries;
  categorization_model: CategorizationEntry;
  anomalies: Anomaly;
  forecasts: ForecastRecord;
  jars: Jar;
  wishlist: WishlistItem;
  gem_achievements: GemAchievement;
  settings_kv: SettingKV;
}

export type TableName = keyof EntityMap;

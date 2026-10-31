export const CATEGORY_COLORS = {
  Food: '#E4572E',
  Groceries: '#76B041',
  Rent: '#4361EE',
  Shopping: '#F29E4C',
  Travel: '#2EC4B6',
  Bills: '#9B5DE5',
  Subscriptions: '#F15BB5',
  Health: '#00A6A6',
  Education: '#3A86FF',
  Entertainment: '#FF006E',
  EMI: '#8338EC',
  Salary: '#2A9D8F',
  Transfer: '#8D99AE',
  Other: '#6C757D'
} as const;

export const ACCOUNT_TYPE_LABELS = {
  savings: 'Savings',
  current: 'Current',
  credit_card: 'Credit card',
  loan: 'Loan',
  wallet: 'Wallet',
  cash: 'Cash'
} as const;

export const SETTING_KEYS = {
  onboarded: 'onboarded',
  theme: 'theme',
  biometricLock: 'biometric_lock',
  billReminders: 'bill_reminders',
  forecastStale: 'forecast_stale'
} as const;

import { Transaction, TransactionCategory } from '../types/finance';
import { CATEGORIES_META } from '../constants/categories';

export interface CategorySpendingSummary {
  category: TransactionCategory;
  amount: number;
  percentage: number;
  transactionCount: number;
  color: string;
}

/**
 * Pure, deterministic calculation of total income from a transaction list
 */
export const calculateTotalIncome = (transactions: Transaction[]): number => {
  return transactions
    .filter((tx) => tx.type === 'INCOME')
    .reduce((sum, tx) => sum + tx.amount, 0);
};

/**
 * Pure, deterministic calculation of total expenses from a transaction list
 */
export const calculateTotalExpenses = (transactions: Transaction[]): number => {
  return transactions
    .filter((tx) => tx.type === 'EXPENSE')
    .reduce((sum, tx) => sum + tx.amount, 0);
};

/**
 * Net cash flow = Total Income - Total Expenses
 */
export const calculateNetCashFlow = (transactions: Transaction[]): number => {
  return calculateTotalIncome(transactions) - calculateTotalExpenses(transactions);
};

/**
 * Computes category-wise breakdown with percentage and metadata color
 */
export const calculateCategorySpending = (transactions: Transaction[]): CategorySpendingSummary[] => {
  const expenseTx = transactions.filter((tx) => tx.type === 'EXPENSE');
  const totalExpense = expenseTx.reduce((sum, tx) => sum + tx.amount, 0);

  const categoryMap: Partial<Record<TransactionCategory, { amount: number; count: number }>> = {};

  expenseTx.forEach((tx) => {
    if (!categoryMap[tx.category]) {
      categoryMap[tx.category] = { amount: 0, count: 0 };
    }
    categoryMap[tx.category]!.amount += tx.amount;
    categoryMap[tx.category]!.count += 1;
  });

  const results: CategorySpendingSummary[] = Object.keys(categoryMap).map((catKey) => {
    const category = catKey as TransactionCategory;
    const item = categoryMap[category]!;
    const percentage = totalExpense > 0 ? (item.amount / totalExpense) * 100 : 0;
    return {
      category,
      amount: item.amount,
      percentage: Number(percentage.toFixed(1)),
      transactionCount: item.count,
      color: CATEGORIES_META[category]?.color || '#9CA3AF',
    };
  });

  // Sort descending by highest spending
  return results.sort((a, b) => b.amount - a.amount);
};

/**
 * Computes daily safe spend limit based on remaining days in current month
 */
export const calculateDailySafeSpend = (
  currentBalance: number,
  committedUpcomingBills: number,
  reserveFloor: number = 15000,
  daysRemainingInMonth: number = 10
): { dailySafeAmount: number; discretionaryPool: number } => {
  const discretionaryPool = Math.max(0, currentBalance - committedUpcomingBills - reserveFloor);
  const dailySafeAmount = daysRemainingInMonth > 0 ? Math.floor(discretionaryPool / daysRemainingInMonth) : 0;
  return { dailySafeAmount, discretionaryPool };
};

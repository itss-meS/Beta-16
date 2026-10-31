import { Transaction, AnomalyItem } from '../types/finance';

/**
 * Detects unusual transactions based on statistical deviation within categories.
 * Note: Explains why flagged without assuming fraud.
 */
export const detectUnusualTransactions = (transactions: Transaction[]): AnomalyItem[] => {
  const anomalies: AnomalyItem[] = [];

  // Group expense transactions by category
  const expensesByCategory: Record<string, Transaction[]> = {};
  transactions
    .filter((tx) => tx.type === 'EXPENSE')
    .forEach((tx) => {
      if (!expensesByCategory[tx.category]) {
        expensesByCategory[tx.category] = [];
      }
      expensesByCategory[tx.category].push(tx);
    });

  Object.entries(expensesByCategory).forEach(([category, txList]) => {
    if (txList.length < 2) return;

    // Calculate baseline mean
    const totalAmount = txList.reduce((sum, tx) => sum + tx.amount, 0);
    const mean = totalAmount / txList.length;

    txList.forEach((tx) => {
      // Flag if transaction exceeds 2.5x typical average and is above ₹3,000
      if (tx.amount > mean * 2.2 && tx.amount > 3000) {
        const deviationMultiplier = Number((tx.amount / mean).toFixed(1));
        anomalies.push({
          id: `anomaly_${tx.id}`,
          transactionId: tx.id,
          title: tx.title,
          amount: tx.amount,
          date: tx.date,
          category: tx.category,
          typicalAverage: Math.round(mean),
          deviationMultiplier,
          reason: `This transaction is ${deviationMultiplier}x higher than your typical average (₹${Math.round(mean).toLocaleString('en-IN')}) for ${category}.`,
          status: 'PENDING',
        });
      }
    });
  });

  return anomalies;
};

import React, { createContext, useContext, useState, useMemo } from 'react';
import {
  Transaction,
  BankAccount,
  SavingsGoal,
  RecurringPayment,
  AnomalyItem,
  CashFlowForecast,
  FinancialInsight,
} from '../types/finance';
import { DEMO_TRANSACTIONS } from '../data/demoTransactions';
import { DEMO_ACCOUNTS } from '../data/demoAccounts';
import { DEMO_GOALS, DEMO_BADGES, BadgeItem, CURRENT_MISSION, SavingsMission } from '../data/demoGoals';
import {
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetCashFlow,
  calculateCategorySpending,
  CategorySpendingSummary,
} from '../services/financeEngine';
import { detectRecurringPayments, calculateTotalRecurringMonthly } from '../services/recurringDetector';
import { detectUnusualTransactions } from '../services/anomalyDetector';
import { forecastMonthlyBalance } from '../services/forecasting';

interface FinanceContextType {
  transactions: Transaction[];
  accounts: BankAccount[];
  goals: SavingsGoal[];
  badges: BadgeItem[];
  mission: SavingsMission;
  recurring: RecurringPayment[];
  anomalies: AnomalyItem[];
  totalIncome: number;
  totalExpenses: number;
  totalBalance: number;
  netCashFlow: number;
  categorySpending: CategorySpendingSummary[];
  totalRecurringMonthly: number;
  forecast: CashFlowForecast;
  insights: FinancialInsight[];
  isOfflineMode: boolean;
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  importTransactions: (newTransactions: Transaction[], replaceAll?: boolean) => void;
  reviewAnomaly: (anomalyId: string, status: 'CONFIRMED' | 'DISMISSED') => void;
  addGoal: (goal: Omit<SavingsGoal, 'id'>) => void;
  contributeToGoal: (goalId: string, amount: number) => void;
  resetDemoData: () => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>(DEMO_TRANSACTIONS);
  const [accounts, setAccounts] = useState<BankAccount[]>(DEMO_ACCOUNTS);
  const [goals, setGoals] = useState<SavingsGoal[]>(DEMO_GOALS);
  const [badges, setBadges] = useState<BadgeItem[]>(DEMO_BADGES);
  const [mission, setMission] = useState<SavingsMission>(CURRENT_MISSION);
  const isOfflineMode = true;

  // Real-time calculations derived from local transactions
  const totalIncome = useMemo(() => calculateTotalIncome(transactions), [transactions]);
  const totalExpenses = useMemo(() => calculateTotalExpenses(transactions), [transactions]);
  const netCashFlow = useMemo(() => calculateNetCashFlow(transactions), [transactions]);
  
  // Total Balance across accounts
  const totalBalance = useMemo(
    () => accounts.reduce((sum, acc) => sum + acc.balance, 0),
    [accounts]
  );

  const categorySpending = useMemo(
    () => calculateCategorySpending(transactions),
    [transactions]
  );

  const recurring = useMemo(
    () => detectRecurringPayments(transactions),
    [transactions]
  );

  const totalRecurringMonthly = useMemo(
    () => calculateTotalRecurringMonthly(recurring),
    [recurring]
  );

  const [reviewedAnomalies, setReviewedAnomalies] = useState<Record<string, 'CONFIRMED' | 'DISMISSED'>>({});

  const anomalies = useMemo(() => {
    const raw = detectUnusualTransactions(transactions);
    return raw.map((a) => ({
      ...a,
      status: reviewedAnomalies[a.id] || a.status,
    }));
  }, [transactions, reviewedAnomalies]);

  const forecast = useMemo(
    () => forecastMonthlyBalance(transactions, totalBalance),
    [transactions, totalBalance]
  );

  const insights: FinancialInsight[] = useMemo(() => [
    {
      id: 'ins_01',
      type: 'WARNING',
      title: 'Food Spending Increased by 12%',
      description: 'You spent ₹15,870 on dining & deliveries this month, higher than last month’s baseline.',
      category: 'Food',
      impactAmount: 1700,
      dataPointsUsed: ['8 Zomato/Swiggy orders', 'Past 30-day average comparison'],
      actionLabel: 'Review Food Budget',
    },
    {
      id: 'ins_02',
      type: 'INFO',
      title: 'Upcoming Recurring Obligations',
      description: `You have ₹${totalRecurringMonthly.toLocaleString('en-IN')} committed in upcoming bills and subscriptions.`,
      category: 'Bills',
      impactAmount: totalRecurringMonthly,
      dataPointsUsed: ['Rent', 'Broadband', 'Electricity', 'OTT subscriptions'],
      actionLabel: 'View Commitments',
    },
  ], [totalRecurringMonthly]);

  const addTransaction = (newTx: Omit<Transaction, 'id'>) => {
    const created: Transaction = {
      ...newTx,
      id: `tx_user_${Date.now()}`,
    };
    setTransactions((prev) => [created, ...prev]);

    // Update account balance
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === created.accountId) {
          const delta = created.type === 'INCOME' ? created.amount : -created.amount;
          return { ...acc, balance: Math.max(0, acc.balance + delta) };
        }
        return acc;
      })
    );
  };

  const importTransactions = (newTransactions: Transaction[], replaceAll: boolean = false) => {
    if (replaceAll) {
      setTransactions(newTransactions);
    } else {
      setTransactions((prev) => [...newTransactions, ...prev]);
    }

    // Recalculate primary account balance
    const netDelta = newTransactions.reduce(
      (sum, tx) => sum + (tx.type === 'INCOME' ? tx.amount : -tx.amount),
      0
    );

    setAccounts((prev) =>
      prev.map((acc, idx) => {
        if (idx === 0) {
          return { ...acc, balance: Math.max(0, acc.balance + netDelta) };
        }
        return acc;
      })
    );
  };

  const reviewAnomaly = (anomalyId: string, status: 'CONFIRMED' | 'DISMISSED') => {
    setReviewedAnomalies((prev) => ({ ...prev, [anomalyId]: status }));
  };

  const addGoal = (newGoal: Omit<SavingsGoal, 'id'>) => {
    const created: SavingsGoal = {
      ...newGoal,
      id: `goal_${Date.now()}`,
    };
    setGoals((prev) => [...prev, created]);
  };

  const contributeToGoal = (goalId: string, amount: number) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id === goalId) {
          const nextVal = g.currentAmount + amount;
          return {
            ...g,
            currentAmount: nextVal,
            isCompleted: nextVal >= g.targetAmount,
          };
        }
        return g;
      })
    );
  };

  const resetDemoData = () => {
    setTransactions(DEMO_TRANSACTIONS);
    setAccounts(DEMO_ACCOUNTS);
    setGoals(DEMO_GOALS);
    setBadges(DEMO_BADGES);
    setMission(CURRENT_MISSION);
    setReviewedAnomalies({});
  };

  return (
    <FinanceContext.Provider
      value={{
        transactions,
        accounts,
        goals,
        badges,
        mission,
        recurring,
        anomalies,
        totalIncome,
        totalExpenses,
        totalBalance,
        netCashFlow,
        categorySpending,
        totalRecurringMonthly,
        forecast,
        insights,
        isOfflineMode,
        addTransaction,
        importTransactions,
        reviewAnomaly,
        addGoal,
        contributeToGoal,
        resetDemoData,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};

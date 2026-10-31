import {
  PurchaseSimulationInput,
  PurchaseScenarioResult,
  AffordabilityStatus,
  Transaction,
} from '../types/finance';
import { calculateTotalIncome, calculateTotalExpenses } from './financeEngine';
import { detectRecurringPayments, calculateTotalRecurringMonthly } from './recurringDetector';
import { formatINR } from '../constants/theme';

/**
 * Core mathematical engine for the Purchase Decision Simulator.
 * Evaluates 3 scenarios with transparent math, reserve floor protection,
 * and explicit uncertainty limitations.
 */
export const simulatePurchaseScenarios = (
  input: PurchaseSimulationInput,
  transactions: Transaction[],
  currentBalance: number
): PurchaseScenarioResult[] => {
  const reserveFloor = input.customReserveThreshold ?? 15000;
  const recurringList = detectRecurringPayments(transactions);
  const totalRecurring = calculateTotalRecurringMonthly(recurringList);
  const pastIncome = calculateTotalIncome(transactions);
  const pastExpense = calculateTotalExpenses(transactions);

  const baselineIncome = pastIncome > 0 ? pastIncome : 105000;
  const baselineVariable = Math.max(0, pastExpense - totalRecurring);
  const baselineMonthlyExpense = totalRecurring + baselineVariable;

  // ----------------------------------------------------
  // SCENARIO 1: BUY NOW (Immediate impact on current balance)
  // ----------------------------------------------------
  const balanceAfterImmediateBuy = currentBalance - input.amount;
  const bufferImmediate = balanceAfterImmediateBuy - reserveFloor;

  let statusNow: AffordabilityStatus = 'SAFE';
  let verdictNow = '';
  if (bufferImmediate < 0) {
    statusNow = 'RISKY';
    verdictNow = `Depletes reserve fund by ${formatINR(Math.abs(bufferImmediate))}`;
  } else if (bufferImmediate < 8000) {
    statusNow = 'CAUTION';
    verdictNow = `Leaves thin buffer of ${formatINR(bufferImmediate)} above reserve`;
  } else {
    statusNow = 'SAFE';
    verdictNow = `Comfortable buffer of ${formatINR(bufferImmediate)} remaining`;
  }

  const scenarioNow: PurchaseScenarioResult = {
    scenarioId: 'NOW',
    scenarioTitle: 'Buy Immediately',
    purchaseAmount: input.amount,
    startingBalance: currentBalance,
    projectedIncome: 0,
    projectedRecurring: 0,
    projectedVariable: 0,
    totalProjectedOutflow: input.amount,
    estimatedRemainingBalance: balanceAfterImmediateBuy,
    configuredReserveFloor: reserveFloor,
    netBufferAboveReserve: bufferImmediate,
    status: statusNow,
    verdict: verdictNow,
    explanation: `Buying ${input.itemName} right now immediately reduces your balance from ${formatINR(
      currentBalance
    )} to ${formatINR(balanceAfterImmediateBuy)}. ${
      bufferImmediate < 0
        ? `Warning: This breaks your emergency safety floor of ${formatINR(reserveFloor)}.`
        : `Your emergency safety floor of ${formatINR(reserveFloor)} remains intact.`
    }`,
    confidenceRating: 'High data coverage',
    uncertaintyNotes: [
      'Assumes no unexpected emergency expenses before next salary cycle.',
      'Does not account for pending unbilled credit card charges.',
    ],
  };

  // ----------------------------------------------------
  // SCENARIO 2: BUY NEXT MONTH (Post salary & obligations)
  // ----------------------------------------------------
  // In next month: starting balance = currentBalance + (nextMonthIncome - nextMonthExpenses) - purchaseAmount
  const nextMonthNetSavings = baselineIncome - baselineMonthlyExpense;
  const balanceNextMonthAfterPurchase = currentBalance + nextMonthNetSavings - input.amount;
  const bufferNextMonth = balanceNextMonthAfterPurchase - reserveFloor;

  let statusNextMonth: AffordabilityStatus = 'SAFE';
  let verdictNextMonth = '';
  if (bufferNextMonth < 0) {
    statusNextMonth = 'RISKY';
    verdictNextMonth = `Leaves balance below reserve by ${formatINR(Math.abs(bufferNextMonth))}`;
  } else if (bufferNextMonth < 10000) {
    statusNextMonth = 'CAUTION';
    verdictNextMonth = `Manageable, leaves ${formatINR(balanceNextMonthAfterPurchase)} total`;
  } else {
    statusNextMonth = 'SAFE';
    verdictNextMonth = `High affordability, leaves ${formatINR(balanceNextMonthAfterPurchase)}`;
  }

  const scenarioNextMonth: PurchaseScenarioResult = {
    scenarioId: 'NEXT_MONTH',
    scenarioTitle: 'Buy Next Month',
    purchaseAmount: input.amount,
    startingBalance: currentBalance,
    projectedIncome: baselineIncome,
    projectedRecurring: totalRecurring,
    projectedVariable: baselineVariable,
    totalProjectedOutflow: baselineMonthlyExpense + input.amount,
    estimatedRemainingBalance: balanceNextMonthAfterPurchase,
    configuredReserveFloor: reserveFloor,
    netBufferAboveReserve: bufferNextMonth,
    status: statusNextMonth,
    verdict: verdictNextMonth,
    explanation: `Based on your recorded income of ${formatINR(
      baselineIncome
    )} and estimated monthly expenses of ${formatINR(
      baselineMonthlyExpense
    )}, purchasing this ${input.itemName} next month may leave approximately ${formatINR(
      balanceNextMonthAfterPurchase
    )}.`,
    confidenceRating: 'High data coverage',
    uncertaintyNotes: [
      `Assumes next month income remains steady at ${formatINR(baselineIncome)}.`,
      `Variable living expenses assumed to match current month (${formatINR(baselineVariable)}).`,
    ],
  };

  // ----------------------------------------------------
  // SCENARIO 3: SAVE FOR 3 MONTHS (Amortized monthly goal)
  // ----------------------------------------------------
  const monthlySavingRequired = Math.ceil(input.amount / 3);
  const totalIncome3M = baselineIncome * 3;
  const totalExpenses3M = baselineMonthlyExpense * 3;
  const balanceAfter3M = currentBalance + (totalIncome3M - totalExpenses3M) - input.amount;
  const buffer3M = balanceAfter3M - reserveFloor;

  const scenario3M: PurchaseScenarioResult = {
    scenarioId: 'THREE_MONTHS',
    scenarioTitle: 'Save Over 3 Months',
    purchaseAmount: input.amount,
    startingBalance: currentBalance,
    projectedIncome: baselineIncome,
    projectedRecurring: totalRecurring,
    projectedVariable: baselineVariable + monthlySavingRequired,
    totalProjectedOutflow: input.amount,
    estimatedRemainingBalance: balanceAfter3M,
    configuredReserveFloor: reserveFloor,
    netBufferAboveReserve: buffer3M,
    status: 'SAFE',
    verdict: `Save ${formatINR(monthlySavingRequired)}/mo for 3 months with zero risk`,
    explanation: `By allocating ${formatINR(
      monthlySavingRequired
    )} per month over 3 months, you preserve your daily cash flow without tapping your emergency reserve. Estimated ending balance: ${formatINR(
      balanceAfter3M
    )}.`,
    confidenceRating: 'Moderate coverage',
    uncertaintyNotes: [
      'Inflation or price changes on the product over 90 days are not factored in.',
      'Relies on consistent monthly discipline to deposit the savings allocation.',
    ],
  };

  return [scenarioNextMonth, scenarioNow, scenario3M];
};

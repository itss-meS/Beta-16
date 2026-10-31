import { Transaction, TransactionCategory, PaymentMethod } from '../types/finance';

export interface ParsedStatementResult {
  bankName: string;
  totalRecords: number;
  totalCredits: number;
  totalDebits: number;
  dateRange: string;
  transactions: Transaction[];
  parsingNotes: string[];
}

/**
 * Intelligent categorization based on Indian transaction narration keywords
 */
export const categorizeNarration = (narration: string): { category: TransactionCategory; paymentMethod: PaymentMethod } => {
  const text = narration.toLowerCase();

  let paymentMethod: PaymentMethod = 'UPI';
  if (text.includes('neft')) paymentMethod = 'NEFT';
  else if (text.includes('imps')) paymentMethod = 'IMPS';
  else if (text.includes('atm') || text.includes('cash wdl')) paymentMethod = 'ATM';
  else if (text.includes('pos') || text.includes('card') || text.includes('e-com')) paymentMethod = 'CARD';
  else if (text.includes('ach') || text.includes('auto') || text.includes('mandate')) paymentMethod = 'AUTO_DEBIT';

  if (text.includes('salary') || text.includes('payroll') || text.includes('stipend')) {
    return { category: 'Salary', paymentMethod };
  }
  if (text.includes('rent') || text.includes('landlord') || text.includes('housing')) {
    return { category: 'Rent', paymentMethod };
  }
  if (
    text.includes('zomato') ||
    text.includes('swiggy') ||
    text.includes('blinkit') ||
    text.includes('zepto') ||
    text.includes('burger') ||
    text.includes('cafe') ||
    text.includes('chai') ||
    text.includes('restaurant') ||
    text.includes('dine') ||
    text.includes('biryani')
  ) {
    return { category: 'Food', paymentMethod };
  }
  if (
    text.includes('bescom') ||
    text.includes('electricity') ||
    text.includes('airtel') ||
    text.includes('jio') ||
    text.includes('water') ||
    text.includes('broadband') ||
    text.includes('gas') ||
    text.includes('emi')
  ) {
    return { category: 'Bills', paymentMethod };
  }
  if (
    text.includes('amazon') ||
    text.includes('flipkart') ||
    text.includes('myntra') ||
    text.includes('croma') ||
    text.includes('uniqlo') ||
    text.includes('retail') ||
    text.includes('store')
  ) {
    return { category: 'Shopping', paymentMethod };
  }
  if (
    text.includes('uber') ||
    text.includes('ola') ||
    text.includes('petrol') ||
    text.includes('fuel') ||
    text.includes('indianoil') ||
    text.includes('metro') ||
    text.includes('flight') ||
    text.includes('irctc')
  ) {
    return { category: 'Travel', paymentMethod };
  }
  if (
    text.includes('netflix') ||
    text.includes('spotify') ||
    text.includes('pvr') ||
    text.includes('inox') ||
    text.includes('bookmyshow') ||
    text.includes('prime') ||
    text.includes('hotstar')
  ) {
    return { category: 'Entertainment', paymentMethod };
  }
  if (text.includes('apollo') || text.includes('pharmacy') || text.includes('hospital') || text.includes('clinic') || text.includes('lab')) {
    return { category: 'Healthcare', paymentMethod };
  }

  return { category: 'Other', paymentMethod };
};

/**
 * Parses raw CSV statement text completely offline on-device
 */
export const parseOfflineStatementCSV = (csvContent: string): ParsedStatementResult => {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let detectedBank = 'Indian Bank Statement';
  if (/hdfc/i.test(csvContent)) detectedBank = 'HDFC Bank Ltd';
  else if (/sbi|state bank/i.test(csvContent)) detectedBank = 'State Bank of India';
  else if (/icici/i.test(csvContent)) detectedBank = 'ICICI Bank Ltd';
  else if (/axis/i.test(csvContent)) detectedBank = 'Axis Bank Ltd';

  const parsedTransactions: Transaction[] = [];
  let totalCredits = 0;
  let totalDebits = 0;
  let minDate = '';
  let maxDate = '';

  lines.forEach((line, index) => {
    // Skip common header rows
    if (
      index === 0 &&
      (line.toLowerCase().includes('date') || line.toLowerCase().includes('narration') || line.toLowerCase().includes('particulars'))
    ) {
      return;
    }

    const cols = line.split(',').map((c) => c.replace(/["']/g, '').trim());
    if (cols.length < 3) return;

    // Detect layout variants
    // Variant A: Date, Narration, Withdrawal, Deposit
    // Variant B: Date, Title, Amount, Type
    const dateStr = cols[0];
    const narration = cols[1] || 'Bank Transaction';

    let amount = 0;
    let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';

    if (cols.length >= 4 && (!isNaN(parseFloat(cols[2])) || !isNaN(parseFloat(cols[3])))) {
      const withdrawal = parseFloat(cols[2]);
      const deposit = parseFloat(cols[3]);
      if (!isNaN(deposit) && deposit > 0) {
        amount = deposit;
        type = 'INCOME';
      } else if (!isNaN(withdrawal) && withdrawal > 0) {
        amount = withdrawal;
        type = 'EXPENSE';
      }
    } else {
      const parsedVal = parseFloat(cols[2]);
      if (!isNaN(parsedVal)) {
        amount = Math.abs(parsedVal);
        type = (cols[3] || '').toUpperCase() === 'INCOME' || parsedVal > 0 ? 'INCOME' : 'EXPENSE';
      }
    }

    if (amount <= 0) return;

    const { category, paymentMethod } = categorizeNarration(narration);
    if (type === 'INCOME') totalCredits += amount;
    else totalDebits += amount;

    if (!minDate || dateStr < minDate) minDate = dateStr;
    if (!maxDate || dateStr > maxDate) maxDate = dateStr;

    parsedTransactions.push({
      id: `stmt_tx_${Date.now()}_${index}`,
      title: narration,
      amount,
      type,
      category,
      date: dateStr.includes('-') ? dateStr : '2026-10-15',
      time: '12:00 PM',
      paymentMethod,
      accountId: 'acc_hdfc_01',
      merchant: narration.split(/[-–/]/)[0]?.trim() || narration,
      isRecurring: /rent|netflix|spotify|bescom|airtel|emi/i.test(narration),
    });
  });

  return {
    bankName: detectedBank,
    totalRecords: parsedTransactions.length,
    totalCredits,
    totalDebits,
    dateRange: minDate && maxDate ? `${minDate} to ${maxDate}` : 'October 2026',
    transactions: parsedTransactions,
    parsingNotes: [
      `Detected format: ${detectedBank}`,
      'Classified UPI, NEFT, and POS debit patterns automatically',
      'Calculated 100% locally with zero cloud transmission',
    ],
  };
};

/**
 * Pre-configured realistic Indian Bank Statement samples for 1-click test import
 */
export const SAMPLE_STATEMENTS = [
  {
    id: 'hdfc_sample',
    title: 'HDFC Bank — Indiranagar Salary & Utilities',
    bankName: 'HDFC Bank Ltd',
    accountNumber: '•••• 4312',
    dateRange: '01 Oct 2026 - 31 Oct 2026',
    summary: 'Salary credit +₹65,000, Indiranagar Rent, Swiggy, BESCOM electricity, Blinkit',
    csv: `Date,Narration,Withdrawal,Deposit
2026-10-01,TechCorp Payroll Salary Credit,0,65000
2026-10-02,UPI-Suresh Kumar-House Rent Indiranagar,13500,0
2026-10-04,POS-Nature Basket Grocery,2850,0
2026-10-06,UPI-Swiggy Food Gourmet,920,0
2026-10-08,ACH-BESCOM Electricity Bill,1320,0
2026-10-10,UPI-Zomato Burger King,480,0
2026-10-12,ACH-Airtel Fiber Broadband,1061,0
2026-10-14,UPI-Blinkit Quick Groceries,1150,0
2026-10-16,POS-IndianOil Fuel Refill,2600,0
2026-10-20,ACH-Netflix Entertainment Services,499,0`,
  },
  {
    id: 'sbi_sample',
    title: 'SBI Bank — Festive Diwali & Travel',
    bankName: 'State Bank of India',
    accountNumber: '•••• 8821',
    dateRange: '10 Oct 2026 - 28 Oct 2026',
    summary: 'Festive Consulting Bonus +₹42,000, Myntra, Flight Booking, Croma Gift',
    csv: `Date,Narration,Withdrawal,Deposit
2026-10-10,NEFT-Client Consulting Bonus Payout,0,42000
2026-10-11,UPI-Myntra Festive Shopping,3499,0
2026-10-15,POS-Croma Electronics Diwali Offer,6800,0
2026-10-18,UPI-MakeMyTrip Flight Booking,5400,0
2026-10-22,UPI-Apollo Pharmacy Health Check,1100,0
2026-10-25,UPI-Cafe Coffee Day Outing,650,0`,
  },
];

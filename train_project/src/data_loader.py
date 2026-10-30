"""
Data Loader Module for Expense Forecasting & Budget Saving Capacity System
Handles ingestion, cleaning, unicode normalization, transaction categorization,
and aggregation for both budget and transaction datasets.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Tuple, Dict, List

# Define category taxonomy
ESSENTIAL_CATEGORIES = [
    'Rent',
    'Utilities',
    'Subscriptions & Digital',
    'Food & Groceries',
    'Transport',
    'Health & Wellness'
]

DISCRETIONARY_CATEGORIES = [
    'Restaurants & Cafés',
    'Shopping & Clothing',
    'Travel & Holidays',
    'Entertainment & Leisure',
    'Gifts & Social',
    'Education & Self-Dev',
    'Personal Care'
]

SAVINGS_CATEGORY = 'Savings & Investment'


def normalize_category_name(cat: str) -> str:
    """Normalize unicode category strings to maintain strict consistency."""
    if not isinstance(cat, str):
        return cat
    cat = cat.strip()
    # Normalize variants of Cafés / Cafes
    if 'Caf' in cat:
        return 'Restaurants & Cafés'
    return cat


class DataLoader:
    def __init__(self, data_dir: str = 'data'):
        self.data_dir = Path(data_dir)
        self.budget_path = self.data_dir / 'budget.csv'
        self.transactions_path = self.data_dir / 'transactions.csv'
        
    def load_raw_data(self) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Loads raw CSV files with appropriate encoding."""
        if not self.budget_path.exists():
            raise FileNotFoundError(f"Budget file not found at {self.budget_path}")
        if not self.transactions_path.exists():
            raise FileNotFoundError(f"Transactions file not found at {self.transactions_path}")
            
        budget_df = pd.read_csv(self.budget_path, encoding='utf-8')
        tx_df = pd.read_csv(self.transactions_path, encoding='utf-8')
        return budget_df, tx_df
        
    def clean_transactions(self, tx_df: pd.DataFrame) -> pd.DataFrame:
        """Cleans and enriches transaction level data."""
        df = tx_df.copy()
        
        # Parse Dates
        df['Date'] = pd.to_datetime(df['Date'], format='%d/%m/%Y')
        df['Year'] = df['Date'].dt.year
        df['Month_Num'] = df['Date'].dt.month
        df['Month_Str'] = df['Date'].dt.strftime('%b-%y')  # 'Jan-24'
        df['Period'] = df['Date'].dt.to_period('M')
        df['Day'] = df['Date'].dt.day
        df['DayOfWeek'] = df['Date'].dt.day_name()
        df['IsWeekend'] = df['Date'].dt.dayofweek.isin([5, 6]).astype(int)
        df['Quarter'] = df['Date'].dt.quarter
        
        # Normalize category names
        df['Category'] = df['Category'].apply(normalize_category_name)
        
        # Absolute amounts for expenses
        df['AbsAmount'] = df['Amount (TND)'].abs()
        
        # Flag expense nature
        df['IsRecurring_Bool'] = (df['IsRecurring'].astype(str).str.strip().str.lower() == 'yes').astype(int) \
            if 'IsRecurring' in df.columns else (df['Is Recurring'].astype(str).str.strip().str.lower() == 'yes').astype(int)
            
        df['IsEssential'] = df['Category'].isin(ESSENTIAL_CATEGORIES).astype(int)
        df['IsDiscretionary'] = df['Category'].isin(DISCRETIONARY_CATEGORIES).astype(int)
        df['IsSavingsTransfer'] = (df['Category'] == SAVINGS_CATEGORY).astype(int)
        
        return df

    def clean_budget(self, budget_df: pd.DataFrame) -> pd.DataFrame:
        """Cleans budget dataframe and melts to long format."""
        df = budget_df.copy()
        df['Category'] = df['Category'].apply(normalize_category_name)
        
        # Melt columns Jan-24 .. Dec-24 into long format
        month_cols = [c for c in df.columns if c != 'Category']
        long_df = pd.melt(
            df,
            id_vars=['Category'],
            value_vars=month_cols,
            var_name='Month_Str',
            value_name='Budget_Amount'
        )
        
        # Convert Month_Str to datetime period
        long_df['Date'] = pd.to_datetime(long_df['Month_Str'], format='%b-%y')
        long_df['Period'] = long_df['Date'].dt.to_period('M')
        long_df['Month_Num'] = long_df['Date'].dt.month
        long_df['Year'] = long_df['Date'].dt.year
        long_df['Quarter'] = long_df['Date'].dt.quarter
        
        long_df['IsEssential'] = long_df['Category'].isin(ESSENTIAL_CATEGORIES).astype(int)
        long_df['IsDiscretionary'] = long_df['Category'].isin(DISCRETIONARY_CATEGORIES).astype(int)
        long_df['IsSavingsTarget'] = (long_df['Category'] == SAVINGS_CATEGORY).astype(int)
        
        return long_df

    def build_monthly_category_dataset(self) -> pd.DataFrame:
        """
        Builds the unified monthly category-level dataset combining actuals and budget.
        Essential for training category expense forecasting models.
        """
        raw_budget, raw_tx = self.load_raw_data()
        tx = self.clean_transactions(raw_tx)
        budget_long = self.clean_budget(raw_budget)
        
        # Aggregate transactions by Category and Month_Str
        # Only expenses (both consumption and savings transfer)
        exp_tx = tx[tx['Type'] == 'Expense']
        
        monthly_actuals = exp_tx.groupby(['Category', 'Month_Str']).agg(
            Actual_Amount=('AbsAmount', 'sum'),
            Tx_Count=('Transaction ID', 'count'),
            Avg_Tx_Amount=('AbsAmount', 'mean'),
            Recurring_Tx_Count=('IsRecurring_Bool', 'sum'),
            Recurring_Amount=('AbsAmount', lambda x: exp_tx.loc[x.index][exp_tx.loc[x.index, 'IsRecurring_Bool'] == 1]['AbsAmount'].sum())
        ).reset_index()
        
        # Merge with budget targets
        merged = pd.merge(budget_long, monthly_actuals, on=['Category', 'Month_Str'], how='left')
        merged['Actual_Amount'] = merged['Actual_Amount'].fillna(0.0)
        merged['Tx_Count'] = merged['Tx_Count'].fillna(0).astype(int)
        merged['Avg_Tx_Amount'] = merged['Avg_Tx_Amount'].fillna(0.0)
        merged['Recurring_Tx_Count'] = merged['Recurring_Tx_Count'].fillna(0).astype(int)
        merged['Recurring_Amount'] = merged['Recurring_Amount'].fillna(0.0)
        
        # Variance metrics: Over-budget is positive, Under-budget is negative
        merged['Variance_Amount'] = merged['Actual_Amount'] - merged['Budget_Amount']
        merged['Variance_Pct'] = (merged['Variance_Amount'] / merged['Budget_Amount']) * 100.0
        
        merged = merged.sort_values(['Category', 'Date']).reset_index(drop=True)
        return merged

    def build_monthly_financial_summary(self) -> pd.DataFrame:
        """
        Builds aggregated monthly cashflow and saving capacity dataset.
        Combines total Income, Consumption Expenses, Savings Transfers, and Budget.
        """
        raw_budget, raw_tx = self.load_raw_data()
        tx = self.clean_transactions(raw_tx)
        budget_long = self.clean_budget(raw_budget)
        
        periods = sorted(tx['Period'].unique())
        summary_records = []
        
        for p in periods:
            m_str = p.strftime('%b-%y')
            dt = p.to_timestamp()
            
            # Transactions in this month
            df_m = tx[tx['Period'] == p]
            
            # Income components
            df_inc = df_m[df_m['Type'] == 'Income']
            total_income = df_inc['Amount (TND)'].sum()
            salary_income = df_inc[df_inc['Subcategory'] == 'Salary']['Amount (TND)'].sum()
            freelance_income = df_inc[df_inc['Subcategory'] == 'Freelance']['Amount (TND)'].sum()
            bonus_income = df_inc[df_inc['Subcategory'] == 'Bonus']['Amount (TND)'].sum()
            
            # Expense components
            df_exp = df_m[df_m['Type'] == 'Expense']
            total_expense_outflow = df_exp['AbsAmount'].sum()
            
            # Savings transfer (STB transfer in transactions)
            stb_savings = df_exp[df_exp['Category'] == SAVINGS_CATEGORY]['AbsAmount'].sum()
            
            # Pure consumption expense (outflow minus actual savings transfer)
            consumption_expense = total_expense_outflow - stb_savings
            
            # Essential vs Discretionary consumption
            essential_expense = df_exp[df_exp['Category'].isin(ESSENTIAL_CATEGORIES)]['AbsAmount'].sum()
            discretionary_expense = df_exp[df_exp['Category'].isin(DISCRETIONARY_CATEGORIES)]['AbsAmount'].sum()
            
            # Recurring vs Non-recurring
            recurring_expense = df_exp[df_exp['IsRecurring_Bool'] == 1]['AbsAmount'].sum()
            non_recurring_expense = df_exp[df_exp['IsRecurring_Bool'] == 0]['AbsAmount'].sum()
            
            # Budgeted targets for this month
            b_m = budget_long[budget_long['Period'] == p]
            budgeted_total_outflow = b_m['Budget_Amount'].sum()
            budgeted_savings = b_m[b_m['Category'] == SAVINGS_CATEGORY]['Budget_Amount'].sum()
            budgeted_consumption = budgeted_total_outflow - budgeted_savings
            budgeted_essential = b_m[b_m['Category'].isin(ESSENTIAL_CATEGORIES)]['Budget_Amount'].sum()
            budgeted_discretionary = b_m[b_m['Category'].isin(DISCRETIONARY_CATEGORIES)]['Budget_Amount'].sum()
            
            # --- SAVING CAPACITY METRICS ---
            # 1. Actual Net Saving Capacity = Total Income - Consumption Expenses
            actual_saving_capacity = total_income - consumption_expense
            
            # 2. Maximum / Potential Saving Capacity = Total Income - Essential Expenses (if discretionary = 0)
            potential_saving_capacity = total_income - essential_expense
            
            # 3. Budgeted Saving Capacity Target
            budgeted_saving_capacity = budgeted_savings
            
            # 4. Actual Savings Rate (%)
            actual_savings_rate = (actual_saving_capacity / total_income * 100.0) if total_income > 0 else 0.0
            
            # 5. Planned Savings Rate (%)
            planned_savings_rate = (budgeted_savings / total_income * 100.0) if total_income > 0 else 0.0
            
            # 6. Budget Overrun / Underrun in consumption
            consumption_variance = consumption_expense - budgeted_consumption
            
            # 7. Savings Goal Realization (STB Saved vs Budgeted Savings)
            savings_realization_rate = (stb_savings / budgeted_savings * 100.0) if budgeted_savings > 0 else 0.0
            
            summary_records.append({
                'Period': p,
                'Date': dt,
                'Month_Str': m_str,
                'Month_Num': p.month,
                'Quarter': p.quarter,
                'Total_Income': total_income,
                'Salary_Income': salary_income,
                'Freelance_Income': freelance_income,
                'Bonus_Income': bonus_income,
                'Total_Expense_Outflow': total_expense_outflow,
                'Consumption_Expense': consumption_expense,
                'Essential_Expense': essential_expense,
                'Discretionary_Expense': discretionary_expense,
                'STB_Saved': stb_savings,
                'Recurring_Expense': recurring_expense,
                'Non_Recurring_Expense': non_recurring_expense,
                'Budgeted_Total_Outflow': budgeted_total_outflow,
                'Budgeted_Consumption': budgeted_consumption,
                'Budgeted_Savings': budgeted_savings,
                'Budgeted_Essential': budgeted_essential,
                'Budgeted_Discretionary': budgeted_discretionary,
                'Actual_Saving_Capacity': actual_saving_capacity,
                'Potential_Saving_Capacity': potential_saving_capacity,
                'Budgeted_Saving_Capacity': budgeted_saving_capacity,
                'Actual_Savings_Rate_Pct': actual_savings_rate,
                'Planned_Savings_Rate_Pct': planned_savings_rate,
                'Consumption_Variance': consumption_variance,
                'Savings_Realization_Rate_Pct': savings_realization_rate
            })
            
        summary_df = pd.DataFrame(summary_records)
        return summary_df


if __name__ == '__main__':
    loader = DataLoader()
    cat_df = loader.build_monthly_category_dataset()
    print("Monthly Category Dataset Head:")
    print(cat_df[['Category', 'Month_Str', 'Budget_Amount', 'Actual_Amount', 'Variance_Amount']].head(10))
    
    summary_df = loader.build_monthly_financial_summary()
    print("\nMonthly Financial Summary:")
    print(summary_df[['Month_Str', 'Total_Income', 'Consumption_Expense', 'STB_Saved', 'Actual_Saving_Capacity', 'Actual_Savings_Rate_Pct']])

"""
Interactive What-If Scenario Simulator for Budget & Saving Capacity
Allows users to test income modifications, category budget adjustments,
and see immediate impact on projected saving capacity and savings rates.
"""

import argparse
import pandas as pd
from pathlib import Path


def run_scenario(
    month: str,
    extra_income: float = 0.0,
    cut_category: str = None,
    cut_pct: float = 0.0
):
    csv_path = Path('outputs/saving_capacity_forecast_2025.csv')
    cat_path = Path('outputs/category_forecast_2025.csv')
    
    if not csv_path.exists() or not cat_path.exists():
        print("Please run `python train_and_forecast.py` first to generate forecast outputs.")
        return
        
    df_sc = pd.read_csv(csv_path)
    df_cat = pd.read_csv(cat_path)
    
    # Normalize month string (e.g., 'jun-25' -> 'Jun-25')
    month = month.capitalize() if len(month) <= 6 else month
    sub_sc = df_sc[df_sc['Month_Str'].str.lower() == month.lower()]
    
    if sub_sc.empty:
        print(f"Month '{month}' not found. Available months: {', '.join(df_sc['Month_Str'].tolist())}")
        return
        
    row = sub_sc.iloc[0]
    m_str = row['Month_Str']
    
    # Base Values
    base_income = row['Total_Income']
    base_expense = row['Forecasted_Consumption_Expense']
    base_savings = row['Forecasted_Saving_Capacity']
    base_rate = row['Projected_Savings_Rate_Pct']
    
    # Apply modifications
    new_income = base_income + extra_income
    
    # Filter category expenses for this month
    m_cats = df_cat[df_cat['Month_Str'].str.lower() == month.lower()].copy()
    
    expense_reduction = 0.0
    affected_cat_name = None
    if cut_category and cut_pct > 0:
        match = m_cats[m_cats['Category'].str.lower().str.contains(cut_category.lower())]
        if not match.empty:
            affected_cat_name = match.iloc[0]['Category']
            cat_amount = match.iloc[0]['Forecast_Amount']
            expense_reduction = cat_amount * (cut_pct / 100.0)
        else:
            print(f"Warning: Category '{cut_category}' not found in category forecast.")
            
    new_expense = base_expense - expense_reduction
    new_savings = new_income - new_expense
    new_rate = (new_savings / new_income) * 100.0
    savings_delta = new_savings - base_savings
    
    print("\n" + "=" * 65)
    print(f" FINANCIAL SIMULATION: {m_str}")
    print("=" * 65)
    print(f"{'Metric':<32} | {'Baseline':<12} | {'Simulated':<12} | {'Delta'}")
    print("-" * 65)
    print(f"{'Total Income (TND)':<32} | {base_income:>10.2f}   | {new_income:>10.2f}   | {('+' if extra_income>=0 else '')}{extra_income:>8.2f}")
    print(f"{'Consumption Expense (TND)':<32} | {base_expense:>10.2f}   | {new_expense:>10.2f}   | {-expense_reduction:>8.2f}")
    print(f"{'Net Saving Capacity (TND)':<32} | {base_savings:>10.2f}   | {new_savings:>10.2f}   | {('+' if savings_delta>=0 else '')}{savings_delta:>8.2f}")
    print(f"{'Savings Rate (%)':<32} | {base_rate:>9.1f}%   | {new_rate:>9.1f}%   | {('+' if new_rate>=base_rate else '')}{new_rate-base_rate:>7.1f}%")
    print("-" * 65)
    
    if affected_cat_name:
        print(f"Applied Budget Action: Reduced '{affected_cat_name}' by {cut_pct:.1f}% (-{expense_reduction:.2f} TND)")
    if extra_income > 0:
        print(f"Applied Income Action: Added Freelance/Bonus of +{extra_income:.2f} TND")
        
    print(f"Health Status: {'EXCELLENT (>=25%)' if new_rate>=25 else ('HEALTHY (>=20%)' if new_rate>=20 else ('MODERATE (0-20%)' if new_rate>=0 else 'DEFICIT (<0%)'))}")
    print("=" * 65 + "\n")
    
    print(f"Top 5 Category Expenses for {m_str}:")
    top5 = m_cats.sort_values('Forecast_Amount', ascending=False).head(5)
    for _, c_row in top5.iterrows():
        print(f" - {c_row['Category']:<26}: {c_row['Forecast_Amount']:>8.2f} TND (Budget: {c_row['Budget_Amount']:>6.0f} TND)")
    print()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="What-If Scenario Financial Simulator")
    parser.add_argument('--month', type=str, default='Jun-25', help="Month to simulate (e.g. Jun-25, Jul-25)")
    parser.add_argument('--extra-income', type=float, default=0.0, help="Additional income in TND (e.g. freelance or bonus)")
    parser.add_argument('--cut-category', type=str, default=None, help="Category name to reduce (e.g. 'Travel', 'Shopping')")
    parser.add_argument('--cut-pct', type=float, default=0.0, help="Percentage cut to apply (e.g. 30 for 30%)")
    args = parser.parse_args()
    
    run_scenario(
        month=args.month,
        extra_income=args.extra_income,
        cut_category=args.cut_category,
        cut_pct=args.cut_pct
    )

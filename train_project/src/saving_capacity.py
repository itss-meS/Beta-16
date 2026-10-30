"""
Saving Capacity Modeling & Optimization Engine
Calculates net saving capacity, discretionary vs essential expenditure,
budget adherence, scenario simulations, and automated spending cut recommendations.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from pathlib import Path


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


class SavingCapacityEngine:
    def __init__(self, target_savings_rate: float = 20.0):
        """
        target_savings_rate: Target savings percentage of income (default 20%).
        """
        self.target_savings_rate = target_savings_rate

    def project_2025_income(
        self,
        scenario: str = 'expected',
        base_salary: float = 3500.0
    ) -> pd.DataFrame:
        """
        Forecasts 2025 monthly income across salary, freelance, and seasonal bonuses.
        Scenarios: 'conservative', 'expected', 'optimistic'.
        """
        months = list(range(1, 13))
        month_names = ['Jan-25', 'Feb-25', 'Mar-25', 'Apr-25', 'May-25', 'Jun-25',
                       'Jul-25', 'Aug-25', 'Sep-25', 'Oct-25', 'Nov-25', 'Dec-25']
                       
        records = []
        for m_idx, m in enumerate(months):
            m_str = month_names[m_idx]
            salary = base_salary
            
            # Freelance projection based on 2024 cadence
            if scenario == 'conservative':
                freelance = 0.0
                bonus = 3500.0 if m == 12 else 0.0  # Only mandatory 13th month
            elif scenario == 'optimistic':
                # Higher freelance activity and full bonuses
                freelance = 850.0 if m in [2, 3, 4, 6, 8, 9, 10, 11] else 350.0
                bonus = 4200.0 if m == 12 else (500.0 if m in [6, 9] else 0.0)
            else:  # 'expected'
                # Historical average active freelance: ~550 TND in active months
                freelance = 550.0 if m in [2, 3, 4, 6, 8, 9, 10, 11] else 0.0
                # December has 13th month salary (3500) + Q4 bonus (500)
                bonus = 4000.0 if m == 12 else 0.0
                
            total = salary + freelance + bonus
            records.append({
                'Month_Num': m,
                'Month_Str': m_str,
                'Salary': salary,
                'Freelance': freelance,
                'Bonus': bonus,
                'Total_Income': total,
                'Scenario': scenario
            })
            
        return pd.DataFrame(records)

    def compute_saving_capacity_forecast(
        self,
        category_forecast_df: pd.DataFrame,
        income_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Integrates ML expense forecasts with income projections to compute
        projected saving capacity, savings rates, and financial health indicators for 2025.
        """
        # Exclude 'Savings & Investment' row from consumption expenses
        cons_df = category_forecast_df[category_forecast_df['Category'] != SAVINGS_CATEGORY]
        
        # Aggregate monthly expenses
        monthly_exp = cons_df.groupby('Month_Str').agg(
            Forecasted_Consumption_Expense=('Forecast_Amount', 'sum'),
            Lower_CI_Expense=('Lower_CI_90', 'sum'),
            Upper_CI_Expense=('Upper_CI_90', 'sum'),
            Budgeted_Consumption=('Budget_Amount', 'sum'),
            Essential_Expense=('Forecast_Amount', lambda x: cons_df.loc[x.index][cons_df.loc[x.index, 'IsEssential'] == 1]['Forecast_Amount'].sum()),
            Discretionary_Expense=('Forecast_Amount', lambda x: cons_df.loc[x.index][cons_df.loc[x.index, 'IsDiscretionary'] == 1]['Forecast_Amount'].sum())
        ).reset_index()
        
        # Extract planned budget savings target for 2025
        savings_target_df = category_forecast_df[category_forecast_df['Category'] == SAVINGS_CATEGORY].groupby('Month_Str')['Budget_Amount'].sum().reset_index()
        savings_target_df.rename(columns={'Budget_Amount': 'Budgeted_Savings_Target'}, inplace=True)
        
        # Merge with Income
        merged = pd.merge(income_df, monthly_exp, on='Month_Str', how='left')
        merged = pd.merge(merged, savings_target_df, on='Month_Str', how='left')
        merged['Budgeted_Savings_Target'] = merged['Budgeted_Savings_Target'].fillna(250.0)
        
        # --- CORE SAVING CAPACITY METRICS ---
        # 1. Net Saving Capacity (Forecasted)
        merged['Forecasted_Saving_Capacity'] = merged['Total_Income'] - merged['Forecasted_Consumption_Expense']
        
        # 2. Conservative Saving Capacity (Worst case expense)
        merged['Worst_Case_Saving_Capacity'] = merged['Total_Income'] - merged['Upper_CI_Expense']
        
        # 3. Best Case Saving Capacity (Low expense)
        merged['Best_Case_Saving_Capacity'] = merged['Total_Income'] - merged['Lower_CI_Expense']
        
        # 4. Maximum / Potential Saving Capacity (Total Income - Essential Expenses only)
        merged['Potential_Saving_Capacity'] = merged['Total_Income'] - merged['Essential_Expense']
        
        # 5. Projected Savings Rate (%)
        merged['Projected_Savings_Rate_Pct'] = (merged['Forecasted_Saving_Capacity'] / merged['Total_Income']) * 100.0
        
        # 6. Potential Savings Rate (%)
        merged['Potential_Savings_Rate_Pct'] = (merged['Potential_Saving_Capacity'] / merged['Total_Income']) * 100.0
        
        # 7. Saving Capacity Gap vs Budget Target (Surplus or Deficit relative to planned savings)
        merged['Saving_Capacity_Gap'] = merged['Forecasted_Saving_Capacity'] - merged['Budgeted_Savings_Target']
        
        # 8. Cumulative Savings Accumulation
        merged['Cumulative_Projected_Savings'] = merged['Forecasted_Saving_Capacity'].cumsum()
        
        # 9. Financial Health Status
        def evaluate_health(row):
            if row['Forecasted_Saving_Capacity'] < 0:
                return 'CRITICAL DEFICIT (Overspending)'
            elif row['Projected_Savings_Rate_Pct'] >= self.target_savings_rate:
                return 'HEALTHY (Meets Target >= 20%)'
            else:
                return 'MODERATE (Below Target < 20%)'
                
        merged['Health_Status'] = merged.apply(evaluate_health, axis=1)
        merged = merged.sort_values('Month_Num').reset_index(drop=True)
        return merged

    def generate_savings_optimization_plan(
        self,
        category_forecast_df: pd.DataFrame,
        saving_capacity_df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Creates an actionable optimization strategy:
        1. Identifies months with deficits or below target savings.
        2. Proposes specific discretionary cuts to restore positive cashflow
           and guarantee meeting the target savings rate.
        """
        opt_records = []
        actionable_recommendations = []
        
        for idx, row in saving_capacity_df.iterrows():
            m_str = row['Month_Str']
            income = row['Total_Income']
            target_savings = max(income * (self.target_savings_rate / 100.0), row['Budgeted_Savings_Target'])
            curr_savings = row['Forecasted_Saving_Capacity']
            shortfall = target_savings - curr_savings
            
            m_cats = category_forecast_df[
                (category_forecast_df['Month_Str'] == m_str) &
                (category_forecast_df['IsDiscretionary'] == 1)
            ].copy()
            
            total_disc = m_cats['Forecast_Amount'].sum()
            
            if shortfall > 0 and total_disc > 0:
                # Required reduction ratio on discretionary expenses
                reduction_ratio = min(0.40, shortfall / total_disc)  # Cap reduction at 40% to be realistic
                optimized_disc = total_disc * (1.0 - reduction_ratio)
                optimized_savings = curr_savings + (total_disc * reduction_ratio)
                saved_amount = total_disc * reduction_ratio
                
                # Top overspent categories in this month
                top_overspent = m_cats.sort_values('Forecast_Amount', ascending=False)
                for _, cat_row in top_overspent.head(2).iterrows():
                    rec_cut = cat_row['Forecast_Amount'] * reduction_ratio
                    actionable_recommendations.append({
                        'Month': m_str,
                        'Category': cat_row['Category'],
                        'Current_Forecast (TND)': round(cat_row['Forecast_Amount'], 2),
                        'Recommended_Budget (TND)': round(cat_row['Forecast_Amount'] - rec_cut, 2),
                        'Monthly_Savings_Gain (TND)': round(rec_cut, 2),
                        'Reason': f"Reduce discretionary spend by {round(reduction_ratio*100, 1)}% to reach savings goal"
                    })
            else:
                optimized_savings = curr_savings
                saved_amount = 0.0
                
            opt_records.append({
                'Month_Str': m_str,
                'Total_Income': income,
                'Original_Forecast_Expense': row['Forecasted_Consumption_Expense'],
                'Optimized_Expense': row['Forecasted_Consumption_Expense'] - saved_amount,
                'Original_Saving_Capacity': curr_savings,
                'Optimized_Saving_Capacity': optimized_savings,
                'Original_Savings_Rate_Pct': row['Projected_Savings_Rate_Pct'],
                'Optimized_Savings_Rate_Pct': (optimized_savings / income) * 100.0,
                'Savings_Boost (TND)': saved_amount
            })
            
        opt_df = pd.DataFrame(opt_records)
        rec_df = pd.DataFrame(actionable_recommendations)
        return opt_df, rec_df


if __name__ == '__main__':
    from data_loader import DataLoader
    from feature_engineering import FeatureEngineer
    from expense_models import ExpenseForecaster
    
    loader = DataLoader()
    raw_cat_df = loader.build_monthly_category_dataset()
    fe = FeatureEngineer()
    cat_feats = fe.build_category_features(raw_cat_df)
    
    forecaster = ExpenseForecaster()
    forecaster.fit_final_models(cat_feats)
    f_2025 = forecaster.forecast_2025(cat_feats)
    
    sc_engine = SavingCapacityEngine(target_savings_rate=20.0)
    income_2025 = sc_engine.project_2025_income(scenario='expected')
    sc_df = sc_engine.compute_saving_capacity_forecast(f_2025, income_2025)
    
    print("--- 2025 SAVING CAPACITY FORECAST ---")
    print(sc_df[['Month_Str', 'Total_Income', 'Forecasted_Consumption_Expense',
                 'Forecasted_Saving_Capacity', 'Projected_Savings_Rate_Pct', 'Health_Status']].to_string(index=False))
                 
    opt_df, rec_df = sc_engine.generate_savings_optimization_plan(f_2025, sc_df)
    print("\n--- OPTIMIZATION PLAN PREVIEW ---")
    print(opt_df[['Month_Str', 'Original_Saving_Capacity', 'Optimized_Saving_Capacity', 'Optimized_Savings_Rate_Pct']].head(6))
    print("\nTop Actionable Spending Cuts:")
    print(rec_df.head(6).to_string(index=False))

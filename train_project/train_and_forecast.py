"""
Master Pipeline: Expense Forecasting & Budget Saving Capacity Training
Executes end-to-end data processing, feature engineering, model training,
walk-forward validation, 2025 expense forecasting, saving capacity estimation,
and report/dashboard generation.
"""

import sys
import argparse
import pandas as pd
import numpy as np
from pathlib import Path

from src.data_loader import DataLoader
from src.feature_engineering import FeatureEngineer
from src.expense_models import ExpenseForecaster
from src.saving_capacity import SavingCapacityEngine
from src.evaluator import ModelEvaluator
from src.visualizer import FinancialVisualizer


def run_pipeline(
    scenario: str = 'expected',
    target_savings_rate: float = 20.0,
    base_salary: float = 3500.0,
    min_train_months: int = 6
):
    print("=" * 80)
    print(" EXPENSE FORECASTING & BUDGET SAVING CAPACITY MACHINE LEARNING SYSTEM")
    print("=" * 80)
    
    # -------------------------------------------------------------
    # 1. DATA INGESTION & CLEANING
    # -------------------------------------------------------------
    print("\n[Step 1/6] Loading & Preprocessing Historical Datasets...")
    loader = DataLoader(data_dir='data')
    raw_budget, raw_tx = loader.load_raw_data()
    print(f" Loaded raw budget: {raw_budget.shape[0]} categories x {raw_budget.shape[1]-1} months")
    print(f" Loaded raw transactions: {len(raw_tx)} records across 2024")
    
    monthly_cat_df = loader.build_monthly_category_dataset()
    monthly_summary_2024 = loader.build_monthly_financial_summary()
    print(f" Cleaned unified category-month records: {len(monthly_cat_df)}")
    print(f" Total 2024 Income: {monthly_summary_2024['Total_Income'].sum():,.2f} TND")
    print(f" Total 2024 Consumption Outflow: {monthly_summary_2024['Consumption_Expense'].sum():,.2f} TND")
    print(f" Total 2024 Actual Net Savings: {monthly_summary_2024['Actual_Saving_Capacity'].sum():,.2f} TND")
    
    # Save 2024 historical summary
    output_dir = Path('outputs')
    output_dir.mkdir(parents=True, exist_ok=True)
    monthly_summary_2024.to_csv(output_dir / 'budget_vs_actual_2024.csv', index=False)
    
    # -------------------------------------------------------------
    # 2. FEATURE ENGINEERING
    # -------------------------------------------------------------
    print("\n[Step 2/6] Engineering Time-Series Lags, Rolling Stats & Seasonality...")
    fe = FeatureEngineer()
    cat_features = fe.build_category_features(monthly_cat_df)
    print(f" Feature matrix generated: {cat_features.shape[0]} samples x {cat_features.shape[1]} features")
    
    # -------------------------------------------------------------
    # 3. WALK-FORWARD CROSS VALIDATION & BENCHMARKING
    # -------------------------------------------------------------
    print(f"\n[Step 3/6] Running Temporal Walk-Forward Cross Validation (Folds > {min_train_months} months)...")
    forecaster = ExpenseForecaster(models_dir='models')
    val_results = forecaster.walk_forward_validation(cat_features, min_train_months=min_train_months)
    eval_metrics = forecaster.evaluate_models(val_results)
    
    print("\n" + "-" * 75)
    print(" MODEL PERFORMANCE BENCHMARK (OUT-OF-SAMPLE TEST RESULTS)")
    print("-" * 75)
    print(eval_metrics.to_string(index=False))
    print("-" * 75)
    
    eval_metrics.to_csv(output_dir / 'model_evaluation_metrics.csv', index=False)
    
    evaluator = ModelEvaluator(output_dir='outputs')
    cat_breakdown = evaluator.evaluate_category_level_breakdown(val_results, forecaster.model_weights)
    
    # -------------------------------------------------------------
    # 4. FINAL MODEL TRAINING & PERSISTENCE
    # -------------------------------------------------------------
    print("\n[Step 4/6] Fitting Final Production Ensemble on Full Historical Data...")
    forecaster.fit_final_models(cat_features)
    
    # -------------------------------------------------------------
    # 5. EXPENSE & SAVING CAPACITY FORECASTING (2025)
    # -------------------------------------------------------------
    print("\n[Step 5/6] Generating 12-Month Recursive Forecasts for 2025...")
    category_forecast_2025 = forecaster.forecast_2025(cat_features)
    category_forecast_2025.to_csv(output_dir / 'category_forecast_2025.csv', index=False)
    
    # Initialize Saving Capacity Engine
    sc_engine = SavingCapacityEngine(target_savings_rate=target_savings_rate)
    income_2025 = sc_engine.project_2025_income(scenario=scenario, base_salary=base_salary)
    sc_forecast_2025 = sc_engine.compute_saving_capacity_forecast(category_forecast_2025, income_2025)
    sc_forecast_2025.to_csv(output_dir / 'saving_capacity_forecast_2025.csv', index=False)
    
    # Optimization Plan
    opt_df, rec_df = sc_engine.generate_savings_optimization_plan(category_forecast_2025, sc_forecast_2025)
    opt_df.to_csv(output_dir / 'savings_optimization_plan.csv', index=False)
    rec_df.to_csv(output_dir / 'actionable_spending_cuts.csv', index=False)
    
    # Summary of monthly totals for 2025
    monthly_totals_2025 = sc_forecast_2025[[
        'Month_Str', 'Total_Income', 'Forecasted_Consumption_Expense',
        'Lower_CI_Expense', 'Upper_CI_Expense', 'Essential_Expense',
        'Discretionary_Expense', 'Forecasted_Saving_Capacity',
        'Projected_Savings_Rate_Pct', 'Health_Status'
    ]].copy()
    monthly_totals_2025.to_csv(output_dir / 'expense_forecast_2025.csv', index=False)
    
    print("\n" + "-" * 88)
    print(" 2025 MONTHLY SAVING CAPACITY & EXPENSE FORECAST")
    print("-" * 88)
    print(monthly_totals_2025.to_string(index=False))
    print("-" * 88)
    
    total_proj_inc = sc_forecast_2025['Total_Income'].sum()
    total_proj_exp = sc_forecast_2025['Forecasted_Consumption_Expense'].sum()
    total_proj_sav = sc_forecast_2025['Forecasted_Saving_Capacity'].sum()
    avg_proj_sav_rate = (total_proj_sav / total_proj_inc) * 100.0
    
    print(f"\n2025 Executive Projection Summary ({scenario.upper()} scenario):")
    print(f" * Projected Annual Income:             {total_proj_inc:,.2f} TND")
    print(f" * Projected Annual Consumption Expense: {total_proj_exp:,.2f} TND")
    print(f" * Projected Annual Net Saving Capacity: {total_proj_sav:,.2f} TND")
    print(f" * Projected Annual Savings Rate:        {avg_proj_sav_rate:.1f}%")
    
    # -------------------------------------------------------------
    # 6. VISUALIZATION & EXECUTIVE DASHBOARDS
    # -------------------------------------------------------------
    print("\n[Step 6/6] Rendering High-Resolution Charts & Executive Dashboard...")
    vis = FinancialVisualizer(output_dir='outputs')
    p1 = vis.plot_monthly_forecast_overview(monthly_summary_2024, sc_forecast_2025)
    p2 = vis.plot_saving_capacity_dashboard(monthly_summary_2024, sc_forecast_2025)
    p3 = vis.plot_category_forecast_breakdown(category_forecast_2025)
    p4 = vis.generate_full_dashboard(monthly_summary_2024, category_forecast_2025, sc_forecast_2025, opt_df)
    
    print(f" [OK] Generated: {p1}")
    print(f" [OK] Generated: {p2}")
    print(f" [OK] Generated: {p3}")
    print(f" [OK] Generated: {p4}")
    
    print("\n" + "=" * 80)
    print(" ALL TASKS COMPLETED SUCCESSFULLY. ARTIFACTS PERSISTED TO 'outputs/' & 'models/'.")
    print("=" * 80)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Expense Forecasting & Saving Capacity ML Pipeline")
    parser.add_argument('--scenario', type=str, default='expected', choices=['conservative', 'expected', 'optimistic'],
                        help="Income scenario for 2025 (default: expected)")
    parser.add_argument('--savings-rate', type=float, default=20.0,
                        help="Target annual savings rate percentage (default: 20.0)")
    parser.add_argument('--salary', type=float, default=3500.0,
                        help="Baseline monthly salary in TND (default: 3500.0)")
    parser.add_argument('--min-train-months', type=int, default=6,
                        help="Minimum months for initial walk-forward CV fold (default: 6)")
    args = parser.parse_args()
    
    run_pipeline(
        scenario=args.scenario,
        target_savings_rate=args.savings_rate,
        base_salary=args.salary,
        min_train_months=args.min_train_months
    )

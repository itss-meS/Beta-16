"""
Visualizer Module for Expense Forecasting & Budget Saving Capacity System
Generates publication-quality charts, dashboards, and diagnostic plots.
"""

import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import seaborn as sns
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional


class FinancialVisualizer:
    def __init__(self, output_dir: str = 'outputs'):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        # Configure style
        sns.set_theme(style='whitegrid', font='sans-serif')
        plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Arial', 'Helvetica']
        plt.rcParams['axes.edgecolor'] = '#cccccc'
        plt.rcParams['axes.linewidth'] = 0.8

    def plot_monthly_forecast_overview(
        self,
        summary_2024: pd.DataFrame,
        saving_capacity_2025: pd.DataFrame,
        save_name: str = 'expense_forecast_plot.png'
    ) -> Path:
        """
        Plots 24-month timeline (2024 historical actuals + 2025 ML forecasts)
        with income curve and 90% confidence ribbon.
        """
        fig, ax = plt.subplots(figsize=(14, 6), dpi=300)
        
        # Prepare 2024 data
        x_2024 = range(len(summary_2024))
        labels_2024 = summary_2024['Month_Str'].tolist()
        act_exp_2024 = summary_2024['Consumption_Expense'].tolist()
        inc_2024 = summary_2024['Total_Income'].tolist()
        
        # Prepare 2025 data
        x_2025 = range(len(summary_2024), len(summary_2024) + len(saving_capacity_2025))
        labels_2025 = saving_capacity_2025['Month_Str'].tolist()
        pred_exp_2025 = saving_capacity_2025['Forecasted_Consumption_Expense'].tolist()
        lower_ci = saving_capacity_2025['Lower_CI_Expense'].tolist()
        upper_ci = saving_capacity_2025['Upper_CI_Expense'].tolist()
        inc_2025 = saving_capacity_2025['Total_Income'].tolist()
        
        all_x = list(x_2024) + list(x_2025)
        all_labels = labels_2024 + labels_2025
        
        # Plot 2024 Actuals
        ax.plot(x_2024, act_exp_2024, color='#1f77b4', marker='o', linewidth=2.5, label='Historical Expense (2024 Actual)')
        ax.plot(x_2024, inc_2024, color='#2ca02c', linestyle='--', linewidth=1.8, label='Total Income (Actual/Projected)')
        
        # Bridge connecting Dec-24 to Jan-25
        bridge_x = [x_2024[-1], x_2025[0]]
        bridge_y = [act_exp_2024[-1], pred_exp_2025[0]]
        ax.plot(bridge_x, bridge_y, color='#d62728', linestyle=':', linewidth=2)
        
        # Plot 2025 Forecasts
        ax.plot(x_2025, pred_exp_2025, color='#d62728', marker='s', linewidth=2.5, label='ML Forecasted Expense (2025 Ensemble)')
        ax.plot(x_2025, inc_2025, color='#2ca02c', linestyle='--', linewidth=1.8)
        
        # 90% Confidence Interval ribbon
        ax.fill_between(x_2025, lower_ci, upper_ci, color='#d62728', alpha=0.18, label='90% Prediction Interval')
        
        # Mark vertical boundary
        ax.axvline(x=len(x_2024) - 0.5, color='#7f7f7f', linestyle='-', linewidth=1.2, alpha=0.8)
        ax.text(len(x_2024) - 0.3, ax.get_ylim()[1] * 0.92, 'FORECAST HORIZON (2025)', color='#333333', fontweight='bold', fontsize=10)
        
        ax.set_title('Monthly Total Consumption Expense & Income Trajectory (2024 Actuals vs 2025 Forecast)', fontsize=14, fontweight='bold', pad=15)
        ax.set_xlabel('Month', fontsize=11, fontweight='bold')
        ax.set_ylabel('Amount (TND)', fontsize=11, fontweight='bold')
        ax.set_xticks(all_x)
        ax.set_xticklabels(all_labels, rotation=45, ha='right', fontsize=9)
        ax.legend(loc='upper left', frameon=True, framealpha=0.9)
        ax.grid(True, linestyle='--', alpha=0.5)
        
        plt.tight_layout()
        out_path = self.output_dir / save_name
        plt.savefig(out_path)
        plt.close(fig)
        return out_path

    def plot_saving_capacity_dashboard(
        self,
        summary_2024: pd.DataFrame,
        saving_capacity_2025: pd.DataFrame,
        save_name: str = 'saving_capacity_plot.png'
    ) -> Path:
        """
        Plots saving capacity bars (surplus vs deficit) and cumulative savings accumulation.
        """
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 9), dpi=300, sharex=True)
        
        months_2024 = summary_2024['Month_Str'].tolist()
        months_2025 = saving_capacity_2025['Month_Str'].tolist()
        all_months = months_2024 + months_2025
        x_indices = range(len(all_months))
        
        sc_2024 = summary_2024['Actual_Saving_Capacity'].tolist()
        sc_2025 = saving_capacity_2025['Forecasted_Saving_Capacity'].tolist()
        all_sc = sc_2024 + sc_2025
        
        # Colors: Green for surplus, Red for deficit
        bar_colors = ['#2ca02c' if v >= 0 else '#d62728' for v in all_sc]
        
        bars = ax1.bar(x_indices, all_sc, color=bar_colors, width=0.65, edgecolor='#333333', linewidth=0.6, alpha=0.88)
        ax1.axhline(0, color='#333333', linewidth=1.0)
        ax1.axvline(x=len(months_2024) - 0.5, color='#7f7f7f', linestyle='--', linewidth=1.2)
        
        # Annotate values
        for i, v in enumerate(all_sc):
            offset = 120 if v >= 0 else -250
            ax1.text(i, v + offset, f"{int(v)}", ha='center', va='bottom' if v >= 0 else 'top', fontsize=8, fontweight='bold')
            
        ax1.set_title('Monthly Saving Capacity (Surplus vs Deficit in TND)', fontsize=13, fontweight='bold')
        ax1.set_ylabel('Net Saving Capacity (TND)', fontsize=11, fontweight='bold')
        ax1.grid(True, linestyle='--', alpha=0.5)
        
        # Panel 2: Cumulative Savings Growth
        cum_2024 = np.cumsum(summary_2024['STB_Saved'].tolist())
        start_2025_savings = cum_2024[-1]
        cum_2025 = start_2025_savings + np.cumsum([max(0.0, s) for s in sc_2025])
        all_cum = list(cum_2024) + list(cum_2025)
        
        ax2.plot(range(len(months_2024)), cum_2024, color='#1f77b4', marker='o', linewidth=2.5, label='Actual STB Bank Savings (2024)')
        ax2.plot(range(len(months_2024), len(all_months)), cum_2025, color='#2ca02c', marker='s', linestyle='--', linewidth=2.5, label='Projected Cumulative Savings (2025)')
        ax2.axvline(x=len(months_2024) - 0.5, color='#7f7f7f', linestyle='--', linewidth=1.2)
        
        ax2.set_title('Cumulative Savings Growth Trajectory (TND)', fontsize=13, fontweight='bold')
        ax2.set_xlabel('Month', fontsize=11, fontweight='bold')
        ax2.set_ylabel('Cumulative Total (TND)', fontsize=11, fontweight='bold')
        ax2.set_xticks(x_indices)
        ax2.set_xticklabels(all_months, rotation=45, ha='right', fontsize=9)
        ax2.legend(loc='upper left', frameon=True)
        ax2.grid(True, linestyle='--', alpha=0.5)
        
        plt.tight_layout()
        out_path = self.output_dir / save_name
        plt.savefig(out_path)
        plt.close(fig)
        return out_path

    def plot_category_forecast_breakdown(
        self,
        category_forecast_2025: pd.DataFrame,
        save_name: str = 'category_breakdown_plot.png'
    ) -> Path:
        """
        Plots stacked category breakdown across 2025 to visualize expenditure composition.
        """
        # Filter out Savings category to focus on consumption breakdown
        cons_df = category_forecast_2025[category_forecast_2025['Category'] != 'Savings & Investment']
        piv = cons_df.pivot_table(index='Month_Str', columns='Category', values='Forecast_Amount', aggfunc='sum')
        
        months_order = ['Jan-25', 'Feb-25', 'Mar-25', 'Apr-25', 'May-25', 'Jun-25',
                        'Jul-25', 'Aug-25', 'Sep-25', 'Oct-25', 'Nov-25', 'Dec-25']
        piv = piv.reindex(months_order)
        
        fig, ax = plt.subplots(figsize=(14, 7), dpi=300)
        cmap = plt.get_cmap('tab20')
        colors = [cmap(i) for i in np.linspace(0, 1, len(piv.columns))]
        
        piv.plot(kind='bar', stacked=True, ax=ax, color=colors, edgecolor='#ffffff', linewidth=0.5, width=0.7)
        ax.set_title('2025 Forecasted Consumption Expenses by Category (Stacked Breakdown)', fontsize=14, fontweight='bold', pad=15)
        ax.set_xlabel('Month', fontsize=11, fontweight='bold')
        ax.set_ylabel('Total Expense (TND)', fontsize=11, fontweight='bold')
        ax.legend(bbox_to_anchor=(1.02, 1), loc='upper left', title='Expense Category', frameon=True)
        plt.xticks(rotation=45, ha='right')
        ax.grid(True, linestyle='--', alpha=0.5, axis='y')
        
        plt.tight_layout()
        out_path = self.output_dir / save_name
        plt.savefig(out_path)
        plt.close(fig)
        return out_path

    def generate_full_dashboard(
        self,
        summary_2024: pd.DataFrame,
        category_forecast_2025: pd.DataFrame,
        saving_capacity_2025: pd.DataFrame,
        optimization_plan: pd.DataFrame,
        save_name: str = 'visual_dashboard.png'
    ) -> Path:
        """
        Combines key figures into an executive 4-panel financial dashboard.
        """
        fig, axes = plt.subplots(2, 2, figsize=(18, 12), dpi=300)
        
        # 1. Top-Left: Expense & Income Overview
        ax1 = axes[0, 0]
        x_25 = range(len(saving_capacity_2025))
        m_25 = saving_capacity_2025['Month_Str'].tolist()
        ax1.plot(x_25, saving_capacity_2025['Total_Income'], color='#2ca02c', marker='o', linewidth=2.5, label='Income (Projected)')
        ax1.plot(x_25, saving_capacity_2025['Forecasted_Consumption_Expense'], color='#d62728', marker='s', linewidth=2.5, label='Forecasted Expense')
        ax1.fill_between(x_25, saving_capacity_2025['Lower_CI_Expense'], saving_capacity_2025['Upper_CI_Expense'], color='#d62728', alpha=0.2, label='90% Confidence Interval')
        ax1.set_title('2025 Projected Income vs Forecasted Consumption Outflows', fontsize=12, fontweight='bold')
        ax1.set_xticks(x_25)
        ax1.set_xticklabels(m_25, rotation=45, ha='right', fontsize=9)
        ax1.set_ylabel('TND', fontsize=10, fontweight='bold')
        ax1.legend(loc='upper left', fontsize=9)
        ax1.grid(True, linestyle='--', alpha=0.5)
        
        # 2. Top-Right: Savings Rate Trajectory (Original vs Optimized)
        ax2 = axes[0, 1]
        ax2.plot(x_25, saving_capacity_2025['Projected_Savings_Rate_Pct'], color='#e377c2', marker='^', linewidth=2, label='Baseline Forecast Savings Rate (%)')
        ax2.plot(x_25, optimization_plan['Optimized_Savings_Rate_Pct'], color='#1f77b4', marker='o', linewidth=2.5, linestyle='--', label='Optimized Savings Rate (%)')
        ax2.axhline(20.0, color='#2ca02c', linestyle=':', linewidth=2, label='Target Benchmark (20%)')
        ax2.axhline(0.0, color='#d62728', linestyle='-', linewidth=1.2)
        ax2.set_title('Monthly Savings Rate: Forecast vs Budget-Optimized Plan', fontsize=12, fontweight='bold')
        ax2.set_xticks(x_25)
        ax2.set_xticklabels(m_25, rotation=45, ha='right', fontsize=9)
        ax2.set_ylabel('Savings Rate (%)', fontsize=10, fontweight='bold')
        ax2.legend(loc='lower left', fontsize=9)
        ax2.grid(True, linestyle='--', alpha=0.5)
        
        # 3. Bottom-Left: Net Saving Capacity (Bars)
        ax3 = axes[1, 0]
        sc_vals = saving_capacity_2025['Forecasted_Saving_Capacity'].tolist()
        colors = ['#2ca02c' if v >= 0 else '#d62728' for v in sc_vals]
        ax3.bar(x_25, sc_vals, color=colors, width=0.6, edgecolor='#333333', linewidth=0.5)
        ax3.axhline(0, color='#333333', linewidth=1.0)
        ax3.set_title('2025 Monthly Net Saving Capacity (TND)', fontsize=12, fontweight='bold')
        ax3.set_xticks(x_25)
        ax3.set_xticklabels(m_25, rotation=45, ha='right', fontsize=9)
        ax3.set_ylabel('Net Savings (TND)', fontsize=10, fontweight='bold')
        ax3.grid(True, linestyle='--', alpha=0.5)
        
        # 4. Bottom-Right: Essential vs Discretionary Ratio
        ax4 = axes[1, 1]
        ess_vals = saving_capacity_2025['Essential_Expense']
        disc_vals = saving_capacity_2025['Discretionary_Expense']
        ax4.bar(x_25, ess_vals, color='#3b528b', width=0.6, label='Essential (Rent, Utilities, Food, Transit)')
        ax4.bar(x_25, disc_vals, bottom=ess_vals, color='#5dc963', width=0.6, label='Discretionary (Travel, Shopping, Leisure)')
        ax4.set_title('2025 Essential vs Discretionary Expense Distribution', fontsize=12, fontweight='bold')
        ax4.set_xticks(x_25)
        ax4.set_xticklabels(m_25, rotation=45, ha='right', fontsize=9)
        ax4.set_ylabel('Total Expense (TND)', fontsize=10, fontweight='bold')
        ax4.legend(loc='upper left', fontsize=9)
        ax4.grid(True, linestyle='--', alpha=0.5)
        
        plt.suptitle('FINANCIAL FORECASTING & SAVING CAPACITY EXECUTIVE DASHBOARD', fontsize=15, fontweight='bold', y=0.99)
        plt.tight_layout()
        out_path = self.output_dir / save_name
        plt.savefig(out_path)
        plt.close(fig)
        return out_path


if __name__ == '__main__':
    from data_loader import DataLoader
    from feature_engineering import FeatureEngineer
    from expense_models import ExpenseForecaster
    from saving_capacity import SavingCapacityEngine
    
    loader = DataLoader()
    raw_cat_df = loader.build_monthly_category_dataset()
    summary_24 = loader.build_monthly_financial_summary()
    fe = FeatureEngineer()
    cat_feats = fe.build_category_features(raw_cat_df)
    
    forecaster = ExpenseForecaster()
    forecaster.fit_final_models(cat_feats)
    f_2025 = forecaster.forecast_2025(cat_feats)
    
    sc_engine = SavingCapacityEngine(target_savings_rate=20.0)
    income_25 = sc_engine.project_2025_income(scenario='expected')
    sc_2025 = sc_engine.compute_saving_capacity_forecast(f_2025, income_25)
    opt_df, rec_df = sc_engine.generate_savings_optimization_plan(f_2025, sc_2025)
    
    vis = FinancialVisualizer()
    p1 = vis.plot_monthly_forecast_overview(summary_24, sc_2025)
    p2 = vis.plot_saving_capacity_dashboard(summary_24, sc_2025)
    p3 = vis.plot_category_forecast_breakdown(f_2025)
    p4 = vis.generate_full_dashboard(summary_24, f_2025, sc_2025, opt_df)
    
    print(f"Generated all charts successfully:")
    print(f"1. {p1}")
    print(f"2. {p2}")
    print(f"3. {p3}")
    print(f"4. {p4}")

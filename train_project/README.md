# 💰 Expense Forecasting & Budget Saving Capacity ML System

An end-to-end Machine Learning and Econometric Financial Planning system trained on transaction-level cash flows and category-level budget targets.

---

## 📌 Executive Summary & Architecture

The system solves two interconnected financial modeling challenges:
1. **Expense Forecasting (from Transaction Data)**: Predicts upcoming consumption expenditures at both the aggregate monthly level and across all 13 individual spending categories using time-series feature engineering and multi-model ensemble machine learning.
2. **Saving Capacity Modeling (from Budget & Cash Flow)**: Calculates, tracks, and projects **Net Saving Capacity**, **Potential Saving Capacity**, **Budget Adherence**, and **Savings Rates (%)**, providing automated spending-cut recommendations to eliminate deficits and meet targeted savings goals (e.g. $\ge 20\%$).

```
┌────────────────────────┐      ┌───────────────────────────┐
│   budget.csv           │      │   transactions.csv        │
│   (14 Categories x     │      │   (792 Transactions x     │
│    12 Months Targets)  │      │    Income & Expenses)     │
└───────────┬────────────┘      └─────────────┬─────────────┘
            │                                 │
            └───────────────┬─────────────────┘
                            ▼
               ┌────────────────────────┐
               │    src/data_loader     │
               │  - Unicode cleaning    │
               │  - Essential vs Disc.  │
               │  - Financial summary   │
               └────────────┬───────────┘
                            ▼
               ┌────────────────────────┐
               │ src/feature_engineer   │
               │  - Lags (t-1, t-2, t-3)│
               │  - Rolling Mean/Std    │
               │  - Cyclical Sin/Cos    │
               │  - Seasonal Flags      │
               └────────────┬───────────┘
                            ▼
               ┌────────────────────────┐
               │   src/expense_models   │
               │  - Walk-Forward CV     │
               │  - HistGradientBoost   │
               │  - Random Forest       │
               │  - Ridge Regression    │
               │  - Weighted Ensemble   │
               └────────────┬───────────┘
                            ▼
               ┌────────────────────────┐
               │  src/saving_capacity   │
               │  - Income Scenarios    │
               │  - Net Saving Capacity │
               │  - Optimization Engine │
               │  - Runway & Health Idx │
               └────────────┬───────────┘
                            ▼
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌────────────────────────┐             ┌────────────────────────┐
│  outputs/ (Reports)    │             │  outputs/ (Plots)      │
│  - expense_forecast    │             │  - visual_dashboard    │
│  - saving_capacity     │             │  - expense_trajectory  │
│  - optimization_plan   │             │  - category_breakdown  │
│  - evaluation_metrics  │             │  - savings_growth      │
└────────────────────────┘             └────────────────────────┘
```

---

## 📐 Mathematical Framework

### 1. Saving Capacity Formulations
For each month $t$:

$$\text{Net Saving Capacity}_t = \text{Total Income}_t - \text{Consumption Expenses}_t$$

$$\text{Potential Saving Capacity}_t = \text{Total Income}_t - \text{Essential Expenses}_t$$

$$\text{Budgeted Savings Target}_t = \text{Budget}_{\text{Savings \& Investment}, t}$$

$$\text{Savings Rate}_t = \left( \frac{\text{Net Saving Capacity}_t}{\text{Total Income}_t} \right) \times 100\%$$

$$\text{Saving Capacity Gap}_t = \text{Net Saving Capacity}_t - \text{Budgeted Savings Target}_t$$

- **Essential Expenses**: Strictly necessary baseline living costs ($\text{Rent} + \text{Utilities} + \text{Food \& Groceries} + \text{Transport} + \text{Health \& Wellness} + \text{Digital Subscriptions}$).
- **Discretionary Expenses**: Elastic lifestyle spending ($\text{Travel \& Holidays} + \text{Shopping \& Clothing} + \text{Restaurants \& Cafés} + \text{Entertainment} + \text{Gifts \& Social} + \text{Education \& Self-Dev} + \text{Personal Care}$).

### 2. Discretionary Spend Optimization
When a projected month exhibits a deficit ($\text{Net Saving Capacity}_t < 0$) or falls below the target threshold ($\text{Savings Rate}_t < 20\%$), the engine solves:

$$\Delta \text{Savings}_t = \min\left(0.40 \times \text{Discretionary Expense}_t, \, \text{Target Savings}_t - \text{Net Saving Capacity}_t\right)$$

$$\text{Optimized Saving Capacity}_t = \text{Net Saving Capacity}_t + \Delta \text{Savings}_t$$

---

## 🔬 Model Benchmarking & Walk-Forward Validation

To prevent temporal data leakage, all candidate models were evaluated via **Temporal Walk-Forward Cross Validation** across historical months (Months 7 to 12):

| Model | MAE (TND) | RMSE (TND) | WAPE (%) | sMAPE (%) | $R^2$ Score | Mean Bias (TND) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Ensemble (Weighted Blend)** | **90.82** | **214.46** | **28.77%** | **30.19%** | **0.7828** | **-0.38** |
| HistGradientBoosting | 111.68 | 271.65 | 35.38% | 35.87% | 0.6515 | -41.42 |
| Baseline: Budget Target | 114.73 | 377.22 | 36.35% | 30.86% | 0.3279 | -71.98 |
| RandomForest | 140.47 | 392.56 | 44.50% | 31.44% | 0.2722 | +15.64 |
| Ridge Regression | 153.03 | 369.86 | 48.48% | 77.06% | 0.3539 | +38.42 |

> **Key Milestone**: The ML Ensemble reduces forecast error (RMSE) by **43.1%** relative to the naive budget baseline and increases explained variance ($R^2$) from **0.3279 to 0.7828** with zero empirical bias.

---

## 📊 2025 Forecast & Saving Capacity Trajectory

Under the **Expected** economic scenario (3,500 TND Base Salary + historical freelance cadence + Q4 bonus/13th month):

| Month | Total Income (TND) | Forecasted Expense (TND) | Essential (TND) | Discretionary (TND) | Net Saving Capacity (TND) | Savings Rate (%) | Health Status |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Jan-25** | 3,500.00 | 3,171.05 | 1,871.55 | 1,299.50 | **+328.95** | 9.4% | Moderate |
| **Feb-25** | 4,050.00 | 3,110.93 | 1,808.80 | 1,302.13 | **+939.07** | 23.2% | Healthy |
| **Mar-25** | 4,050.00 | 3,064.61 | 1,775.79 | 1,288.82 | **+985.39** | 24.3% | Healthy |
| **Apr-25** | 4,050.00 | 3,897.26 | 2,133.26 | 1,764.00 | **+152.74** | 3.8% | Moderate |
| **May-25** | 3,500.00 | 3,317.57 | 1,672.61 | 1,644.96 | **+182.43** | 5.2% | Moderate |
| **Jun-25** | 4,050.00 | 4,914.16 | 1,690.86 | 3,223.30 | **-864.16** | -21.3% | Deficit Alert |
| **Jul-25** | 3,500.00 | 5,816.95 | 1,834.57 | 3,982.38 | **-2,316.95** | -66.2% | Deficit Alert |
| **Aug-25** | 4,050.00 | 4,018.10 | 1,914.88 | 2,103.22 | **+31.90** | 0.8% | Moderate |
| **Sep-25** | 4,050.00 | 3,795.55 | 1,533.93 | 2,261.62 | **+254.45** | 6.3% | Moderate |
| **Oct-25** | 4,050.00 | 2,992.91 | 1,512.26 | 1,480.65 | **+1,057.09** | 26.1% | Healthy |
| **Nov-25** | 4,050.00 | 3,785.78 | 1,877.68 | 1,908.10 | **+264.22** | 6.5% | Moderate |
| **Dec-25** | 7,500.00 | 4,846.82 | 1,846.88 | 2,999.94 | **+2,653.18** | 35.4% | Healthy |
| **Total** | **50,400.00** | **46,731.69** | **21,473.07** | **25,258.62** | **+3,668.31** | **7.3%** | Positive Surplus |

---

## 🚀 Quickstart & Usage

### 1. Run Complete Training & Forecasting Pipeline
```bash
python train_and_forecast.py --scenario expected --savings-rate 20.0
```
Optional CLI flags:
- `--scenario`: `conservative`, `expected`, `optimistic`
- `--savings-rate`: Target savings percentage (default: `20.0`)
- `--salary`: Baseline monthly salary in TND (default: `3500.0`)
- `--min-train-months`: Minimum initial walk-forward training months (default: `6`)

### 2. Interactive What-If Scenario Simulator
Test custom budget cuts and extra income on any month:
```bash
python run_demo.py --month Jun-25 --cut-category "Travel" --cut-pct 35.0 --extra-income 500
```

---

## 📁 Repository Structure

```
├── data/
│   ├── budget.csv                  # 14 categories x 12 months budget limits
│   └── transactions.csv            # 792 transaction records across 2024
├── models/
│   ├── ensemble_weights.joblib     # Optimized model blending weights
│   ├── histgradientboosting_model.joblib
│   ├── randomforest_model.joblib
│   └── ridge_model.joblib
├── outputs/
│   ├── budget_vs_actual_2024.csv   # Historical financial summary
│   ├── expense_forecast_2025.csv   # Monthly expense & CI totals
│   ├── category_forecast_2025.csv  # 14 categories x 12 months projections
│   ├── saving_capacity_forecast_2025.csv # Projected saving capacity metrics
│   ├── savings_optimization_plan.csv     # Recommended cuts & savings boost
│   ├── actionable_spending_cuts.csv      # Top specific category cuts
│   ├── model_evaluation_metrics.csv      # Out-of-sample benchmark
│   ├── category_performance_breakdown.csv# Predictability tiers
│   ├── visual_dashboard.png        # 4-panel executive dashboard
│   ├── expense_forecast_plot.png   # 24-month trajectory with 90% CI
│   ├── saving_capacity_plot.png    # Surplus/Deficit bars & Cumulative savings
│   └── category_breakdown_plot.png # 2025 stacked category composition
├── src/
│   ├── __init__.py
│   ├── data_loader.py              # Ingestion, cleaning, categorization
│   ├── feature_engineering.py      # Lags, rolling stats, seasonality
│   ├── expense_models.py           # Walk-forward CV & Ensemble ML
│   ├── saving_capacity.py          # Saving capacity & optimization engine
│   ├── evaluator.py                # Diagnostics & benchmark metrics
│   └── visualizer.py               # Publication charts & dashboards
├── train_and_forecast.py           # Master execution script
├── run_demo.py                     # What-if scenario simulator
└── README.md                       # Comprehensive documentation
```

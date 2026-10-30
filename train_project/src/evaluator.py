"""
Evaluator Module for Expense Forecasting & Budget System
Generates comprehensive performance benchmarks, category-level error diagnostics,
and comparative lift analysis relative to budget baselines.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from typing import Dict, Tuple


def calculate_metrics(y_true, y_pred) -> Dict[str, float]:
    """Calculates comprehensive regression error metrics."""
    y_true, y_pred = np.array(y_true, dtype=float), np.array(y_pred, dtype=float)
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    
    # WAPE
    sum_true = np.sum(np.abs(y_true))
    wape = (np.sum(np.abs(y_true - y_pred)) / (sum_true + 1e-6)) * 100.0
    
    # sMAPE
    denom = np.abs(y_true) + np.abs(y_pred) + 1e-6
    smape = np.mean(200.0 * np.abs(y_true - y_pred) / denom)
    
    r2 = r2_score(y_true, y_pred)
    bias = np.mean(y_pred - y_true)
    
    return {
        'MAE (TND)': round(mae, 2),
        'RMSE (TND)': round(rmse, 2),
        'WAPE (%)': round(wape, 2),
        'sMAPE (%)': round(smape, 2),
        'R2 Score': round(r2, 4),
        'Mean Bias (TND)': round(bias, 2)
    }


class ModelEvaluator:
    def __init__(self, output_dir: str = 'outputs'):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def evaluate_category_level_breakdown(self, cv_df: pd.DataFrame, ensemble_weights: Dict[str, float]) -> pd.DataFrame:
        """
        Computes granular error breakdown for each expense category.
        Highlights predictable categories (e.g. Rent, Utilities) vs volatile categories (e.g. Travel).
        """
        # Pivot to get ensemble predictions
        ens_preds = cv_df.pivot_table(index=['Test_Month', 'Month_Str', 'Category', 'Actual', 'Budget'], columns='Model', values='Predicted').reset_index()
        total_w = sum(ensemble_weights.values())
        ens_preds['Predicted_Ensemble'] = sum(ens_preds[m] * (ensemble_weights[m] / total_w) for m in ensemble_weights.keys())
        
        records = []
        for cat in sorted(ens_preds['Category'].unique()):
            sub = ens_preds[ens_preds['Category'] == cat]
            actual = sub['Actual']
            pred = sub['Predicted_Ensemble']
            budget = sub['Budget']
            
            m_ens = calculate_metrics(actual, pred)
            m_bud = calculate_metrics(actual, budget)
            
            imp = round(((m_bud['MAE (TND)'] - m_ens['MAE (TND)']) / m_bud['MAE (TND)']) * 100.0, 1) if m_bud['MAE (TND)'] > 0 else 0.0
            
            records.append({
                'Category': cat,
                'Historical_Mean (TND)': round(actual.mean(), 2),
                'Ensemble_MAE (TND)': m_ens['MAE (TND)'],
                'Ensemble_RMSE (TND)': m_ens['RMSE (TND)'],
                'Ensemble_WAPE (%)': m_ens['WAPE (%)'],
                'Budget_MAE (TND)': m_bud['MAE (TND)'],
                'MAE_Improvement_vs_Budget (%)': imp,
                'Predictability_Tier': 'Very High' if m_ens['WAPE (%)'] < 15.0 else ('High' if m_ens['WAPE (%)'] < 30.0 else 'Volatile/Seasonal')
            })
            
        res_df = pd.DataFrame(records).sort_values('Ensemble_WAPE (%)').reset_index(drop=True)
        res_df.to_csv(self.output_dir / 'category_performance_breakdown.csv', index=False)
        return res_df


if __name__ == '__main__':
    from data_loader import DataLoader
    from feature_engineering import FeatureEngineer
    from expense_models import ExpenseForecaster
    
    loader = DataLoader()
    raw_cat_df = loader.build_monthly_category_dataset()
    fe = FeatureEngineer()
    cat_feats = fe.build_category_features(raw_cat_df)
    
    forecaster = ExpenseForecaster()
    val_results = forecaster.walk_forward_validation(cat_feats, min_train_months=6)
    eval_df = forecaster.evaluate_models(val_results)
    
    evaluator = ModelEvaluator()
    cat_breakdown = evaluator.evaluate_category_level_breakdown(val_results, forecaster.model_weights)
    print("Category Predictability Breakdown:")
    print(cat_breakdown.to_string(index=False))

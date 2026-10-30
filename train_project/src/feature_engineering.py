"""
Feature Engineering Module for Expense Forecasting & Budget Saving Capacity System
Extracts time-series lags, rolling window statistics, calendar/seasonality encodings,
budget interaction terms, and category-specific structural indicators.
"""

import pandas as pd
import numpy as np
from typing import Tuple, List, Dict, Optional


def add_calendar_and_seasonality_features(df: pd.DataFrame) -> pd.DataFrame:
    """Adds cyclical, calendar, and Tunisian holiday/seasonal event indicators."""
    res = df.copy()
    
    # Month number and Quarter
    if 'Month_Num' not in res.columns:
        res['Month_Num'] = res['Date'].dt.month
    if 'Quarter' not in res.columns:
        res['Quarter'] = res['Date'].dt.quarter
        
    # Cyclical Sine/Cosine transformations of month (captures annual cycle continuously)
    res['Sin_Month'] = np.sin(2 * np.pi * res['Month_Num'] / 12.0)
    res['Cos_Month'] = np.cos(2 * np.pi * res['Month_Num'] / 12.0)
    
    # Seasonal indicators
    # Summer holiday season (High travel, outdoor leisure, vacations in Tunisia)
    res['Is_Summer'] = res['Month_Num'].isin([6, 7, 8]).astype(int)
    
    # Year-end & Black Friday shopping season (Nov soldes, Dec holiday celebrations, bonuses)
    res['Is_YearEnd'] = res['Month_Num'].isin([11, 12]).astype(int)
    
    # Ramadan & Aïd season in 2024 (March, April, May - high grocery/social expenses)
    res['Is_Festive_Spring'] = res['Month_Num'].isin([3, 4, 5]).astype(int)
    
    # Back to school season (September - higher education supplies)
    res['Is_BackToSchool'] = (res['Month_Num'] == 9).astype(int)
    
    return res


class FeatureEngineer:
    def __init__(self):
        pass

    def build_category_features(self, monthly_cat_df: pd.DataFrame) -> pd.DataFrame:
        """
        Engineers category-level features with lags, rolling statistics,
        budget ratios, and seasonality.
        """
        df = monthly_cat_df.copy()
        df = df.sort_values(['Category', 'Date']).reset_index(drop=True)
        
        # Calendar & Seasonality
        df = add_calendar_and_seasonality_features(df)
        
        # Calculate category historical recurring ratio
        rec_sum = df.groupby('Category')['Recurring_Amount'].sum()
        act_sum = df.groupby('Category')['Actual_Amount'].sum() + 1e-6
        cat_rec_ratio = (rec_sum / act_sum).to_dict()
        df['Historical_Recurring_Ratio'] = df['Category'].map(cat_rec_ratio).fillna(0.0)
        
        # Lags and Rolling statistics per Category
        grouped = df.groupby('Category')
        
        # Lags for Actual Amount
        df['Actual_Lag1'] = grouped['Actual_Amount'].shift(1)
        df['Actual_Lag2'] = grouped['Actual_Amount'].shift(2)
        df['Actual_Lag3'] = grouped['Actual_Amount'].shift(3)
        
        # Rolling Statistics over past months (excluding current month to prevent leakage)
        # Using shift(1) before rolling
        df['Rolling_Mean_3m'] = grouped['Actual_Amount'].apply(
            lambda s: s.shift(1).rolling(window=3, min_periods=1).mean()
        ).reset_index(level=0, drop=True)
        
        df['Rolling_Std_3m'] = grouped['Actual_Amount'].apply(
            lambda s: s.shift(1).rolling(window=3, min_periods=1).std()
        ).reset_index(level=0, drop=True).fillna(0.0)
        
        df['Rolling_Min_3m'] = grouped['Actual_Amount'].apply(
            lambda s: s.shift(1).rolling(window=3, min_periods=1).min()
        ).reset_index(level=0, drop=True)
        
        df['Rolling_Max_3m'] = grouped['Actual_Amount'].apply(
            lambda s: s.shift(1).rolling(window=3, min_periods=1).max()
        ).reset_index(level=0, drop=True)
        
        # Budget features
        df['Budget_Lag1'] = grouped['Budget_Amount'].shift(1)
        df['Budget_Diff'] = df['Budget_Amount'] - df['Budget_Lag1']
        df['Budget_Ratio'] = df['Budget_Amount'] / (df['Budget_Lag1'] + 1e-6)
        
        # Prior month variance (Did user overspend or underspend budget last month?)
        df['Variance_Lag1'] = df['Actual_Lag1'] - df['Budget_Lag1']
        
        # Fill missing early lags with initial values (e.g. Month 1 lags filled with Budget)
        df['Actual_Lag1'] = df['Actual_Lag1'].fillna(df['Budget_Amount'])
        df['Actual_Lag2'] = df['Actual_Lag2'].fillna(df['Actual_Lag1'])
        df['Actual_Lag3'] = df['Actual_Lag3'].fillna(df['Actual_Lag2'])
        df['Rolling_Mean_3m'] = df['Rolling_Mean_3m'].fillna(df['Budget_Amount'])
        df['Rolling_Min_3m'] = df['Rolling_Min_3m'].fillna(df['Budget_Amount'])
        df['Rolling_Max_3m'] = df['Rolling_Max_3m'].fillna(df['Budget_Amount'])
        df['Budget_Lag1'] = df['Budget_Lag1'].fillna(df['Budget_Amount'])
        df['Budget_Diff'] = df['Budget_Diff'].fillna(0.0)
        df['Budget_Ratio'] = df['Budget_Ratio'].fillna(1.0)
        df['Variance_Lag1'] = df['Variance_Lag1'].fillna(0.0)
        
        return df

    def build_monthly_total_features(self, summary_df: pd.DataFrame) -> pd.DataFrame:
        """
        Engineers aggregate monthly features for total expense forecasting and saving capacity.
        """
        df = summary_df.copy()
        df = df.sort_values('Date').reset_index(drop=True)
        df = add_calendar_and_seasonality_features(df)
        
        # Expense Lags
        df['Exp_Lag1'] = df['Consumption_Expense'].shift(1)
        df['Exp_Lag2'] = df['Consumption_Expense'].shift(2)
        
        # Rolling stats
        df['Exp_Rolling_Mean_3m'] = df['Consumption_Expense'].shift(1).rolling(window=3, min_periods=1).mean()
        df['Exp_Rolling_Std_3m'] = df['Consumption_Expense'].shift(1).rolling(window=3, min_periods=1).std().fillna(0.0)
        
        # Income Lags
        df['Income_Lag1'] = df['Total_Income'].shift(1)
        
        # Budget Totals
        df['Budget_Consumption_Diff'] = df['Budgeted_Consumption'] - df['Budgeted_Consumption'].shift(1)
        
        # Fill NA for month 1
        df['Exp_Lag1'] = df['Exp_Lag1'].fillna(df['Budgeted_Consumption'])
        df['Exp_Lag2'] = df['Exp_Lag2'].fillna(df['Exp_Lag1'])
        df['Exp_Rolling_Mean_3m'] = df['Exp_Rolling_Mean_3m'].fillna(df['Budgeted_Consumption'])
        df['Income_Lag1'] = df['Income_Lag1'].fillna(df['Total_Income'])
        df['Budget_Consumption_Diff'] = df['Budget_Consumption_Diff'].fillna(0.0)
        
        return df


if __name__ == '__main__':
    from data_loader import DataLoader
    loader = DataLoader()
    cat_df = loader.build_monthly_category_dataset()
    fe = FeatureEngineer()
    cat_feats = fe.build_category_features(cat_df)
    print("Features shape:", cat_feats.shape)
    print(cat_feats[['Category', 'Month_Str', 'Actual_Amount', 'Budget_Amount', 'Actual_Lag1', 'Rolling_Mean_3m', 'Is_Summer']].head(8))

"""
Main Training & Forecasting Entry Point
Run this script to train the Machine Learning expense models on the transactions,
compute saving capacity from budget & cash flows, and generate forecasts & PDF report.

Usage:
    python train.py
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from train_and_forecast import run_pipeline
from generate_pdf_report import build_pdf_report


def main():
    print("\n" + "=" * 80)
    print("  EXPENSE FORECASTING & BUDGET SAVING CAPACITY ML SYSTEM")
    print("  TRAINING FROM HISTORICAL TRANSACTIONS & BUDGET DATA")
    print("=" * 80 + "\n")
    
    # 1. Run full training, validation, forecasting and visualization
    run_pipeline(
        scenario='expected',
        target_savings_rate=20.0,
        base_salary=3500.0,
        min_train_months=6
    )
    
    # 2. Build the executive PDF report
    print("\n[Step 7/7] Generating Executive PDF Report...")
    pdf_path = build_pdf_report('financial_forecasting_report.pdf')
    print(f" PDF Report Generated: {pdf_path.resolve()}\n")
    
    print("=" * 80)
    print("  TRAINING COMPLETE! ALL MODELS, FORECASTS, AND PDF READY.")
    print("  - Models: models/")
    print("  - Forecasts & Charts: outputs/")
    print("  - PDF Report: outputs/financial_forecasting_report.pdf")
    print("=" * 80 + "\n")


if __name__ == '__main__':
    main()

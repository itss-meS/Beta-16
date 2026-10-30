@echo off
title Train Expense Forecasting and Saving Capacity Model
echo ===============================================================================
echo     EXPENSE FORECASTING & BUDGET SAVING CAPACITY MACHINE LEARNING SYSTEM
echo ===============================================================================
echo.
echo Starting training on transactions and budget data...
python train.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Training encountered an error. Please ensure Python is installed.
    pause
    exit /b %errorlevel%
)
echo.
echo ===============================================================================
echo Training and forecasting completed successfully!
echo - Forecasts and Visuals: outputs\
echo - Executive PDF Report:  outputs\financial_forecasting_report.pdf
echo - Saved ML Models:       models\
echo ===============================================================================
echo.
pause

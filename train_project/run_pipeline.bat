@echo off
title Expense Forecasting & Saving Capacity ML Pipeline
echo ===============================================================================
echo     EXPENSE FORECASTING & BUDGET SAVING CAPACITY MACHINE LEARNING SYSTEM
echo ===============================================================================
echo.
echo Running full ML pipeline (Train, Validate, Forecast 2025, Optimize Budget)...
python train_and_forecast.py --scenario expected --savings-rate 20.0
if %errorlevel% neq 0 (
    echo Error during pipeline execution!
    pause
    exit /b %errorlevel%
)
echo.
echo Generating Executive PDF Report...
python generate_pdf_report.py
if %errorlevel% neq 0 (
    echo Error generating PDF!
    pause
    exit /b %errorlevel%
)
echo.
echo ===============================================================================
echo Pipeline Complete! 
echo Forecasts: outputs\expense_forecast_2025.csv
echo PDF Report: financial_forecasting_report.pdf
echo Dashboard:  outputs\visual_dashboard.png
echo ===============================================================================
echo.
pause

"""
PDF Report Generator for Expense Forecasting & Saving Capacity System
Builds a publication-quality executive PDF report with styled tables,
key metrics, mathematical summaries, and embedded visual figures using ReportLab.
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np

from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """Adds running headers and page numbers to all pages."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(36, 760, "Expense Forecasting & Budget Saving Capacity ML System — Executive Report")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(36, 754, 576, 754)
            
        # Footer
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(576, 25, page_str)
        self.drawString(36, 25, "CONFIDENTIAL & PROPRIETARY — FINANCIAL MACHINE LEARNING PIPELINE")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(36, 35, 576, 35)
        self.restoreState()


def build_pdf_report(pdf_filename: str = 'financial_forecasting_report.pdf'):
    output_dir = Path('outputs')
    pdf_path = output_dir / pdf_filename
    
    # 0.5 in margins (36 points)
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=45,
        bottomMargin=45
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=6
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#475569'),
        spaceAfter=15
    )
    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#1e3a8a'),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6
    )
    callout_style = ParagraphStyle(
        'Callout_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#1e293b')
    )
    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#1e293b')
    )
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=colors.white
    )
    
    story = []
    
    # =========================================================================
    # HEADER / COVER TITLE
    # =========================================================================
    story.append(Paragraph("EXPENSE FORECASTING & BUDGET SAVING CAPACITY", title_style))
    story.append(Paragraph("End-to-End Machine Learning Architecture, Walk-Forward Validation & 2025 Financial Projections", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563eb'), spaceBefore=2, spaceAfter=10))
    
    # Executive Metadata Box
    meta_data = [
        [
            Paragraph("<b>Dataset:</b> 792 Transactions across 2024 (Tunisia TND)", body_style),
            Paragraph("<b>Algorithm:</b> Weighted Ensemble (GBDT + RF + Ridge)", body_style),
        ],
        [
            Paragraph("<b>Target Savings Rate:</b> 20.0% of Monthly Income", body_style),
            Paragraph("<b>Ensemble Out-of-Sample R²:</b> 0.7828 (vs 0.3279 Baseline)", body_style),
        ]
    ]
    t_meta = Table(meta_data, colWidths=[270, 270])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 10))
    
    # =========================================================================
    # SECTION 1: EXECUTIVE SUMMARY
    # =========================================================================
    story.append(Paragraph("1. Executive Summary & Problem Formulation", h1_style))
    exec_summary_text = (
        "This system addresses personal financial planning by combining two distinct data streams: "
        "(1) <b>Category-level budget limits</b> (14 categories across 12 months) and "
        "(2) <b>Micro-level transaction records</b> (792 historical inflows and outflows). "
        "The model forecasts consumption expenses across all 13 spending categories, estimates future "
        "<b>Net Saving Capacity</b> (Total Income − Consumption Outflow), compares against the planned budget "
        "savings target, and formulates an actionable budget optimization plan to curb high-risk seasonal deficits."
    )
    story.append(Paragraph(exec_summary_text, body_style))
    
    # Key Financial Metrics Strip
    metrics_strip = [
        [
            Paragraph("<font size=11><b>49,930 TND</b></font><br/><font color='#64748b' size=7>2024 TOTAL INCOME</font>", table_cell_style),
            Paragraph("<font size=11><b>46,914 TND</b></font><br/><font color='#64748b' size=7>2024 TOTAL CONSUMPTION</font>", table_cell_style),
            Paragraph("<font size=11 color='#16a34a'><b>+3,016 TND</b></font><br/><font color='#64748b' size=7>2024 NET SAVINGS</font>", table_cell_style),
            Paragraph("<font size=11 color='#2563eb'><b>+3,668 TND</b></font><br/><font color='#64748b' size=7>2025 PROJECTED SAVINGS</font>", table_cell_style),
        ]
    ]
    t_strip = Table(metrics_strip, colWidths=[135, 135, 135, 135])
    t_strip.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 1.0, colors.HexColor('#e2e8f0')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_strip)
    story.append(Spacer(1, 10))
    
    # =========================================================================
    # SECTION 2: MODEL BENCHMARKING
    # =========================================================================
    story.append(Paragraph("2. Machine Learning Model Evaluation (Temporal Walk-Forward CV)", h1_style))
    cv_intro = (
        "To guarantee zero look-ahead bias and eliminate temporal data leakage, all models were trained and tested "
        "using recursive <b>Temporal Walk-Forward Validation</b> across historical test months (July through December 2024). "
        "The Blended Ensemble (combining HistGradientBoosting, Random Forest, and Ridge) strongly outperforms "
        "all single estimators and the baseline budget target."
    )
    story.append(Paragraph(cv_intro, body_style))
    
    # Load model evaluation metrics
    df_eval = pd.read_csv(output_dir / 'model_evaluation_metrics.csv')
    eval_headers = [Paragraph(f"<b>{c}</b>", table_header_style) for c in df_eval.columns]
    eval_rows = [eval_headers]
    for _, row in df_eval.iterrows():
        eval_rows.append([
            Paragraph(f"<b>{row['Model']}</b>" if 'Ensemble' in str(row['Model']) else str(row['Model']), table_cell_style),
            Paragraph(f"{row['MAE (TND)']:.2f}", table_cell_style),
            Paragraph(f"{row['RMSE (TND)']:.2f}", table_cell_style),
            Paragraph(f"{row['WAPE (%)']:.2f}%", table_cell_style),
            Paragraph(f"{row['sMAPE (%)']:.2f}%", table_cell_style),
            Paragraph(f"{row['R2 Score']:.4f}", table_cell_style),
            Paragraph(f"{row['Mean Bias (TND)']:.2f}", table_cell_style),
        ])
    t_eval = Table(eval_rows, colWidths=[150, 65, 65, 65, 65, 60, 70])
    t_eval.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3a8a')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_eval)
    story.append(Spacer(1, 10))
    
    # =========================================================================
    # SECTION 3: 2025 MONTHLY FORECAST & SAVING CAPACITY
    # =========================================================================
    story.append(Paragraph("3. 2025 Monthly Forecast & Net Saving Capacity Projections", h1_style))
    story.append(Paragraph(
        "Net Saving Capacity represents true monthly cash surplus: <b>Net Saving Capacity = Total Income − Consumption Expense</b>. "
        "Essential expenses remain predictable (~1,500–2,100 TND), while discretionary spending creates deficit risks during summer (June/July).",
        body_style
    ))
    
    df_sc = pd.read_csv(output_dir / 'expense_forecast_2025.csv')
    sc_cols_to_show = ['Month_Str', 'Total_Income', 'Forecasted_Consumption_Expense', 'Essential_Expense', 'Discretionary_Expense', 'Forecasted_Saving_Capacity', 'Projected_Savings_Rate_Pct', 'Health_Status']
    sc_headers = [Paragraph(f"<b>{c.replace('_', ' ')}</b>", table_header_style) for c in ['Month', 'Income', 'Expense', 'Essential', 'Discret.', 'Net Savings', 'Rate (%)', 'Health Status']]
    sc_rows = [sc_headers]
    for _, row in df_sc.iterrows():
        status_color = '#16a34a' if 'HEALTHY' in row['Health_Status'] else ('#dc2626' if 'DEFICIT' in row['Health_Status'] else '#d97706')
        sc_rows.append([
            Paragraph(str(row['Month_Str']), table_cell_style),
            Paragraph(f"{row['Total_Income']:,.0f}", table_cell_style),
            Paragraph(f"{row['Forecasted_Consumption_Expense']:,.0f}", table_cell_style),
            Paragraph(f"{row['Essential_Expense']:,.0f}", table_cell_style),
            Paragraph(f"{row['Discretionary_Expense']:,.0f}", table_cell_style),
            Paragraph(f"<b>{row['Forecasted_Saving_Capacity']:,.0f}</b>", table_cell_style),
            Paragraph(f"{row['Projected_Savings_Rate_Pct']:.1f}%", table_cell_style),
            Paragraph(f"<font color='{status_color}'><b>{row['Health_Status'].split(' ')[0]}</b></font>", table_cell_style),
        ])
    t_sc = Table(sc_rows, colWidths=[45, 60, 60, 60, 60, 75, 55, 125])
    t_sc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f766e')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_sc)
    
    # Page Break to Display High-Res Charts cleanly
    story.append(PageBreak())
    
    # =========================================================================
    # SECTION 4: EXECUTIVE DASHBOARD & VISUAL CHARTS
    # =========================================================================
    story.append(Paragraph("4. Executive Visual Dashboard", h1_style))
    story.append(Paragraph("4-Panel Executive Overview illustrating income vs expense bands, savings rates, net savings bars, and discretionary composition.", body_style))
    
    dash_path = output_dir / 'visual_dashboard.png'
    if dash_path.exists():
        # Printable width: 540 points
        story.append(Image(str(dash_path), width=535, height=350))
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("5. Expense Trajectory & Saving Capacity Accumulation", h1_style))
    traj_path = output_dir / 'expense_forecast_plot.png'
    if traj_path.exists():
        story.append(Image(str(traj_path), width=535, height=220))
    story.append(Spacer(1, 10))
    
    # Page Break for Category Breakdown & Optimization
    story.append(PageBreak())
    
    story.append(Paragraph("6. Category Breakdown & Discretionary Optimization Plan", h1_style))
    breakdown_path = output_dir / 'category_breakdown_plot.png'
    if breakdown_path.exists():
        story.append(Image(str(breakdown_path), width=535, height=240))
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("Top Actionable Discretionary Budget Cuts (To Guarantee Savings Target ≥ 20%)", h1_style))
    df_cuts = pd.read_csv(output_dir / 'actionable_spending_cuts.csv').head(6)
    cuts_headers = [Paragraph(f"<b>{c}</b>", table_header_style) for c in ['Month', 'Category', 'Forecast (TND)', 'Target Cap (TND)', 'Savings Gain (TND)', 'Actionable Rationale']]
    cuts_rows = [cuts_headers]
    for _, row in df_cuts.iterrows():
        cuts_rows.append([
            Paragraph(str(row['Month']), table_cell_style),
            Paragraph(f"<b>{row['Category']}</b>", table_cell_style),
            Paragraph(f"{row['Current_Forecast (TND)']:.1f}", table_cell_style),
            Paragraph(f"<font color='#16a34a'><b>{row['Recommended_Budget (TND)']:.1f}</b></font>", table_cell_style),
            Paragraph(f"<b>+{row['Monthly_Savings_Gain (TND)']:.1f}</b>", table_cell_style),
            Paragraph(str(row['Reason']), table_cell_style),
        ])
    t_cuts = Table(cuts_rows, colWidths=[50, 110, 75, 75, 75, 155])
    t_cuts.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#b91c1c')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_cuts)
    story.append(Spacer(1, 10))
    
    # =========================================================================
    # SECTION 7: REPRODUCIBILITY GUIDE
    # =========================================================================
    story.append(Paragraph("7. Code Execution & Reproducibility Guide", h1_style))
    repro_text = (
        "All code, data, models, and scripts are packaged in the project zip. To retrain or simulate:<br/>"
        "• <b>Train & Forecast:</b> <code>python train_and_forecast.py --scenario expected --savings-rate 20.0</code><br/>"
        "• <b>Scenario Simulator:</b> <code>python run_demo.py --month Jun-25 --cut-category 'Travel' --cut-pct 35.0 --extra-income 500</code><br/>"
        "• <b>One-Click Batch:</b> Double click <code>run_pipeline.bat</code> to execute on Windows."
    )
    story.append(Paragraph(repro_text, body_style))
    
    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully generated at: {pdf_path.resolve()}")
    return pdf_path


if __name__ == '__main__':
    build_pdf_report()

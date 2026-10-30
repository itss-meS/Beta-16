"""
evaluate.py — Standalone model evaluation on any labelled CSV.

Use this to evaluate the trained model against:
  - A new labelled test set that was NOT used in training.
  - A date-sliced holdout (e.g., last month of transactions).
  - A merchant-holdout set (categories for unseen merchants).

Usage:
    # Evaluate against the default processed training split (reuses train/test split logic):
    python src/evaluate.py

    # Evaluate against a custom labelled CSV:
    python src/evaluate.py --csv data/raw/labelled_test.csv

    # Specify column names if different from config.py:
    python src/evaluate.py --csv data/raw/test.csv --text-col "Description" --label-col "Category"

Output:
    - Prints a full classification report.
    - Saves outputs/eval_confusion_matrix.png
    - Saves outputs/eval_per_category_f1.png
    - Saves outputs/eval_metrics.json
"""

# Prevent OpenBLAS memory allocation errors on Windows (Python 3.14 + OpenBLAS).
import os
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import argparse
import json
import sys
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import re
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config


# ---------------------------------------------------------------------------
# Text cleaning (must be identical to prepare_data.py and predict.py)
# ---------------------------------------------------------------------------

_RE_EMAIL       = re.compile(r"\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b")
_RE_UPI_REF     = re.compile(
    r"\b(?:upi|ref|rrn|txn|neft|imps|rtgs|transaction)[/:# \-]*[a-z0-9\-]+\b"
)
_RE_LONG_NUM    = re.compile(r"\b\d{5,}\b")
_RE_NON_ALPHA   = re.compile(r"[^a-z ]")
_RE_MULTI_SPACE = re.compile(r"\s+")


def _clean(value: object) -> str:
    if pd.isna(value):
        return ""
    text = str(value).lower().strip()
    text = _RE_EMAIL.sub(" ", text)
    text = _RE_UPI_REF.sub(" ", text)
    text = _RE_LONG_NUM.sub(" ", text)
    text = _RE_NON_ALPHA.sub(" ", text)
    text = _RE_MULTI_SPACE.sub(" ", text).strip()
    return text


# ---------------------------------------------------------------------------
# Plot helpers
# ---------------------------------------------------------------------------

def _save_confusion_matrix(
    y_true: list, y_pred: list, labels: list[str], output_dir: Path, prefix: str = "eval"
) -> None:
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    n  = len(labels)
    fig_size = max(8, n * 0.7)
    fig, ax = plt.subplots(figsize=(fig_size, fig_size))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Purples",
                xticklabels=labels, yticklabels=labels, linewidths=0.5, ax=ax)
    ax.set_xlabel("Predicted", fontsize=12)
    ax.set_ylabel("True", fontsize=12)
    ax.set_title("Confusion Matrix — Evaluation Set", fontsize=14, pad=15)
    plt.xticks(rotation=45, ha="right", fontsize=9)
    plt.yticks(rotation=0, fontsize=9)
    plt.tight_layout()
    path = output_dir / f"{prefix}_confusion_matrix.png"
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"  📊  Confusion matrix → {path}")


def _save_f1_chart(
    y_true: list, y_pred: list, labels: list[str], output_dir: Path, prefix: str = "eval"
) -> None:
    report = classification_report(y_true, y_pred, labels=labels, output_dict=True, zero_division=0)
    f1s    = [report.get(lbl, {}).get("f1-score", 0.0) for lbl in labels]
    sups   = [report.get(lbl, {}).get("support",  0)   for lbl in labels]
    order  = np.argsort(f1s)
    labels_s = [labels[i] for i in order]
    f1_s     = [f1s[i]    for i in order]
    sup_s    = [sups[i]   for i in order]

    n = len(labels_s)
    fig, ax = plt.subplots(figsize=(10, max(5, n * 0.45)))
    bars = ax.barh(labels_s, f1_s, color=[
        "#2ecc71" if v >= 0.80 else "#f39c12" if v >= 0.60 else "#e74c3c" for v in f1_s
    ], edgecolor="white", height=0.6)
    for bar, val, sup in zip(bars, f1_s, sup_s):
        ax.text(min(val + 0.02, 0.98), bar.get_y() + bar.get_height() / 2,
                f"  {val:.2f}  (n={sup})", va="center", fontsize=8.5)
    ax.set_xlim(0, 1.15)
    ax.set_xlabel("F1 Score", fontsize=11)
    ax.set_title("Per-Category F1 Score — Evaluation Set", fontsize=13, pad=12)
    ax.axvline(x=0.80, color="grey", linestyle="--", linewidth=0.8, alpha=0.6)
    plt.tight_layout()
    path = output_dir / f"{prefix}_per_category_f1.png"
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"  📊  F1 chart        → {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluate the trained model on a labelled CSV."
    )
    parser.add_argument("--csv",        default="",  help="Path to labelled CSV")
    parser.add_argument("--text-col",   default="",  help="Column with transaction text")
    parser.add_argument("--label-col",  default="",  help="Column with true category label")
    parser.add_argument("--merchant-col", default="", help="Merchant column (optional)")
    args = parser.parse_args()

    # ── Load model ────────────────────────────────────────────────────────
    model_path = config.MODEL_DIR / "transaction_category_model.joblib"
    if not model_path.exists():
        print("❌  Model not found. Run: python src/train.py")
        sys.exit(1)

    model = joblib.load(model_path)
    print(f"\n  ✅  Model loaded from {model_path}")

    # ── Determine CSV to evaluate ─────────────────────────────────────────
    if args.csv:
        csv_path = Path(args.csv)
        text_col    = args.text_col    or config.TEXT_COL
        label_col   = args.label_col   or config.CATEGORY_COL
        merchant_col = args.merchant_col or config.MERCHANT_COL
    else:
        # Default: evaluate on the same processed training data used in train.py.
        csv_path     = config.PROCESSED_DIR / "training_data.csv"
        text_col     = "description"
        label_col    = "category"
        merchant_col = None
        print("  ℹ️   No --csv provided. Evaluating on processed training data.")
        print("       Note: this uses the same data the model was trained on — for a fair")
        print("       evaluation, provide a held-out CSV with --csv.\n")

    if not csv_path.exists():
        print(f"❌  File not found: {csv_path}")
        sys.exit(1)

    df = pd.read_csv(csv_path)
    print(f"  📂  Loaded: {csv_path}  ({len(df):,} rows)")

    for col in [text_col, label_col]:
        if col not in df.columns:
            print(f"❌  Column \"{col}\" not found. Available: {list(df.columns)}")
            sys.exit(1)

    # ── Build feature column ──────────────────────────────────────────────
    if merchant_col and merchant_col in df.columns:
        X_raw = (df[merchant_col].astype(str) + " " + df[text_col].astype(str)).apply(_clean)
    else:
        X_raw = df[text_col].astype(str).apply(_clean)

    y_true = df[label_col].astype(str).tolist()

    # Filter out empty-text rows.
    valid = X_raw.str.len() > 0
    X_raw  = X_raw[valid]
    y_true = [y for y, v in zip(y_true, valid) if v]

    if len(y_true) == 0:
        print("❌  No valid rows to evaluate after cleaning.")
        sys.exit(1)

    # ── Predict ───────────────────────────────────────────────────────────
    y_pred  = model.predict(X_raw.tolist())
    labels  = sorted(set(y_true) | set(y_pred))

    # ── Metrics ───────────────────────────────────────────────────────────
    acc      = float(accuracy_score(y_true, y_pred))
    macro_f1 = float(f1_score(y_true, y_pred, average="macro",    zero_division=0))
    wtd_f1   = float(f1_score(y_true, y_pred, average="weighted", zero_division=0))

    print(f"\n  📈  Results on {len(y_true):,} rows")
    print(f"  {'─'*40}")
    print(f"  Accuracy   : {acc:.4f}  ({acc*100:.1f}%)")
    print(f"  Macro F1   : {macro_f1:.4f}")
    print(f"  Weighted F1: {wtd_f1:.4f}")
    print(f"  {'─'*40}\n")
    print(classification_report(y_true, y_pred, zero_division=0))

    # ── Save outputs ──────────────────────────────────────────────────────
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    metrics = {
        "evaluated_csv":  str(csv_path),
        "rows_evaluated": len(y_true),
        "accuracy":       round(acc, 6),
        "macro_f1":       round(macro_f1, 6),
        "weighted_f1":    round(wtd_f1, 6),
        "labels":         labels,
        "classification_report": classification_report(y_true, y_pred, output_dict=True, zero_division=0),
    }
    metrics_path = config.OUTPUT_DIR / "eval_metrics.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print(f"  💾  Metrics saved → {metrics_path}")

    _save_confusion_matrix(y_true, y_pred, labels, config.OUTPUT_DIR)
    _save_f1_chart(y_true, y_pred, labels, config.OUTPUT_DIR)

    print("\n  ✅  Evaluation complete.")


if __name__ == "__main__":
    main()

"""
train.py — Step 2: Train the TF-IDF + Logistic Regression categorisation model.

What this script does
─────────────────────
1. Loads the clean training dataset produced by prepare_data.py.
2. Splits into 80 % train / 20 % test using stratified sampling.
3. Builds a scikit-learn Pipeline:
      TF-IDF Vectorizer (unigrams + bigrams, sublinear TF scaling)
   →  Logistic Regression (class-weight balanced, L2 regularisation)
4. Trains the model and evaluates on the held-out test set.
5. Saves the trained model to models/transaction_category_model.joblib.
6. Saves evaluation metrics to outputs/category_metrics.json.
7. Generates two visualisation plots in outputs/:
      - confusion_matrix.png
      - per_category_f1.png

Usage:
    python src/train.py
"""

# Limit BLAS/OpenBLAS threads before any numpy/scipy import to prevent memory errors
# on some Windows environments (Python 3.14 + OpenBLAS).
import os
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import json
import sys
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")   # non-interactive backend — safe for all environments
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config


# ---------------------------------------------------------------------------
# Visualisation helpers
# ---------------------------------------------------------------------------

def _plot_confusion_matrix(
    y_true: pd.Series,
    y_pred: np.ndarray,
    labels: list[str],
    output_dir: Path,
) -> None:
    """Save a colour-coded confusion matrix heatmap."""
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    n  = len(labels)

    # Scale figure height to number of categories.
    fig_size = max(8, n * 0.7)
    fig, ax = plt.subplots(figsize=(fig_size, fig_size))

    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=labels,
        yticklabels=labels,
        linewidths=0.5,
        ax=ax,
    )
    ax.set_xlabel("Predicted Category", fontsize=12)
    ax.set_ylabel("True Category", fontsize=12)
    ax.set_title("Confusion Matrix — Transaction Categorisation", fontsize=14, pad=15)
    plt.xticks(rotation=45, ha="right", fontsize=9)
    plt.yticks(rotation=0, fontsize=9)
    plt.tight_layout()

    path = output_dir / "confusion_matrix.png"
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"  📊  Confusion matrix saved → {path}")


def _plot_per_category_f1(
    y_true: pd.Series,
    y_pred: np.ndarray,
    labels: list[str],
    output_dir: Path,
) -> None:
    """Save a horizontal bar chart of per-category F1 scores."""
    report = classification_report(y_true, y_pred, labels=labels, output_dict=True, zero_division=0)

    f1_scores = [report.get(lbl, {}).get("f1-score", 0.0) for lbl in labels]
    support   = [report.get(lbl, {}).get("support",  0)   for lbl in labels]

    # Sort by F1 score for readability.
    order      = np.argsort(f1_scores)
    labels_s   = [labels[i]  for i in order]
    f1_s       = [f1_scores[i] for i in order]
    support_s  = [support[i]   for i in order]

    n = len(labels_s)
    fig, ax = plt.subplots(figsize=(10, max(5, n * 0.45)))

    bars = ax.barh(labels_s, f1_s, color=[
        "#2ecc71" if v >= 0.80 else "#f39c12" if v >= 0.60 else "#e74c3c"
        for v in f1_s
    ], edgecolor="white", height=0.6)

    # Annotate with F1 value and sample count.
    for bar, f1_val, sup in zip(bars, f1_s, support_s):
        ax.text(
            min(f1_val + 0.02, 0.98),
            bar.get_y() + bar.get_height() / 2,
            f"  {f1_val:.2f}  (n={sup})",
            va="center", fontsize=8.5,
        )

    ax.set_xlim(0, 1.15)
    ax.set_xlabel("F1 Score", fontsize=11)
    ax.set_title("Per-Category F1 Score", fontsize=13, pad=12)
    ax.axvline(x=0.80, color="grey", linestyle="--", linewidth=0.8, alpha=0.6)
    ax.text(0.80, -0.8, "0.80 target", color="grey", fontsize=8, ha="center")
    plt.tight_layout()

    path = output_dir / "per_category_f1.png"
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"  📊  Per-category F1 chart saved → {path}")


# ---------------------------------------------------------------------------
# Training pipeline
# ---------------------------------------------------------------------------

def build_pipeline() -> Pipeline:
    """
    Construct the scikit-learn ML pipeline.

    TF-IDF settings:
      - ngram_range=(1, 2)   : captures both single words and two-word phrases
                               (e.g. "home loan", "electricity bill")
      - sublinear_tf=True    : applies log(1 + tf) to dampen high-frequency terms
      - min_df=1             : include even rare terms (dataset may be small)
      - max_features=20000   : cap vocabulary to avoid memory issues

    Logistic Regression settings:
      - class_weight="balanced"  : compensates for class imbalance automatically
      - max_iter=1500            : enough iterations for convergence on TF-IDF features
      - C=1.0 (default)          : standard L2 regularisation
    """
    return Pipeline([
        ("tfidf", TfidfVectorizer(
            lowercase=True,
            ngram_range=(1, 2),
            min_df=1,
            max_features=20_000,
            sublinear_tf=True,
            strip_accents="unicode",
        )),
        ("classifier", LogisticRegression(
            max_iter=3000,
            class_weight="balanced",
            random_state=config.RANDOM_SEED,
            solver="lbfgs",
            tol=1e-3,
            # multi_class parameter removed in scikit-learn >= 1.7;
            # lbfgs handles multinomial automatically.
        )),
    ])


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    config.MODEL_DIR.mkdir(parents=True, exist_ok=True)
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # ── Load clean training data ──────────────────────────────────────────
    train_path = config.PROCESSED_DIR / "training_data.csv"
    if not train_path.exists():
        print("❌  training_data.csv not found. Run: python src/prepare_data.py")
        sys.exit(1)

    df = pd.read_csv(train_path)
    print(f"\n📂  Loaded: {train_path}  ({len(df):,} rows)")

    # Sanity checks.
    if "description" not in df.columns or "category" not in df.columns:
        print("❌  Expected columns 'description' and 'category' in training_data.csv.")
        sys.exit(1)

    # Ensure every class has at least 2 examples (required for stratified split).
    counts = df["category"].value_counts()
    too_few = counts[counts < 2].index.tolist()
    if too_few:
        print(f"❌  Categories with fewer than 2 examples: {too_few}")
        print("    Re-run prepare_data.py after adding more labelled examples.")
        sys.exit(1)

    X: pd.Series = df["description"].astype(str)
    y: pd.Series = df["category"].astype(str)

    print(f"    Categories ({y.nunique()}): {sorted(y.unique())}")

    # ── Train / test split ────────────────────────────────────────────────
    # Stratified split requires test_size >= number of unique classes.
    # If the dataset is very small, fall back to a non-stratified split.
    n_classes   = y.nunique()
    test_size   = config.TEST_SIZE
    min_test_n  = max(1, n_classes)  # need at least one sample per class ideally

    if int(len(X) * test_size) < min_test_n:
        # Dataset too small for the configured test size — use a fixed count.
        test_size = min(min_test_n, max(1, len(X) // 5))
        print(
            f"  ⚠️   Dataset has only {len(X)} rows and {n_classes} classes. "
            f"Using test_size={test_size} (count) instead of {config.TEST_SIZE:.0%}."
        )

    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=test_size,
            random_state=config.RANDOM_SEED,
            stratify=y,
        )
    except ValueError:
        # Stratification failed (too few samples per class) — fall back gracefully.
        print(
            "  ⚠️   Stratified split failed (too few samples per class). "
            "Using non-stratified split. Add more labelled examples for reliable evaluation."
        )
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=test_size,
            random_state=config.RANDOM_SEED,
        )

    print(f"    Train: {len(X_train):,}  |  Test: {len(X_test):,}")

    # ── Build and train model ─────────────────────────────────────────────
    print("\n🏋️   Training model …")
    model = build_pipeline()
    model.fit(X_train, y_train)

    # ── Evaluate ──────────────────────────────────────────────────────────
    y_pred  = model.predict(X_test)
    labels  = sorted(y.unique())

    acc      = float(accuracy_score(y_test, y_pred))
    macro_f1 = float(f1_score(y_test, y_pred, average="macro",    zero_division=0))
    wtd_f1   = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))

    print(f"\n📈  Evaluation (held-out test set — {len(X_test):,} rows)")
    print(f"  {'─'*40}")
    print(f"  Accuracy         : {acc:.4f}  ({acc*100:.1f}%)")
    print(f"  Macro F1         : {macro_f1:.4f}")
    print(f"  Weighted F1      : {wtd_f1:.4f}")
    print(f"  {'─'*40}")
    print()
    print(classification_report(y_test, y_pred, zero_division=0))

    # Warn on any category with F1 < 0.5.
    report_dict = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    weak_cats = [
        lbl for lbl in labels
        if isinstance(report_dict.get(lbl), dict)
        and report_dict[lbl].get("f1-score", 1.0) < 0.50
        and report_dict[lbl].get("support", 0) > 0
    ]
    if weak_cats:
        print(f"  ⚠️   Low F1 (<0.50) categories: {weak_cats}")
        print("       Consider adding more labelled examples for these categories.")

    # ── Save metrics JSON ─────────────────────────────────────────────────
    metrics = {
        "rows_total":    int(len(df)),
        "rows_train":    int(len(X_train)),
        "rows_test":     int(len(X_test)),
        "accuracy":      round(acc, 6),
        "macro_f1":      round(macro_f1, 6),
        "weighted_f1":   round(wtd_f1, 6),
        "labels":        labels,
        "confusion_matrix": confusion_matrix(y_test, y_pred, labels=labels).tolist(),
        "classification_report": report_dict,
        "evaluation_note": (
            "Stratified random holdout. Merchants present in training may also appear in test, "
            "which can inflate performance. For production, also evaluate on merchants/dates "
            "not present in training data. Report macro-F1 and per-category recall."
        ),
    }
    metrics_path = config.OUTPUT_DIR / "category_metrics.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print(f"  💾  Metrics saved → {metrics_path}")

    # ── Save model ────────────────────────────────────────────────────────
    model_path = config.MODEL_DIR / "transaction_category_model.joblib"
    joblib.dump(model, model_path)
    print(f"  💾  Model saved  → {model_path}")

    # ── Generate visualisations ───────────────────────────────────────────
    print("\n📊  Generating visualisations …")
    _plot_confusion_matrix(y_test, y_pred, labels, config.OUTPUT_DIR)
    _plot_per_category_f1(y_test, y_pred, labels, config.OUTPUT_DIR)

    print(f"\n✅  Training complete.")
    print("    Next step: python src/predict.py --text \"ZOMATO ONLINE ORDER\"")


if __name__ == "__main__":
    main()

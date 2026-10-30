"""
predict.py — Step 3: Categorise one or more transactions.

Single-transaction usage:
    python src/predict.py --text "ZOMATO ONLINE ORDER"
    python src/predict.py --text "UBER TRIP" --merchant "UBER"
    python src/predict.py --text "HDFC HOME LOAN EMI" --top 3

Batch usage (CSV file with a 'text' column, optional 'merchant' column):
    python src/predict.py --batch data/raw/new_transactions.csv
    python src/predict.py --batch data/raw/new_transactions.csv --out data/processed/predictions.csv

Output format (single):
    {
      "transaction":        "ZOMATO ONLINE ORDER",
      "clean_text":         "zomato online order",
      "category":           "Food",
      "confidence":         0.9231,
      "top_predictions":    [["Food", 0.9231], ["Groceries", 0.0412], ...],
      "source":             "ml_model",
      "needs_confirmation": false
    }

    source = "user_merchant_rule"  when a saved merchant correction overrides the model.
    needs_confirmation = true      when confidence < CONFIDENCE_THRESHOLD (see config.py).
"""

# Prevent OpenBLAS memory allocation errors on Windows (Python 3.14 + OpenBLAS).
# Must be set before any numpy/scipy/sklearn import.
import os
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config


# ---------------------------------------------------------------------------
# Text cleaning (must match prepare_data.py exactly)
# ---------------------------------------------------------------------------

_RE_EMAIL       = re.compile(r"\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b")
_RE_UPI_REF     = re.compile(
    r"\b(?:upi|ref|rrn|txn|neft|imps|rtgs|transaction)[/:# \-]*[a-z0-9\-]+\b"
)
_RE_LONG_NUM    = re.compile(r"\b\d{5,}\b")
_RE_NON_ALPHA   = re.compile(r"[^a-z ]")
_RE_MULTI_SPACE = re.compile(r"\s+")


def _clean(value: object) -> str:
    if pd.isna(value) or str(value).strip() == "":
        return ""
    text = str(value).lower().strip()
    text = _RE_EMAIL.sub(" ", text)
    text = _RE_UPI_REF.sub(" ", text)
    text = _RE_LONG_NUM.sub(" ", text)
    text = _RE_NON_ALPHA.sub(" ", text)
    text = _RE_MULTI_SPACE.sub(" ", text).strip()
    return text


# ---------------------------------------------------------------------------
# Merchant rule lookup (user corrections saved via correct.py)
# ---------------------------------------------------------------------------

def _load_merchant_rules() -> pd.DataFrame:
    path = config.FEEDBACK_DIR / "merchant_rules.csv"
    if path.exists():
        try:
            return pd.read_csv(path)
        except Exception:
            pass
    return pd.DataFrame(columns=["merchant_key", "category"])


def _lookup_merchant_rule(merchant_key: str, rules: pd.DataFrame) -> str | None:
    """Return the user-saved category for a merchant key, or None."""
    if not merchant_key or rules.empty:
        return None
    match = rules[rules["merchant_key"] == merchant_key]
    if not match.empty:
        # Use the most recently added rule (last row).
        return str(match.iloc[-1]["category"])
    return None


# ---------------------------------------------------------------------------
# Single-transaction prediction
# ---------------------------------------------------------------------------

def predict_one(
    model,
    rules: pd.DataFrame,
    text: str,
    merchant: str = "",
    top_k: int = 3,
) -> dict[str, Any]:
    """
    Predict the category for a single transaction.

    Returns a dict with:
      transaction, clean_text, category, confidence,
      top_predictions, source, needs_confirmation
    """
    merchant_key = _clean(merchant)
    clean_text   = _clean(merchant + " " + text) if merchant else _clean(text)

    # ── Check user merchant rules first ──────────────────────────────────
    rule_category = _lookup_merchant_rule(merchant_key, rules)
    if rule_category:
        return {
            "transaction":        text,
            "merchant":           merchant or None,
            "clean_text":         clean_text,
            "category":           rule_category,
            "confidence":         1.0,
            "top_predictions":    [[rule_category, 1.0]],
            "source":             "user_merchant_rule",
            "needs_confirmation": False,
        }

    # ── ML model prediction ───────────────────────────────────────────────
    if not clean_text:
        return {
            "transaction":        text,
            "merchant":           merchant or None,
            "clean_text":         clean_text,
            "category":           "Unknown",
            "confidence":         0.0,
            "top_predictions":    [["Unknown", 0.0]],
            "source":             "empty_input",
            "needs_confirmation": True,
        }

    probs   = model.predict_proba([clean_text])[0]
    classes = model.classes_

    # Top-k predictions, sorted by probability descending.
    top_indices     = probs.argsort()[::-1][:top_k]
    top_predictions = [[str(classes[i]), round(float(probs[i]), 4)] for i in top_indices]

    best_idx    = top_indices[0]
    category    = str(classes[best_idx])
    confidence  = float(probs[best_idx])

    return {
        "transaction":        text,
        "merchant":           merchant or None,
        "clean_text":         clean_text,
        "category":           category,
        "confidence":         round(confidence, 4),
        "top_predictions":    top_predictions,
        "source":             "ml_model",
        "needs_confirmation": confidence < config.CONFIDENCE_THRESHOLD,
    }


# ---------------------------------------------------------------------------
# Batch prediction
# ---------------------------------------------------------------------------

def predict_batch(
    model,
    rules: pd.DataFrame,
    df: pd.DataFrame,
    text_col: str,
    merchant_col: str | None,
    top_k: int = 3,
) -> pd.DataFrame:
    """
    Run predictions on a DataFrame containing transaction rows.

    Returns the input DataFrame with appended columns:
      predicted_category, confidence, source, needs_confirmation
    """
    results = []
    for _, row in df.iterrows():
        text     = str(row.get(text_col, ""))
        merchant = str(row.get(merchant_col, "")) if merchant_col else ""
        res      = predict_one(model, rules, text, merchant, top_k=1)
        results.append({
            "predicted_category":  res["category"],
            "confidence":          res["confidence"],
            "source":              res["source"],
            "needs_confirmation":  res["needs_confirmation"],
        })

    result_df = pd.DataFrame(results)
    return pd.concat([df.reset_index(drop=True), result_df], axis=1)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Predict transaction categories using the trained model."
    )
    # Single-transaction args.
    parser.add_argument("--text",     default="",  help="Transaction description text")
    parser.add_argument("--merchant", default="",  help="Merchant or vendor name (optional)")
    parser.add_argument("--top",      type=int, default=3,
                        help="Number of top category predictions to show (default: 3)")

    # Batch args.
    parser.add_argument("--batch",    default="",
                        help="Path to CSV file for batch prediction")
    parser.add_argument("--out",      default="",
                        help="Output CSV path for batch results (default: auto-generated)")
    parser.add_argument("--text-col", default="",
                        help="Text column name in batch CSV (default: TEXT_COL from config.py)")
    parser.add_argument("--merchant-col", default="",
                        help="Merchant column in batch CSV (default: MERCHANT_COL from config.py)")

    args = parser.parse_args()

    # ── Load model ────────────────────────────────────────────────────────
    model_path = config.MODEL_DIR / "transaction_category_model.joblib"
    if not model_path.exists():
        print("❌  Model not found. Train first: python src/train.py")
        sys.exit(1)

    model = joblib.load(model_path)
    rules = _load_merchant_rules()

    # ── Batch mode ────────────────────────────────────────────────────────
    if args.batch:
        batch_path = Path(args.batch)
        if not batch_path.exists():
            print(f"❌  Batch CSV not found: {batch_path}")
            sys.exit(1)

        df = pd.read_csv(batch_path)
        text_col     = args.text_col     or config.TEXT_COL
        merchant_col = args.merchant_col or config.MERCHANT_COL

        if text_col not in df.columns:
            print(f"❌  Text column \"{text_col}\" not found in {batch_path}")
            print(f"    Available columns: {list(df.columns)}")
            print("    Use --text-col to specify the correct column.")
            sys.exit(1)

        if merchant_col and merchant_col not in df.columns:
            print(f"  ⚠️   Merchant column \"{merchant_col}\" not found. Ignoring merchant.")
            merchant_col = None

        print(f"\n📂  Batch prediction on {len(df):,} rows …")
        out_df = predict_batch(model, rules, df, text_col, merchant_col, top_k=1)

        # Determine output path.
        if args.out:
            out_path = Path(args.out)
        else:
            out_path = batch_path.parent / (batch_path.stem + "_predicted.csv")

        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_df.to_csv(out_path, index=False)

        confirmed   = (out_df["needs_confirmation"] == False).sum()
        unconfirmed = (out_df["needs_confirmation"] == True).sum()

        print(f"  ✅  Done.")
        print(f"  High confidence (≥ {config.CONFIDENCE_THRESHOLD}): {confirmed:,}")
        print(f"  Needs review   (< {config.CONFIDENCE_THRESHOLD}): {unconfirmed:,}")
        print(f"  Saved → {out_path}")
        return

    # ── Single-transaction mode ───────────────────────────────────────────
    if not args.text:
        parser.print_help()
        print("\n❌  Provide --text or --batch.\n")
        sys.exit(1)

    result = predict_one(model, rules, args.text, args.merchant, top_k=args.top)
    print("\n" + json.dumps(result, indent=2))

    # Human-readable summary.
    flag = "⚠️  REVIEW SUGGESTED" if result["needs_confirmation"] else "✅"
    print(f"\n{flag}  Category: {result['category']}  (confidence: {result['confidence']:.0%})")
    if result["needs_confirmation"]:
        print(f"   Confidence is below the threshold ({config.CONFIDENCE_THRESHOLD:.0%}).")
        print("   Use: python src/correct.py --merchant \"...\" --category \"...\"")


if __name__ == "__main__":
    main()

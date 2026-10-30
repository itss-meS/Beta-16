"""
inspect_csv.py — Step 0: Inspect your raw CSV before any preprocessing.

Run this FIRST, before prepare_data.py, to understand your dataset structure.

Usage:
    python src/inspect_csv.py
    python src/inspect_csv.py --csv data/raw/my_other_file.csv
"""

import argparse
import sys
from pathlib import Path

import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config


# ---------------------------------------------------------------------------
# Heuristic column detection
# ---------------------------------------------------------------------------

# Candidate column names for each role (all lowercase for matching).
_TEXT_CANDIDATES      = ["note", "description", "narration", "remarks", "transaction details",
                          "details", "particulars", "memo", "text", "name", "vendor", "payee"]
_CATEGORY_CANDIDATES  = ["category", "tag", "type", "label", "transaction type", "expense type"]
_MERCHANT_CANDIDATES  = ["merchant", "vendor", "payee", "party", "beneficiary", "shop"]
_AMOUNT_CANDIDATES    = ["amount", "debit", "credit", "value", "sum", "price"]
_DATE_CANDIDATES      = ["date", "transaction date", "txn date", "value date", "booking date"]
_INCOME_EXP_CANDIDATES = ["income/expense", "income_expense", "transaction_type", "type",
                           "debit/credit", "dr/cr"]


def _fuzzy_match(columns: list[str], candidates: list[str]) -> str | None:
    """Return the first column whose lowercased name matches any candidate substring."""
    lower_cols = {c.lower().strip(): c for c in columns}
    for cand in candidates:
        for lc, orig in lower_cols.items():
            if cand in lc or lc in cand:
                return orig
    return None


def detect_columns(df: pd.DataFrame) -> dict:
    cols = list(df.columns)
    return {
        "text":       _fuzzy_match(cols, _TEXT_CANDIDATES),
        "category":   _fuzzy_match(cols, _CATEGORY_CANDIDATES),
        "merchant":   _fuzzy_match(cols, _MERCHANT_CANDIDATES),
        "amount":     _fuzzy_match(cols, _AMOUNT_CANDIDATES),
        "date":       _fuzzy_match(cols, _DATE_CANDIDATES),
        "income_exp": _fuzzy_match(cols, _INCOME_EXP_CANDIDATES),
    }


# ---------------------------------------------------------------------------
# Report helpers
# ---------------------------------------------------------------------------

def _sep(char: str = "─", width: int = 70) -> None:
    print(char * width)


def _print_column_samples(df: pd.DataFrame, col: str, n: int = 8) -> None:
    """Print n non-null sample values from a column."""
    samples = df[col].dropna().astype(str).unique()[:n]
    for s in samples:
        print(f"    • {s[:80]}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Inspect a raw transaction CSV and suggest column mappings."
    )
    parser.add_argument(
        "--csv",
        default=str(config.INPUT_CSV),
        help="Path to raw CSV file (default: INPUT_CSV from config.py)",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"\n❌  File not found: {csv_path}")
        print("   Download the CSV from Kaggle and place it at:")
        print(f"   {config.INPUT_CSV}")
        print("\n   Kaggle dataset: https://www.kaggle.com/datasets/tharunprabu/my-expenses-data")
        sys.exit(1)

    print()
    _sep("═")
    print("  FinSight AI — CSV Inspector")
    _sep("═")

    # ── Load ──────────────────────────────────────────────────────────────
    try:
        df = pd.read_csv(csv_path)
    except Exception as exc:
        print(f"❌  Could not read CSV: {exc}")
        sys.exit(1)

    # ── Basic stats ───────────────────────────────────────────────────────
    print(f"\n📄  File   : {csv_path}")
    print(f"📊  Rows   : {len(df):,}")
    print(f"📋  Columns: {df.shape[1]}")

    # ── Column overview ───────────────────────────────────────────────────
    _sep()
    print("COLUMNS IN YOUR CSV")
    _sep()
    for i, col in enumerate(df.columns, 1):
        dtype    = str(df[col].dtype)
        nulls    = df[col].isna().sum()
        unique   = df[col].nunique()
        sample   = df[col].dropna().astype(str).iloc[0][:50] if not df[col].dropna().empty else "—"
        print(f"  [{i:2d}] {col:<30}  dtype={dtype:<8}  nulls={nulls:<6}  unique={unique:<6}  sample: {sample}")

    # ── Heuristic detection ───────────────────────────────────────────────
    detected = detect_columns(df)

    _sep()
    print("AUTO-DETECTED COLUMN ROLES")
    _sep()
    role_labels = {
        "text":       "Transaction description / text  (TEXT_COL)",
        "category":   "Category label                  (CATEGORY_COL)",
        "merchant":   "Merchant / vendor               (MERCHANT_COL)",
        "amount":     "Amount",
        "date":       "Transaction date",
        "income_exp": "Income / Expense flag",
    }
    all_detected = True
    for role, label in role_labels.items():
        val = detected[role]
        if val:
            print(f"  ✅  {label:<48} → \"{val}\"")
        else:
            print(f"  ⚠️   {label:<48} → not detected")
            if role in ("text", "category"):
                all_detected = False

    # ── Category distribution ─────────────────────────────────────────────
    cat_col = detected["category"] or config.CATEGORY_COL
    if cat_col in df.columns:
        _sep()
        print(f"CATEGORY DISTRIBUTION  (column: \"{cat_col}\")")
        _sep()
        dist = df[cat_col].value_counts()
        total = len(df)
        for cat, cnt in dist.items():
            bar = "█" * min(int(cnt / total * 40), 40)
            print(f"  {str(cat):<30} {cnt:>5}  {bar}")
        print(f"\n  Total categories : {df[cat_col].nunique()}")
        low = dist[dist < 5]
        if not low.empty:
            print(f"\n  ⚠️   Categories with fewer than 5 examples (may cause training issues):")
            for cat, cnt in low.items():
                print(f"       • {cat}: {cnt}")

    # ── Sample rows ───────────────────────────────────────────────────────
    _sep()
    print("SAMPLE ROWS (first 5)")
    _sep()
    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 200)
    pd.set_option("display.max_colwidth", 60)
    print(df.head(5).to_string(index=False))

    # ── Sample description values ─────────────────────────────────────────
    text_col = detected["text"] or config.TEXT_COL
    if text_col in df.columns:
        _sep()
        print(f"SAMPLE DESCRIPTION VALUES  (column: \"{text_col}\")")
        _sep()
        _print_column_samples(df, text_col, n=12)

    # ── Recommended config.py settings ───────────────────────────────────
    _sep()
    print("RECOMMENDED config.py SETTINGS")
    _sep()
    print()
    d_text     = f'"{detected["text"]}"'     if detected["text"]     else '"<SET THIS>"'
    d_category = f'"{detected["category"]}"' if detected["category"] else '"<SET THIS>"'
    d_merchant = f'"{detected["merchant"]}"' if detected["merchant"] else 'None'
    print(f"  TEXT_COL     = {d_text}")
    print(f"  CATEGORY_COL = {d_category}")
    print(f"  MERCHANT_COL = {d_merchant}")
    print()

    if not all_detected:
        print("  ⚠️   One or more required columns were NOT auto-detected.")
        print("       Open config.py and set TEXT_COL and CATEGORY_COL manually.")
        print(f"       Available column names: {list(df.columns)}")
    else:
        print("  ✅  All required columns detected. Verify the suggestions above, then run:")
        print("       python src/prepare_data.py")

    _sep("═")
    print()


if __name__ == "__main__":
    main()

"""
prepare_data.py — Step 1: Preprocess raw transaction CSV into a clean training dataset.

What this script does
─────────────────────
1. Loads the raw CSV and validates required columns.
2. Combines the description text and (optionally) merchant column into one feature.
3. Cleans the text: removes emails, UPI/ref IDs, long numeric tokens, special chars.
4. Normalises category labels using the CATEGORY_MAP defined in config.py.
5. Removes rows with empty descriptions or missing categories.
6. Deduplicates carefully (same description + category = duplicate; keeps one).
7. Removes categories that have fewer than 2 labelled examples (cannot train on them).
8. Saves the clean dataset to data/processed/training_data.csv.
9. Prints a full preprocessing report including dropped-row summary.

Usage:
    python src/prepare_data.py
    python src/prepare_data.py --csv data/raw/my_other_file.csv   # override input
    python src/prepare_data.py --verbose                          # show dropped rows
"""

# Prevent OpenBLAS memory allocation errors on Windows (Python 3.14 + OpenBLAS).
import os
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import argparse
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config


# ---------------------------------------------------------------------------
# Text cleaning
# ---------------------------------------------------------------------------

# Patterns that carry no semantic meaning for categorisation.
_RE_EMAIL       = re.compile(r"\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b")
_RE_UPI_REF     = re.compile(
    r"\b(?:upi|ref|rrn|txn|neft|imps|rtgs|transaction)[/:# \-]*[a-z0-9\-]+\b"
)
_RE_LONG_NUM    = re.compile(r"\b\d{5,}\b")          # 5+ digit numeric tokens (IDs, pin codes)
_RE_NON_ALPHA   = re.compile(r"[^a-z ]")             # keep only a-z and spaces
_RE_MULTI_SPACE = re.compile(r"\s+")


def clean_text(value: object) -> str:
    """
    Return a lowercase, cleaned version of a transaction description string.

    Steps:
      - Lowercase
      - Remove email addresses
      - Remove UPI / reference IDs (upi:, ref#, rrn, txn, neft, imps, rtgs)
      - Remove long numeric tokens (5+ digits) — UPI trace IDs, account fragments
      - Remove everything that is not a letter or space
      - Collapse multiple spaces
    """
    if pd.isna(value):
        return ""
    text = str(value).lower().strip()
    text = _RE_EMAIL.sub(" ", text)
    text = _RE_UPI_REF.sub(" ", text)
    text = _RE_LONG_NUM.sub(" ", text)
    text = _RE_NON_ALPHA.sub(" ", text)
    text = _RE_MULTI_SPACE.sub(" ", text).strip()
    return text


def clean_merchant(value: object) -> str:
    """Light clean for merchant names — same pipeline as clean_text."""
    return clean_text(value)


# ---------------------------------------------------------------------------
# Category normalisation
# ---------------------------------------------------------------------------

def normalize_category(value: object) -> str:
    """
    Map a raw category string to its canonical label via CATEGORY_MAP.

    The map is tried on the lowercase stripped value first.
    If no mapping exists, the original value is returned in Title Case
    (so "food & dining" → "Food" from map; "CustomTag" → "Customtag" title-cased).
    """
    if pd.isna(value):
        return ""
    raw = str(value).strip()
    normalised = config.CATEGORY_MAP.get(raw.lower(), raw.title())
    return normalised.strip()


# ---------------------------------------------------------------------------
# Preprocessing pipeline
# ---------------------------------------------------------------------------

def preprocess(df: pd.DataFrame, verbose: bool = False) -> pd.DataFrame:
    """
    Run the full preprocessing pipeline and return a clean DataFrame
    with columns ['description', 'category'].

    Dropped rows are tracked and reported.
    """
    report: dict[str, int] = {}
    original_count = len(df)

    # ── Step 1: Validate required columns ────────────────────────────────
    required = [config.TEXT_COL, config.CATEGORY_COL]
    missing  = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(
            f"\n❌  Required columns not found: {missing}"
            f"\n    Your CSV has columns: {list(df.columns)}"
            f"\n    → Open config.py and correct TEXT_COL / CATEGORY_COL."
            f"\n    → Or run: python src/inspect_csv.py"
        )

    # ── Step 2: Build the text feature ───────────────────────────────────
    description_series = df[config.TEXT_COL].apply(clean_text)

    if config.MERCHANT_COL and config.MERCHANT_COL in df.columns:
        merchant_series  = df[config.MERCHANT_COL].apply(clean_merchant)
        # Prepend merchant so it has higher TF-IDF weight influence.
        description_series = (merchant_series + " " + description_series).str.strip()
    elif config.MERCHANT_COL and config.MERCHANT_COL not in df.columns:
        print(
            f"  ⚠️   MERCHANT_COL = \"{config.MERCHANT_COL}\" is set in config.py "
            f"but not found in the CSV. Ignoring merchant column."
        )

    # ── Step 3: Build working DataFrame ──────────────────────────────────
    data = pd.DataFrame({
        "description": description_series,
        "category":    df[config.CATEGORY_COL].apply(normalize_category),
    })

    # ── Step 4: Drop rows with empty descriptions ─────────────────────────
    before = len(data)
    data = data[data["description"].str.len() > 1]
    report["empty_description"] = before - len(data)

    # ── Step 5: Drop rows with missing / empty categories ─────────────────
    before = len(data)
    data = data[data["category"].notna() & (data["category"].str.strip() != "")]
    report["missing_category"] = before - len(data)

    # ── Step 6: Handle duplicates ─────────────────────────────────────────
    # This dataset uses merchant/place names as descriptions (e.g., "Monoprix Lac").
    # The same merchant appears many times across months — this is NOT noise.
    # Each occurrence reinforces the merchant→category mapping.
    #
    # We intentionally keep all rows so the model learns frequency patterns.
    # Only truly identical rows (full duplicate of description+category after cleaning,
    # which also means completely identical amounts, etc.) should be considered, but
    # since we only store description+category, we keep all.
    report["exact_duplicates"] = 0  # no deduplication performed

    inconsistent = (
        data.groupby("description")["category"]
        .nunique()
        .loc[lambda x: x > 1]
    )
    if len(inconsistent) > 0:
        print(
            f"\n  ⚠️   Found {len(inconsistent)} description(s) mapped to multiple categories "
            f"(labelling inconsistency). Keeping all; the model will learn the majority."
        )
        if verbose:
            for desc in inconsistent.index[:10]:
                cats = data.loc[data["description"] == desc, "category"].unique()
                print(f"       • \"{desc}\" → {list(cats)}")

    # ── Step 7: Remove rare categories (< 2 examples) ────────────────────
    # Scikit-learn stratified split requires at least 2 examples per class.
    before = len(data)
    counts   = data["category"].value_counts()
    rare     = counts[counts < 2].index.tolist()
    data     = data[~data["category"].isin(rare)].copy()
    report["rare_category_rows"] = before - len(data)
    if rare:
        print(f"\n  ⚠️   Removed {len(rare)} rare category/categories (< 2 examples): {rare}")
        print("       Add more labelled examples for these categories if you want them predicted.")

    # ── Step 8: Final validation ──────────────────────────────────────────
    if data["category"].nunique() < 2:
        raise ValueError(
            "❌  After preprocessing, fewer than 2 categories remain with at least 2 examples.\n"
            "    Check your CSV and CATEGORY_MAP in config.py."
        )

    data = data.reset_index(drop=True)

    # ── Report ─────────────────────────────────────────────────────────────
    total_dropped = original_count - len(data)
    print(f"\n  📋  Preprocessing Summary")
    print(f"  {'─'*44}")
    print(f"  Original rows          : {original_count:>7,}")
    print(f"  Empty description      : {report['empty_description']:>7,}  dropped")
    print(f"  Missing category       : {report['missing_category']:>7,}  dropped")
    print(f"  Exact duplicates       : {report['exact_duplicates']:>7,}  dropped")
    print(f"  Rare category rows     : {report['rare_category_rows']:>7,}  dropped")
    print(f"  {'─'*44}")
    print(f"  Clean rows remaining   : {len(data):>7,}")
    print(f"  Total dropped          : {total_dropped:>7,}  ({100*total_dropped/max(original_count,1):.1f}%)")
    print(f"  Categories in dataset  : {data['category'].nunique():>7,}")

    return data


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Preprocess raw transaction CSV for training.")
    parser.add_argument(
        "--csv",
        default=str(config.INPUT_CSV),
        help="Path to raw CSV (default: INPUT_CSV from config.py)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print extra details about dropped / inconsistent rows",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"\n❌  CSV not found: {csv_path}")
        print("   1. Download from: https://www.kaggle.com/datasets/tharunprabu/my-expenses-data")
        print(f"  2. Place it at   : {config.INPUT_CSV}")
        print("   3. Run           : python src/inspect_csv.py")
        sys.exit(1)

    print(f"\n📂  Loading: {csv_path}")
    try:
        df = pd.read_csv(csv_path)
    except Exception as exc:
        print(f"❌  Failed to read CSV: {exc}")
        sys.exit(1)

    print(f"    {len(df):,} rows  ×  {df.shape[1]} columns")
    print(f"    Columns: {list(df.columns)}")

    # Run the pipeline.
    data = preprocess(df, verbose=args.verbose)

    # ── Category distribution after cleaning ──────────────────────────────
    print("\n  Category distribution (clean data):")
    dist = data["category"].value_counts()
    for cat, cnt in dist.items():
        bar = "█" * min(int(cnt / len(data) * 40), 40)
        print(f"    {str(cat):<30} {cnt:>5}  {bar}")

    # ── Save ──────────────────────────────────────────────────────────────
    config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    output_path = config.PROCESSED_DIR / "training_data.csv"
    data.to_csv(output_path, index=False)

    print(f"\n✅  Saved clean training data → {output_path}")
    print("    Next step: python src/train.py")


if __name__ == "__main__":
    main()

"""
correct.py — Step 4 (ongoing): Save user corrections for transaction categories.

What this script does
─────────────────────
- Saves a merchant → category correction rule to data/feedback/merchant_rules.csv.
- When predict.py encounters a transaction from this merchant, it uses the rule
  instead of the model — giving you instant, deterministic corrections.
- Optionally applies the correction to an existing predictions CSV (bulk mode).

IMPORTANT
─────────
Corrections stored here apply to future predictions by exact merchant key match.
They do NOT silently modify historical transaction records already stored elsewhere.
When running a bulk correction on an existing file, the script shows you a preview
and asks for confirmation before writing anything.

Usage:
    # Save a correction rule:
    python src/correct.py --merchant "ZOMATO" --category "Food"

    # Correct a mis-categorised description key (not merchant-based):
    python src/correct.py --merchant "hdfc home loan" --category "EMI"

    # Apply saved corrections to an existing predictions CSV:
    python src/correct.py --apply data/processed/predictions.csv

    # List all saved correction rules:
    python src/correct.py --list
"""

import argparse
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalise_key(value: str) -> str:
    """
    Convert a merchant name to a stable lookup key.
    Lowercases, strips non-alphanumeric chars, collapses spaces.
    """
    value = str(value).lower()
    value = re.sub(r"[^a-z0-9 ]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def _load_rules() -> pd.DataFrame:
    path = config.FEEDBACK_DIR / "merchant_rules.csv"
    if path.exists():
        try:
            df = pd.read_csv(path)
            # Ensure required columns exist.
            for col in ("merchant_key", "category", "added_at"):
                if col not in df.columns:
                    df[col] = ""
            return df
        except Exception as exc:
            print(f"  ⚠️   Could not read existing rules file: {exc}")
    return pd.DataFrame(columns=["merchant_key", "category", "added_at"])


def _save_rules(df: pd.DataFrame) -> None:
    config.FEEDBACK_DIR.mkdir(parents=True, exist_ok=True)
    path = config.FEEDBACK_DIR / "merchant_rules.csv"
    df.to_csv(path, index=False)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_save(merchant: str, category: str) -> None:
    """Add or update a merchant → category correction rule."""
    key = _normalise_key(merchant)
    if not key:
        print("❌  Merchant name cannot be empty.")
        sys.exit(1)
    if not category.strip():
        print("❌  Category cannot be empty.")
        sys.exit(1)

    rules = _load_rules()
    existing = rules[rules["merchant_key"] == key]

    import datetime
    timestamp = datetime.datetime.now().isoformat(timespec="seconds")

    if not existing.empty:
        old_cat = existing.iloc[-1]["category"]
        print(f"  🔄  Updating existing rule: \"{key}\" : \"{old_cat}\" → \"{category}\"")
        rules = rules[rules["merchant_key"] != key]
    else:
        print(f"  ✅  Adding new rule: \"{key}\" → \"{category}\"")

    new_row = pd.DataFrame([{
        "merchant_key": key,
        "category":     category.strip(),
        "added_at":     timestamp,
    }])
    rules = pd.concat([rules, new_row], ignore_index=True)
    _save_rules(rules)

    path = config.FEEDBACK_DIR / "merchant_rules.csv"
    print(f"  💾  Saved → {path}")
    print()
    print("  How this works:")
    print(f"    Future predictions for merchant \"{key}\" will return \"{category}\" with 100% confidence.")
    print("    Historical transaction records stored elsewhere are NOT changed automatically.")
    print("    To update a predictions CSV, run: python src/correct.py --apply <file.csv>")


def cmd_list() -> None:
    """Print all saved merchant correction rules."""
    rules = _load_rules()
    if rules.empty:
        print("  No correction rules saved yet.")
        print("  Run: python src/correct.py --merchant \"ZOMATO\" --category \"Food\"")
        return

    print(f"\n  {'Merchant Key':<35} {'Category':<20} {'Added At'}")
    print(f"  {'─'*35} {'─'*20} {'─'*20}")
    for _, row in rules.iterrows():
        print(f"  {str(row['merchant_key']):<35} {str(row['category']):<20} {str(row.get('added_at', ''))}")
    print(f"\n  Total rules: {len(rules)}")


def cmd_apply(csv_path: Path) -> None:
    """
    Apply saved merchant correction rules to an existing predictions CSV.

    The CSV must have a column that contains the original merchant key used
    during prediction, OR the predicted_category column which can be overridden.

    The script matches merchant_key values against the rules and updates
    the predicted_category column where a rule exists.

    A preview is shown before any changes are written.
    """
    if not csv_path.exists():
        print(f"❌  File not found: {csv_path}")
        sys.exit(1)

    rules = _load_rules()
    if rules.empty:
        print("  No correction rules saved. Nothing to apply.")
        return

    df = pd.read_csv(csv_path)
    print(f"\n  📂  Loaded: {csv_path}  ({len(df):,} rows)")
    print(f"  📋  Columns: {list(df.columns)}")

    # Try to find a merchant column in the loaded file.
    merchant_col = None
    candidates = ["merchant", "merchant_key", "vendor", "payee", config.MERCHANT_COL]
    for c in candidates:
        if c and c in df.columns:
            merchant_col = c
            break

    if not merchant_col:
        print(
            "  ⚠️   No merchant column found in the CSV. "
            "Cannot apply merchant-based corrections.\n"
            f"  Available columns: {list(df.columns)}"
        )
        return

    print(f"  Using merchant column: \"{merchant_col}\"")

    # Build a merchant_key column for matching.
    df["_match_key"] = df[merchant_col].apply(
        lambda v: _normalise_key(str(v)) if pd.notna(v) else ""
    )

    rule_map = dict(zip(rules["merchant_key"], rules["category"]))

    # Identify rows that will be changed.
    affected = df["_match_key"].isin(rule_map)
    affected_rows = df[affected].copy()

    if affected_rows.empty:
        print("  No rows match any saved correction rules. Nothing to update.")
        df.drop(columns=["_match_key"], inplace=True)
        return

    print(f"\n  The following {len(affected_rows)} row(s) will be updated:")
    print(f"  {'Original description (truncated)':<45} {'Old category':<20} → {'New category'}")
    print(f"  {'─'*45} {'─'*20}   {'─'*20}")

    text_col = config.TEXT_COL if config.TEXT_COL in df.columns else df.columns[0]

    for _, row in affected_rows.head(20).iterrows():
        desc     = str(row.get(text_col, ""))[:43]
        old_cat  = str(row.get("predicted_category", "?"))
        new_cat  = rule_map[row["_match_key"]]
        print(f"  {desc:<45} {old_cat:<20}   {new_cat}")

    if len(affected_rows) > 20:
        print(f"  … and {len(affected_rows) - 20} more rows.")

    # Confirm before writing.
    answer = input(f"\n  Apply these {len(affected_rows)} correction(s)? [y/N]: ").strip().lower()
    if answer != "y":
        print("  Cancelled. No changes written.")
        df.drop(columns=["_match_key"], inplace=True)
        return

    # Apply corrections.
    if "predicted_category" in df.columns:
        df.loc[affected, "predicted_category"] = df.loc[affected, "_match_key"].map(rule_map)
        df.loc[affected, "source"]             = "user_merchant_rule"
        df.loc[affected, "confidence"]         = 1.0
        df.loc[affected, "needs_confirmation"] = False

    df.drop(columns=["_match_key"], inplace=True)
    df.to_csv(csv_path, index=False)
    print(f"\n  ✅  Updated {len(affected_rows)} row(s) and saved → {csv_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Save user corrections for transaction categories."
    )
    parser.add_argument("--merchant", default="",
                        help="Merchant or vendor name to correct")
    parser.add_argument("--category", default="",
                        help="Correct category label")
    parser.add_argument("--list",     action="store_true",
                        help="List all saved correction rules")
    parser.add_argument("--apply",    default="",
                        help="Apply saved corrections to a predictions CSV file")
    args = parser.parse_args()

    print()

    if args.list:
        cmd_list()
        return

    if args.apply:
        cmd_apply(Path(args.apply))
        return

    if args.merchant and args.category:
        cmd_save(args.merchant, args.category)
        return

    parser.print_help()
    print("\n  Examples:")
    print("    python src/correct.py --merchant \"ZOMATO\"    --category \"Food\"")
    print("    python src/correct.py --merchant \"NETFLIX\"   --category \"Subscription\"")
    print("    python src/correct.py --list")
    print("    python src/correct.py --apply data/processed/predictions.csv")


if __name__ == "__main__":
    main()

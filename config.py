"""
config.py — Central configuration for FinSight AI: Model 1 (Transaction Categorization)

HOW TO CONFIGURE
----------------
1. Run `python src/inspect_csv.py` first.
   It will print your CSV's actual column names and sample rows.

2. Set TEXT_COL to the column that contains the transaction description or narration.
   Common names: "Note", "Description", "Narration", "Remarks", "Transaction Details"

3. Set CATEGORY_COL to the column that holds the category label.
   Common names: "Category", "Type", "Tag"

4. Set MERCHANT_COL to a merchant/vendor name column, or None if absent.
   Common names: "Merchant", "Vendor", "Payee", "Party"

5. Do NOT change RAW_DIR, PROCESSED_DIR, etc. unless you know what you are doing.
"""

from pathlib import Path

# ---------------------------------------------------------------------------
# Directories
# ---------------------------------------------------------------------------
ROOT          = Path(__file__).resolve().parent
RAW_DIR       = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
FEEDBACK_DIR  = ROOT / "data" / "feedback"
MODEL_DIR     = ROOT / "models"
OUTPUT_DIR    = ROOT / "outputs"

# ---------------------------------------------------------------------------
# Input CSV
# ---------------------------------------------------------------------------
INPUT_CSV = RAW_DIR / "my_expenses_data.csv"

# ---------------------------------------------------------------------------
# Column mapping — EDIT THESE to match your actual CSV headers.
# Run `python src/inspect_csv.py` to see your headers and sample values.
# ---------------------------------------------------------------------------

# Column containing the transaction description / narration text (REQUIRED).
# transactions.csv uses "Description" as the merchant/place name column.
TEXT_COL = "Description"

# Column containing the ground-truth category label (REQUIRED).
CATEGORY_COL = "Category"

# Column containing merchant / vendor name (OPTIONAL — set to None if absent).
# transactions.csv has no separate merchant column; the Description IS the merchant.
MERCHANT_COL = None

# ---------------------------------------------------------------------------
# Category normalisation map
#
# Keys are lowercase raw values that appear in your CSV.
# Values are the clean canonical label the model will learn and predict.
# Add more mappings if your CSV has extra category names.
# ---------------------------------------------------------------------------
CATEGORY_MAP: dict[str, str] = {
    # ── Exact category names from transactions.csv (passed through as-is) ──
    # These are already clean — the map preserves them exactly.
    "food & groceries":         "Food & Groceries",
    "transport":                "Transport",
    "restaurants & cafés":      "Restaurants & Cafés",
    "health & wellness":        "Health & Wellness",
    "education & self-dev":     "Education & Self-Dev",
    "personal care":            "Personal Care",
    "entertainment & leisure":  "Entertainment & Leisure",
    "shopping & clothing":      "Shopping & Clothing",
    "gifts & social":           "Gifts & Social",
    "travel & holidays":        "Travel & Holidays",
    "rent":                     "Rent",
    "utilities":                "Utilities",
    "subscriptions & digital":  "Subscriptions & Digital",
    "savings & investment":     "Savings & Investment",
    "income":                   "Income",

    # ── Common aliases / alternate spellings ──
    "food":                     "Food & Groceries",
    "grocery":                  "Food & Groceries",
    "groceries":                "Food & Groceries",
    "supermarket":              "Food & Groceries",
    "restaurants":              "Restaurants & Cafés",
    "cafe":                     "Restaurants & Cafés",
    "cafes":                    "Restaurants & Cafés",
    "dining":                   "Restaurants & Cafés",
    "health":                   "Health & Wellness",
    "healthcare":               "Health & Wellness",
    "medical":                  "Health & Wellness",
    "wellness":                 "Health & Wellness",
    "education":                "Education & Self-Dev",
    "self development":         "Education & Self-Dev",
    "shopping":                 "Shopping & Clothing",
    "clothing":                 "Shopping & Clothing",
    "entertainment":            "Entertainment & Leisure",
    "leisure":                  "Entertainment & Leisure",
    "travel":                   "Travel & Holidays",
    "holidays":                 "Travel & Holidays",
    "subscription":             "Subscriptions & Digital",
    "subscriptions":            "Subscriptions & Digital",
    "streaming":                "Subscriptions & Digital",
    "digital":                  "Subscriptions & Digital",
    "savings":                  "Savings & Investment",
    "investment":               "Savings & Investment",
    "salary":                   "Income",
    "freelance":                "Income",
    "bonus":                    "Income",
    "gifts":                    "Gifts & Social",
    "social":                   "Gifts & Social",
    "gift":                     "Gifts & Social",
    "housing":                  "Rent",
    "apartment rent":           "Rent",
    "bills":                    "Utilities",
    "electricity":              "Utilities",
    "water":                    "Utilities",
    "internet":                 "Utilities",
    "mobile phone":             "Utilities",
    "personal":                 "Personal Care",
    "care":                     "Personal Care",
}

# ---------------------------------------------------------------------------
# Prediction settings
# ---------------------------------------------------------------------------

# Predictions below this confidence score are flagged as "needs_confirmation".
# The user should review and correct these manually.
# Range: 0.0 – 1.0.  Default: 0.60
CONFIDENCE_THRESHOLD: float = 0.60

# ---------------------------------------------------------------------------
# Training settings
# ---------------------------------------------------------------------------

# Fraction of data held out for evaluation (80/20 split by default).
TEST_SIZE: float = 0.20

# Random seed for reproducibility.
RANDOM_SEED: int = 42

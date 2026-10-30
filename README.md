# FinSight AI — Model 1: Intelligent Transaction Categorization

A privacy-first, offline ML module that automatically categorises bank transactions
into meaningful financial categories — built with scikit-learn, TF-IDF, and Logistic Regression.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Setup](#3-setup)
4. [Step-by-Step Guide](#4-step-by-step-guide)
5. [Configuration Reference](#5-configuration-reference)
6. [Script Reference](#6-script-reference)
7. [Output Files](#7-output-files)
8. [Troubleshooting](#8-troubleshooting)
9. [Evaluation Cautions](#9-evaluation-cautions)

---

## 1. Project Overview

**Goal:** Given a raw transaction description (e.g., `UBER TRIP 4521`), automatically
predict the financial category (e.g., `Travel`).

**Dataset:** [Kaggle — My Expenses Data](https://www.kaggle.com/datasets/tharunprabu/my-expenses-data)

Download the CSV and place it at:
```
data/raw/my_expenses_data.csv
```

**Example predictions:**

| Transaction Description | Predicted Category |
|---|---|
| ZOMATO ONLINE ORDER | Food |
| SWIGGY INSTAMART | Groceries |
| UBER TRIP | Travel |
| NETFLIX SUBSCRIPTION | Subscription |
| AMAZON INDIA | Shopping |
| HDFC HOME LOAN | EMI |
| MONTHLY HOUSE RENT | Rent |
| ELECTRICITY BILL | Bills |
| SALARY CREDIT | Income |
| APOLLO PHARMACY | Healthcare |

---

## 2. Architecture

```
Raw CSV
   │
   ▼
[inspect_csv.py]  — Inspect headers, detect column roles, suggest config
   │
   ▼
[prepare_data.py] — Clean text, normalise categories → training_data.csv
   │
   ▼
[train.py]        — TF-IDF + Logistic Regression → model.joblib + metrics
   │
   ▼
[predict.py]      — Single or batch predictions with confidence scores
   │
   ▼
[correct.py]      — Save merchant correction rules for instant overrides
   │
   ▼
[evaluate.py]     — Standalone evaluation on any labelled CSV
```

**ML Pipeline:**
```
Transaction description text
   │
   ▼  TF-IDF Vectorizer
      • lowercase = True
      • ngram_range = (1, 2)   ← captures "home loan", "electricity bill"
      • sublinear_tf = True    ← log(1 + tf) dampens high-frequency noise
      • max_features = 20,000
   │
   ▼  Logistic Regression
      • class_weight = "balanced"  ← handles class imbalance automatically
      • max_iter = 1500
      • solver = lbfgs / multinomial
   │
   ▼
Predicted Category + Confidence Score
```

---

## 3. Setup

### Prerequisites
- Python 3.10 or higher
- pip

### Install dependencies

**Windows (PowerShell):**
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

**macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Create required directories
The scripts create these automatically, but you can create them manually:
```
data/
  raw/          ← place your CSV here
  processed/
  feedback/
models/
outputs/
```

---

## 4. Step-by-Step Guide

### Step 0 — Get the dataset

1. Go to: https://www.kaggle.com/datasets/tharunprabu/my-expenses-data
2. Download the CSV file.
3. Place it at: `data/raw/my_expenses_data.csv`

---

### Step 1 — Inspect your CSV

```bash
python src/inspect_csv.py
```

This will:
- Print all column names in your CSV
- Auto-detect which column is the description, category, merchant, etc.
- Show sample values and category distribution
- Print recommended `config.py` settings

**Sample output:**
```
  COLUMNS IN YOUR CSV
  ─────────────────────
  [ 1] Date       dtype=object  nulls=0   unique=365  sample: 2023-01-01
  [ 2] Account    dtype=object  nulls=0   unique=3    sample: HDFC Savings
  [ 3] Category   dtype=object  nulls=0   unique=12   sample: Food
  [ 4] Note       dtype=object  nulls=12  unique=890  sample: ZOMATO ONLINE ORDER

  RECOMMENDED config.py SETTINGS
  TEXT_COL     = "Note"
  CATEGORY_COL = "Category"
  MERCHANT_COL = None
```

---

### Step 2 — Configure column names

Open `config.py` and set the correct column names based on Step 1 output:

```python
TEXT_COL     = "Note"       # ← column with transaction description
CATEGORY_COL = "Category"   # ← column with category label
MERCHANT_COL = None         # ← merchant column, or None if absent
```

---

### Step 3 — Preprocess the data

```bash
python src/prepare_data.py
```

This cleans the text, normalises categories, removes noise, and saves
`data/processed/training_data.csv`.

**Sample output:**
```
  Preprocessing Summary
  ────────────────────────────────────────────
  Original rows          :   1,234
  Empty description      :      12  dropped
  Missing category       :       0  dropped
  Exact duplicates       :      45  dropped
  Rare category rows     :       3  dropped
  ────────────────────────────────────────────
  Clean rows remaining   :   1,174
  Categories in dataset  :      12
```

---

### Step 4 — Train the model

```bash
python src/train.py
```

This trains a TF-IDF + Logistic Regression pipeline and saves:
- `models/transaction_category_model.joblib`
- `outputs/category_metrics.json`
- `outputs/confusion_matrix.png`
- `outputs/per_category_f1.png`

**Sample output:**
```
  Accuracy  : 0.9312  (93.1%)
  Macro F1  : 0.8944
  Weighted F1: 0.9301

                precision    recall  f1-score   support
  Bills              0.91      0.95      0.93        21
  EMI                0.96      0.92      0.94        13
  Food               0.97      0.96      0.97        54
  ...
```

---

### Step 5 — Make predictions

**Single transaction:**
```bash
python src/predict.py --text "ZOMATO ONLINE ORDER"
python src/predict.py --text "UBER TRIP 4521" --merchant "UBER"
python src/predict.py --text "HDFC HOME LOAN EMI" --top 3
```

**Sample output:**
```json
{
  "transaction": "ZOMATO ONLINE ORDER",
  "category": "Food",
  "confidence": 0.9423,
  "top_predictions": [["Food", 0.9423], ["Groceries", 0.0312], ["Shopping", 0.0098]],
  "source": "ml_model",
  "needs_confirmation": false
}
```

**Batch prediction on a CSV:**
```bash
python src/predict.py --batch data/raw/new_transactions.csv
python src/predict.py --batch data/raw/new_transactions.csv --out data/processed/predictions.csv
```

---

### Step 6 — Correct wrong predictions

When the model gets something wrong, save a correction:

```bash
python src/correct.py --merchant "ZOMATO"   --category "Food"
python src/correct.py --merchant "NETFLIX"  --category "Subscription"
python src/correct.py --merchant "HDFC BANK LOAN" --category "EMI"
```

List all saved corrections:
```bash
python src/correct.py --list
```

Apply corrections to an existing predictions file:
```bash
python src/correct.py --apply data/processed/predictions.csv
```

---

### Step 7 — Evaluate on a new dataset

```bash
# Evaluate on a custom labelled CSV:
python src/evaluate.py --csv data/raw/my_test_set.csv

# Specify column names:
python src/evaluate.py --csv data/raw/test.csv --text-col "Description" --label-col "Category"
```

---

## 5. Configuration Reference

**`config.py`**

| Variable | Default | Description |
|---|---|---|
| `INPUT_CSV` | `data/raw/my_expenses_data.csv` | Path to the raw input CSV |
| `TEXT_COL` | `"Note"` | Column with transaction description |
| `CATEGORY_COL` | `"Category"` | Column with category label |
| `MERCHANT_COL` | `None` | Merchant column (set to `None` if absent) |
| `CATEGORY_MAP` | (see config.py) | Raw → canonical category name mappings |
| `CONFIDENCE_THRESHOLD` | `0.60` | Below this, prediction is flagged for review |
| `TEST_SIZE` | `0.20` | Fraction of data used for evaluation |
| `RANDOM_SEED` | `42` | Reproducibility seed |

**Adjusting `CONFIDENCE_THRESHOLD`:**
- Increase (e.g., `0.75`) → more predictions get flagged for review → fewer wrong silent predictions.
- Decrease (e.g., `0.45`) → fewer reviews requested → more autonomous but potentially less accurate.

---

## 6. Script Reference

| Script | Purpose | Run After |
|---|---|---|
| `src/inspect_csv.py` | Inspect CSV headers and detect column roles | Dataset downloaded |
| `src/prepare_data.py` | Preprocess raw CSV → clean training data | Step 0 + config set |
| `src/train.py` | Train model, evaluate, save plots | `prepare_data.py` |
| `src/predict.py` | Predict category for one or many transactions | `train.py` |
| `src/correct.py` | Save merchant correction rules | Any time |
| `src/evaluate.py` | Evaluate model on any labelled CSV | `train.py` |

---

## 7. Output Files

```
data/
  processed/
    training_data.csv        ← cleaned dataset used for training
  feedback/
    merchant_rules.csv       ← user-saved merchant corrections

models/
    transaction_category_model.joblib   ← trained ML model

outputs/
    category_metrics.json    ← accuracy, F1, confusion matrix (JSON)
    confusion_matrix.png     ← heatmap of predictions vs actual
    per_category_f1.png      ← bar chart of per-category F1 scores
    eval_metrics.json        ← evaluation run metrics (from evaluate.py)
    eval_confusion_matrix.png
    eval_per_category_f1.png
```

---

## 8. Troubleshooting

**`Missing columns ['Note', 'Category']. CSV columns: [...]`**
→ Your CSV has different column names. Run `python src/inspect_csv.py` and update `config.py`.

**`Run python src/prepare_data.py first.`**
→ `training_data.csv` does not exist. Run Step 3.

**`Model not found. Train first.`**
→ The model file does not exist. Run Step 4.

**`Each category needs at least two labelled examples.`**
→ Some categories have only 1 example. Add more data or remove them from `CATEGORY_MAP`.

**Low accuracy / F1**
→ Check the per-category F1 chart (`outputs/per_category_f1.png`).
→ Categories shown in red (F1 < 0.5) need more training examples.
→ Check if `CATEGORY_MAP` covers all the category names in your CSV.

**Prediction flagged as `needs_confirmation: true`**
→ The model confidence is below `CONFIDENCE_THRESHOLD` (default: 60%).
→ This is expected for ambiguous transactions. Save a correction with `correct.py`.

---

## 9. Evaluation Cautions

- The default 80/20 split is stratified and random. Since similar merchants can appear
  in both train and test, this likely **overstates real-world performance**.

- For a realistic production evaluation:
  1. **Merchant holdout:** train on merchants A–Z except a few; test only on those excluded merchants.
  2. **Time-based split:** train on older transactions; test on the most recent month.

- Always report **macro-F1** (treats all categories equally) alongside accuracy.
  Accuracy can look high even when the model fails on rare categories.

- `needs_confirmation: true` predictions should be routed to the user for review.
  Model probability scores are **not calibrated confidence**; they are relative,
  not absolute probability estimates.

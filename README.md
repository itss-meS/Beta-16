# FinSight

FinSight is an Expo + React Native + TypeScript mobile prototype for an offline-first, explainable personal finance assistant. Its interface takes visual cues from the supplied reference: a soft lavender canvas, floating rounded white cards, compact category colors, and generous spacing.

## Run on Android

1. Install Node.js (LTS) and Android Studio with an emulator, or enable USB debugging on an Android phone.
2. In this directory, run `npm install`.
3. Run `npm run android` (or `npx expo start` and press `a`).
4. For a phone on the same network, install Expo Go and scan the QR code.

Expo's development server needs network access between the development computer and Expo Go. The app's sample finance screens and calculations themselves do not call a server or require internet once bundled.

## What is implemented

- One-screen Expo Router app with persistent bottom navigation: Home, Activity, Insights, Planner, Assistant.
- Lavender/white FinSight visual system, balance hero, trend line, income and expense cards, SVG category donut, goals progress, insight cards, and activity list.
- October 2026 clearly labeled sample UPI, NEFT, BBPS and card transactions in INR. The sample dataset intentionally totals ₹1,13,000 income and ₹29,936 expenses; the opening balance is illustrative.
- Transaction search and filters for type, recurring status, and category.
- Spending category summaries and a mobile bar visualization. Older monthly bars are explicitly marked illustrative.
- Purchase planner that recalculates estimated remaining balance for now, next month, or three months, with editable price and reserve and a visible calculation breakdown.
- Offline rule-based assistant using the same local transaction dataset.
- Savings goal progress display.
- No bank connection, cloud API, synchronization claim, or live AI call.

## Data and calculations

Demo records are in `src/data/demo.ts`, typed models in `src/types/finance.ts`, and shared totals/category/purchase/assistant calculations in `src/services/finance.ts`. The UI uses the same transaction list for dashboard totals, insights, and assistant answers. Sample numbers are not real account data.

## Current prototype limits

- No onboarding flow, native splash illustration, account import, transaction detail sheet, editable savings goal management, recurring/anomaly dedicated screens, profile/settings, persistent SQLite store, CSV import/export, or production-grade forecast history yet.
- The balance card is a labeled illustrative opening balance and is not reconciled against sample activity.
- The planner repeats the current sample monthly income and expenses for each selected month; it is a transparent scenario calculation, not a forecast model.
- No encryption or bank authentication is claimed.

## Project layout

```text
src/
  app/          Expo Router entry and app shell
  components/   Reusable cards, chips, icons, bottom navigation
  constants/    Colors and styling tokens
  data/         Explicit sample data
  services/     Local finance and assistant logic
  types/        TypeScript finance models
```

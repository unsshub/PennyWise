# PennyWise Core Specification

Status: ready-for-agent

## Problem Statement

People looking to manage their daily spending, multi-currency holdings, recurring bills, and budgets on Android face a painful trade-off: existing finance apps either force rigid monthly rules, lock core features (like multiple Wallets, multi-currency tracking, or flexible custom budget periods) behind expensive subscriptions, suffer from sluggish multi-step transaction entry forms that discourage daily tracking, or harvest sensitive financial data into remote cloud servers. Users need a free, fast, private, and deeply customizable personal finance manager that adapts to their life while keeping 100% of their financial data on their own device.

## Solution

PennyWise is a free, offline-first all-in-one expense tracker, flexible budget planner, and personal finance manager for Android built with Expo (React Native + TypeScript) and an on-device SQLite database (`expo-sqlite`). Inspired by Cashew, PennyWise provides:

- **Multi-Currency Wallets & Accurate Net Worth**: Track any number of Wallets denominated in fiat (`USD`, `EUR`, `GBP`, etc.) or cryptocurrency (`BTC`, `ETH`, etc.) with exact decimal precision, automatic exchange rate updates with offline caching and manual overrides, immutable Transaction `Snapshot Rate`s, and live `Net Worth` aggregation.
- **Sub-Second Daily Transaction Logging**: A bottom-sheet calculator keypad with inline arithmetic (`+`, `-`, `×`, `÷`) and quick-select chips for `Wallet`, `Category`, and `Subcategory` to log an `Expense`, `Income`, `Transfer`, or `Balance Adjustment` in seconds.
- **Flexible Budgeting & Dynamic Daily Spending Allowance**: Concurrent `Budget`s over any `Budget Period` (weekly, monthly, yearly, custom `Every N Days/Weeks/Months`, or one-off custom date ranges) using either `Automatic Filter` or `Manual Assignment` (`Budget Scope`), complete with real-time `Daily Spending Allowance` calculations.
- **Bills & Subscriptions Tracking**: `Recurring Rule`s and `Upcoming Payment`s supporting both automatic settlement (`autoPay`) and manual 1-tap `"Mark as Paid"` confirmation with local push notification reminders.
- **Interactive Spending Insights**: Interactive line charts (`Spending Pace Comparison` overlaying current vs. previous period), drill-down Category/Subcategory donut charts, Income vs. Expense bar graphs, and Net Worth history trends.
- **Deep Personalization & Local Privacy**: Reorderable and toggleable `Home Section`s, theme/accent customization (Light, Dark, AMOLED True Black), optional biometric app lock, `Privacy Mask` balance blurring, CSV export, and full offline `Backup Snapshot` export/restore.

## User Stories

### Wallets & Multi-Currency Management
1. As a user, I want to select my `Base Currency` during onboarding and change it at any time in settings, so that my `Net Worth`, cross-wallet insights, and global `Budget`s are displayed in my preferred currency.
2. As a user, I want to create multiple `Wallet`s (such as "Cash Wallet", "Euros", and "Bitcoin"), each with its own currency code, decimal precision (e.g., 2 decimals for USD/EUR, 8 decimals for BTC), icon, color, and starting balance, so that I can track all my money containers in one app.
3. As a user, I want to toggle whether an individual `Wallet` is included in my `Net Worth`, so that I can exclude specific savings stashes or custodial funds from my global total when desired.
4. As a user, I want the app to automatically fetch and cache `Exchange Rate`s for fiat and cryptocurrencies when online and work seamlessly from the local SQLite cache when offline, so that my multi-currency conversions always work without internet dependency.
5. As a user, I want to manually override the `Exchange Rate` for any currency in settings, so that I can use custom or local market rates when offline or traveling.
6. As a user, I want to see each `Wallet`'s balance in its native currency alongside its converted value in my `Base Currency`, as well as my total `Net Worth` across all included `Wallet`s, so that I always know my true financial position.
7. As a user, I want to reorder, edit, archive, or delete `Wallet`s, so that my active Wallets Carousel stays clean as my finances evolve.
8. As a user, I want to directly edit a `Wallet`'s current balance when reconciling my physical cash or bank balance and have the app automatically record a `Balance Adjustment` Transaction, so that my ledger remains audit-proof without polluting my spending `Budget`s or `Expense` charts.

### Fast Daily Transaction Tracking & Classification
9. As a user, I want to tap a prominent floating `+` button from anywhere on the main screen to open a quick-entry bottom sheet with a numeric calculator keypad immediately focused, so that I can start typing an amount with zero extra taps.
10. As a user, I want to perform inline arithmetic (`+`, `-`, `×`, `÷`) directly on the quick-entry keypad (e.g., typing `12.50 + 4.25` to evaluate to `16.75`), so that I can add up receipt items without leaving the app.
11. As a user, I want to log an `Expense` Transaction with an amount, `Wallet`, `Category`, optional `Subcategory`, timestamp (defaulting to now), optional title/merchant, and optional note in under 3 seconds, so that daily tracking feels effortless.
12. As a user, I want to log an `Income` Transaction into any `Wallet` with a `Category` and optional `Subcategory`, so that my earnings and cash inflows are accurately tracked.
13. As a user, I want to log a `Transfer` Transaction between any two `Wallet`s—including cross-currency transfers (e.g., `USD` to `EUR` or `USD` to `BTC`) where the destination inflow amount is pre-calculated using the current `Exchange Rate` but remains manually editable to match exact bank/exchange settlement amounts—so that moving money between my own Wallets never inflates my `Expense` or `Income` totals.
14. As a user, I want every Transaction recorded in a foreign-currency `Wallet` to store an immutable `Snapshot Rate` to the `Base Currency` at the time of the Transaction (with an option to edit that rate on the Transaction), so that historical spending charts and past `Budget Period`s never silently shift when market rates fluctuate later.
15. As a user, I want to create, edit, reorder, and customize top-level `Category` items (with custom names, icons, colors, and default `Expense` or `Income` flow direction) as well as nested `Subcategory` items (one level deep, e.g., `Food & Dining` → `Coffee`, `Groceries`, `Restaurants`), so that my classification system reflects my personal spending habits.
16. As a user, I want the app to ship with a thoughtful set of default `Category` and `Subcategory` presets so that I can start logging Transactions immediately without tedious initial setup.
17. As a user, I want to browse a chronological, date-grouped Transaction log showing each day's net total and individual Transactions with their `Category` icon, color, title, `Subcategory`, `Wallet` badge, native amount, and converted `Base Currency` amount (if different), so that I can review my spending history at a glance.
18. As a user, I want to search and filter my Transaction history by text query (title/note), date range, `Wallet`, `Category` / `Subcategory`, and Transaction type (`Expense`, `Income`, `Transfer`, `Balance Adjustment`), so that I can quickly locate past expenses and audit where my money went.
19. As a user, I want to edit, duplicate, or delete any existing Transaction and have the affected `Wallet` balances and active `Budget` progress update immediately, so that mistakes are trivial to fix.

### Flexible Budgeting & Daily Spending Allowance
20. As a user, I want to create multiple concurrent `Budget`s, each with a custom name, target limit, color/theme, `Budget Period`, and `Budget Scope`, so that I can simultaneously track an overall monthly living budget, a category-specific dining cap, and a short-term vacation budget.
21. As a user, I want to configure a `Budget`'s `Budget Period` as `Weekly`, `Monthly` (anchored to any day of the month, such as payday on the 25th), `Yearly`, a custom recurring interval (`Every N Days`, `Every N Weeks`, or `Every N Months` from a chosen start date), or a one-time `Custom Date Range`, so that my budgets match my real-world cash-flow cycle rather than rigid calendar rules.
22. As a user, I want to configure a `Budget`'s `Budget Scope` as either **Automatic Filter** (automatically counting all `Expense` Transactions matching selected `Category`/`Subcategory` items and/or selected `Wallet`s) or **Manual Assignment** (only counting `Expense` Transactions I explicitly pin to that `Budget`), so that I can track both routine category budgets and isolated event/trip budgets.
23. As a user, I want to see my real-time **`Daily Spending Allowance`** on every active `Budget`, calculated as `max(0, (Budget Limit - Spent in Current Period) / Remaining Days Inclusive)`, so that I know the exact amount I can safely spend per day for the rest of the period.
24. As a user, I want to see a visual progress bar with a "Today" time-elapsed marker on each `Budget` card comparing `% of Budget Spent` vs. `% of Budget Period Elapsed`, so that I can immediately tell if I am pacing ahead or behind schedule.
25. As a user, I want to adjust a `Budget`'s target limit or filter criteria at any time without losing my Transaction data, and inspect past cycles of any recurring `Budget` to compare my historical budget adherence over time.

### Stay Ahead of Bills (Recurring Rules & Upcoming Payments)
26. As a user, I want to create a `Recurring Rule` for repeating subscriptions, bills, or regular income (`Daily`, `Weekly`, `Monthly`, `Yearly`, or custom `Every N Days/Weeks/Months`) specifying the amount, `Wallet`, `Category`/`Subcategory`, next due date, `autoPay` mode, and reminder lead time (`reminderDaysBefore`), so that all my recurring obligations are tracked in one place.
27. As a user, I want to create one-off future `Upcoming Payment`s (such as an annual tax bill or upcoming repair), so that non-recurring future bills are also tracked alongside subscriptions.
28. As a user, I want `Upcoming Payment`s to stay separate from my current `Wallet` balance and current `Budget` spent until they are settled, while showing me a clear summary of "Total Upcoming Bills This Period", so that future obligations don't prematurely distort today's cash balance.
29. As a user, I want `Recurring Rule`s with `autoPay: true` to automatically convert due `Upcoming Payment`s into posted `Transaction`s when their due date arrives and advance the `Recurring Rule` to its next due date, so that automated subscriptions like Netflix require zero manual maintenance.
30. As a user, I want `Recurring Rule`s (or standalone bills) with `autoPay: false` to trigger local Android push notifications before and on the due date and appear in an "Upcoming & Overdue" queue with a 1-tap **"Mark as Paid"** action (allowing me to adjust the final amount if a utility bill varied) or a **"Skip"** action, so that I never miss a manual bill payment.

### Clear Spending Insights & Interactive Analytics
31. As a user, I want to view an interactive **`Spending Pace Comparison`** line chart that plots my cumulative daily `Expense`s for the current period (solid line) overlaid against the previous equivalent period's cumulative `Expense`s (dashed/muted line) with touch-scrubbing tooltips, so that I can immediately spot whether I am spending faster or slower than last period on the same day.
32. As a user, I want to view an interactive **Category Breakdown Donut/Pie Chart** of my `Expense`s (or `Income`) for any selected period, where tapping a `Category` slice highlights its share, drills down into its `Subcategory` breakdown, and lists the underlying Transactions below, so that I can see exactly where my money goes and uncover opportunities to save.
33. As a user, I want to view an interactive **Cash Flow Bar Graph** comparing total `Income` vs. total `Expense` (and net savings) across consecutive weeks, months, or years, so that I can track my savings rate and spot multi-month trends.
34. As a user, I want to view an interactive **Net Worth & Wallet Balance History Line Chart** over configurable time horizons (`1M`, `3M`, `6M`, `1Y`, `All`) reconstructed from my `Wallet` balances and historical Transactions, so that I can see my long-term wealth trajectory.
35. As a user, I want to filter the entire Insights screen by `Wallet` (All Wallets or specific Wallets) and period window, and see key summary metrics (`Average Daily Spend`, `Biggest Expense Category`, `Net Cash Flow`, and `% Change vs. Previous Period`), so that I can make informed financial decisions.

### Personalization, Privacy & Data Portability
36. As a user, I want to customize my Home screen by reordering and toggling the visibility of modular `Home Section` blocks (`Wallets Carousel`, `Pinned Budgets & Daily Spending Allowance`, `Spending Pace Comparison`, `Upcoming Payments`, and `Recent Transactions`), so that the dashboard works the way I do.
37. As a user, I want to customize the app's visual appearance with theme modes (`System`, `Light`, `Dark`, and `AMOLED True Black`) and selectable accent color palettes, plus per-`Wallet` and per-`Category` colors and icons, so that my budget tracker feels personal.
38. As a user, I want a 1-tap **`Privacy Mask`** toggle in the Home header that blurs or masks sensitive balance and transaction amounts on screen, so that I can log expenses in public without exposing my `Net Worth` to bystanders.
39. As a user, I want an optional **Biometric App Lock** (Android fingerprint / face authentication via `expo-local-authentication`) required when launching or resuming the app, so that my financial data is protected even if I hand my unlocked phone to someone else.
40. As a user, I want to export a complete **`Backup Snapshot`** file (JSON bundle containing all Wallets, Categories, Subcategories, Transactions, Budgets, Recurring Rules, Exchange Rates, and Preferences) to local storage or the Android share sheet and restore from a `Backup Snapshot` file at any time, so that I have full ownership and portability of my data without a cloud account.
41. As a user, I want to export my filtered or full `Transaction` history to a standard **CSV** file, so that I can analyze my finances in external spreadsheet tools whenever I choose.

## Implementation Decisions

### 1. Application Architecture & Module Boundaries
- **Stack (per ADR-0001)**: Expo (React Native + TypeScript) with `expo-router` for file-based tab and modal navigation and `expo-sqlite` for synchronous/asynchronous on-device SQLite persistence.
- **Layered Module Structure**:
  - **Database & Migration Module**: Manages the local SQLite connection (supporting both the persistent on-device database file and an in-memory SQLite instance for automated tests), schema migrations, and default seed data (`Base Currency`, default `Category`/`Subcategory` tree, default `Home Section` layout, and initial `Wallet`).
  - **Monetary Precision & Currency Arithmetic Module (per ADR-0003)**: Encapsulates all monetary conversions, scaled-integer subunit representation (`amountMinor` integer paired with `decimalPlaces`), `Snapshot Rate` conversion to `Base Currency`, and inline calculator expression parsing (`+`, `-`, `*`, `/`) so no floating-point drift can occur.
  - **Ledger & Finance Engine (Primary Domain Service Seam)**: Stateless/repository service layer accepting a database handle that executes all domain operations atomically inside SQLite transactions:
    - `WalletService`: CRUD, ordering, `includeInNetWorth` toggling, computed balance retrieval, live `Net Worth` calculation, and manual balance reconciliation (which emits a `Balance Adjustment` Transaction).
    - `ExchangeRateService`: Fetches daily public exchange rates (fiat + major crypto), caches them in SQLite, supports manual user overrides, and resolves both live `Exchange Rate`s and Transaction `Snapshot Rate`s.
    - `TransactionService`: CRUD for `Expense`, `Income`, `Transfer` (dual-wallet with source amount, destination amount, and `Snapshot Rate`), and `Balance Adjustment`, plus rich multi-criteria search/filtering and atomic `Wallet` balance updates.
    - `CategoryService`: Two-level hierarchy management for `Category` and `Subcategory` items with icons, colors, and flow direction (`Expense` | `Income`).
    - `BudgetService`: Computes current and historical `Budget Period` boundaries (weekly, monthly with custom anchor day, yearly, `Every N Days/Weeks/Months`, and custom date ranges), aggregates matching `Expense` Transactions by `Budget Scope` (`Automatic Filter` by Categories/Wallets vs. `Manual Assignment` via explicit `budgetId` links) using each Transaction's `Snapshot Rate`, and computes `Daily Spending Allowance` and pace metrics.
    - `RecurringBillService`: Manages `Recurring Rule` schedules and `Upcoming Payment` lifecycles, processes due `autoPay` rules into posted Transactions on app launch/background wakeup, handles manual `"Mark as Paid"` (with optional amount override) and `"Skip"`, and schedules local notifications via `expo-notifications`.
    - `InsightsService`: Produces chart-ready series for `Spending Pace Comparison` (day-by-day cumulative current vs. previous period), Category/Subcategory breakdown slices, Cash Flow bar series (`Income` vs. `Expense`), and historical `Net Worth` curves.
    - `BackupAndExportService`: Serializes and validates full `Backup Snapshot` JSON bundles (atomic restore with schema version check) and generates RFC-4180 compliant CSV exports.
  - **UI & Presentation Layer**:
    - Bottom Tab Navigation (`Home`, `Transactions`, `Budgets`, `Insights`, `Settings & Bills`) plus a global Floating Action Button (`+`) triggering the **Quick-Entry Calculator Bottom Sheet**.
    - Theme Engine supporting `Light`, `Dark`, and `AMOLED True Black` with customizable accent palettes and global `Privacy Mask` context.
    - Interactive SVG/Canvas charts supporting touch scrubbing and slice selection.

### 2. Core Data Schema & Domain Types

```typescript
// Core domain shapes encoded in SQLite tables

export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'BALANCE_ADJUSTMENT';

export interface Wallet {
  id: string;
  name: string;
  currencyCode: string;      // e.g. 'USD', 'EUR', 'BTC'
  decimalPlaces: number;     // e.g. 2 for USD/EUR, 8 for BTC
  initialBalanceMinor: bigint | string; // exact scaled integer string in SQLite
  currentBalanceMinor: bigint | string; // maintained atomically with transactions
  color: string;
  icon: string;
  includeInNetWorth: boolean;
  sortOrder: number;
  isArchived: boolean;
}

export interface ExchangeRate {
  currencyCode: string;      // Foreign currency code
  baseCurrencyCode: string;  // User's Base Currency code
  rateToBase: number;        // 1 unit of currencyCode = rateToBase units of Base Currency
  isManualOverride: boolean;
  updatedAt: string;         // ISO-8601 timestamp
}

export interface Category {
  id: string;
  parentId: string | null;   // null = top-level Category; non-null = Subcategory
  name: string;
  flowType: 'EXPENSE' | 'INCOME';
  color: string;
  icon: string;
  sortOrder: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  walletId: string;                 // Source wallet (or target wallet for INCOME/BALANCE_ADJUSTMENT)
  destinationWalletId: string | null; // Populated only when type === 'TRANSFER'
  amountMinor: string;              // Exact positive minor-unit integer string in walletId's currency (signed for BALANCE_ADJUSTMENT)
  destinationAmountMinor: string | null; // For TRANSFER: inflow in destinationWalletId's currency
  currencyCode: string;
  decimalPlaces: number;
  snapshotRateToBase: number;       // Immutable Snapshot Rate at transaction time (per ADR-0002)
  categoryId: string | null;        // Top-level Category
  subcategoryId: string | null;     // Optional child Subcategory
  manualBudgetId: string | null;    // Optional explicit link for Manual Assignment Budget Scope
  title: string;
  note: string;
  occurredAt: string;               // ISO-8601 timestamp
  recurringRuleId: string | null;
}

export type BudgetPeriodType = 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'INTERVAL' | 'CUSTOM_RANGE';
export type BudgetScopeType = 'AUTOMATIC_FILTER' | 'MANUAL_ASSIGNMENT';

export interface Budget {
  id: string;
  name: string;
  limitAmountMinor: string;         // Denominated in currencyCode (defaults to Base Currency)
  currencyCode: string;
  decimalPlaces: number;
  periodType: BudgetPeriodType;
  intervalCount: number | null;     // For INTERVAL: e.g. Every 14 Days / Every 2 Weeks
  intervalUnit: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
  anchorDate: string;               // ISO date anchor (or start date for CUSTOM_RANGE)
  endDate: string | null;           // Populated only for CUSTOM_RANGE
  scopeType: BudgetScopeType;
  filterCategoryIds: string[];      // Empty = all categories (when AUTOMATIC_FILTER)
  filterWalletIds: string[];        // Empty = all wallets (when AUTOMATIC_FILTER)
  color: string;
  icon: string;
  isPinnedToHome: boolean;
  sortOrder: number;
}

export interface RecurringRule {
  id: string;
  title: string;
  type: 'EXPENSE' | 'INCOME';
  walletId: string;
  categoryId: string;
  subcategoryId: string | null;
  amountMinor: string;
  currencyCode: string;
  decimalPlaces: number;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'INTERVAL';
  intervalCount: number;
  nextDueDate: string;              // ISO-8601 date (YYYY-MM-DD)
  autoPay: boolean;
  reminderDaysBefore: number;       // e.g. 0 = on due date, 1 = 1 day before
  isActive: boolean;
}
```

### 3. Key Algorithmic Contracts
- **Exact Multi-Currency & Crypto Precision (per ADR-0003)**:
  - Because `BTC` has 8 decimal places (`1 BTC = 100,000,000 satoshis`) and `USD` has 2 (`$1 = 100 cents`), monetary amounts are stored as exact integer minor-unit strings (handled via `BigInt` in TypeScript) alongside `decimalPlaces`.
  - Converting a Transaction's `amountMinor` (with `decimalPlaces = D_w`) to the `Base Currency` (with `decimalPlaces = D_b`) uses:
    $$\text{BaseMinor} = \text{round}\left( \frac{\text{Number}(\text{amountMinor})}{10^{D_w}} \times \text{snapshotRateToBase} \times 10^{D_b} \right)$$
- **Daily Spending Allowance Formula**:
  - Given an active `Budget Period` `[periodStart, periodEnd]` (inclusive calendar days) and `today` clamped into the active period:
    - $\text{remainingDaysInclusive} = \max(1, \text{daysBetween}(\text{today}, \text{periodEnd}) + 1)$
    - $\text{remainingBudgetMinor} = \max(0, \text{limitAmountMinor} - \text{spentInPeriodMinor})$
    - $\text{dailyAllowanceMinor} = \lfloor \text{remainingBudgetMinor} / \text{remainingDaysInclusive} \rfloor$
- **Spending Pace Comparison Curve**:
  - For a period of length $N$ days, constructs two arrays `currentCumulative[1..dayOfToday]` and `previousCumulative[1..N_prev]`, where each entry $d$ equals the sum of converted `Expense` Transactions occurring from day $1$ through day $d$ of that respective period.

## Testing Decisions

- **Philosophy**: Tests must verify external domain behavior through public module boundaries—never internal implementation details, private helpers, or mocked SQL strings.
- **Primary Testing Seam — `Ledger & Finance Engine` backed by In-Memory SQLite**:
  - All core services (`WalletService`, `ExchangeRateService`, `TransactionService`, `CategoryService`, `BudgetService`, `RecurringBillService`, `InsightsService`, `BackupAndExportService`) accept a database driver interface so tests run against a real in-memory SQLite database (`better-sqlite3` / SQLite in-memory adapter in Jest/Vitest) executing the exact same schema migrations and SQL queries as the production app.
  - Behavioral test suites will verify:
    1. **Multi-Currency Wallets & Net Worth**: Creating USD (2 decimals), EUR (2 decimals), and BTC (8 decimals) `Wallet`s; toggling `includeInNetWorth`; verifying live `Exchange Rate` changes update `Net Worth` while leaving past Transaction `Snapshot Rate`s untouched.
    2. **4-Type Transaction Ledger Invariants**: Recording `Expense`, `Income`, cross-currency `Transfer` (verifying source deduction, destination addition, and exclusion from Expense/Income budgets), and manual balance reconciliation (`Balance Adjustment`).
    3. **Flexible Budgets & Daily Spending Allowance**: Verifying `Weekly`, `Monthly` (custom anchor day), `Interval`, and `Custom Date Range` period calculation; `Automatic Filter` (by Category/Subcategory and Wallet) vs. `Manual Assignment` scope; and exact `Daily Spending Allowance` math across under-budget, on-budget, and over-budget states.
    4. **Recurring Rules & Upcoming Payments**: Verifying `autoPay: true` auto-settles due items on process without double-posting, and `autoPay: false` leaves items pending until `"Mark as Paid"` (with optional amount override) or `"Skip"` is called.
    5. **Spending Pace Comparison & Insights**: Verifying cumulative daily pace series generation for current vs. previous periods and Category/Subcategory drill-down aggregation.
    6. **Backup Snapshot Round-Trip & CSV Export**: Exporting a populated database to a `Backup Snapshot`, wiping the database, restoring the snapshot, and verifying 100% state equality.
- **Secondary Testing Seam — `Inline Calculator Expression Parser`**:
  - Pure unit tests verifying chained keypad expressions (`12.50 + 4.25`, `100 - 25 * 2`, division rounding, and invalid trailing operators) resolve to exact minor-unit amounts.

## Out of Scope

- Cloud user accounts, remote authentication servers, or multi-device cloud database sync (by design: PennyWise is strictly local-first and private).
- Direct bank account scraping / Open Banking (Plaid/SaltEdge) integration.
- Stock brokerage order execution or live candlestick trading terminals.
- Split-receipt transactions across multiple categories within a single transaction record (we chose the clean 4-type Transaction model with Category + Subcategory).

## Further Notes

- All domain terminology in code, database tables, tests, and UI must strictly adhere to `GLOSSARY.md` (`Wallet`, `Base Currency`, `Exchange Rate`, `Snapshot Rate`, `Net Worth`, `Transaction`, `Expense`, `Income`, `Transfer`, `Balance Adjustment`, `Category`, `Subcategory`, `Budget`, `Budget Period`, `Budget Scope`, `Daily Spending Allowance`, `Recurring Rule`, `Upcoming Payment`, `Spending Pace Comparison`, `Home Section`, `Backup Snapshot`, `Privacy Mask`).
- All architectural choices must respect `docs/adr/0001-expo-local-first-architecture.md`, `docs/adr/0002-multi-currency-snapshot-and-live-rates.md`, and `docs/adr/0003-exact-monetary-precision-across-fiat-and-crypto.md`.

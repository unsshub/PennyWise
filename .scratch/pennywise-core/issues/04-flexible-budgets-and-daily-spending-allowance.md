# 04 — Flexible Budgets & Dynamic Daily Spending Allowance

**What to build:** Enable users to create and track multiple concurrent `Budget`s over any recurring or custom `Budget Period` (`Weekly`, `Monthly` anchored to any payday, `Yearly`, custom `Every N Days/Weeks/Months`, or `Custom Date Range`) with either `Automatic Filter` or `Manual Assignment` `Budget Scope`, displaying real-time `Daily Spending Allowance` calculations, visual spending-pace progress bars, and historical period comparisons.

**Blocked by:** 02 — Categories, Subcategories & Calculator Quick-Entry for Expenses and Income

**Status:** resolved

- [x] User can create, edit, reorder, and delete multiple concurrent `Budget`s, each with a custom name, target limit, color/icon, `Budget Period`, `Budget Scope`, and `isPinnedToHome` toggle.
- [x] `Budget Period` supports `Weekly`, `Monthly` (with any configurable anchor day of the month, such as payday on the 25th), `Yearly`, custom recurring intervals (`Every N Days`, `Every N Weeks`, `Every N Months` from an anchor date), and one-time `Custom Date Range`s.
- [x] `Budget Scope` supports both **Automatic Filter** (automatically aggregating `Expense` `Transaction`s matching selected `Category`/`Subcategory` items and/or selected `Wallet`s, or all expenses when left unfiltered) and **Manual Assignment** (aggregating only `Expense` `Transaction`s explicitly linked to that `Budget`, such as for a vacation or event).
- [x] Cross-currency `Expense` `Transaction`s matching a `Budget` are converted into the `Budget`'s currency using each `Transaction`'s immutable `Snapshot Rate`.
- [x] Every active `Budget` displays its real-time **`Daily Spending Allowance`** calculated as `max(0, (Budget Limit - Spent in Current Period) / Remaining Days Inclusive)`, alongside total spent, remaining amount, and a progress bar with a "Today" time-elapsed marker comparing `% of Budget Spent` vs. `% of Budget Period Elapsed`.
- [x] User can step backward through past cycles of any recurring `Budget` to inspect historical budget adherence and adjust a `Budget`'s target limit at any time.
- [x] Automated behavioral tests at the `Ledger & Finance Engine` seam verify period boundary math across all `BudgetPeriodType`s, `Automatic Filter` vs. `Manual Assignment` aggregation with multi-currency `Snapshot Rate`s, and exact `Daily Spending Allowance` calculations across under-budget, on-budget, and over-budget scenarios.

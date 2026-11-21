# 06 — Interactive Spending Insights & Spending Pace Comparison Charts

**What to build:** Deliver the interactive Insights & Analytics tab featuring the signature cumulative **`Spending Pace Comparison`** line chart (overlaying current period vs. previous period spending), drill-down **Category → Subcategory Breakdown Donut Chart**, **Income vs. Expense Cash Flow Bar Graph**, and **Net Worth History Line Chart**, all filterable by time period and `Wallet`.

**Blocked by:** 02 — Categories, Subcategories & Calculator Quick-Entry for Expenses and Income

**Status:** ready-for-agent

- [ ] Insights tab provides universal filters at the top for time window (`Week`, `Month`, `Year`, `Custom Period`) and `Wallet` scope (`All Wallets` or specific `Wallet`s), converting multi-currency `Transaction`s to the `Base Currency` via their `Snapshot Rate`.
- [ ] **`Spending Pace Comparison` Line Chart**: Plots cumulative daily `Expense`s for the current period (solid line up to today) overlaid against the previous equivalent period's cumulative `Expense`s (dashed/muted line) with interactive touch-scrubbing tooltips showing the exact day-by-day difference.
- [ ] **Category Breakdown Donut/Pie Chart**: Displays percentage and monetary breakdown of `Expense`s (or `Income`) by top-level `Category`; tapping a slice drills down into its child `Subcategory` breakdown and filters the matching `Transaction` list below.
- [ ] **Cash Flow Bar Graph**: Compares total `Income` vs. total `Expense` and net savings across consecutive weeks, months, or years.
- [ ] **Net Worth & Wallet Balance History Line Chart**: Plots historical `Net Worth` (or selected `Wallet` balance) trajectory over `1M`, `3M`, `6M`, `1Y`, and `All` time horizons.
- [ ] Insights summary cards display `Average Daily Spend`, `Top Expense Category`, `Net Cash Flow`, and `% Change vs. Previous Period`.
- [ ] Automated behavioral tests at the `Ledger & Finance Engine` seam verify cumulative daily `Spending Pace Comparison` series generation, Category-to-Subcategory drill-down aggregation, multi-period Cash Flow bar series, and historical balance curve reconstruction.

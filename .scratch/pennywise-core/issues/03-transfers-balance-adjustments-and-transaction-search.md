# 03 — Inter-Wallet Cross-Currency Transfers, Balance Adjustments & Transaction Search/Filters

**What to build:** Complete the 4-type `Transaction` model by adding inter-wallet `Transfer` `Transaction`s (including cross-currency transfers between fiat and crypto `Wallet`s) and automatic `Balance Adjustment` `Transaction`s when a user reconciles a `Wallet`'s current balance directly, plus comprehensive search and multi-criteria filtering on the Transactions tab.

**Blocked by:** 02 — Categories, Subcategories & Calculator Quick-Entry for Expenses and Income

**Status:** resolved

- [x] User can log a `Transfer` `Transaction` in the Quick-Entry sheet by selecting a source `Wallet` and a destination `Wallet`; when the two `Wallet`s have different currencies (e.g., `USD` to `EUR` or `USD` to `BTC`), the destination inflow amount is pre-calculated using the current `Exchange Rate` and remains manually editable to match exact bank/exchange settlement amounts.
- [x] Recording, editing, or deleting a `Transfer` atomically updates both the source `Wallet` and destination `Wallet` balances while excluding the `Transfer` from `Expense` and `Income` spending totals.
- [x] User can directly edit a `Wallet`'s current balance to reconcile physical cash or bank balances, which automatically records a signed `Balance Adjustment` `Transaction` for the delta so the ledger remains audit-proof without distorting `Expense` or `Income` totals.
- [x] User can search and filter the Transaction log by free-text query (matching title or note), date range, `Wallet`, `Category` / `Subcategory`, and `Transaction` type (`Expense`, `Income`, `Transfer`, `Balance Adjustment`).
- [x] Automated behavioral tests at the `Ledger & Finance Engine` seam verify same-currency and cross-currency `Transfer` balance invariants, `Balance Adjustment` creation on manual balance reconciliation, exclusion of `Transfer` and `Balance Adjustment` from spending totals, and multi-criteria transaction search/filtering.

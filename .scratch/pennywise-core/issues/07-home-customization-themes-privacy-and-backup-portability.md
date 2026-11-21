# 07 — Modular Home Sections, Themes, Privacy Mask, Biometric Lock & Backup Snapshot / CSV Portability

**What to build:** Deliver full personalization, on-device privacy protection, and offline data portability: reorderable and toggleable `Home Section` blocks on the Home dashboard, customizable themes (`System`, `Light`, `Dark`, `AMOLED True Black`) and accent color palettes, 1-tap `Privacy Mask` balance blurring, optional Android Biometric App Lock, CSV transaction export, and full offline `Backup Snapshot` export and restore.

**Blocked by:**
- 03 — Inter-Wallet Cross-Currency Transfers, Balance Adjustments & Transaction Search/Filters
- 04 — Flexible Budgets & Dynamic Daily Spending Allowance
- 05 — Recurring Rules, Upcoming Payments & Bill Reminders
- 06 — Interactive Spending Insights & Spending Pace Comparison Charts

**Status:** ready-for-agent

- [ ] Home dashboard renders modular `Home Section` blocks (`Wallets Carousel`, `Pinned Budgets & Daily Spending Allowance`, `Spending Pace Comparison`, `Upcoming Payments`, and `Recent Transactions`), and users can reorder or toggle visibility of any `Home Section` with persistence in SQLite.
- [ ] User can switch between `System`, `Light`, `Dark`, and `AMOLED True Black` theme modes and choose custom accent color palettes that apply across charts, buttons, and cards.
- [ ] Tapping the 1-tap **`Privacy Mask`** toggle in the Home header immediately obscures/blurs all monetary balances and transaction amounts across the app until toggled off.
- [ ] User can enable an optional **Biometric App Lock** (`expo-local-authentication`) that prompts for Android fingerprint / face authentication on app launch and background resume.
- [ ] User can export a complete **`Backup Snapshot`** JSON file via the native Android share sheet / file system and restore a `Backup Snapshot` file via the document picker, atomically replacing or restoring all `Wallet`s, `Category`/`Subcategory` trees, `Transaction`s, `Budget`s, `Recurring Rule`s, `Upcoming Payment`s, `Exchange Rate`s, and user preferences.
- [ ] User can export their full or filtered `Transaction` log to a standard RFC-4180 **CSV** file.
- [ ] Automated behavioral tests at the `Ledger & Finance Engine` seam verify `Home Section` layout persistence, RFC-4180 CSV generation (including proper escaping of commas/quotes and multi-currency columns), and 100% lossless round-trip export and restore of a full `Backup Snapshot`.

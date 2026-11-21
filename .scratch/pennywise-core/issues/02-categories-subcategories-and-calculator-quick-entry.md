# 02 — Categories, Subcategories & Calculator Quick-Entry for Expenses and Income

**What to build:** Deliver the two-level `Category` and `Subcategory` classification system (pre-seeded with sensible defaults and fully customizable with icons and colors), the floating `+` **Calculator Quick-Entry Bottom Sheet** with inline arithmetic (`+`, `-`, `×`, `÷`), and the date-grouped Transaction History tab for logging, browsing, editing, and deleting `Expense` and `Income` `Transaction`s with immutable `Snapshot Rate`s (per ADR-0002).

**Blocked by:** 01 — App Foundation, Multi-Currency Wallets Carousel & Net Worth Header

**Status:** resolved

- [x] Database seeds a default set of top-level `Category` and child `Subcategory` items for both `Expense` and `Income` flows (e.g., `Food & Dining` → `Groceries`, `Coffee`, `Restaurants`; `Housing`; `Transport`; `Salary`), and users can create, edit, reorder, or delete `Category` and `Subcategory` items with custom icons and colors.
- [x] Tapping the global floating `+` button opens the Quick-Entry Bottom Sheet with the numeric calculator keypad immediately focused for sub-3-second entry.
- [x] The calculator keypad evaluates chained inline arithmetic expressions (`+`, `-`, `×`, `÷`, e.g., `12.50 + 4.25` → `16.75`) into exact minor-unit amounts in the selected `Wallet`'s currency precision.
- [x] User can log an `Expense` or `Income` `Transaction` with an amount, `Wallet`, `Category`, optional `Subcategory`, timestamp (defaulting to now), optional title, and optional note.
- [x] Every logged `Transaction` captures an immutable `Snapshot Rate` from the `Wallet`'s currency to the `Base Currency` at creation time (editable on the `Transaction` if desired) and atomically updates the `Wallet`'s balance and `Net Worth`.
- [x] Subsequent changes to live `Exchange Rate`s update `Net Worth` without mutating the converted `Base Currency` value of historical `Transaction`s.
- [x] Transactions tab displays a chronological, date-grouped log showing each day's net total and each `Transaction`'s `Category` icon/color, title, `Subcategory`, `Wallet` badge, native amount, and converted `Base Currency` amount, with full support for editing, duplicating, and deleting `Transaction`s.
- [x] Automated behavioral tests verify the `Inline Calculator Expression Parser` seam and test `Category`/`Subcategory` management, `Expense`/`Income` logging, `Snapshot Rate` immutability, and atomic `Wallet` balance updates on edit/delete.

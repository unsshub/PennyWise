# 05 — Recurring Rules, Upcoming Payments & Bill Reminders

**What to build:** Enable users to stay ahead of subscriptions, recurring bills, regular income, and one-off future obligations using `Recurring Rule`s and `Upcoming Payment`s, complete with automatic settlement (`autoPay: true`), manual 1-tap `"Mark as Paid"` confirmation (`autoPay: false`), and local Android push notification reminders.

**Blocked by:** 02 — Categories, Subcategories & Calculator Quick-Entry for Expenses and Income

**Status:** resolved

- [x] User can create, edit, pause, and delete a `Recurring Rule` (`Daily`, `Weekly`, `Monthly`, `Yearly`, or custom `Every N Days/Weeks/Months`) specifying title, `Expense` or `Income` type, amount, `Wallet`, `Category`/`Subcategory`, `nextDueDate`, `autoPay` toggle, and `reminderDaysBefore`.
- [x] User can create standalone one-off future `Upcoming Payment`s (such as an upcoming annual bill) alongside recurring subscriptions.
- [x] Unsettled `Upcoming Payment`s do not alter current `Wallet` balances or active `Budget` spent totals, and the Bills view summarizes total upcoming obligations for the current period.
- [x] When due dates arrive, `Recurring Rule`s with `autoPay: true` automatically post due `Upcoming Payment`s as `Transaction`s (capturing the current `Snapshot Rate` and updating the `Wallet` balance) and advance `nextDueDate` to the next cycle without duplicate posting.
- [x] `Recurring Rule`s and standalone bills with `autoPay: false` schedule local Android push notifications (`expo-notifications`) according to `reminderDaysBefore` and appear in the "Upcoming & Overdue" queue with 1-tap **"Mark as Paid"** (allowing the user to tweak the final amount before posting the `Transaction`) and **"Skip"** actions.
- [x] Automated behavioral tests at the `Ledger & Finance Engine` seam verify recurring schedule advancement, idempotent `autoPay` settlement across single and multi-cycle catch-up windows, manual `"Mark as Paid"` with amount overrides, `"Skip"` behavior, and isolation of unsettled `Upcoming Payment`s from `Wallet` balances and `Budget`s.

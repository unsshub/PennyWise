# 01 — App Foundation, Multi-Currency Wallets Carousel & Net Worth Header

**What to build:** Scaffold the Expo (React Native + TypeScript) application with on-device SQLite persistence (`expo-sqlite` plus an in-memory SQLite test adapter) and exact minor-unit monetary arithmetic (per ADR-0001 and ADR-0003). Deliver end-to-end management of the user's `Base Currency`, cached and manually overridable `Exchange Rate`s, multi-currency `Wallet`s (supporting both 2-decimal fiat like `USD`/`EUR` and 8-decimal cryptocurrency like `BTC`), and the Home screen's live `Net Worth` header and Wallets Carousel.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] App boots into a bottom-tab navigation shell with an initialized on-device SQLite database and default seed data (`Base Currency` defaulted to `USD`, default `Exchange Rate` cache, and an initial Cash `Wallet`).
- [ ] All monetary storage and calculations use exact integer minor units (`BigInt` / integer string paired with `decimalPlaces`) with zero IEEE-754 floating-point rounding drift across 2-decimal fiat and 8-decimal crypto currencies.
- [ ] User can view and change their `Base Currency` at any time, automatically recalculating `Net Worth` and converted `Wallet` display balances.
- [ ] User can create, edit, reorder, archive, and delete multiple `Wallet`s (e.g., "Cash Wallet" in `USD`, "Euros" in `EUR`, "Bitcoin" in `BTC`), customizing each `Wallet`'s name, currency code, starting balance, icon, color, and `includeInNetWorth` toggle.
- [ ] App fetches public `Exchange Rate`s when online, caches them in SQLite for offline operation, and allows the user to manually override any currency's `Exchange Rate` to the `Base Currency`.
- [ ] Home screen displays the total `Net Worth` in the `Base Currency` (summing only non-archived `Wallet`s with `includeInNetWorth: true` converted at the latest cached `Exchange Rate`) alongside an interactive Wallets Carousel showing each `Wallet`'s native balance and converted `Base Currency` value.
- [ ] Automated behavioral tests at the `Ledger & Finance Engine` in-memory SQLite seam verify multi-currency `Wallet` CRUD, 2-decimal and 8-decimal precision, `Exchange Rate` caching/overrides, `includeInNetWorth` filtering, and `Net Worth` calculation.

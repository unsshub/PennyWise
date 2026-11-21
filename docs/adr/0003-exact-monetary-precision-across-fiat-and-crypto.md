# Integer Minor-Unit / Scaled-Integer Monetary Arithmetic

To prevent IEEE-754 floating-point rounding errors across multi-currency Wallets (ranging from 2-decimal fiat like `USD`/`EUR` to 8-decimal cryptocurrency like `BTC`), all monetary amounts in SQLite and business logic are stored and computed using exact decimal scaling (stored as exact numeric strings or scaled integer subunits paired with the currency's `decimalPlaces`, plus high-precision `Snapshot Rate` multipliers). Floating-point numbers are only formatted for display or chart rendering at the UI boundary.

# Snapshot Exchange Rates on Transactions and Live Cached Rates for Net Worth

We store an immutable `Snapshot Rate` on each Transaction at creation time while maintaining a locally cached `Exchange Rate` table (updated automatically when online or overridden manually) for current Wallet balances. Historical transactions, spending charts, and Budgets use each Transaction's `Snapshot Rate` so past budget periods never retroactively drift when fiat or crypto prices fluctuate, whereas `Net Worth` uses the latest cached `Exchange Rate` to reflect real-time portfolio value.

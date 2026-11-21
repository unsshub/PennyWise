// @ts-nocheck
import assert from 'node:assert/strict';
import test from 'node:test';

import { createInMemoryFinanceEngine } from '../finance-engine';

test('Slice 01 — initializes default Base Currency (USD), default Cash Wallet, and computes Net Worth across multi-currency Wallets (USD, EUR, BTC)', () => {
  const engine = createInMemoryFinanceEngine();

  // Default state on boot
  assert.equal(engine.getBaseCurrency(), 'USD');
  const initialWallets = engine.listWallets();
  assert.equal(initialWallets.length, 1);
  assert.equal(initialWallets[0].name, 'Cash Wallet');
  assert.equal(initialWallets[0].currencyCode, 'USD');
  assert.equal(initialWallets[0].decimalPlaces, 2);
  assert.equal(initialWallets[0].currentBalanceMinor, '0');
  assert.equal(engine.calculateNetWorthMinor(), '0');

  // Update Cash Wallet initial/current balance to $500.00 (50000 cents)
  engine.updateWallet(initialWallets[0].id, {
    name: 'Wallet',
    initialBalanceMinor: '50000',
  });

  // Create a Euros Wallet with €200.00 (20000 cents, 2 decimals)
  const eurWallet = engine.createWallet({
    name: 'Euros',
    currencyCode: 'EUR',
    decimalPlaces: 2,
    initialBalanceMinor: '20000',
    color: '#3B82F6',
    icon: '€',
    includeInNetWorth: true,
  });

  // Create a Bitcoin Wallet with 0.05000000 BTC (5,000,000 satoshis, 8 decimals)
  const btcWallet = engine.createWallet({
    name: 'Bitcoin',
    currencyCode: 'BTC',
    decimalPlaces: 8,
    initialBalanceMinor: '5000000',
    color: '#F59E0B',
    icon: '₿',
    includeInNetWorth: true,
  });

  // Set Exchange Rates to USD: 1 EUR = 1.10 USD, 1 BTC = 90000.00 USD
  engine.setExchangeRate({
    currencyCode: 'EUR',
    rateToBase: 1.1,
    isManualOverride: true,
  });
  engine.setExchangeRate({
    currencyCode: 'BTC',
    rateToBase: 90000,
    isManualOverride: true,
  });

  // Expected Net Worth in USD cents:
  // $500.00 (50000) + €200.00 * 1.10 ($220.00 = 22000) + 0.05 BTC * 90000 ($4500.00 = 450000) = $5220.00 (522000 cents)
  assert.equal(engine.calculateNetWorthMinor(), '522000');

  // Exclude Bitcoin Wallet from Net Worth -> Net Worth becomes $500 + $220 = $720.00 (72000 cents)
  engine.updateWallet(btcWallet.id, { includeInNetWorth: false });
  assert.equal(engine.calculateNetWorthMinor(), '72000');

  // Re-include Bitcoin Wallet, then change Base Currency to EUR (1 EUR = 1.10 USD -> 1 USD = 1/1.10 EUR)
  engine.updateWallet(btcWallet.id, { includeInNetWorth: true });
  engine.setBaseCurrency('EUR');
  assert.equal(engine.getBaseCurrency(), 'EUR');

  // Reordering and archiving wallets
  engine.reorderWallets([btcWallet.id, eurWallet.id, initialWallets[0].id]);
  const reordered = engine.listWallets();
  assert.equal(reordered[0].id, btcWallet.id);
  assert.equal(reordered[1].id, eurWallet.id);

  engine.updateWallet(eurWallet.id, { isArchived: true });
  assert.equal(engine.listWallets().length, 2);
  assert.equal(engine.listWallets({ includeArchived: true }).length, 3);
});

test('Slice 02a — Inline Calculator Expression Parser evaluates chained arithmetic (+, -, ×, ÷) into exact minor-unit amounts', async () => {
  const { evaluateCalculatorExpression } = await import('../calculator');

  // Simple addition: 12.50 + 4.25 = 16.75 -> 1675 cents (2 decimals)
  const addResult = evaluateCalculatorExpression('12.50 + 4.25', 2);
  assert.equal(addResult.isValid, true);
  assert.equal(addResult.amountMinor, '1675');
  assert.equal(addResult.displayMajor, '16.75');

  // Operator precedence: 100 - 25 × 2 = 50.00 -> 5000 cents
  const precResult = evaluateCalculatorExpression('100 - 25 × 2', 2);
  assert.equal(precResult.isValid, true);
  assert.equal(precResult.amountMinor, '5000');

  // Division and trailing operator tolerance: '45 ÷ 4 +' -> 11.25 -> 1125 cents
  const divResult = evaluateCalculatorExpression('45 ÷ 4 +', 2);
  assert.equal(divResult.isValid, true);
  assert.equal(divResult.amountMinor, '1125');

  // 8-decimal crypto precision (BTC): '0.025 + 0.005' -> 0.03000000 BTC = 3,000,000 satoshis
  const btcResult = evaluateCalculatorExpression('0.025 + 0.005', 8);
  assert.equal(btcResult.isValid, true);
  assert.equal(btcResult.amountMinor, '3000000');
});

test('Slice 02b — Categories, Subcategories, and logging Expense & Income Transactions with immutable Snapshot Rates', () => {
  const engine = createInMemoryFinanceEngine();
  const usdWallet = engine.listWallets()[0];
  engine.updateWallet(usdWallet.id, { initialBalanceMinor: '100000' }); // $1,000.00

  const eurWallet = engine.createWallet({
    name: 'Euros',
    currencyCode: 'EUR',
    decimalPlaces: 2,
    initialBalanceMinor: '50000', // €500.00
  });

  // Set EUR Exchange Rate to 1.08 USD on Nov 1
  engine.setExchangeRate({ currencyCode: 'EUR', rateToBase: 1.08 });

  // Default seeded categories & subcategories exist
  const categories = engine.listCategories();
  assert.ok(categories.length >= 6);
  const foodCat = categories.find((c) => c.name === 'Food & Dining' && c.parentId === null);
  assert.ok(foodCat);
  const subcats = engine.listSubcategories(foodCat.id);
  assert.ok(subcats.length >= 2);
  const coffeeSub = subcats.find((s) => s.name === 'Coffee');
  assert.ok(coffeeSub);

  // User can also create a custom Category and Subcategory
  const customCat = engine.createCategory({
    name: 'Pets',
    flowType: 'EXPENSE',
    color: '#EC4899',
    icon: '🐾',
  });
  const customSub = engine.createCategory({
    parentId: customCat.id,
    name: 'Vet Visits',
    flowType: 'EXPENSE',
    color: '#EC4899',
    icon: '🩺',
  });
  assert.equal(engine.listSubcategories(customCat.id)[0].id, customSub.id);

  // Log a €50.00 (5000 cents) dinner Expense from Euros Wallet on Nov 1 at rate 1.08 ($54.00)
  const dinnerTx = engine.recordTransaction({
    type: 'EXPENSE',
    walletId: eurWallet.id,
    amountMinor: '5000',
    categoryId: foodCat.id,
    subcategoryId: coffeeSub.id,
    title: 'Bistro Paris',
    note: 'Dinner with friends',
    occurredAt: '2026-11-01T19:30:00.000Z',
  });

  assert.equal(dinnerTx.snapshotRateToBase, 1.08);
  assert.equal(engine.convertTransactionToBaseMinor(dinnerTx), '5400'); // $54.00
  assert.equal(engine.getWallet(eurWallet.id).currentBalanceMinor, '45000'); // €450.00 remaining

  // Now live EUR Exchange Rate shifts to 1.20 USD on Nov 20
  engine.setExchangeRate({ currencyCode: 'EUR', rateToBase: 1.2 });

  // Live Net Worth uses 1.20 ($1,000 + €450 * 1.20 = $1,540.00 = 154000 cents)
  assert.equal(engine.calculateNetWorthMinor(), '154000');

  // Historical dinner Transaction keeps its immutable Snapshot Rate of 1.08 ($54.00 = 5400 cents)
  const fetchedDinner = engine.getTransaction(dinnerTx.id);
  assert.equal(fetchedDinner.snapshotRateToBase, 1.08);
  assert.equal(engine.convertTransactionToBaseMinor(fetchedDinner), '5400');

  // Log an Income Transaction of $2,500.00 (250000 cents) into USD Wallet
  const incomeCat = categories.find((c) => c.flowType === 'INCOME' && c.parentId === null);
  const salaryTx = engine.recordTransaction({
    type: 'INCOME',
    walletId: usdWallet.id,
    amountMinor: '250000',
    categoryId: incomeCat.id,
    title: 'Monthly Salary',
    occurredAt: '2026-11-02T09:00:00.000Z',
  });
  assert.equal(engine.getWallet(usdWallet.id).currentBalanceMinor, '350000'); // $3,500.00

  // Editing dinner Transaction from €50.00 to €60.00 updates Euros Wallet balance to €440.00 (44000)
  engine.updateTransaction(dinnerTx.id, { amountMinor: '6000' });
  assert.equal(engine.getWallet(eurWallet.id).currentBalanceMinor, '44000');

  // Deleting salary Transaction restores USD Wallet balance to $1,000.00 (100000)
  engine.deleteTransaction(salaryTx.id);
  assert.equal(engine.getWallet(usdWallet.id).currentBalanceMinor, '100000');
});

test('Slice 03 — Inter-Wallet Cross-Currency Transfers, manual Wallet reconciliation via Balance Adjustment, and Transaction search/filtering', () => {
  const engine = createInMemoryFinanceEngine();
  const usdWallet = engine.listWallets()[0];
  engine.updateWallet(usdWallet.id, { initialBalanceMinor: '200000' }); // $2,000.00

  const eurWallet = engine.createWallet({
    name: 'Euros',
    currencyCode: 'EUR',
    decimalPlaces: 2,
    initialBalanceMinor: '10000', // €100.00
  });

  const btcWallet = engine.createWallet({
    name: 'Bitcoin',
    currencyCode: 'BTC',
    decimalPlaces: 8,
    initialBalanceMinor: '0',
  });

  engine.setExchangeRate({ currencyCode: 'EUR', rateToBase: 1.1 });
  engine.setExchangeRate({ currencyCode: 'BTC', rateToBase: 100000 });

  // Cross-currency Transfer: $550.00 (55000 cents) from USD Wallet to Euros Wallet
  // Pre-calculated inflow at 1 EUR = 1.10 USD is €500.00 (50000 cents), or user specifies €495.00 (49500) after bank fee
  const transferTx = engine.recordTransaction({
    type: 'TRANSFER',
    walletId: usdWallet.id,
    destinationWalletId: eurWallet.id,
    amountMinor: '55000',
    destinationAmountMinor: '49500',
    title: 'Wise USD to EUR Transfer',
    occurredAt: '2026-11-05T12:00:00.000Z',
  });

  assert.equal(engine.getWallet(usdWallet.id).currentBalanceMinor, '145000'); // $1,450.00
  assert.equal(engine.getWallet(eurWallet.id).currentBalanceMinor, '59500'); // €595.00

  // Cross-currency Transfer to Bitcoin with automatic destination calculation: $1,000.00 (100000 cents) at $100,000/BTC -> 0.01000000 BTC (1000000 satoshis)
  const btcTransferTx = engine.recordTransaction({
    type: 'TRANSFER',
    walletId: usdWallet.id,
    destinationWalletId: btcWallet.id,
    amountMinor: '100000',
    title: 'Buy BTC',
    occurredAt: '2026-11-06T12:00:00.000Z',
  });
  assert.equal(btcTransferTx.destinationAmountMinor, '1000000');
  assert.equal(engine.getWallet(usdWallet.id).currentBalanceMinor, '45000'); // $450.00
  assert.equal(engine.getWallet(btcWallet.id).currentBalanceMinor, '1000000'); // 0.01 BTC

  // Manual Balance Reconciliation on USD Wallet: user counts physical cash and sets balance from $450.00 to $442.00 (44200 cents)
  const adjTx = engine.reconcileWalletBalance(
    usdWallet.id,
    '44200',
    'Cash count reconciliation',
    '2026-11-07T18:00:00.000Z'
  );
  assert.ok(adjTx);
  assert.equal(adjTx.type, 'BALANCE_ADJUSTMENT');
  assert.equal(adjTx.amountMinor, '-800'); // -$8.00 adjustment
  assert.equal(engine.getWallet(usdWallet.id).currentBalanceMinor, '44200');

  // Record a normal Expense of $25.00 on Coffee
  const foodCat = engine.listCategories().find((c) => c.name === 'Food & Dining');
  const coffeeSub = engine.listSubcategories(foodCat.id).find((s) => s.name === 'Coffee');
  engine.recordTransaction({
    type: 'EXPENSE',
    walletId: usdWallet.id,
    amountMinor: '2500',
    categoryId: foodCat.id,
    subcategoryId: coffeeSub.id,
    title: 'Blue Bottle Coffee',
    note: 'Morning latte',
    occurredAt: '2026-11-08T08:30:00.000Z',
  });

  // Search and Filter transactions
  const queryMatches = engine.queryTransactions({ searchQuery: 'latte' });
  assert.equal(queryMatches.length, 1);
  assert.equal(queryMatches[0].title, 'Blue Bottle Coffee');

  const transferMatches = engine.queryTransactions({ types: ['TRANSFER'] });
  assert.equal(transferMatches.length, 2);

  const eurWalletMatches = engine.queryTransactions({ walletId: eurWallet.id });
  assert.equal(eurWalletMatches.length, 1); // Transfer into Euros Wallet shows up when filtering by Euros Wallet
  assert.equal(eurWalletMatches[0].id, transferTx.id);

  // Verify period Expense/Income summary excludes TRANSFER and BALANCE_ADJUSTMENT
  const summary = engine.summarizePeriodCashFlow({
    startDate: '2026-11-01',
    endDate: '2026-11-30',
  });
  assert.equal(summary.totalExpenseBaseMinor, '2500'); // Only the $25.00 coffee expense!
  assert.equal(summary.totalIncomeBaseMinor, '0');
});

test('Slice 04 — Flexible Budgets (Monthly, Custom Interval, Custom Date Range), Automatic Filter vs. Manual Assignment Scope, and Daily Spending Allowance math', () => {
  const engine = createInMemoryFinanceEngine();
  const usdWallet = engine.listWallets()[0];
  const eurWallet = engine.createWallet({
    name: 'Euros',
    currencyCode: 'EUR',
    decimalPlaces: 2,
    initialBalanceMinor: '100000',
  });
  engine.setExchangeRate({ currencyCode: 'EUR', rateToBase: 1.1 });

  const categories = engine.listCategories();
  const foodCat = categories.find((c) => c.name === 'Food & Dining');
  const transportCat = categories.find((c) => c.name === 'Transportation');

  // 1. Overall Monthly Budget: $900.00 (90000 cents) for November 2026 (30 days: 2026-11-01 to 2026-11-30)
  const monthlyBudget = engine.createBudget({
    name: 'Monthly Living',
    limitAmountMinor: '90000',
    periodType: 'MONTHLY',
    anchorDate: '2026-11-01',
    scopeType: 'AUTOMATIC_FILTER',
    filterCategoryIds: [],
    filterWalletIds: [],
  });

  // 2. Category-Specific Budget: $300.00 (30000 cents) on Food & Dining only
  const foodBudget = engine.createBudget({
    name: 'Food & Dining Cap',
    limitAmountMinor: '30000',
    periodType: 'MONTHLY',
    anchorDate: '2026-11-01',
    scopeType: 'AUTOMATIC_FILTER',
    filterCategoryIds: [foodCat.id],
    filterWalletIds: [],
  });

  // 3. Manual Assignment Trip Budget: $1,500.00 (150000 cents) Custom Date Range 2026-11-10 to 2026-11-19 (10 days)
  const tripBudget = engine.createBudget({
    name: 'Euro Vacation',
    limitAmountMinor: '150000',
    periodType: 'CUSTOM_RANGE',
    anchorDate: '2026-11-10',
    endDate: '2026-11-19',
    scopeType: 'MANUAL_ASSIGNMENT',
  });

  // Log $250.00 Food Expense in USD Wallet on Nov 3
  engine.recordTransaction({
    type: 'EXPENSE',
    walletId: usdWallet.id,
    amountMinor: '25000',
    categoryId: foodCat.id,
    title: 'Whole Foods Groceries',
    occurredAt: '2026-11-03T10:00:00.000Z',
  });

  // Log $150.00 Transport Expense in USD Wallet on Nov 8
  engine.recordTransaction({
    type: 'EXPENSE',
    walletId: usdWallet.id,
    amountMinor: '15000',
    categoryId: transportCat.id,
    title: 'Monthly Metro Pass',
    occurredAt: '2026-11-08T10:00:00.000Z',
  });

  // Evaluate Monthly Living Budget on Day 11 (2026-11-11 -> 20 days remaining inclusive: Nov 11..Nov 30)
  // Total spent = $250 + $150 = $400.00 (40000 cents)
  // Remaining budget = $900 - $400 = $500.00 (50000 cents)
  // Daily Spending Allowance = 50000 / 20 days = $25.00/day (2500 cents)
  const monthlyEval = engine.evaluateBudget(monthlyBudget.id, '2026-11-11');
  assert.equal(monthlyEval.periodStart, '2026-11-01');
  assert.equal(monthlyEval.periodEnd, '2026-11-30');
  assert.equal(monthlyEval.totalDays, 30);
  assert.equal(monthlyEval.remainingDaysInclusive, 20);
  assert.equal(monthlyEval.spentMinor, '40000');
  assert.equal(monthlyEval.remainingMinor, '50000');
  assert.equal(monthlyEval.dailySpendingAllowanceMinor, '2500');

  // Evaluate Food & Dining Budget on Day 11 (2026-11-11): only counts the $250 Food expense!
  // Remaining = $300 - $250 = $50.00 (5000 cents) over 20 days = $2.50/day (250 cents)
  const foodEval = engine.evaluateBudget(foodBudget.id, '2026-11-11');
  assert.equal(foodEval.spentMinor, '25000');
  assert.equal(foodEval.remainingMinor, '5000');
  assert.equal(foodEval.dailySpendingAllowanceMinor, '250');

  // Log a €500.00 (50000 cents) hotel expense in Euros Wallet at Snapshot Rate 1.10 ($550.00 = 55000 USD cents)
  // explicitly pinned to the Manual Assignment Trip Budget on 2026-11-12
  engine.recordTransaction({
    type: 'EXPENSE',
    walletId: eurWallet.id,
    amountMinor: '50000',
    categoryId: transportCat.id,
    manualBudgetId: tripBudget.id,
    title: 'Paris Hotel',
    occurredAt: '2026-11-12T15:00:00.000Z',
  });

  // Evaluate Trip Budget on 2026-11-15 (5 days remaining inclusive: Nov 15..Nov 19)
  // Spent = $550.00 (55000 cents); Remaining = $1,500 - $550 = $950.00 (95000 cents)
  // Daily Spending Allowance = 95000 / 5 = $190.00/day (19000 cents)
  const tripEval = engine.evaluateBudget(tripBudget.id, '2026-11-15');
  assert.equal(tripEval.spentMinor, '55000');
  assert.equal(tripEval.remainingMinor, '95000');
  assert.equal(tripEval.remainingDaysInclusive, 5);
  assert.equal(tripEval.dailySpendingAllowanceMinor, '19000');

  // Overspending Food Budget clamps Daily Spending Allowance to 0
  engine.recordTransaction({
    type: 'EXPENSE',
    walletId: usdWallet.id,
    amountMinor: '10000', // +$100 -> total food spent = $350 on a $300 budget
    categoryId: foodCat.id,
    title: 'Steakhouse',
    occurredAt: '2026-11-15T20:00:00.000Z',
  });
  const overFoodEval = engine.evaluateBudget(foodBudget.id, '2026-11-15');
  assert.equal(overFoodEval.spentMinor, '35000');
  assert.equal(overFoodEval.remainingMinor, '0');
  assert.equal(overFoodEval.overBudgetMinor, '5000');
  assert.equal(overFoodEval.dailySpendingAllowanceMinor, '0');
});

test('Slice 05 — Recurring Rules, Upcoming Payments (autoPay vs. manual Mark as Paid / Skip), and isolation from current Wallet balances until settled', () => {
  const engine = createInMemoryFinanceEngine();
  const usdWallet = engine.listWallets()[0];
  engine.updateWallet(usdWallet.id, { initialBalanceMinor: '100000' }); // $1,000.00

  const categories = engine.listCategories();
  const entertainmentCat = categories.find((c) => c.name === 'Entertainment');
  const housingCat = categories.find((c) => c.name === 'Housing & Bills');

  // 1. Auto-Pay Recurring Rule: Netflix $15.99 (1599 cents) monthly on the 15th
  const netflixRule = engine.createRecurringRule({
    title: 'Netflix Subscription',
    type: 'EXPENSE',
    walletId: usdWallet.id,
    categoryId: entertainmentCat.id,
    amountMinor: '1599',
    frequency: 'MONTHLY',
    intervalCount: 1,
    nextDueDate: '2026-11-15',
    autoPay: true,
    reminderDaysBefore: 1,
  });

  // 2. Manual-Confirm Recurring Rule: Electric Bill ~$120.00 (12000 cents) monthly on the 20th
  const electricRule = engine.createRecurringRule({
    title: 'City Electric Bill',
    type: 'EXPENSE',
    walletId: usdWallet.id,
    categoryId: housingCat.id,
    amountMinor: '12000',
    frequency: 'MONTHLY',
    intervalCount: 1,
    nextDueDate: '2026-11-20',
    autoPay: false,
    reminderDaysBefore: 2,
  });

  // 3. One-off standalone Upcoming Payment: Car Insurance $450.00 (45000 cents) due 2026-11-25
  const insuranceBill = engine.createUpcomingPayment({
    title: '6-Month Car Insurance',
    type: 'EXPENSE',
    walletId: usdWallet.id,
    categoryId: housingCat.id,
    amountMinor: '45000',
    dueDate: '2026-11-25',
    autoPay: false,
    reminderDaysBefore: 3,
  });

  // Before Nov 15 (e.g. on Nov 10): none of the upcoming bills affect the Wallet balance ($1,000.00)
  const settledOnNov10 = engine.processDueAutoPayRules('2026-11-10');
  assert.equal(settledOnNov10.length, 0);
  assert.equal(engine.getWallet(usdWallet.id).currentBalanceMinor, '100000');

  // Upcoming payments list shows all 3 obligations
  const upcomingOnNov10 = engine.listUpcomingPayments();
  assert.equal(upcomingOnNov10.length, 3);

  // On Nov 15: processDueAutoPayRules automatically settles Netflix ($15.99) and advances Netflix nextDueDate to 2026-12-15
  const settledOnNov15 = engine.processDueAutoPayRules('2026-11-15');
  assert.equal(settledOnNov15.length, 1);
  assert.equal(settledOnNov15[0].title, 'Netflix Subscription');
  assert.equal(settledOnNov15[0].amountMinor, '1599');
  assert.equal(engine.getWallet(usdWallet.id).currentBalanceMinor, '98401'); // $1,000.00 - $15.99 = $984.01
  assert.equal(engine.getRecurringRule(netflixRule.id).nextDueDate, '2026-12-15');

  // Calling processDueAutoPayRules again on Nov 15 is idempotent (no duplicate charge!)
  assert.equal(engine.processDueAutoPayRules('2026-11-15').length, 0);

  // On Nov 20: Electric Bill has autoPay: false, so processDueAutoPayRules does NOT auto-charge it
  assert.equal(engine.processDueAutoPayRules('2026-11-20').length, 0);
  assert.equal(engine.getWallet(usdWallet.id).currentBalanceMinor, '98401');

  // User taps "Mark as Paid" on Electric Bill with an actual utility bill amount override of $128.50 (12850 cents)
  const electricUpcoming = engine
    .listUpcomingPayments()
    .find((u) => u.recurringRuleId === electricRule.id);
  assert.ok(electricUpcoming);
  const paidElectricTx = engine.markUpcomingPaymentAsPaid(electricUpcoming.id, {
    actualAmountMinor: '12850',
    occurredAt: '2026-11-20T14:00:00.000Z',
  });
  assert.equal(paidElectricTx.amountMinor, '12850');
  assert.equal(engine.getWallet(usdWallet.id).currentBalanceMinor, '85551'); // $984.01 - $128.50 = $855.51
  assert.equal(engine.getRecurringRule(electricRule.id).nextDueDate, '2026-12-20');

  // User skips the standalone Car Insurance upcoming payment (or pays it via another external account)
  engine.skipUpcomingPayment(insuranceBill.id);
  const remainingForNov = engine
    .listUpcomingPayments()
    .filter((u) => u.dueDate <= '2026-11-30');
  assert.equal(remainingForNov.length, 0);
});

test('Slice 06 — Spending Insights: cumulative Spending Pace Comparison (current vs. previous period), Category/Subcategory drill-down breakdown, and Cash Flow series', () => {
  const engine = createInMemoryFinanceEngine();
  const usdWallet = engine.listWallets()[0];
  engine.updateWallet(usdWallet.id, { initialBalanceMinor: '500000' }); // $5,000.00

  const categories = engine.listCategories();
  const foodCat = categories.find((c) => c.name === 'Food & Dining');
  const groceriesSub = engine.listSubcategories(foodCat.id).find((s) => s.name === 'Groceries');
  const coffeeSub = engine.listSubcategories(foodCat.id).find((s) => s.name === 'Coffee');
  const housingCat = categories.find((c) => c.name === 'Housing & Bills');
  const salaryCat = categories.find((c) => c.name === 'Salary & Paycheck');

  // Previous Period (October 2026):
  // Oct 2: $100.00 Food
  // Oct 5: $200.00 Housing -> Cumulative by Oct 5 = $300.00 (30000 cents)
  engine.recordTransaction({
    type: 'EXPENSE',
    walletId: usdWallet.id,
    amountMinor: '10000',
    categoryId: foodCat.id,
    subcategoryId: groceriesSub.id,
    title: 'Oct Groceries',
    occurredAt: '2026-10-02T10:00:00.000Z',
  });
  engine.recordTransaction({
    type: 'EXPENSE',
    walletId: usdWallet.id,
    amountMinor: '20000',
    categoryId: housingCat.id,
    title: 'Oct Utilities',
    occurredAt: '2026-10-05T10:00:00.000Z',
  });

  // Current Period (November 2026):
  // Nov 1: $50.00 Coffee
  // Nov 3: $150.00 Groceries
  // Nov 5: $250.00 Housing -> Cumulative by Nov 5 = $450.00 (45000 cents)
  // Nov 4: $3,000.00 Salary Income
  engine.recordTransaction({
    type: 'EXPENSE',
    walletId: usdWallet.id,
    amountMinor: '5000',
    categoryId: foodCat.id,
    subcategoryId: coffeeSub.id,
    title: 'Nov Coffee',
    occurredAt: '2026-11-01T08:00:00.000Z',
  });
  engine.recordTransaction({
    type: 'EXPENSE',
    walletId: usdWallet.id,
    amountMinor: '15000',
    categoryId: foodCat.id,
    subcategoryId: groceriesSub.id,
    title: 'Nov Groceries',
    occurredAt: '2026-11-03T11:00:00.000Z',
  });
  engine.recordTransaction({
    type: 'EXPENSE',
    walletId: usdWallet.id,
    amountMinor: '25000',
    categoryId: housingCat.id,
    title: 'Nov Utilities',
    occurredAt: '2026-11-05T14:00:00.000Z',
  });
  engine.recordTransaction({
    type: 'INCOME',
    walletId: usdWallet.id,
    amountMinor: '300000',
    categoryId: salaryCat.id,
    title: 'Nov Paycheck',
    occurredAt: '2026-11-04T09:00:00.000Z',
  });

  // 1. Spending Pace Comparison evaluated on 2026-11-05 (Current: Nov 1..Nov 30 vs Previous: Oct 1..Oct 31)
  const pace = engine.computeSpendingPaceComparison({
    currentStart: '2026-11-01',
    currentEnd: '2026-11-30',
    referenceToday: '2026-11-05',
  });

  assert.equal(pace.currentCumulativeMinorByDay.length, 5); // Days 1..5
  assert.equal(pace.currentCumulativeMinorByDay[0], '5000'); // Day 1: $50
  assert.equal(pace.currentCumulativeMinorByDay[1], '5000'); // Day 2: $50
  assert.equal(pace.currentCumulativeMinorByDay[2], '20000'); // Day 3: $200
  assert.equal(pace.currentCumulativeMinorByDay[4], '45000'); // Day 5: $450

  // Previous period (October) cumulative on Day 2 = $100 (10000), Day 5 = $300 (30000)
  assert.equal(pace.previousCumulativeMinorByDay[0], '0');
  assert.equal(pace.previousCumulativeMinorByDay[1], '10000');
  assert.equal(pace.previousCumulativeMinorByDay[4], '30000');
  // Delta on Day 5: $450 - $300 = +$150.00 (+50% faster spending than last month on Day 5)
  assert.equal(pace.deltaAtReferenceDayMinor, '15000');
  assert.equal(pace.percentChangeAtReferenceDay, 50);

  // 2. Category Breakdown Donut with Subcategory drill-down for Nov 2026
  const breakdown = engine.computeCategoryBreakdown({
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    flowType: 'EXPENSE',
  });

  assert.equal(breakdown.totalMinor, '45000');
  assert.equal(breakdown.categories.length, 2); // Housing ($250) and Food & Dining ($200)
  assert.equal(breakdown.categories[0].categoryId, housingCat.id);
  assert.equal(breakdown.categories[0].amountMinor, '25000');

  const foodSlice = breakdown.categories.find((c) => c.categoryId === foodCat.id);
  assert.ok(foodSlice);
  assert.equal(foodSlice.amountMinor, '20000'); // $150 Groceries + $50 Coffee
  assert.equal(foodSlice.subcategories.length, 2);
  assert.equal(foodSlice.subcategories[0].subcategoryId, groceriesSub.id);
  assert.equal(foodSlice.subcategories[0].amountMinor, '15000');
  assert.equal(foodSlice.subcategories[1].subcategoryId, coffeeSub.id);
  assert.equal(foodSlice.subcategories[1].amountMinor, '5000');
});

test('Slice 07 — Modular Home Sections, Themes & Privacy Mask preferences, RFC-4180 CSV export, and lossless Backup Snapshot round-trip restore', () => {
  const engine = createInMemoryFinanceEngine();
  const usdWallet = engine.listWallets()[0];
  engine.updateWallet(usdWallet.id, {
    name: 'Main USD',
    initialBalanceMinor: '250000',
  });
  const btcWallet = engine.createWallet({
    name: 'Cold BTC',
    currencyCode: 'BTC',
    decimalPlaces: 8,
    initialBalanceMinor: '12500000', // 0.125 BTC
  });

  // 1. Home Sections customization (reordering & toggling visibility)
  const initialSections = engine.getHomeSections();
  assert.equal(initialSections.length, 5);
  assert.equal(initialSections[0].id, 'WALLETS_CAROUSEL');

  engine.updateHomeSections([
    { id: 'PINNED_BUDGETS', title: 'Budgets & Daily Allowance', visible: true, order: 0 },
    { id: 'WALLETS_CAROUSEL', title: 'Wallets', visible: true, order: 1 },
    { id: 'SPENDING_PACE', title: 'Spending Pace', visible: false, order: 2 },
    { id: 'UPCOMING_PAYMENTS', title: 'Upcoming Bills', visible: true, order: 3 },
    { id: 'RECENT_TRANSACTIONS', title: 'Recent Transactions', visible: true, order: 4 },
  ]);
  const updatedSections = engine.getHomeSections();
  assert.equal(updatedSections[0].id, 'PINNED_BUDGETS');
  assert.equal(
    updatedSections.find((s) => s.id === 'SPENDING_PACE').visible,
    false
  );

  // 2. Theme, Accent Color, Privacy Mask, and Biometric Lock preferences
  engine.updatePreferences({
    themeMode: 'AMOLED',
    accentColor: '#8B5CF6',
    privacyMaskEnabled: true,
    biometricLockEnabled: true,
  });
  const prefs = engine.getPreferences();
  assert.equal(prefs.themeMode, 'AMOLED');
  assert.equal(prefs.accentColor, '#8B5CF6');
  assert.equal(prefs.privacyMaskEnabled, true);
  assert.equal(prefs.biometricLockEnabled, true);

  // 3. Record a Transaction with commas and quotes in title/note and test RFC-4180 CSV export
  const foodCat = engine.listCategories().find((c) => c.name === 'Food & Dining');
  engine.recordTransaction({
    type: 'EXPENSE',
    walletId: usdWallet.id,
    amountMinor: '4250',
    categoryId: foodCat.id,
    title: 'Joe\'s "Best", Diner',
    note: 'Lunch, tip included',
    occurredAt: '2026-11-18T12:30:00.000Z',
  });

  const csv = engine.exportTransactionsToCsv();
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 2); // Header + 1 transaction row
  assert.ok(lines[0].includes('Date,Type,Title,Category,Subcategory,Wallet,Amount,Currency'));
  assert.ok(lines[1].includes('"Joe\'s ""Best"", Diner"'));
  assert.ok(lines[1].includes('42.50,USD'));

  // 4. Full Backup Snapshot export and restore into a brand-new blank engine
  const snapshotJson = engine.exportBackupSnapshotJson();

  const freshEngine = createInMemoryFinanceEngine();
  assert.equal(freshEngine.listWallets().length, 1);
  assert.equal(freshEngine.listTransactions().length, 0);

  freshEngine.restoreBackupSnapshotJson(snapshotJson);

  assert.equal(freshEngine.listWallets().length, 2);
  assert.equal(
    freshEngine.getWallet(btcWallet.id).currentBalanceMinor,
    '12500000'
  );
  assert.equal(freshEngine.listTransactions().length, 1);
  assert.equal(
    freshEngine.listTransactions()[0].title,
    'Joe\'s "Best", Diner'
  );
  assert.equal(freshEngine.getPreferences().themeMode, 'AMOLED');
  assert.equal(freshEngine.getHomeSections()[0].id, 'PINNED_BUDGETS');
});







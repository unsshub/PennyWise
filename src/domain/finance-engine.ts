import {
  SUPPORTED_CURRENCIES,
  convertMinorUnits,
  getCurrencyDefinition,
} from './currency';
import type {
  BackupSnapshot,
  Budget,
  BudgetEvaluation,
  BudgetPeriodType,
  BudgetScopeType,
  CashFlowBarPoint,
  Category,
  CategoryBreakdownResult,
  CategoryBreakdownSlice,
  ExchangeRate,
  HomeSection,
  NetWorthHistoryPoint,
  RecurringFrequency,
  RecurringRule,
  SQLiteDriver,
  SpendingPaceComparison,
  SubcategoryBreakdownSlice,
  Transaction,
  TransactionType,
  UpcomingPayment,
  UserPreferences,
  Wallet,
} from './types';

function parseDateUtc(dateStr: string): number {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatDateUtc(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysUtc(dateStr: string, days: number): string {
  return formatDateUtc(parseDateUtc(dateStr) + days * 86_400_000);
}

function diffDaysInclusive(startDate: string, endDate: string): number {
  const diff = Math.round((parseDateUtc(endDate) - parseDateUtc(startDate)) / 86_400_000);
  return Math.max(1, diff + 1);
}

function addMonthsClamped(dateStr: string, monthsToAdd: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const totalMonths = (y * 12 + (m - 1)) + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonthIndex = totalMonths % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, daysInTargetMonth);
  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface DefaultCategorySeed {
  id: string;
  name: string;
  flowType: 'EXPENSE' | 'INCOME';
  color: string;
  icon: string;
  subcategories: { id: string; name: string; icon: string }[];
}

const DEFAULT_CATEGORY_SEEDS: DefaultCategorySeed[] = [
  {
    id: 'cat-food',
    name: 'Food & Dining',
    flowType: 'EXPENSE',
    color: '#F97316',
    icon: '🍔',
    subcategories: [
      { id: 'sub-groceries', name: 'Groceries', icon: '🛒' },
      { id: 'sub-coffee', name: 'Coffee', icon: '☕' },
      { id: 'sub-restaurants', name: 'Restaurants', icon: '🍽️' },
    ],
  },
  {
    id: 'cat-housing',
    name: 'Housing & Bills',
    flowType: 'EXPENSE',
    color: '#3B82F6',
    icon: '🏠',
    subcategories: [
      { id: 'sub-rent', name: 'Rent & Mortgage', icon: '🔑' },
      { id: 'sub-utilities', name: 'Utilities', icon: '⚡' },
      { id: 'sub-internet', name: 'Internet & Phone', icon: '📶' },
    ],
  },
  {
    id: 'cat-transport',
    name: 'Transportation',
    flowType: 'EXPENSE',
    color: '#8B5CF6',
    icon: '🚗',
    subcategories: [
      { id: 'sub-fuel', name: 'Fuel & Charging', icon: '⛽' },
      { id: 'sub-transit', name: 'Public Transit', icon: '🚇' },
      { id: 'sub-taxi', name: 'Rideshare & Taxi', icon: '🚕' },
    ],
  },
  {
    id: 'cat-shopping',
    name: 'Shopping',
    flowType: 'EXPENSE',
    color: '#EC4899',
    icon: '🛍️',
    subcategories: [
      { id: 'sub-clothing', name: 'Clothing', icon: '👕' },
      { id: 'sub-electronics', name: 'Electronics', icon: '💻' },
    ],
  },
  {
    id: 'cat-entertainment',
    name: 'Entertainment',
    flowType: 'EXPENSE',
    color: '#EAB308',
    icon: '🎬',
    subcategories: [
      { id: 'sub-subscriptions', name: 'Subscriptions', icon: '📺' },
      { id: 'sub-hobbies', name: 'Games & Hobbies', icon: '🎮' },
    ],
  },
  {
    id: 'cat-health',
    name: 'Health & Fitness',
    flowType: 'EXPENSE',
    color: '#14B8A6',
    icon: '💊',
    subcategories: [
      { id: 'sub-pharmacy', name: 'Pharmacy & Medical', icon: '🏥' },
      { id: 'sub-gym', name: 'Gym & Sports', icon: '🏋️' },
    ],
  },
  {
    id: 'cat-salary',
    name: 'Salary & Paycheck',
    flowType: 'INCOME',
    color: '#10B981',
    icon: '💼',
    subcategories: [
      { id: 'sub-paycheck', name: 'Primary Paycheck', icon: '💵' },
      { id: 'sub-bonus', name: 'Bonus & Overtime', icon: '🎉' },
    ],
  },
  {
    id: 'cat-freelance',
    name: 'Freelance & Investments',
    flowType: 'INCOME',
    color: '#06B6D4',
    icon: '📈',
    subcategories: [
      { id: 'sub-client', name: 'Client Project', icon: '🤝' },
      { id: 'sub-dividends', name: 'Dividends & Interest', icon: '🪙' },
    ],
  },
];

export class FinanceEngine {
  private readonly db: SQLiteDriver;

  constructor(db: SQLiteDriver) {
    this.db = db;
    this.initializeSchemaAndSeed();
  }

  private initializeSchemaAndSeed(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        currency_code TEXT NOT NULL,
        decimal_places INTEGER NOT NULL,
        initial_balance_minor TEXT NOT NULL,
        current_balance_minor TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        include_in_net_worth INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS exchange_rates (
        currency_code TEXT PRIMARY KEY NOT NULL,
        base_currency_code TEXT NOT NULL,
        rate_to_base REAL NOT NULL,
        is_manual_override INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        parent_id TEXT,
        name TEXT NOT NULL,
        flow_type TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        wallet_id TEXT NOT NULL,
        destination_wallet_id TEXT,
        amount_minor TEXT NOT NULL,
        destination_amount_minor TEXT,
        currency_code TEXT NOT NULL,
        decimal_places INTEGER NOT NULL,
        snapshot_rate_to_base REAL NOT NULL,
        category_id TEXT,
        subcategory_id TEXT,
        manual_budget_id TEXT,
        title TEXT NOT NULL,
        note TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        recurring_rule_id TEXT
      );

      CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        limit_amount_minor TEXT NOT NULL,
        currency_code TEXT NOT NULL,
        decimal_places INTEGER NOT NULL,
        period_type TEXT NOT NULL,
        interval_count INTEGER,
        interval_unit TEXT,
        anchor_date TEXT NOT NULL,
        end_date TEXT,
        scope_type TEXT NOT NULL,
        filter_category_ids_json TEXT NOT NULL DEFAULT '[]',
        filter_wallet_ids_json TEXT NOT NULL DEFAULT '[]',
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        is_pinned_to_home INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS recurring_rules (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        wallet_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        subcategory_id TEXT,
        amount_minor TEXT NOT NULL,
        currency_code TEXT NOT NULL,
        decimal_places INTEGER NOT NULL,
        frequency TEXT NOT NULL,
        interval_count INTEGER NOT NULL DEFAULT 1,
        next_due_date TEXT NOT NULL,
        auto_pay INTEGER NOT NULL DEFAULT 0,
        reminder_days_before INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS standalone_upcoming_payments (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        wallet_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        subcategory_id TEXT,
        amount_minor TEXT NOT NULL,
        currency_code TEXT NOT NULL,
        decimal_places INTEGER NOT NULL,
        due_date TEXT NOT NULL,
        auto_pay INTEGER NOT NULL DEFAULT 0,
        reminder_days_before INTEGER NOT NULL DEFAULT 1
      );
    `);

    const existingBase = this.db.get<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?;',
      ['base_currency']
    );
    const baseCurrency = existingBase?.value ?? 'USD';
    if (!existingBase) {
      this.db.run('INSERT INTO app_settings (key, value) VALUES (?, ?);', [
        'base_currency',
        baseCurrency,
      ]);
    }

    const existingRates = this.db.all<{ currency_code: string }>(
      'SELECT currency_code FROM exchange_rates;'
    );
    if (existingRates.length === 0) {
      this.seedDefaultExchangeRates(baseCurrency);
    }

    const existingWallets = this.db.all<{ id: string }>('SELECT id FROM wallets;');
    if (existingWallets.length === 0) {
      const def = getCurrencyDefinition(baseCurrency);
      this.db.run(
        `INSERT INTO wallets (
          id, name, currency_code, decimal_places, initial_balance_minor, current_balance_minor,
          color, icon, include_in_net_worth, sort_order, is_archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          'wallet-default-cash',
          'Cash Wallet',
          baseCurrency,
          def.decimalPlaces,
          '0',
          '0',
          '#10B981',
          '💵',
          1,
          0,
          0,
        ]
      );
    }

    const existingCats = this.db.all<{ id: string }>('SELECT id FROM categories;');
    if (existingCats.length === 0) {
      this.seedDefaultCategories();
    }
  }

  private seedDefaultExchangeRates(baseCurrency: string): void {
    const baseDef = getCurrencyDefinition(baseCurrency);
    const nowIso = new Date().toISOString();
    for (const curr of SUPPORTED_CURRENCIES) {
      const rateToBase =
        curr.code === baseCurrency ? 1.0 : curr.defaultRateToUsd / baseDef.defaultRateToUsd;
      this.db.run(
        `INSERT OR REPLACE INTO exchange_rates (
          currency_code, base_currency_code, rate_to_base, is_manual_override, updated_at
        ) VALUES (?, ?, ?, ?, ?);`,
        [curr.code, baseCurrency, rateToBase, 0, nowIso]
      );
    }
  }

  private seedDefaultCategories(): void {
    DEFAULT_CATEGORY_SEEDS.forEach((cat, idx) => {
      this.db.run(
        `INSERT INTO categories (id, parent_id, name, flow_type, color, icon, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [cat.id, null, cat.name, cat.flowType, cat.color, cat.icon, idx]
      );
      cat.subcategories.forEach((sub, subIdx) => {
        this.db.run(
          `INSERT INTO categories (id, parent_id, name, flow_type, color, icon, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [sub.id, cat.id, sub.name, cat.flowType, cat.color, sub.icon, subIdx]
        );
      });
    });
  }

  public getBaseCurrency(): string {
    const row = this.db.get<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?;',
      ['base_currency']
    );
    return row?.value ?? 'USD';
  }

  public setBaseCurrency(newBaseCurrency: string): void {
    const upper = newBaseCurrency.toUpperCase();
    const oldBase = this.getBaseCurrency();
    if (upper === oldBase) {
      return;
    }

    const newBaseRateToOldBase = this.getExchangeRateToBase(upper);
    const divisor = newBaseRateToOldBase > 0 ? newBaseRateToOldBase : 1;
    const allRates = this.listExchangeRates();
    const nowIso = new Date().toISOString();

    this.db.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);', [
      'base_currency',
      upper,
    ]);

    for (const r of allRates) {
      const rebasedRate = r.currencyCode === upper ? 1.0 : r.rateToBase / divisor;
      this.db.run(
        `INSERT OR REPLACE INTO exchange_rates (
          currency_code, base_currency_code, rate_to_base, is_manual_override, updated_at
        ) VALUES (?, ?, ?, ?, ?);`,
        [r.currencyCode, upper, rebasedRate, r.isManualOverride ? 1 : 0, nowIso]
      );
    }

    this.db.run(
      `INSERT OR REPLACE INTO exchange_rates (
        currency_code, base_currency_code, rate_to_base, is_manual_override, updated_at
      ) VALUES (?, ?, ?, ?, ?);`,
      [oldBase, upper, 1.0 / divisor, 0, nowIso]
    );

    // Rebase historical transactions' snapshot_rate_to_base relative to the new Base Currency
    // so historical transactions and budgets remain invariant in real terms (per ADR-0002)
    const allTxs = this.listTransactions();
    for (const tx of allTxs) {
      const rebasedSnapshotRate =
        tx.currencyCode === upper ? 1.0 : tx.snapshotRateToBase / divisor;
      this.db.run(
        'UPDATE transactions SET snapshot_rate_to_base = ? WHERE id = ?;',
        [rebasedSnapshotRate, tx.id]
      );
    }
  }

  public listExchangeRates(): ExchangeRate[] {
    const rows = this.db.all<{
      currency_code: string;
      base_currency_code: string;
      rate_to_base: number;
      is_manual_override: number;
      updated_at: string;
    }>('SELECT * FROM exchange_rates ORDER BY currency_code ASC;');

    return rows.map((r) => ({
      currencyCode: r.currency_code,
      baseCurrencyCode: r.base_currency_code,
      rateToBase: r.rate_to_base,
      isManualOverride: Boolean(r.is_manual_override),
      updatedAt: r.updated_at,
    }));
  }

  public getExchangeRateToBase(currencyCode: string): number {
    const upper = currencyCode.toUpperCase();
    const base = this.getBaseCurrency();
    if (upper === base) {
      return 1.0;
    }
    const row = this.db.get<{ rate_to_base: number }>(
      'SELECT rate_to_base FROM exchange_rates WHERE currency_code = ?;',
      [upper]
    );
    if (row && row.rate_to_base > 0) {
      return row.rate_to_base;
    }
    const currDef = getCurrencyDefinition(upper);
    const baseDef = getCurrencyDefinition(base);
    return currDef.defaultRateToUsd / baseDef.defaultRateToUsd;
  }

  public setExchangeRate(params: {
    currencyCode: string;
    rateToBase: number;
    isManualOverride?: boolean;
  }): ExchangeRate {
    const upper = params.currencyCode.toUpperCase();
    const base = this.getBaseCurrency();
    const rate = upper === base ? 1.0 : params.rateToBase;
    const isManual = params.isManualOverride ?? true;
    const nowIso = new Date().toISOString();

    this.db.run(
      `INSERT OR REPLACE INTO exchange_rates (
        currency_code, base_currency_code, rate_to_base, is_manual_override, updated_at
      ) VALUES (?, ?, ?, ?, ?);`,
      [upper, base, rate, isManual ? 1 : 0, nowIso]
    );

    return {
      currencyCode: upper,
      baseCurrencyCode: base,
      rateToBase: rate,
      isManualOverride: isManual,
      updatedAt: nowIso,
    };
  }

  public listWallets(options?: { includeArchived?: boolean }): Wallet[] {
    const includeArchived = options?.includeArchived ?? false;
    const query = includeArchived
      ? 'SELECT * FROM wallets ORDER BY sort_order ASC, id ASC;'
      : 'SELECT * FROM wallets WHERE is_archived = 0 ORDER BY sort_order ASC, id ASC;';

    const rows = this.db.all<{
      id: string;
      name: string;
      currency_code: string;
      decimal_places: number;
      initial_balance_minor: string;
      current_balance_minor: string;
      color: string;
      icon: string;
      include_in_net_worth: number;
      sort_order: number;
      is_archived: number;
    }>(query);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      currencyCode: row.currency_code,
      decimalPlaces: row.decimal_places,
      initialBalanceMinor: row.initial_balance_minor,
      currentBalanceMinor: row.current_balance_minor,
      color: row.color,
      icon: row.icon,
      includeInNetWorth: Boolean(row.include_in_net_worth),
      sortOrder: row.sort_order,
      isArchived: Boolean(row.is_archived),
    }));
  }

  public getWallet(id: string): Wallet | undefined {
    return this.listWallets({ includeArchived: true }).find((w) => w.id === id);
  }

  public createWallet(params: {
    name: string;
    currencyCode: string;
    decimalPlaces?: number;
    initialBalanceMinor?: string;
    color?: string;
    icon?: string;
    includeInNetWorth?: boolean;
  }): Wallet {
    const upper = params.currencyCode.toUpperCase();
    const def = getCurrencyDefinition(upper);
    const decimalPlaces = params.decimalPlaces ?? def.decimalPlaces;
    const initialBalanceMinor = params.initialBalanceMinor ?? '0';
    const existing = this.listWallets({ includeArchived: true });
    const sortOrder = existing.length;
    const id = generateId('wallet');

    const wallet: Wallet = {
      id,
      name: params.name.trim() || upper,
      currencyCode: upper,
      decimalPlaces,
      initialBalanceMinor,
      currentBalanceMinor: initialBalanceMinor,
      color: params.color ?? '#3B82F6',
      icon: params.icon ?? def.symbol,
      includeInNetWorth: params.includeInNetWorth ?? true,
      sortOrder,
      isArchived: false,
    };

    this.db.run(
      `INSERT INTO wallets (
        id, name, currency_code, decimal_places, initial_balance_minor, current_balance_minor,
        color, icon, include_in_net_worth, sort_order, is_archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        wallet.id,
        wallet.name,
        wallet.currencyCode,
        wallet.decimalPlaces,
        wallet.initialBalanceMinor,
        wallet.currentBalanceMinor,
        wallet.color,
        wallet.icon,
        wallet.includeInNetWorth ? 1 : 0,
        wallet.sortOrder,
        0,
      ]
    );

    return wallet;
  }

  public updateWallet(
    id: string,
    updates: {
      name?: string;
      currencyCode?: string;
      decimalPlaces?: number;
      initialBalanceMinor?: string;
      color?: string;
      icon?: string;
      includeInNetWorth?: boolean;
      isArchived?: boolean;
    }
  ): Wallet {
    const existing = this.getWallet(id);
    if (!existing) {
      throw new Error(`Wallet not found: ${id}`);
    }

    const nextCurrency = updates.currencyCode
      ? updates.currencyCode.toUpperCase()
      : existing.currencyCode;
    const def = getCurrencyDefinition(nextCurrency);
    const nextDecimals =
      updates.decimalPlaces ??
      (updates.currencyCode ? def.decimalPlaces : existing.decimalPlaces);

    let nextInitial = existing.initialBalanceMinor;
    let nextCurrent = existing.currentBalanceMinor;
    if (updates.initialBalanceMinor !== undefined) {
      const delta =
        BigInt(updates.initialBalanceMinor) - BigInt(existing.initialBalanceMinor);
      nextInitial = updates.initialBalanceMinor;
      nextCurrent = (BigInt(existing.currentBalanceMinor) + delta).toString();
    }

    const updated: Wallet = {
      ...existing,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      currencyCode: nextCurrency,
      decimalPlaces: nextDecimals,
      initialBalanceMinor: nextInitial,
      currentBalanceMinor: nextCurrent,
      color: updates.color ?? existing.color,
      icon: updates.icon ?? existing.icon,
      includeInNetWorth:
        updates.includeInNetWorth !== undefined
          ? updates.includeInNetWorth
          : existing.includeInNetWorth,
      isArchived:
        updates.isArchived !== undefined ? updates.isArchived : existing.isArchived,
    };

    this.db.run(
      `UPDATE wallets SET
        name = ?, currency_code = ?, decimal_places = ?,
        initial_balance_minor = ?, current_balance_minor = ?,
        color = ?, icon = ?, include_in_net_worth = ?, is_archived = ?
      WHERE id = ?;`,
      [
        updated.name,
        updated.currencyCode,
        updated.decimalPlaces,
        updated.initialBalanceMinor,
        updated.currentBalanceMinor,
        updated.color,
        updated.icon,
        updated.includeInNetWorth ? 1 : 0,
        updated.isArchived ? 1 : 0,
        id,
      ]
    );

    return updated;
  }

  public reorderWallets(orderedWalletIds: string[]): void {
    orderedWalletIds.forEach((id, idx) => {
      this.db.run('UPDATE wallets SET sort_order = ? WHERE id = ?;', [idx, id]);
    });
  }

  public deleteWallet(id: string): void {
    this.db.run('DELETE FROM wallets WHERE id = ?;', [id]);
  }

  public convertWalletBalanceToBaseMinor(wallet: Wallet): string {
    const base = this.getBaseCurrency();
    const baseDef = getCurrencyDefinition(base);
    const rate = this.getExchangeRateToBase(wallet.currencyCode);
    return convertMinorUnits(
      wallet.currentBalanceMinor,
      wallet.decimalPlaces,
      baseDef.decimalPlaces,
      rate
    );
  }

  public calculateNetWorthMinor(): string {
    const wallets = this.listWallets({ includeArchived: false });
    let totalMinor = 0n;
    for (const wallet of wallets) {
      if (!wallet.includeInNetWorth) {
        continue;
      }
      const converted = this.convertWalletBalanceToBaseMinor(wallet);
      totalMinor += BigInt(converted);
    }
    return totalMinor.toString();
  }

  // =========================================================================
  // Slice 02: Categories, Subcategories & Transactions (Expense & Income)
  // =========================================================================

  public listCategories(options?: {
    flowType?: 'EXPENSE' | 'INCOME';
    topLevelOnly?: boolean;
  }): Category[] {
    const rows = this.db.all<{
      id: string;
      parent_id: string | null;
      name: string;
      flow_type: 'EXPENSE' | 'INCOME';
      color: string;
      icon: string;
      sort_order: number;
    }>('SELECT * FROM categories ORDER BY sort_order ASC, id ASC;');

    return rows
      .map((r) => ({
        id: r.id,
        parentId: r.parent_id,
        name: r.name,
        flowType: r.flow_type,
        color: r.color,
        icon: r.icon,
        sortOrder: r.sort_order,
      }))
      .filter((c) => {
        if (options?.flowType && c.flowType !== options.flowType) {
          return false;
        }
        if (options?.topLevelOnly && c.parentId !== null) {
          return false;
        }
        return true;
      });
  }

  public listSubcategories(parentCategoryId: string): Category[] {
    return this.listCategories().filter((c) => c.parentId === parentCategoryId);
  }

  public getCategory(id: string): Category | undefined {
    return this.listCategories().find((c) => c.id === id);
  }

  public createCategory(params: {
    parentId?: string | null;
    name: string;
    flowType: 'EXPENSE' | 'INCOME';
    color?: string;
    icon?: string;
  }): Category {
    const parentId = params.parentId ?? null;
    const siblings = parentId
      ? this.listSubcategories(parentId)
      : this.listCategories({ topLevelOnly: true });
    const category: Category = {
      id: generateId(parentId ? 'sub' : 'cat'),
      parentId,
      name: params.name.trim(),
      flowType: params.flowType,
      color: params.color ?? '#3B82F6',
      icon: params.icon ?? '🏷️',
      sortOrder: siblings.length,
    };

    this.db.run(
      `INSERT INTO categories (id, parent_id, name, flow_type, color, icon, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        category.id,
        category.parentId,
        category.name,
        category.flowType,
        category.color,
        category.icon,
        category.sortOrder,
      ]
    );
    return category;
  }

  public updateCategory(
    id: string,
    updates: {
      name?: string;
      color?: string;
      icon?: string;
      flowType?: 'EXPENSE' | 'INCOME';
    }
  ): Category {
    const existing = this.getCategory(id);
    if (!existing) {
      throw new Error(`Category not found: ${id}`);
    }
    const updated: Category = {
      ...existing,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      color: updates.color ?? existing.color,
      icon: updates.icon ?? existing.icon,
      flowType: updates.flowType ?? existing.flowType,
    };
    this.db.run(
      'UPDATE categories SET name = ?, color = ?, icon = ?, flow_type = ? WHERE id = ?;',
      [updated.name, updated.color, updated.icon, updated.flowType, id]
    );
    return updated;
  }

  public deleteCategory(id: string): void {
    this.db.run('DELETE FROM categories WHERE parent_id = ?;', [id]);
    this.db.run('DELETE FROM categories WHERE id = ?;', [id]);
  }

  public reorderCategories(orderedCategoryIds: string[]): void {
    orderedCategoryIds.forEach((id, idx) => {
      this.db.run('UPDATE categories SET sort_order = ? WHERE id = ?;', [idx, id]);
    });
  }

  private applyTransactionBalanceEffect(tx: Transaction, direction: 1n | -1n): void {
    const sourceWallet = this.getWallet(tx.walletId);
    if (sourceWallet) {
      const amount = BigInt(tx.amountMinor);
      let delta = 0n;
      if (tx.type === 'EXPENSE' || tx.type === 'TRANSFER') {
        delta = -amount * direction;
      } else if (tx.type === 'INCOME' || tx.type === 'BALANCE_ADJUSTMENT') {
        delta = amount * direction;
      }
      const nextBalance = (BigInt(sourceWallet.currentBalanceMinor) + delta).toString();
      this.db.run('UPDATE wallets SET current_balance_minor = ? WHERE id = ?;', [
        nextBalance,
        sourceWallet.id,
      ]);
    }

    if (tx.type === 'TRANSFER' && tx.destinationWalletId) {
      const destWallet = this.getWallet(tx.destinationWalletId);
      if (destWallet) {
        const destInflow = BigInt(tx.destinationAmountMinor ?? tx.amountMinor);
        const destDelta = destInflow * direction;
        const nextDestBalance = (
          BigInt(destWallet.currentBalanceMinor) + destDelta
        ).toString();
        this.db.run('UPDATE wallets SET current_balance_minor = ? WHERE id = ?;', [
          nextDestBalance,
          destWallet.id,
        ]);
      }
    }
  }

  public recordTransaction(params: {
    type: TransactionType;
    walletId: string;
    destinationWalletId?: string | null;
    amountMinor: string;
    destinationAmountMinor?: string | null;
    snapshotRateToBase?: number;
    categoryId?: string | null;
    subcategoryId?: string | null;
    manualBudgetId?: string | null;
    title?: string;
    note?: string;
    occurredAt?: string;
    recurringRuleId?: string | null;
  }): Transaction {
    const wallet = this.getWallet(params.walletId);
    if (!wallet) {
      throw new Error(`Wallet not found: ${params.walletId}`);
    }

    const snapshotRate =
      params.snapshotRateToBase ?? this.getExchangeRateToBase(wallet.currencyCode);

    let destAmountMinor = params.destinationAmountMinor ?? null;
    if (params.type === 'TRANSFER' && params.destinationWalletId && !destAmountMinor) {
      const destWallet = this.getWallet(params.destinationWalletId);
      if (destWallet) {
        if (destWallet.currencyCode === wallet.currencyCode) {
          destAmountMinor = params.amountMinor;
        } else {
          const destRateToBase = this.getExchangeRateToBase(destWallet.currencyCode);
          const crossRate = destRateToBase > 0 ? snapshotRate / destRateToBase : 1;
          destAmountMinor = convertMinorUnits(
            params.amountMinor,
            wallet.decimalPlaces,
            destWallet.decimalPlaces,
            crossRate
          );
        }
      }
    }

    const category = params.categoryId ? this.getCategory(params.categoryId) : undefined;
    const defaultTitle =
      params.title?.trim() ||
      category?.name ||
      (params.type === 'TRANSFER'
        ? 'Transfer'
        : params.type === 'BALANCE_ADJUSTMENT'
          ? 'Balance Adjustment'
          : params.type === 'INCOME'
            ? 'Income'
            : 'Expense');

    const tx: Transaction = {
      id: generateId('tx'),
      type: params.type,
      walletId: wallet.id,
      destinationWalletId: params.destinationWalletId ?? null,
      amountMinor: params.amountMinor,
      destinationAmountMinor: destAmountMinor,
      currencyCode: wallet.currencyCode,
      decimalPlaces: wallet.decimalPlaces,
      snapshotRateToBase: snapshotRate,
      categoryId: params.categoryId ?? null,
      subcategoryId: params.subcategoryId ?? null,
      manualBudgetId: params.manualBudgetId ?? null,
      title: defaultTitle,
      note: params.note?.trim() ?? '',
      occurredAt: params.occurredAt ?? new Date().toISOString(),
      recurringRuleId: params.recurringRuleId ?? null,
    };

    this.db.run(
      `INSERT INTO transactions (
        id, type, wallet_id, destination_wallet_id, amount_minor, destination_amount_minor,
        currency_code, decimal_places, snapshot_rate_to_base, category_id, subcategory_id,
        manual_budget_id, title, note, occurred_at, recurring_rule_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        tx.id,
        tx.type,
        tx.walletId,
        tx.destinationWalletId,
        tx.amountMinor,
        tx.destinationAmountMinor,
        tx.currencyCode,
        tx.decimalPlaces,
        tx.snapshotRateToBase,
        tx.categoryId,
        tx.subcategoryId,
        tx.manualBudgetId,
        tx.title,
        tx.note,
        tx.occurredAt,
        tx.recurringRuleId,
      ]
    );

    this.applyTransactionBalanceEffect(tx, 1n);
    return tx;
  }

  private mapTransactionRow(r: {
    id: string;
    type: TransactionType;
    wallet_id: string;
    destination_wallet_id: string | null;
    amount_minor: string;
    destination_amount_minor: string | null;
    currency_code: string;
    decimal_places: number;
    snapshot_rate_to_base: number;
    category_id: string | null;
    subcategory_id: string | null;
    manual_budget_id: string | null;
    title: string;
    note: string;
    occurred_at: string;
    recurring_rule_id: string | null;
  }): Transaction {
    return {
      id: r.id,
      type: r.type,
      walletId: r.wallet_id,
      destinationWalletId: r.destination_wallet_id,
      amountMinor: r.amount_minor,
      destinationAmountMinor: r.destination_amount_minor,
      currencyCode: r.currency_code,
      decimalPlaces: r.decimal_places,
      snapshotRateToBase: r.snapshot_rate_to_base,
      categoryId: r.category_id,
      subcategoryId: r.subcategory_id,
      manualBudgetId: r.manual_budget_id,
      title: r.title,
      note: r.note,
      occurredAt: r.occurred_at,
      recurringRuleId: r.recurring_rule_id,
    };
  }

  public getTransaction(id: string): Transaction | undefined {
    const row = this.db.get<any>('SELECT * FROM transactions WHERE id = ?;', [id]);
    return row ? this.mapTransactionRow(row) : undefined;
  }

  public listTransactions(): Transaction[] {
    const rows = this.db.all<any>(
      'SELECT * FROM transactions ORDER BY occurred_at DESC, id DESC;'
    );
    return rows.map((r) => this.mapTransactionRow(r));
  }

  public updateTransaction(
    id: string,
    updates: {
      walletId?: string;
      destinationWalletId?: string | null;
      amountMinor?: string;
      destinationAmountMinor?: string | null;
      snapshotRateToBase?: number;
      categoryId?: string | null;
      subcategoryId?: string | null;
      manualBudgetId?: string | null;
      title?: string;
      note?: string;
      occurredAt?: string;
    }
  ): Transaction {
    const existing = this.getTransaction(id);
    if (!existing) {
      throw new Error(`Transaction not found: ${id}`);
    }

    // Revert old balance effect first
    this.applyTransactionBalanceEffect(existing, -1n);

    const nextWallet = updates.walletId
      ? this.getWallet(updates.walletId)
      : this.getWallet(existing.walletId);
    if (!nextWallet) {
      throw new Error('Target wallet not found');
    }

    const updated: Transaction = {
      ...existing,
      walletId: nextWallet.id,
      currencyCode: nextWallet.currencyCode,
      decimalPlaces: nextWallet.decimalPlaces,
      destinationWalletId:
        updates.destinationWalletId !== undefined
          ? updates.destinationWalletId
          : existing.destinationWalletId,
      amountMinor: updates.amountMinor ?? existing.amountMinor,
      destinationAmountMinor:
        updates.destinationAmountMinor !== undefined
          ? updates.destinationAmountMinor
          : existing.destinationAmountMinor,
      snapshotRateToBase: updates.snapshotRateToBase ?? existing.snapshotRateToBase,
      categoryId:
        updates.categoryId !== undefined ? updates.categoryId : existing.categoryId,
      subcategoryId:
        updates.subcategoryId !== undefined
          ? updates.subcategoryId
          : existing.subcategoryId,
      manualBudgetId:
        updates.manualBudgetId !== undefined
          ? updates.manualBudgetId
          : existing.manualBudgetId,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      note: updates.note !== undefined ? updates.note.trim() : existing.note,
      occurredAt: updates.occurredAt ?? existing.occurredAt,
    };

    this.db.run(
      `UPDATE transactions SET
        wallet_id = ?, destination_wallet_id = ?, amount_minor = ?, destination_amount_minor = ?,
        currency_code = ?, decimal_places = ?, snapshot_rate_to_base = ?,
        category_id = ?, subcategory_id = ?, manual_budget_id = ?,
        title = ?, note = ?, occurred_at = ?
      WHERE id = ?;`,
      [
        updated.walletId,
        updated.destinationWalletId,
        updated.amountMinor,
        updated.destinationAmountMinor,
        updated.currencyCode,
        updated.decimalPlaces,
        updated.snapshotRateToBase,
        updated.categoryId,
        updated.subcategoryId,
        updated.manualBudgetId,
        updated.title,
        updated.note,
        updated.occurredAt,
        id,
      ]
    );

    // Apply new balance effect
    this.applyTransactionBalanceEffect(updated, 1n);
    return updated;
  }

  public deleteTransaction(id: string): void {
    const existing = this.getTransaction(id);
    if (!existing) {
      return;
    }
    this.applyTransactionBalanceEffect(existing, -1n);
    this.db.run('DELETE FROM transactions WHERE id = ?;', [id]);
  }

  public convertTransactionToBaseMinor(tx: Transaction): string {
    const base = this.getBaseCurrency();
    const baseDef = getCurrencyDefinition(base);
    if (tx.currencyCode === base) {
      return convertMinorUnits(tx.amountMinor, tx.decimalPlaces, baseDef.decimalPlaces, 1.0);
    }
    return convertMinorUnits(
      tx.amountMinor,
      tx.decimalPlaces,
      baseDef.decimalPlaces,
      tx.snapshotRateToBase
    );
  }

  // =========================================================================
  // Slice 03: Balance Adjustment Reconciliation & Transaction Search/Filters
  // =========================================================================

  public reconcileWalletBalance(
    walletId: string,
    targetBalanceMinor: string,
    note: string = 'Balance reconciliation',
    occurredAt?: string
  ): Transaction | null {
    const wallet = this.getWallet(walletId);
    if (!wallet) {
      throw new Error(`Wallet not found: ${walletId}`);
    }
    const delta = BigInt(targetBalanceMinor) - BigInt(wallet.currentBalanceMinor);
    if (delta === 0n) {
      return null;
    }
    return this.recordTransaction({
      type: 'BALANCE_ADJUSTMENT',
      walletId: wallet.id,
      amountMinor: delta.toString(),
      title: 'Balance Adjustment',
      note,
      occurredAt,
    });
  }

  public queryTransactions(filters?: {
    searchQuery?: string;
    walletId?: string;
    categoryId?: string;
    subcategoryId?: string;
    types?: TransactionType[];
    startDate?: string; // YYYY-MM-DD or ISO timestamp
    endDate?: string;   // YYYY-MM-DD or ISO timestamp
    manualBudgetId?: string;
  }): Transaction[] {
    const all = this.listTransactions();
    if (!filters) {
      return all;
    }

    const q = filters.searchQuery?.trim().toLowerCase();
    const startPrefix = filters.startDate?.slice(0, 10);
    const endPrefix = filters.endDate?.slice(0, 10);

    return all.filter((tx) => {
      if (filters.types && filters.types.length > 0 && !filters.types.includes(tx.type)) {
        return false;
      }
      if (
        filters.walletId &&
        tx.walletId !== filters.walletId &&
        tx.destinationWalletId !== filters.walletId
      ) {
        return false;
      }
      if (filters.categoryId && tx.categoryId !== filters.categoryId) {
        return false;
      }
      if (filters.subcategoryId && tx.subcategoryId !== filters.subcategoryId) {
        return false;
      }
      if (filters.manualBudgetId && tx.manualBudgetId !== filters.manualBudgetId) {
        return false;
      }
      const txDay = tx.occurredAt.slice(0, 10);
      if (startPrefix && txDay < startPrefix) {
        return false;
      }
      if (endPrefix && txDay > endPrefix) {
        return false;
      }
      if (q) {
        const cat = tx.categoryId ? this.getCategory(tx.categoryId) : undefined;
        const sub = tx.subcategoryId ? this.getCategory(tx.subcategoryId) : undefined;
        const haystack = `${tx.title} ${tx.note} ${cat?.name ?? ''} ${sub?.name ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }

  public summarizePeriodCashFlow(params: {
    startDate?: string;
    endDate?: string;
    walletId?: string;
  }): {
    totalExpenseBaseMinor: string;
    totalIncomeBaseMinor: string;
    netCashFlowBaseMinor: string;
  } {
    const txs = this.queryTransactions({
      startDate: params.startDate,
      endDate: params.endDate,
      walletId: params.walletId,
      types: ['EXPENSE', 'INCOME'],
    });

    let expenseMinor = 0n;
    let incomeMinor = 0n;
    for (const tx of txs) {
      const baseMinor = BigInt(this.convertTransactionToBaseMinor(tx));
      if (tx.type === 'EXPENSE') {
        expenseMinor += baseMinor;
      } else if (tx.type === 'INCOME') {
        incomeMinor += baseMinor;
      }
    }

    return {
      totalExpenseBaseMinor: expenseMinor.toString(),
      totalIncomeBaseMinor: incomeMinor.toString(),
      netCashFlowBaseMinor: (incomeMinor - expenseMinor).toString(),
    };
  }

  // =========================================================================
  // Slice 04: Flexible Budgets & Daily Spending Allowance
  // =========================================================================

  private mapBudgetRow(r: any): Budget {
    return {
      id: r.id,
      name: r.name,
      limitAmountMinor: r.limit_amount_minor,
      currencyCode: r.currency_code,
      decimalPlaces: r.decimal_places,
      periodType: r.period_type as BudgetPeriodType,
      intervalCount: r.interval_count,
      intervalUnit: r.interval_unit,
      anchorDate: r.anchor_date,
      endDate: r.end_date,
      scopeType: r.scope_type as BudgetScopeType,
      filterCategoryIds: JSON.parse(r.filter_category_ids_json || '[]'),
      filterWalletIds: JSON.parse(r.filter_wallet_ids_json || '[]'),
      color: r.color,
      icon: r.icon,
      isPinnedToHome: Boolean(r.is_pinned_to_home),
      sortOrder: r.sort_order,
    };
  }

  public listBudgets(): Budget[] {
    const rows = this.db.all<any>('SELECT * FROM budgets ORDER BY sort_order ASC, id ASC;');
    return rows.map((r) => this.mapBudgetRow(r));
  }

  public getBudget(id: string): Budget | undefined {
    const row = this.db.get<any>('SELECT * FROM budgets WHERE id = ?;', [id]);
    return row ? this.mapBudgetRow(row) : undefined;
  }

  public createBudget(params: {
    name: string;
    limitAmountMinor: string;
    currencyCode?: string;
    decimalPlaces?: number;
    periodType: BudgetPeriodType;
    intervalCount?: number | null;
    intervalUnit?: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
    anchorDate: string;
    endDate?: string | null;
    scopeType?: BudgetScopeType;
    filterCategoryIds?: string[];
    filterWalletIds?: string[];
    color?: string;
    icon?: string;
    isPinnedToHome?: boolean;
  }): Budget {
    const currencyCode = (params.currencyCode ?? this.getBaseCurrency()).toUpperCase();
    const def = getCurrencyDefinition(currencyCode);
    const existing = this.listBudgets();
    const budget: Budget = {
      id: generateId('budget'),
      name: params.name.trim(),
      limitAmountMinor: params.limitAmountMinor,
      currencyCode,
      decimalPlaces: params.decimalPlaces ?? def.decimalPlaces,
      periodType: params.periodType,
      intervalCount: params.intervalCount ?? null,
      intervalUnit: params.intervalUnit ?? null,
      anchorDate: params.anchorDate.slice(0, 10),
      endDate: params.endDate ? params.endDate.slice(0, 10) : null,
      scopeType: params.scopeType ?? 'AUTOMATIC_FILTER',
      filterCategoryIds: params.filterCategoryIds ?? [],
      filterWalletIds: params.filterWalletIds ?? [],
      color: params.color ?? '#10B981',
      icon: params.icon ?? '🎯',
      isPinnedToHome: params.isPinnedToHome ?? true,
      sortOrder: existing.length,
    };

    this.db.run(
      `INSERT INTO budgets (
        id, name, limit_amount_minor, currency_code, decimal_places,
        period_type, interval_count, interval_unit, anchor_date, end_date,
        scope_type, filter_category_ids_json, filter_wallet_ids_json,
        color, icon, is_pinned_to_home, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        budget.id,
        budget.name,
        budget.limitAmountMinor,
        budget.currencyCode,
        budget.decimalPlaces,
        budget.periodType,
        budget.intervalCount,
        budget.intervalUnit,
        budget.anchorDate,
        budget.endDate,
        budget.scopeType,
        JSON.stringify(budget.filterCategoryIds),
        JSON.stringify(budget.filterWalletIds),
        budget.color,
        budget.icon,
        budget.isPinnedToHome ? 1 : 0,
        budget.sortOrder,
      ]
    );

    return budget;
  }

  public updateBudget(
    id: string,
    updates: Partial<
      Omit<Budget, 'id' | 'sortOrder'>
    >
  ): Budget {
    const existing = this.getBudget(id);
    if (!existing) {
      throw new Error(`Budget not found: ${id}`);
    }
    const updated: Budget = {
      ...existing,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
    };

    this.db.run(
      `UPDATE budgets SET
        name = ?, limit_amount_minor = ?, currency_code = ?, decimal_places = ?,
        period_type = ?, interval_count = ?, interval_unit = ?, anchor_date = ?, end_date = ?,
        scope_type = ?, filter_category_ids_json = ?, filter_wallet_ids_json = ?,
        color = ?, icon = ?, is_pinned_to_home = ?
      WHERE id = ?;`,
      [
        updated.name,
        updated.limitAmountMinor,
        updated.currencyCode,
        updated.decimalPlaces,
        updated.periodType,
        updated.intervalCount,
        updated.intervalUnit,
        updated.anchorDate,
        updated.endDate,
        updated.scopeType,
        JSON.stringify(updated.filterCategoryIds),
        JSON.stringify(updated.filterWalletIds),
        updated.color,
        updated.icon,
        updated.isPinnedToHome ? 1 : 0,
        id,
      ]
    );
    return updated;
  }

  public deleteBudget(id: string): void {
    this.db.run('DELETE FROM budgets WHERE id = ?;', [id]);
  }

  public reorderBudgets(orderedBudgetIds: string[]): void {
    orderedBudgetIds.forEach((id, idx) => {
      this.db.run('UPDATE budgets SET sort_order = ? WHERE id = ?;', [idx, id]);
    });
  }

  public resolveBudgetPeriodWindow(
    budget: Budget,
    referenceDateStr: string,
    cycleOffset: number = 0
  ): { periodStart: string; periodEnd: string } {
    const refDay = referenceDateStr.slice(0, 10);

    if (budget.periodType === 'CUSTOM_RANGE') {
      const start = budget.anchorDate;
      const end = budget.endDate ?? addDaysUtc(start, 29);
      return { periodStart: start, periodEnd: end };
    }

    if (budget.periodType === 'WEEKLY' || (budget.periodType === 'INTERVAL' && budget.intervalUnit === 'WEEKS')) {
      const weeks = budget.periodType === 'WEEKLY' ? 1 : Math.max(1, budget.intervalCount ?? 1);
      const cycleDays = weeks * 7;
      const diffFromAnchor = Math.floor((parseDateUtc(refDay) - parseDateUtc(budget.anchorDate)) / 86_400_000);
      const currentCycleIndex = Math.floor(diffFromAnchor / cycleDays) + cycleOffset;
      const periodStart = addDaysUtc(budget.anchorDate, currentCycleIndex * cycleDays);
      const periodEnd = addDaysUtc(periodStart, cycleDays - 1);
      return { periodStart, periodEnd };
    }

    if (budget.periodType === 'INTERVAL' && budget.intervalUnit === 'DAYS') {
      const cycleDays = Math.max(1, budget.intervalCount ?? 14);
      const diffFromAnchor = Math.floor((parseDateUtc(refDay) - parseDateUtc(budget.anchorDate)) / 86_400_000);
      const currentCycleIndex = Math.floor(diffFromAnchor / cycleDays) + cycleOffset;
      const periodStart = addDaysUtc(budget.anchorDate, currentCycleIndex * cycleDays);
      const periodEnd = addDaysUtc(periodStart, cycleDays - 1);
      return { periodStart, periodEnd };
    }

    // MONTHLY, YEARLY, or INTERVAL with MONTHS
    const stepMonths =
      budget.periodType === 'YEARLY'
        ? 12
        : budget.periodType === 'INTERVAL' && budget.intervalUnit === 'MONTHS'
          ? Math.max(1, budget.intervalCount ?? 1)
          : 1;

    const [anchorY, anchorM] = budget.anchorDate.split('-').map(Number);
    const [refY, refM] = refDay.split('-').map(Number);
    const approxDiffMonths = (refY - anchorY) * 12 + (refM - anchorM);
    let cycleIdx = Math.floor(approxDiffMonths / stepMonths);

    let candidateStart = addMonthsClamped(budget.anchorDate, cycleIdx * stepMonths);
    if (candidateStart > refDay) {
      cycleIdx -= 1;
      candidateStart = addMonthsClamped(budget.anchorDate, cycleIdx * stepMonths);
    } else {
      const nextStart = addMonthsClamped(budget.anchorDate, (cycleIdx + 1) * stepMonths);
      if (nextStart <= refDay) {
        cycleIdx += 1;
        candidateStart = nextStart;
      }
    }

    const targetIdx = cycleIdx + cycleOffset;
    const periodStart = addMonthsClamped(budget.anchorDate, targetIdx * stepMonths);
    const nextCycleStart = addMonthsClamped(budget.anchorDate, (targetIdx + 1) * stepMonths);
    const periodEnd = addDaysUtc(nextCycleStart, -1);

    return { periodStart, periodEnd };
  }

  public evaluateBudget(
    budgetId: string,
    referenceDateStr: string = new Date().toISOString().slice(0, 10),
    cycleOffset: number = 0
  ): BudgetEvaluation {
    const budget = this.getBudget(budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }

    const refDay = referenceDateStr.slice(0, 10);
    const { periodStart, periodEnd } = this.resolveBudgetPeriodWindow(
      budget,
      refDay,
      cycleOffset
    );
    const totalDays = diffDaysInclusive(periodStart, periodEnd);

    // Clamp reference date into [periodStart, periodEnd] for remaining/elapsed day calculation
    let remainingDaysInclusive: number;
    let elapsedDaysInclusive: number;
    if (refDay < periodStart) {
      remainingDaysInclusive = totalDays;
      elapsedDaysInclusive = 0;
    } else if (refDay > periodEnd) {
      remainingDaysInclusive = 1;
      elapsedDaysInclusive = totalDays;
    } else {
      remainingDaysInclusive = diffDaysInclusive(refDay, periodEnd);
      elapsedDaysInclusive = diffDaysInclusive(periodStart, refDay);
    }

    const candidateTxs = this.queryTransactions({
      startDate: periodStart,
      endDate: periodEnd,
      types: ['EXPENSE'],
    });

    const matchingTxs = candidateTxs.filter((tx) => {
      if (budget.scopeType === 'MANUAL_ASSIGNMENT') {
        return tx.manualBudgetId === budget.id;
      }
      // AUTOMATIC_FILTER
      if (
        budget.filterWalletIds.length > 0 &&
        !budget.filterWalletIds.includes(tx.walletId)
      ) {
        return false;
      }
      if (budget.filterCategoryIds.length > 0) {
        const matchesCat =
          (tx.categoryId && budget.filterCategoryIds.includes(tx.categoryId)) ||
          (tx.subcategoryId && budget.filterCategoryIds.includes(tx.subcategoryId));
        if (!matchesCat) {
          return false;
        }
      }
      return true;
    });

    const baseCurrency = this.getBaseCurrency();
    const baseDef = getCurrencyDefinition(baseCurrency);
    const budgetRateToBase = this.getExchangeRateToBase(budget.currencyCode);

    let spentMinorBig = 0n;
    for (const tx of matchingTxs) {
      const txInBaseMinor = this.convertTransactionToBaseMinor(tx);
      const txInBudgetMinor =
        budget.currencyCode === baseCurrency
          ? txInBaseMinor
          : convertMinorUnits(
              txInBaseMinor,
              baseDef.decimalPlaces,
              budget.decimalPlaces,
              budgetRateToBase > 0 ? 1 / budgetRateToBase : 1
            );
      spentMinorBig += BigInt(txInBudgetMinor);
    }

    const limitBig = BigInt(budget.limitAmountMinor);
    const remainingBig = limitBig > spentMinorBig ? limitBig - spentMinorBig : 0n;
    const overBudgetBig = spentMinorBig > limitBig ? spentMinorBig - limitBig : 0n;
    const dailyAllowanceBig =
      remainingBig > 0n ? remainingBig / BigInt(remainingDaysInclusive) : 0n;

    const percentSpent =
      limitBig > 0n ? Math.min(200, Number((spentMinorBig * 10000n) / limitBig) / 100) : 0;
    const percentTimeElapsed =
      totalDays > 0 ? Math.min(100, Math.round((elapsedDaysInclusive / totalDays) * 100)) : 0;

    return {
      budget,
      periodStart,
      periodEnd,
      totalDays,
      elapsedDaysInclusive,
      remainingDaysInclusive,
      spentMinor: spentMinorBig.toString(),
      remainingMinor: remainingBig.toString(),
      overBudgetMinor: overBudgetBig.toString(),
      dailySpendingAllowanceMinor: dailyAllowanceBig.toString(),
      percentSpent,
      percentTimeElapsed,
      matchingTransactionIds: matchingTxs.map((t) => t.id),
    };
  }

  // =========================================================================
  // Slice 05: Recurring Rules & Upcoming Payments
  // =========================================================================

  private advanceRecurringDueDate(
    dueDateStr: string,
    frequency: RecurringFrequency,
    intervalCount: number
  ): string {
    const count = Math.max(1, intervalCount || 1);
    if (frequency === 'DAILY' || frequency === 'INTERVAL') {
      return addDaysUtc(dueDateStr, count);
    }
    if (frequency === 'WEEKLY') {
      return addDaysUtc(dueDateStr, count * 7);
    }
    if (frequency === 'MONTHLY') {
      return addMonthsClamped(dueDateStr, count);
    }
    if (frequency === 'YEARLY') {
      return addMonthsClamped(dueDateStr, count * 12);
    }
    return addMonthsClamped(dueDateStr, 1);
  }

  private mapRecurringRuleRow(r: any): RecurringRule {
    return {
      id: r.id,
      title: r.title,
      type: r.type,
      walletId: r.wallet_id,
      categoryId: r.category_id,
      subcategoryId: r.subcategory_id,
      amountMinor: r.amount_minor,
      currencyCode: r.currency_code,
      decimalPlaces: r.decimal_places,
      frequency: r.frequency as RecurringFrequency,
      intervalCount: r.interval_count,
      nextDueDate: r.next_due_date,
      autoPay: Boolean(r.auto_pay),
      reminderDaysBefore: r.reminder_days_before,
      isActive: Boolean(r.is_active),
    };
  }

  public listRecurringRules(options?: { activeOnly?: boolean }): RecurringRule[] {
    const activeOnly = options?.activeOnly ?? false;
    const sql = activeOnly
      ? 'SELECT * FROM recurring_rules WHERE is_active = 1 ORDER BY next_due_date ASC, id ASC;'
      : 'SELECT * FROM recurring_rules ORDER BY next_due_date ASC, id ASC;';
    return this.db.all<any>(sql).map((r) => this.mapRecurringRuleRow(r));
  }

  public getRecurringRule(id: string): RecurringRule | undefined {
    const row = this.db.get<any>('SELECT * FROM recurring_rules WHERE id = ?;', [id]);
    return row ? this.mapRecurringRuleRow(row) : undefined;
  }

  public createRecurringRule(params: {
    title: string;
    type: 'EXPENSE' | 'INCOME';
    walletId: string;
    categoryId: string;
    subcategoryId?: string | null;
    amountMinor: string;
    frequency: RecurringFrequency;
    intervalCount?: number;
    nextDueDate: string;
    autoPay?: boolean;
    reminderDaysBefore?: number;
  }): RecurringRule {
    const wallet = this.getWallet(params.walletId);
    if (!wallet) {
      throw new Error(`Wallet not found: ${params.walletId}`);
    }
    const rule: RecurringRule = {
      id: generateId('rule'),
      title: params.title.trim(),
      type: params.type,
      walletId: wallet.id,
      categoryId: params.categoryId,
      subcategoryId: params.subcategoryId ?? null,
      amountMinor: params.amountMinor,
      currencyCode: wallet.currencyCode,
      decimalPlaces: wallet.decimalPlaces,
      frequency: params.frequency,
      intervalCount: Math.max(1, params.intervalCount ?? 1),
      nextDueDate: params.nextDueDate.slice(0, 10),
      autoPay: params.autoPay ?? false,
      reminderDaysBefore: params.reminderDaysBefore ?? 1,
      isActive: true,
    };

    this.db.run(
      `INSERT INTO recurring_rules (
        id, title, type, wallet_id, category_id, subcategory_id,
        amount_minor, currency_code, decimal_places, frequency, interval_count,
        next_due_date, auto_pay, reminder_days_before, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        rule.id,
        rule.title,
        rule.type,
        rule.walletId,
        rule.categoryId,
        rule.subcategoryId,
        rule.amountMinor,
        rule.currencyCode,
        rule.decimalPlaces,
        rule.frequency,
        rule.intervalCount,
        rule.nextDueDate,
        rule.autoPay ? 1 : 0,
        rule.reminderDaysBefore,
        1,
      ]
    );
    return rule;
  }

  public updateRecurringRule(
    id: string,
    updates: Partial<Omit<RecurringRule, 'id'>>
  ): RecurringRule {
    const existing = this.getRecurringRule(id);
    if (!existing) {
      throw new Error(`RecurringRule not found: ${id}`);
    }
    const updated: RecurringRule = {
      ...existing,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
    };
    this.db.run(
      `UPDATE recurring_rules SET
        title = ?, type = ?, wallet_id = ?, category_id = ?, subcategory_id = ?,
        amount_minor = ?, currency_code = ?, decimal_places = ?, frequency = ?,
        interval_count = ?, next_due_date = ?, auto_pay = ?, reminder_days_before = ?, is_active = ?
      WHERE id = ?;`,
      [
        updated.title,
        updated.type,
        updated.walletId,
        updated.categoryId,
        updated.subcategoryId,
        updated.amountMinor,
        updated.currencyCode,
        updated.decimalPlaces,
        updated.frequency,
        updated.intervalCount,
        updated.nextDueDate,
        updated.autoPay ? 1 : 0,
        updated.reminderDaysBefore,
        updated.isActive ? 1 : 0,
        id,
      ]
    );
    return updated;
  }

  public deleteRecurringRule(id: string): void {
    this.db.run('DELETE FROM recurring_rules WHERE id = ?;', [id]);
  }

  public createUpcomingPayment(params: {
    title: string;
    type: 'EXPENSE' | 'INCOME';
    walletId: string;
    categoryId: string;
    subcategoryId?: string | null;
    amountMinor: string;
    dueDate: string;
    autoPay?: boolean;
    reminderDaysBefore?: number;
  }): UpcomingPayment {
    const wallet = this.getWallet(params.walletId);
    if (!wallet) {
      throw new Error(`Wallet not found: ${params.walletId}`);
    }
    const payment: UpcomingPayment = {
      id: generateId('upcoming'),
      recurringRuleId: null,
      title: params.title.trim(),
      type: params.type,
      walletId: wallet.id,
      categoryId: params.categoryId,
      subcategoryId: params.subcategoryId ?? null,
      amountMinor: params.amountMinor,
      currencyCode: wallet.currencyCode,
      decimalPlaces: wallet.decimalPlaces,
      dueDate: params.dueDate.slice(0, 10),
      autoPay: params.autoPay ?? false,
      reminderDaysBefore: params.reminderDaysBefore ?? 1,
    };

    this.db.run(
      `INSERT INTO standalone_upcoming_payments (
        id, title, type, wallet_id, category_id, subcategory_id,
        amount_minor, currency_code, decimal_places, due_date, auto_pay, reminder_days_before
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        payment.id,
        payment.title,
        payment.type,
        payment.walletId,
        payment.categoryId,
        payment.subcategoryId,
        payment.amountMinor,
        payment.currencyCode,
        payment.decimalPlaces,
        payment.dueDate,
        payment.autoPay ? 1 : 0,
        payment.reminderDaysBefore,
      ]
    );
    return payment;
  }

  private listStandaloneUpcomingPayments(): UpcomingPayment[] {
    const standaloneRows = this.db.all<any>(
      'SELECT * FROM standalone_upcoming_payments ORDER BY due_date ASC, id ASC;'
    );
    return standaloneRows.map((r) => ({
      id: r.id,
      recurringRuleId: null,
      title: r.title,
      type: r.type,
      walletId: r.wallet_id,
      categoryId: r.category_id,
      subcategoryId: r.subcategory_id,
      amountMinor: r.amount_minor,
      currencyCode: r.currency_code,
      decimalPlaces: r.decimal_places,
      dueDate: r.due_date,
      autoPay: Boolean(r.auto_pay),
      reminderDaysBefore: r.reminder_days_before,
    }));
  }

  private consumeUpcomingPaymentOccurrence(item: UpcomingPayment): void {
    if (item.recurringRuleId) {
      const rule = this.getRecurringRule(item.recurringRuleId);
      if (rule) {
        const nextDue = this.advanceRecurringDueDate(
          rule.nextDueDate,
          rule.frequency,
          rule.intervalCount
        );
        this.updateRecurringRule(rule.id, { nextDueDate: nextDue });
      }
    } else {
      this.db.run('DELETE FROM standalone_upcoming_payments WHERE id = ?;', [item.id]);
    }
  }

  public listUpcomingPayments(): UpcomingPayment[] {
    const activeRules = this.listRecurringRules({ activeOnly: true });
    const fromRules: UpcomingPayment[] = activeRules.map((rule) => ({
      id: `rule-upcoming:${rule.id}`,
      recurringRuleId: rule.id,
      title: rule.title,
      type: rule.type,
      walletId: rule.walletId,
      categoryId: rule.categoryId,
      subcategoryId: rule.subcategoryId,
      amountMinor: rule.amountMinor,
      currencyCode: rule.currencyCode,
      decimalPlaces: rule.decimalPlaces,
      dueDate: rule.nextDueDate,
      autoPay: rule.autoPay,
      reminderDaysBefore: rule.reminderDaysBefore,
    }));

    const fromStandalone = this.listStandaloneUpcomingPayments();

    return [...fromRules, ...fromStandalone].sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate)
    );
  }

  public processDueAutoPayRules(
    referenceDateStr: string = new Date().toISOString().slice(0, 10)
  ): Transaction[] {
    const refDay = referenceDateStr.slice(0, 10);
    const postedTransactions: Transaction[] = [];

    // 1. Process active autoPay Recurring Rules whose nextDueDate <= refDay
    const rules = this.listRecurringRules({ activeOnly: true }).filter((r) => r.autoPay);
    for (const rule of rules) {
      let currentDue = rule.nextDueDate;
      let safetyCounter = 0;
      while (currentDue <= refDay && safetyCounter < 36) {
        const tx = this.recordTransaction({
          type: rule.type,
          walletId: rule.walletId,
          amountMinor: rule.amountMinor,
          categoryId: rule.categoryId,
          subcategoryId: rule.subcategoryId,
          title: rule.title,
          note: `Auto-paid recurring ${rule.frequency.toLowerCase()} bill`,
          occurredAt: `${currentDue}T09:00:00.000Z`,
          recurringRuleId: rule.id,
        });
        postedTransactions.push(tx);
        currentDue = this.advanceRecurringDueDate(
          currentDue,
          rule.frequency,
          rule.intervalCount
        );
        safetyCounter++;
      }
      if (currentDue !== rule.nextDueDate) {
        this.updateRecurringRule(rule.id, { nextDueDate: currentDue });
      }
    }

    // 2. Process standalone autoPay Upcoming Payments whose dueDate <= refDay
    const standaloneRows = this.db.all<any>(
      'SELECT * FROM standalone_upcoming_payments WHERE auto_pay = 1 AND due_date <= ?;',
      [refDay]
    );
    for (const r of standaloneRows) {
      const tx = this.recordTransaction({
        type: r.type,
        walletId: r.wallet_id,
        amountMinor: r.amount_minor,
        categoryId: r.category_id,
        subcategoryId: r.subcategory_id,
        title: r.title,
        note: 'Auto-paid scheduled payment',
        occurredAt: `${r.due_date}T09:00:00.000Z`,
      });
      postedTransactions.push(tx);
      this.db.run('DELETE FROM standalone_upcoming_payments WHERE id = ?;', [r.id]);
    }

    return postedTransactions;
  }

  public markUpcomingPaymentAsPaid(
    upcomingPaymentId: string,
    options?: {
      actualAmountMinor?: string;
      occurredAt?: string;
    }
  ): Transaction {
    const item = this.listUpcomingPayments().find((u) => u.id === upcomingPaymentId);
    if (!item) {
      throw new Error(`UpcomingPayment not found: ${upcomingPaymentId}`);
    }

    const amountToPost = options?.actualAmountMinor ?? item.amountMinor;
    const occurredAt = options?.occurredAt ?? `${item.dueDate}T12:00:00.000Z`;

    const tx = this.recordTransaction({
      type: item.type,
      walletId: item.walletId,
      amountMinor: amountToPost,
      categoryId: item.categoryId,
      subcategoryId: item.subcategoryId,
      title: item.title,
      note: 'Marked as paid',
      occurredAt,
      recurringRuleId: item.recurringRuleId,
    });

    this.consumeUpcomingPaymentOccurrence(item);
    return tx;
  }

  public skipUpcomingPayment(upcomingPaymentId: string): void {
    const item = this.listUpcomingPayments().find((u) => u.id === upcomingPaymentId);
    if (!item) {
      return;
    }
    this.consumeUpcomingPaymentOccurrence(item);
  }

  // =========================================================================
  // Slice 06: Spending Insights & Spending Pace Comparison Charts
  // =========================================================================

  public computeSpendingPaceComparison(params: {
    currentStart: string;
    currentEnd: string;
    referenceToday?: string;
    walletId?: string;
  }): SpendingPaceComparison {
    const currentStart = params.currentStart.slice(0, 10);
    const currentEnd = params.currentEnd.slice(0, 10);
    const refToday = (params.referenceToday ?? new Date().toISOString()).slice(0, 10);

    const currentTotalDays = diffDaysInclusive(currentStart, currentEnd);
    const clampedToday =
      refToday < currentStart
        ? currentStart
        : refToday > currentEnd
          ? currentEnd
          : refToday;
    const referenceDayIndex = diffDaysInclusive(currentStart, clampedToday);

    // Determine previous equivalent period window:
    // If currentStart is the 1st of a month and currentEnd is the end of that month, use the previous calendar month
    const [cy, cm, cd] = currentStart.split('-').map(Number);
    let previousStart: string;
    let previousEnd: string;
    if (cd === 1 && currentTotalDays >= 28 && currentTotalDays <= 31) {
      previousStart = addMonthsClamped(currentStart, -1);
      previousEnd = addDaysUtc(currentStart, -1);
    } else {
      previousEnd = addDaysUtc(currentStart, -1);
      previousStart = addDaysUtc(previousEnd, -(currentTotalDays - 1));
    }
    const previousTotalDays = diffDaysInclusive(previousStart, previousEnd);

    const currentTxs = this.queryTransactions({
      startDate: currentStart,
      endDate: clampedToday,
      walletId: params.walletId,
      types: ['EXPENSE'],
    });

    const previousTxs = this.queryTransactions({
      startDate: previousStart,
      endDate: previousEnd,
      walletId: params.walletId,
      types: ['EXPENSE'],
    });

    const currentDailyTotals: bigint[] = new Array(referenceDayIndex).fill(0n);
    for (const tx of currentTxs) {
      const dayIdx = diffDaysInclusive(currentStart, tx.occurredAt.slice(0, 10)) - 1;
      if (dayIdx >= 0 && dayIdx < referenceDayIndex) {
        currentDailyTotals[dayIdx] += BigInt(this.convertTransactionToBaseMinor(tx));
      }
    }

    const previousDailyTotals: bigint[] = new Array(previousTotalDays).fill(0n);
    for (const tx of previousTxs) {
      const dayIdx = diffDaysInclusive(previousStart, tx.occurredAt.slice(0, 10)) - 1;
      if (dayIdx >= 0 && dayIdx < previousTotalDays) {
        previousDailyTotals[dayIdx] += BigInt(this.convertTransactionToBaseMinor(tx));
      }
    }

    const currentCumulativeMinorByDay: string[] = [];
    let runningCur = 0n;
    for (let i = 0; i < referenceDayIndex; i++) {
      runningCur += currentDailyTotals[i];
      currentCumulativeMinorByDay.push(runningCur.toString());
    }

    const previousCumulativeMinorByDay: string[] = [];
    let runningPrev = 0n;
    for (let i = 0; i < previousTotalDays; i++) {
      runningPrev += previousDailyTotals[i];
      previousCumulativeMinorByDay.push(runningPrev.toString());
    }

    const curAtRef =
      currentCumulativeMinorByDay.length > 0
        ? BigInt(currentCumulativeMinorByDay[currentCumulativeMinorByDay.length - 1])
        : 0n;
    const prevIdx = Math.min(referenceDayIndex - 1, previousCumulativeMinorByDay.length - 1);
    const prevAtRef =
      prevIdx >= 0 ? BigInt(previousCumulativeMinorByDay[prevIdx]) : 0n;

    const deltaBig = curAtRef - prevAtRef;
    const percentChange =
      prevAtRef > 0n
        ? Math.round((Number(deltaBig) / Number(prevAtRef)) * 100)
        : curAtRef > 0n
          ? 100
          : 0;

    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
      referenceDayIndex,
      currentCumulativeMinorByDay,
      previousCumulativeMinorByDay,
      deltaAtReferenceDayMinor: deltaBig.toString(),
      percentChangeAtReferenceDay: percentChange,
    };
  }

  public computeCategoryBreakdown(params: {
    startDate?: string;
    endDate?: string;
    walletId?: string;
    flowType?: 'EXPENSE' | 'INCOME';
  }): CategoryBreakdownResult {
    const flowType = params.flowType ?? 'EXPENSE';
    const txs = this.queryTransactions({
      startDate: params.startDate,
      endDate: params.endDate,
      walletId: params.walletId,
      types: [flowType],
    });

    let totalBig = 0n;
    const byCat = new Map<
      string,
      {
        amountBig: bigint;
        bySub: Map<string, bigint>;
      }
    >();

    for (const tx of txs) {
      const amt = BigInt(this.convertTransactionToBaseMinor(tx));
      totalBig += amt;
      const catId = tx.categoryId ?? 'uncategorized';
      let entry = byCat.get(catId);
      if (!entry) {
        entry = { amountBig: 0n, bySub: new Map() };
        byCat.set(catId, entry);
      }
      entry.amountBig += amt;

      const subKey = tx.subcategoryId ?? '__direct__';
      entry.bySub.set(subKey, (entry.bySub.get(subKey) ?? 0n) + amt);
    }

    const slices: CategoryBreakdownSlice[] = [];
    for (const [catId, data] of byCat.entries()) {
      const cat = this.getCategory(catId);
      const pct =
        totalBig > 0n
          ? Math.round((Number(data.amountBig) / Number(totalBig)) * 1000) / 10
          : 0;

      const subcategories: SubcategoryBreakdownSlice[] = [];
      for (const [subKey, subAmt] of data.bySub.entries()) {
        const subObj = subKey !== '__direct__' ? this.getCategory(subKey) : undefined;
        const subPct =
          data.amountBig > 0n
            ? Math.round((Number(subAmt) / Number(data.amountBig)) * 1000) / 10
            : 0;
        subcategories.push({
          subcategoryId: subKey === '__direct__' ? null : subKey,
          name: subObj?.name ?? (cat?.name ? `${cat.name} (General)` : 'General'),
          icon: subObj?.icon ?? cat?.icon ?? '🏷️',
          amountMinor: subAmt.toString(),
          percentage: subPct,
        });
      }
      subcategories.sort((a, b) =>
        BigInt(b.amountMinor) > BigInt(a.amountMinor) ? 1 : -1
      );

      slices.push({
        categoryId: catId,
        name: cat?.name ?? 'Uncategorized',
        color: cat?.color ?? '#64748B',
        icon: cat?.icon ?? '🏷️',
        amountMinor: data.amountBig.toString(),
        percentage: pct,
        subcategories,
      });
    }

    slices.sort((a, b) => (BigInt(b.amountMinor) > BigInt(a.amountMinor) ? 1 : -1));

    return {
      totalMinor: totalBig.toString(),
      categories: slices,
    };
  }

  public computeMonthlyCashFlowSeries(params: {
    endMonthDate: string; // YYYY-MM-DD
    monthsCount?: number;
    walletId?: string;
  }): CashFlowBarPoint[] {
    const count = Math.max(1, params.monthsCount ?? 6);
    const [ey, em] = params.endMonthDate.slice(0, 10).split('-').map(Number);
    const endMonthFirstDay = `${ey}-${String(em).padStart(2, '0')}-01`;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const series: CashFlowBarPoint[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const startDate = addMonthsClamped(endMonthFirstDay, -i);
      const nextMonthStart = addMonthsClamped(startDate, 1);
      const endDate = addDaysUtc(nextMonthStart, -1);
      const [, mStr] = startDate.split('-');
      const label = monthNames[Number(mStr) - 1] ?? startDate.slice(0, 7);

      const summary = this.summarizePeriodCashFlow({
        startDate,
        endDate,
        walletId: params.walletId,
      });

      series.push({
        label,
        startDate,
        endDate,
        incomeMinor: summary.totalIncomeBaseMinor,
        expenseMinor: summary.totalExpenseBaseMinor,
        netMinor: summary.netCashFlowBaseMinor,
      });
    }
    return series;
  }

  public computeNetWorthHistory(params: {
    endDate: string;
    pointsCount?: number;
    stepDays?: number;
    walletId?: string;
  }): NetWorthHistoryPoint[] {
    const endDay = params.endDate.slice(0, 10);
    const pointsCount = Math.max(2, params.pointsCount ?? 7);
    const stepDays = Math.max(1, params.stepDays ?? 5);

    const targetWallets = params.walletId
      ? this.listWallets({ includeArchived: true }).filter((w) => w.id === params.walletId)
      : this.listWallets({ includeArchived: false }).filter((w) => w.includeInNetWorth);

    const includedWalletIds = new Set(targetWallets.map((w) => w.id));
    let currentTotalBig = 0n;
    for (const w of targetWallets) {
      currentTotalBig += BigInt(this.convertWalletBalanceToBaseMinor(w));
    }

    const base = this.getBaseCurrency();
    const baseDef = getCurrencyDefinition(base);
    const allTxs = this.listTransactions();
    const points: NetWorthHistoryPoint[] = [];

    for (let i = pointsCount - 1; i >= 0; i--) {
      const pointDate = addDaysUtc(endDay, -i * stepDays);
      let deltaAfterPoint = 0n;
      for (const tx of allTxs) {
        const txDate = tx.occurredAt.slice(0, 10);
        if (txDate <= pointDate) {
          continue;
        }
        if (tx.type === 'EXPENSE' && includedWalletIds.has(tx.walletId)) {
          deltaAfterPoint -= BigInt(this.convertTransactionToBaseMinor(tx));
        } else if (
          (tx.type === 'INCOME' || tx.type === 'BALANCE_ADJUSTMENT') &&
          includedWalletIds.has(tx.walletId)
        ) {
          deltaAfterPoint += BigInt(this.convertTransactionToBaseMinor(tx));
        } else if (tx.type === 'TRANSFER') {
          const srcIncluded = includedWalletIds.has(tx.walletId);
          const dstIncluded =
            tx.destinationWalletId !== null &&
            includedWalletIds.has(tx.destinationWalletId);
          if (srcIncluded && !dstIncluded) {
            deltaAfterPoint -= BigInt(this.convertTransactionToBaseMinor(tx));
          } else if (!srcIncluded && dstIncluded && tx.destinationWalletId) {
            const dstWallet = this.getWallet(tx.destinationWalletId);
            const dstRate = dstWallet
              ? this.getExchangeRateToBase(dstWallet.currencyCode)
              : 1;
            const dstInBase = dstWallet
              ? convertMinorUnits(
                  tx.destinationAmountMinor ?? tx.amountMinor,
                  dstWallet.decimalPlaces,
                  baseDef.decimalPlaces,
                  dstRate
                )
              : this.convertTransactionToBaseMinor(tx);
            deltaAfterPoint += BigInt(dstInBase);
          }
        }
      }

      points.push({
        date: pointDate,
        netWorthMinor: (currentTotalBig - deltaAfterPoint).toString(),
      });
    }

    return points;
  }

  public duplicateTransaction(id: string, occurredAt?: string): Transaction {
    const existing = this.getTransaction(id);
    if (!existing) {
      throw new Error(`Transaction not found: ${id}`);
    }
    return this.recordTransaction({
      type: existing.type,
      walletId: existing.walletId,
      destinationWalletId: existing.destinationWalletId,
      amountMinor: existing.amountMinor,
      destinationAmountMinor: existing.destinationAmountMinor,
      snapshotRateToBase: existing.snapshotRateToBase,
      categoryId: existing.categoryId,
      subcategoryId: existing.subcategoryId,
      manualBudgetId: existing.manualBudgetId,
      title: existing.title,
      note: existing.note,
      occurredAt: occurredAt ?? new Date().toISOString(),
    });
  }

  // =========================================================================
  // Slice 07: Modular Home Sections, Themes, Privacy Mask & Backup / CSV
  // =========================================================================

  public getHomeSections(): HomeSection[] {
    const row = this.db.get<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?;',
      ['home_sections']
    );
    const defaultSections: HomeSection[] = [
      { id: 'WALLETS_CAROUSEL', title: 'Wallets', visible: true, order: 0 },
      { id: 'PINNED_BUDGETS', title: 'Budgets & Daily Allowance', visible: true, order: 1 },
      { id: 'SPENDING_PACE', title: 'Spending Pace Comparison', visible: true, order: 2 },
      { id: 'UPCOMING_PAYMENTS', title: 'Upcoming Payments & Bills', visible: true, order: 3 },
      { id: 'RECENT_TRANSACTIONS', title: 'Recent Transactions', visible: true, order: 4 },
    ];
    if (!row) {
      return defaultSections;
    }
    try {
      const parsed = JSON.parse(row.value) as HomeSection[];
      return parsed.sort((a, b) => a.order - b.order);
    } catch {
      return defaultSections;
    }
  }

  public updateHomeSections(sections: HomeSection[]): HomeSection[] {
    const normalized = sections
      .map((s, idx) => ({ ...s, order: s.order ?? idx }))
      .sort((a, b) => a.order - b.order);
    this.db.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);', [
      'home_sections',
      JSON.stringify(normalized),
    ]);
    return normalized;
  }

  public getPreferences(): UserPreferences {
    const row = this.db.get<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?;',
      ['user_preferences']
    );
    const defaults: UserPreferences = {
      themeMode: 'DARK',
      accentColor: '#10B981',
      privacyMaskEnabled: false,
      biometricLockEnabled: false,
      hasCompletedOnboarding: false,
    };
    if (!row) {
      return defaults;
    }
    try {
      return { ...defaults, ...JSON.parse(row.value) };
    } catch {
      return defaults;
    }
  }

  public updatePreferences(updates: Partial<UserPreferences>): UserPreferences {
    const next: UserPreferences = {
      ...this.getPreferences(),
      ...updates,
    };
    this.db.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);', [
      'user_preferences',
      JSON.stringify(next),
    ]);
    return next;
  }

  public exportTransactionsToCsv(filters?: Parameters<FinanceEngine['queryTransactions']>[0]): string {
    const txs = this.queryTransactions(filters);
    const baseCurrency = this.getBaseCurrency();
    const baseDef = getCurrencyDefinition(baseCurrency);

    const escapeCsvField = (val: string | number | null | undefined): string => {
      const str = val === null || val === undefined ? '' : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = [
      'Date',
      'Type',
      'Title',
      'Category',
      'Subcategory',
      'Wallet',
      'Amount',
      'Currency',
      'SnapshotRateToBase',
      'AmountInBase',
      'BaseCurrency',
      'Note',
    ].join(',');

    const rows = txs.map((tx) => {
      const wallet = this.getWallet(tx.walletId);
      const cat = tx.categoryId ? this.getCategory(tx.categoryId) : undefined;
      const sub = tx.subcategoryId ? this.getCategory(tx.subcategoryId) : undefined;
      const majorAmount = (
        Number(tx.amountMinor) / Math.pow(10, tx.decimalPlaces)
      ).toFixed(tx.decimalPlaces);
      const baseMinor = this.convertTransactionToBaseMinor(tx);
      const majorBase = (
        Number(baseMinor) / Math.pow(10, baseDef.decimalPlaces)
      ).toFixed(baseDef.decimalPlaces);

      return [
        escapeCsvField(tx.occurredAt),
        escapeCsvField(tx.type),
        escapeCsvField(tx.title),
        escapeCsvField(cat?.name ?? ''),
        escapeCsvField(sub?.name ?? ''),
        escapeCsvField(wallet?.name ?? ''),
        escapeCsvField(majorAmount),
        escapeCsvField(tx.currencyCode),
        escapeCsvField(tx.snapshotRateToBase),
        escapeCsvField(majorBase),
        escapeCsvField(baseCurrency),
        escapeCsvField(tx.note),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  public exportBackupSnapshotJson(): string {
    const standaloneUpcomingPayments = this.listStandaloneUpcomingPayments();

    const snapshot: BackupSnapshot = {
      version: 1,
      exportedAt: new Date().toISOString(),
      baseCurrency: this.getBaseCurrency(),
      preferences: this.getPreferences(),
      homeSections: this.getHomeSections(),
      exchangeRates: this.listExchangeRates(),
      wallets: this.listWallets({ includeArchived: true }),
      categories: this.listCategories(),
      transactions: this.listTransactions(),
      budgets: this.listBudgets(),
      recurringRules: this.listRecurringRules(),
      standaloneUpcomingPayments,
    };

    return JSON.stringify(snapshot, null, 2);
  }

  public restoreBackupSnapshotJson(rawJson: string): void {
    const parsed = JSON.parse(rawJson) as BackupSnapshot;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.wallets)) {
      throw new Error('Invalid PennyWise Backup Snapshot file');
    }

    this.db.exec(`
      DELETE FROM transactions;
      DELETE FROM budgets;
      DELETE FROM recurring_rules;
      DELETE FROM standalone_upcoming_payments;
      DELETE FROM categories;
      DELETE FROM wallets;
      DELETE FROM exchange_rates;
    `);

    this.db.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);', [
      'base_currency',
      parsed.baseCurrency || 'USD',
    ]);
    if (parsed.preferences) {
      this.updatePreferences(parsed.preferences);
    }
    if (Array.isArray(parsed.homeSections)) {
      this.updateHomeSections(parsed.homeSections);
    }

    for (const r of parsed.exchangeRates ?? []) {
      this.db.run(
        `INSERT OR REPLACE INTO exchange_rates (
          currency_code, base_currency_code, rate_to_base, is_manual_override, updated_at
        ) VALUES (?, ?, ?, ?, ?);`,
        [
          r.currencyCode,
          r.baseCurrencyCode,
          r.rateToBase,
          r.isManualOverride ? 1 : 0,
          r.updatedAt,
        ]
      );
    }

    for (const w of parsed.wallets) {
      this.db.run(
        `INSERT INTO wallets (
          id, name, currency_code, decimal_places, initial_balance_minor, current_balance_minor,
          color, icon, include_in_net_worth, sort_order, is_archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          w.id,
          w.name,
          w.currencyCode,
          w.decimalPlaces,
          w.initialBalanceMinor,
          w.currentBalanceMinor,
          w.color,
          w.icon,
          w.includeInNetWorth ? 1 : 0,
          w.sortOrder,
          w.isArchived ? 1 : 0,
        ]
      );
    }

    for (const c of parsed.categories ?? []) {
      this.db.run(
        `INSERT INTO categories (id, parent_id, name, flow_type, color, icon, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [c.id, c.parentId, c.name, c.flowType, c.color, c.icon, c.sortOrder]
      );
    }

    for (const tx of parsed.transactions ?? []) {
      this.db.run(
        `INSERT INTO transactions (
          id, type, wallet_id, destination_wallet_id, amount_minor, destination_amount_minor,
          currency_code, decimal_places, snapshot_rate_to_base, category_id, subcategory_id,
          manual_budget_id, title, note, occurred_at, recurring_rule_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          tx.id,
          tx.type,
          tx.walletId,
          tx.destinationWalletId,
          tx.amountMinor,
          tx.destinationAmountMinor,
          tx.currencyCode,
          tx.decimalPlaces,
          tx.snapshotRateToBase,
          tx.categoryId,
          tx.subcategoryId,
          tx.manualBudgetId,
          tx.title,
          tx.note,
          tx.occurredAt,
          tx.recurringRuleId,
        ]
      );
    }

    for (const b of parsed.budgets ?? []) {
      this.db.run(
        `INSERT INTO budgets (
          id, name, limit_amount_minor, currency_code, decimal_places,
          period_type, interval_count, interval_unit, anchor_date, end_date,
          scope_type, filter_category_ids_json, filter_wallet_ids_json,
          color, icon, is_pinned_to_home, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          b.id,
          b.name,
          b.limitAmountMinor,
          b.currencyCode,
          b.decimalPlaces,
          b.periodType,
          b.intervalCount,
          b.intervalUnit,
          b.anchorDate,
          b.endDate,
          b.scopeType,
          JSON.stringify(b.filterCategoryIds ?? []),
          JSON.stringify(b.filterWalletIds ?? []),
          b.color,
          b.icon,
          b.isPinnedToHome ? 1 : 0,
          b.sortOrder,
        ]
      );
    }

    for (const rule of parsed.recurringRules ?? []) {
      this.db.run(
        `INSERT INTO recurring_rules (
          id, title, type, wallet_id, category_id, subcategory_id,
          amount_minor, currency_code, decimal_places, frequency, interval_count,
          next_due_date, auto_pay, reminder_days_before, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          rule.id,
          rule.title,
          rule.type,
          rule.walletId,
          rule.categoryId,
          rule.subcategoryId,
          rule.amountMinor,
          rule.currencyCode,
          rule.decimalPlaces,
          rule.frequency,
          rule.intervalCount,
          rule.nextDueDate,
          rule.autoPay ? 1 : 0,
          rule.reminderDaysBefore,
          rule.isActive ? 1 : 0,
        ]
      );
    }

    for (const u of parsed.standaloneUpcomingPayments ?? []) {
      this.db.run(
        `INSERT INTO standalone_upcoming_payments (
          id, title, type, wallet_id, category_id, subcategory_id,
          amount_minor, currency_code, decimal_places, due_date, auto_pay, reminder_days_before
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          u.id,
          u.title,
          u.type,
          u.walletId,
          u.categoryId,
          u.subcategoryId,
          u.amountMinor,
          u.currencyCode,
          u.decimalPlaces,
          u.dueDate,
          u.autoPay ? 1 : 0,
          u.reminderDaysBefore,
        ]
      );
    }
  }
}

declare const require: (moduleName: string) => any;

export function createInMemorySQLiteDriver(): SQLiteDriver {
  const nodeSqlite = require('node:sqlite');
  const db = new nodeSqlite.DatabaseSync(':memory:');
  return {
    exec(sql: string): void {
      db.exec(sql);
    },
    run(sql: string, params: unknown[] = []): void {
      db.prepare(sql).run(...params);
    },
    get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
      return db.prepare(sql).get(...params) as T | undefined;
    },
    all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      return db.prepare(sql).all(...params) as T[];
    },
  };
}

export function createInMemoryFinanceEngine(): FinanceEngine {
  return new FinanceEngine(createInMemorySQLiteDriver());
}

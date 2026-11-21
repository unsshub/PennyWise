export interface SQLiteDriver {
  exec(sql: string): void;
  run(sql: string, params?: unknown[]): void;
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'BALANCE_ADJUSTMENT';

export interface Wallet {
  id: string;
  name: string;
  currencyCode: string;
  decimalPlaces: number;
  initialBalanceMinor: string;
  currentBalanceMinor: string;
  color: string;
  icon: string;
  includeInNetWorth: boolean;
  sortOrder: number;
  isArchived: boolean;
}

export interface ExchangeRate {
  currencyCode: string;
  baseCurrencyCode: string;
  rateToBase: number;
  isManualOverride: boolean;
  updatedAt: string;
}

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  flowType: 'EXPENSE' | 'INCOME';
  color: string;
  icon: string;
  sortOrder: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  walletId: string;
  destinationWalletId: string | null;
  amountMinor: string;
  destinationAmountMinor: string | null;
  currencyCode: string;
  decimalPlaces: number;
  snapshotRateToBase: number;
  categoryId: string | null;
  subcategoryId: string | null;
  manualBudgetId: string | null;
  title: string;
  note: string;
  occurredAt: string;
  recurringRuleId: string | null;
}

export type BudgetPeriodType = 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'INTERVAL' | 'CUSTOM_RANGE';
export type BudgetScopeType = 'AUTOMATIC_FILTER' | 'MANUAL_ASSIGNMENT';

export interface Budget {
  id: string;
  name: string;
  limitAmountMinor: string;
  currencyCode: string;
  decimalPlaces: number;
  periodType: BudgetPeriodType;
  intervalCount: number | null;
  intervalUnit: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
  anchorDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD for CUSTOM_RANGE
  scopeType: BudgetScopeType;
  filterCategoryIds: string[];
  filterWalletIds: string[];
  color: string;
  icon: string;
  isPinnedToHome: boolean;
  sortOrder: number;
}

export interface BudgetEvaluation {
  budget: Budget;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  totalDays: number;
  elapsedDaysInclusive: number;
  remainingDaysInclusive: number;
  spentMinor: string;
  remainingMinor: string;
  overBudgetMinor: string;
  dailySpendingAllowanceMinor: string;
  percentSpent: number;
  percentTimeElapsed: number;
  matchingTransactionIds: string[];
}

export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'INTERVAL';

export interface RecurringRule {
  id: string;
  title: string;
  type: 'EXPENSE' | 'INCOME';
  walletId: string;
  categoryId: string;
  subcategoryId: string | null;
  amountMinor: string;
  currencyCode: string;
  decimalPlaces: number;
  frequency: RecurringFrequency;
  intervalCount: number;
  nextDueDate: string; // YYYY-MM-DD
  autoPay: boolean;
  reminderDaysBefore: number;
  isActive: boolean;
}

export interface UpcomingPayment {
  id: string;
  recurringRuleId: string | null;
  title: string;
  type: 'EXPENSE' | 'INCOME';
  walletId: string;
  categoryId: string;
  subcategoryId: string | null;
  amountMinor: string;
  currencyCode: string;
  decimalPlaces: number;
  dueDate: string; // YYYY-MM-DD
  autoPay: boolean;
  reminderDaysBefore: number;
}

export interface SpendingPaceComparison {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
  referenceDayIndex: number; // 1-based day index in current period
  currentCumulativeMinorByDay: string[];
  previousCumulativeMinorByDay: string[];
  deltaAtReferenceDayMinor: string;
  percentChangeAtReferenceDay: number;
}

export interface SubcategoryBreakdownSlice {
  subcategoryId: string | null;
  name: string;
  icon: string;
  amountMinor: string;
  percentage: number;
}

export interface CategoryBreakdownSlice {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  amountMinor: string;
  percentage: number;
  subcategories: SubcategoryBreakdownSlice[];
}

export interface CategoryBreakdownResult {
  totalMinor: string;
  categories: CategoryBreakdownSlice[];
}

export interface CashFlowBarPoint {
  label: string;
  startDate: string;
  endDate: string;
  incomeMinor: string;
  expenseMinor: string;
  netMinor: string;
}

export interface NetWorthHistoryPoint {
  date: string;
  netWorthMinor: string;
}

export type HomeSectionId =
  | 'WALLETS_CAROUSEL'
  | 'PINNED_BUDGETS'
  | 'SPENDING_PACE'
  | 'UPCOMING_PAYMENTS'
  | 'RECENT_TRANSACTIONS';

export interface HomeSection {
  id: HomeSectionId;
  title: string;
  visible: boolean;
  order: number;
}

export type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK' | 'AMOLED';

export interface UserPreferences {
  themeMode: ThemeMode;
  accentColor: string;
  privacyMaskEnabled: boolean;
  biometricLockEnabled: boolean;
}

export interface BackupSnapshot {
  version: number;
  exportedAt: string;
  baseCurrency: string;
  preferences: UserPreferences;
  homeSections: HomeSection[];
  exchangeRates: ExchangeRate[];
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringRules: RecurringRule[];
  standaloneUpcomingPayments: UpcomingPayment[];
}

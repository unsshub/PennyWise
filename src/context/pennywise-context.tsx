import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import { formatMinorUnits } from '@/domain/currency';
import type { FinanceEngine } from '@/domain/finance-engine';
import type {
  Budget,
  BudgetEvaluation,
  Category,
  ExchangeRate,
  HomeSection,
  RecurringRule,
  SpendingPaceComparison,
  Transaction,
  UpcomingPayment,
  UserPreferences,
  Wallet,
} from '@/domain/types';
import {
  scheduleUpcomingBillNotifications,
  syncLiveExchangeRates,
} from '@/services/device-services';
import { getDeviceFinanceEngine } from '@/services/sqlite-driver';

export interface ThemePalette {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  danger: string;
  success: string;
  warning: string;
}

export interface QuickEntryDraft {
  editingTransaction?: Transaction | null;
  defaultType?: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  defaultWalletId?: string;
}

interface PennyWiseContextValue {
  engine: FinanceEngine;
  revision: number;
  refresh: () => void;
  baseCurrency: string;
  netWorthMinor: string;
  wallets: Wallet[];
  allWalletsIncludingArchived: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  budgetEvaluations: BudgetEvaluation[];
  recurringRules: RecurringRule[];
  upcomingPayments: UpcomingPayment[];
  exchangeRates: ExchangeRate[];
  homeSections: HomeSection[];
  preferences: UserPreferences;
  theme: ThemePalette;
  spendingPaceThisMonth: SpendingPaceComparison;
  formatAmount: (
    amountMinor: string | bigint,
    currencyCode?: string,
    decimalPlaces?: number,
    options?: { showPlusSign?: boolean; ignorePrivacyMask?: boolean }
  ) => string;
  isQuickEntryOpen: boolean;
  quickEntryDraft: QuickEntryDraft | null;
  openQuickEntry: (draft?: QuickEntryDraft) => void;
  closeQuickEntry: () => void;
  isAppLocked: boolean;
  unlockApp: () => void;
  syncExchangeRatesNow: () => Promise<boolean>;
  seedDemoData: () => void;
}

const PennyWiseContext = createContext<PennyWiseContextValue | null>(null);

export function PennyWiseProvider({ children }: { children: React.ReactNode }) {
  const engine = useMemo(() => getDeviceFinanceEngine(), []);
  const systemScheme = useColorScheme();
  const [revision, setRevision] = useState(0);
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [quickEntryDraft, setQuickEntryDraft] = useState<QuickEntryDraft | null>(null);
  const [isAppLocked, setIsAppLocked] = useState(() => {
    return engine.getPreferences().biometricLockEnabled;
  });

  const refresh = useCallback(() => {
    setRevision((r) => r + 1);
  }, []);

  useEffect(() => {
    // On app launch, settle any due autoPay rules and schedule local notifications
    const today = new Date().toISOString().slice(0, 10);
    const settled = engine.processDueAutoPayRules(today);
    if (settled.length > 0) {
      setRevision((r) => r + 1);
    }
    void scheduleUpcomingBillNotifications(engine.listUpcomingPayments());
  }, [engine]);

  const baseCurrency = useMemo(() => engine.getBaseCurrency(), [engine, revision]);
  const wallets = useMemo(() => engine.listWallets(), [engine, revision]);
  const allWalletsIncludingArchived = useMemo(
    () => engine.listWallets({ includeArchived: true }),
    [engine, revision]
  );
  const netWorthMinor = useMemo(() => engine.calculateNetWorthMinor(), [engine, revision]);
  const categories = useMemo(() => engine.listCategories(), [engine, revision]);
  const transactions = useMemo(() => engine.listTransactions(), [engine, revision]);
  const budgets = useMemo(() => engine.listBudgets(), [engine, revision]);
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const budgetEvaluations = useMemo(
    () => budgets.map((b) => engine.evaluateBudget(b.id, todayStr)),
    [engine, budgets, todayStr, revision]
  );

  const recurringRules = useMemo(() => engine.listRecurringRules(), [engine, revision]);
  const upcomingPayments = useMemo(() => engine.listUpcomingPayments(), [engine, revision]);
  const exchangeRates = useMemo(() => engine.listExchangeRates(), [engine, revision]);
  const homeSections = useMemo(() => engine.getHomeSections(), [engine, revision]);
  const preferences = useMemo(() => engine.getPreferences(), [engine, revision]);

  const spendingPaceThisMonth = useMemo(() => {
    const [y, m] = todayStr.split('-').map(Number);
    const currentStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const currentEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return engine.computeSpendingPaceComparison({
      currentStart,
      currentEnd,
      referenceToday: todayStr,
    });
  }, [engine, todayStr, revision]);

  const theme = useMemo<ThemePalette>(() => {
    const mode = preferences.themeMode;
    const isAmoled = mode === 'AMOLED';
    const isDark =
      isAmoled || mode === 'DARK' || (mode === 'SYSTEM' && systemScheme !== 'light');

    return {
      isDark,
      background: isAmoled ? '#000000' : isDark ? '#0B0F19' : '#F8FAFC',
      surface: isAmoled ? '#0A0D14' : isDark ? '#151C2C' : '#FFFFFF',
      surfaceElevated: isAmoled ? '#121824' : isDark ? '#1E293B' : '#F1F5F9',
      border: isAmoled ? '#1E293B' : isDark ? '#263248' : '#E2E8F0',
      textPrimary: isDark ? '#F8FAFC' : '#0F172A',
      textSecondary: isDark ? '#94A3B8' : '#475569',
      textMuted: isDark ? '#64748B' : '#94A3B8',
      accent: preferences.accentColor || '#10B981',
      danger: '#EF4444',
      success: '#10B981',
      warning: '#F59E0B',
    };
  }, [preferences, systemScheme]);

  const formatAmount = useCallback(
    (
      amountMinor: string | bigint,
      currencyCode?: string,
      decimalPlaces?: number,
      options?: { showPlusSign?: boolean; ignorePrivacyMask?: boolean }
    ) => {
      return formatMinorUnits(
        amountMinor,
        currencyCode ?? baseCurrency,
        decimalPlaces,
        {
          privacyMasked: options?.ignorePrivacyMask
            ? false
            : preferences.privacyMaskEnabled,
          showPlusSign: options?.showPlusSign,
        }
      );
    },
    [baseCurrency, preferences.privacyMaskEnabled]
  );

  const openQuickEntry = useCallback((draft?: QuickEntryDraft) => {
    setQuickEntryDraft(draft ?? null);
    setIsQuickEntryOpen(true);
  }, []);

  const closeQuickEntry = useCallback(() => {
    setIsQuickEntryOpen(false);
    setQuickEntryDraft(null);
  }, []);

  const unlockApp = useCallback(() => {
    setIsAppLocked(false);
  }, []);

  const syncExchangeRatesNow = useCallback(async () => {
    const ok = await syncLiveExchangeRates(engine);
    if (ok) {
      refresh();
    }
    return ok;
  }, [engine, refresh]);

  const seedDemoData = useCallback(() => {
    // Populates rich sample multi-currency Wallets (Wallet, Euros, Bitcoin), Budgets, Bills, and Transactions
    const currentWallets = engine.listWallets();
    const mainUsd = currentWallets[0];
    if (mainUsd) {
      engine.updateWallet(mainUsd.id, {
        name: 'Wallet',
        initialBalanceMinor: '345000', // $3,450.00
        color: '#10B981',
        icon: '💵',
      });
    }

    const hasEur = currentWallets.some((w) => w.currencyCode === 'EUR');
    const eurWallet = hasEur
      ? currentWallets.find((w) => w.currencyCode === 'EUR')!
      : engine.createWallet({
          name: 'Euros',
          currencyCode: 'EUR',
          decimalPlaces: 2,
          initialBalanceMinor: '125000', // €1,250.00
          color: '#3B82F6',
          icon: '€',
          includeInNetWorth: true,
        });

    const hasBtc = currentWallets.some((w) => w.currencyCode === 'BTC');
    if (!hasBtc) {
      engine.createWallet({
        name: 'Bitcoin',
        currencyCode: 'BTC',
        decimalPlaces: 8,
        initialBalanceMinor: '4500000', // 0.045 BTC
        color: '#F59E0B',
        icon: '₿',
        includeInNetWorth: true,
      });
    }

    const cats = engine.listCategories();
    const foodCat = cats.find((c) => c.name === 'Food & Dining');
    const housingCat = cats.find((c) => c.name === 'Housing & Bills');
    const transportCat = cats.find((c) => c.name === 'Transportation');
    const entCat = cats.find((c) => c.name === 'Entertainment');
    const salaryCat = cats.find((c) => c.name === 'Salary & Paycheck');

    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYm = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    if (engine.listTransactions().length === 0 && mainUsd && foodCat && housingCat && salaryCat) {
      engine.recordTransaction({
        type: 'INCOME',
        walletId: mainUsd.id,
        amountMinor: '480000',
        categoryId: salaryCat.id,
        title: 'Monthly Tech Salary',
        note: 'Direct deposit',
        occurredAt: `${ym}-01T09:00:00.000Z`,
      });
      engine.recordTransaction({
        type: 'EXPENSE',
        walletId: mainUsd.id,
        amountMinor: '140000',
        categoryId: housingCat.id,
        title: 'Apartment Rent',
        occurredAt: `${ym}-02T10:00:00.000Z`,
      });
      engine.recordTransaction({
        type: 'EXPENSE',
        walletId: mainUsd.id,
        amountMinor: '8450',
        categoryId: foodCat.id,
        subcategoryId: 'sub-groceries',
        title: 'Trader Joe\'s Groceries',
        occurredAt: `${ym}-04T17:30:00.000Z`,
      });
      engine.recordTransaction({
        type: 'EXPENSE',
        walletId: eurWallet.id,
        amountMinor: '4500',
        categoryId: foodCat.id,
        subcategoryId: 'sub-restaurants',
        title: 'Café de Flore Paris',
        note: 'Brunch in Euros',
        occurredAt: `${ym}-06T12:15:00.000Z`,
      });
      if (transportCat) {
        engine.recordTransaction({
          type: 'EXPENSE',
          walletId: mainUsd.id,
          amountMinor: '4200',
          categoryId: transportCat.id,
          subcategoryId: 'sub-fuel',
          title: 'Shell Station',
          occurredAt: `${ym}-08T15:00:00.000Z`,
        });
      }
      // Previous month sample transactions for Spending Pace Comparison
      engine.recordTransaction({
        type: 'INCOME',
        walletId: mainUsd.id,
        amountMinor: '480000',
        categoryId: salaryCat.id,
        title: 'Last Month Salary',
        occurredAt: `${prevYm}-01T09:00:00.000Z`,
      });
      engine.recordTransaction({
        type: 'EXPENSE',
        walletId: mainUsd.id,
        amountMinor: '140000',
        categoryId: housingCat.id,
        title: 'Last Month Rent',
        occurredAt: `${prevYm}-02T10:00:00.000Z`,
      });
      engine.recordTransaction({
        type: 'EXPENSE',
        walletId: mainUsd.id,
        amountMinor: '21500',
        categoryId: foodCat.id,
        title: 'Last Month Dining & Groceries',
        occurredAt: `${prevYm}-05T19:00:00.000Z`,
      });
    }

    if (engine.listBudgets().length === 0 && foodCat) {
      engine.createBudget({
        name: 'Monthly Living Budget',
        limitAmountMinor: '250000', // $2,500.00
        periodType: 'MONTHLY',
        anchorDate: `${ym}-01`,
        scopeType: 'AUTOMATIC_FILTER',
        color: '#10B981',
        icon: '🎯',
      });
      engine.createBudget({
        name: 'Food & Dining Cap',
        limitAmountMinor: '50000', // $500.00
        periodType: 'MONTHLY',
        anchorDate: `${ym}-01`,
        scopeType: 'AUTOMATIC_FILTER',
        filterCategoryIds: [foodCat.id],
        color: '#F97316',
        icon: '🍔',
      });
    }

    if (engine.listRecurringRules().length === 0 && mainUsd && entCat && housingCat) {
      engine.createRecurringRule({
        title: 'Netflix 4K Plan',
        type: 'EXPENSE',
        walletId: mainUsd.id,
        categoryId: entCat.id,
        subcategoryId: 'sub-subscriptions',
        amountMinor: '2299',
        frequency: 'MONTHLY',
        intervalCount: 1,
        nextDueDate: `${ym}-24`,
        autoPay: true,
        reminderDaysBefore: 1,
      });
      engine.createRecurringRule({
        title: 'Fiber Gigabit Internet',
        type: 'EXPENSE',
        walletId: mainUsd.id,
        categoryId: housingCat.id,
        subcategoryId: 'sub-internet',
        amountMinor: '7000',
        frequency: 'MONTHLY',
        intervalCount: 1,
        nextDueDate: `${ym}-28`,
        autoPay: false,
        reminderDaysBefore: 2,
      });
    }

    refresh();
  }, [engine, refresh]);

  const value = useMemo<PennyWiseContextValue>(
    () => ({
      engine,
      revision,
      refresh,
      baseCurrency,
      netWorthMinor,
      wallets,
      allWalletsIncludingArchived,
      categories,
      transactions,
      budgets,
      budgetEvaluations,
      recurringRules,
      upcomingPayments,
      exchangeRates,
      homeSections,
      preferences,
      theme,
      spendingPaceThisMonth,
      formatAmount,
      isQuickEntryOpen,
      quickEntryDraft,
      openQuickEntry,
      closeQuickEntry,
      isAppLocked,
      unlockApp,
      syncExchangeRatesNow,
      seedDemoData,
    }),
    [
      engine,
      revision,
      refresh,
      baseCurrency,
      netWorthMinor,
      wallets,
      allWalletsIncludingArchived,
      categories,
      transactions,
      budgets,
      budgetEvaluations,
      recurringRules,
      upcomingPayments,
      exchangeRates,
      homeSections,
      preferences,
      theme,
      spendingPaceThisMonth,
      formatAmount,
      isQuickEntryOpen,
      quickEntryDraft,
      openQuickEntry,
      closeQuickEntry,
      isAppLocked,
      unlockApp,
      syncExchangeRatesNow,
      seedDemoData,
    ]
  );

  return (
    <PennyWiseContext.Provider value={value}>{children}</PennyWiseContext.Provider>
  );
}

export function usePennyWise(): PennyWiseContextValue {
  const ctx = useContext(PennyWiseContext);
  if (!ctx) {
    throw new Error('usePennyWise must be used within a PennyWiseProvider');
  }
  return ctx;
}

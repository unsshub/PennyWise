import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, useColorScheme } from 'react-native';

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
    const today = new Date().toISOString().slice(0, 10);
    const settled = engine.processDueAutoPayRules(today);
    if (settled.length > 0) {
      setRevision((r) => r + 1);
    }
    void scheduleUpcomingBillNotifications(engine.listUpcomingPayments());
  }, [engine]);

  // Re-lock on background resume when Biometric App Lock is enabled
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (engine.getPreferences().biometricLockEnabled) {
          setIsAppLocked(true);
        }
      }
    });
    return () => sub.remove();
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

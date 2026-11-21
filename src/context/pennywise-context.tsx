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
import {
  localizeCategoryName,
  localizeHomeSectionTitle,
  translateKey,
} from '@/domain/i18n';
import type {
  AppLanguage,
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
  language: AppLanguage;
  isRTL: boolean;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string) => string;
  localizeName: (rawName: string) => string;
  localizeSection: (sectionId: string, fallbackTitle: string) => string;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  togglePrivacyMask: () => void;
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

interface SnapshotState {
  revision: number;
  baseCurrency: string;
  wallets: Wallet[];
  allWalletsIncludingArchived: Wallet[];
  netWorthMinor: string;
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  budgetEvaluations: BudgetEvaluation[];
  recurringRules: RecurringRule[];
  upcomingPayments: UpcomingPayment[];
  exchangeRates: ExchangeRate[];
  homeSections: HomeSection[];
  preferences: UserPreferences;
  spendingPaceThisMonth: SpendingPaceComparison;
}

function readEngineState(engine: FinanceEngine, revision: number): SnapshotState {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [y, m] = todayStr.split('-').map(Number);
  const currentStart = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const currentEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const budgets = engine.listBudgets();
  return {
    revision,
    baseCurrency: engine.getBaseCurrency(),
    wallets: engine.listWallets(),
    allWalletsIncludingArchived: engine.listWallets({ includeArchived: true }),
    netWorthMinor: engine.calculateNetWorthMinor(),
    categories: engine.listCategories(),
    transactions: engine.listTransactions(),
    budgets,
    budgetEvaluations: budgets.map((b) => engine.evaluateBudget(b.id, todayStr)),
    recurringRules: engine.listRecurringRules(),
    upcomingPayments: engine.listUpcomingPayments(),
    exchangeRates: engine.listExchangeRates(),
    homeSections: engine.getHomeSections(),
    preferences: engine.getPreferences(),
    spendingPaceThisMonth: engine.computeSpendingPaceComparison({
      currentStart,
      currentEnd,
      referenceToday: todayStr,
    }),
  };
}

export function PennyWiseProvider({ children }: { children: React.ReactNode }) {
  const engine = useMemo(() => getDeviceFinanceEngine(), []);
  const systemScheme = useColorScheme();
  const [snapshot, setSnapshot] = useState<SnapshotState>(() =>
    readEngineState(engine, 0)
  );
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [quickEntryDraft, setQuickEntryDraft] = useState<QuickEntryDraft | null>(null);
  const [isAppLocked, setIsAppLocked] = useState(() => {
    return engine.getPreferences().biometricLockEnabled;
  });

  const refresh = useCallback(() => {
    setSnapshot((prev) => readEngineState(engine, prev.revision + 1));
  }, [engine]);

  const updatePreferences = useCallback(
    (updates: Partial<UserPreferences>) => {
      const updatedPrefs = engine.updatePreferences(updates);
      // Immediately update React state synchronously so UI toggles (like Privacy Mask / Theme) respond on the first tap
      setSnapshot((prev) => ({
        ...prev,
        revision: prev.revision + 1,
        preferences: updatedPrefs,
      }));
    },
    [engine]
  );

  const togglePrivacyMask = useCallback(() => {
    setSnapshot((prev) => {
      const nextMasked = !prev.preferences.privacyMaskEnabled;
      const updatedPrefs = engine.updatePreferences({
        privacyMaskEnabled: nextMasked,
      });
      return {
        ...prev,
        revision: prev.revision + 1,
        preferences: updatedPrefs,
      };
    });
  }, [engine]);

  const language: AppLanguage = snapshot.preferences.language ?? 'en';
  const isRTL = language === 'ar';

  const setLanguage = useCallback(
    (lang: AppLanguage) => {
      updatePreferences({ language: lang });
    },
    [updatePreferences]
  );

  const t = useCallback(
    (key: string) => translateKey(language, key),
    [language]
  );

  const localizeName = useCallback(
    (rawName: string) => localizeCategoryName(language, rawName),
    [language]
  );

  const localizeSection = useCallback(
    (sectionId: string, fallbackTitle: string) =>
      localizeHomeSectionTitle(language, sectionId, fallbackTitle),
    [language]
  );

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const settled = engine.processDueAutoPayRules(today);
    if (settled.length > 0) {
      refresh();
    }
    void scheduleUpcomingBillNotifications(engine.listUpcomingPayments());
  }, [engine, refresh]);

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

  const {
    revision,
    baseCurrency,
    wallets,
    allWalletsIncludingArchived,
    netWorthMinor,
    categories,
    transactions,
    budgets,
    budgetEvaluations,
    recurringRules,
    upcomingPayments,
    exchangeRates,
    homeSections,
    preferences,
    spendingPaceThisMonth,
  } = snapshot;

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
      language,
      isRTL,
      setLanguage,
      t,
      localizeName,
      localizeSection,
      updatePreferences,
      togglePrivacyMask,
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
      language,
      isRTL,
      setLanguage,
      t,
      localizeName,
      localizeSection,
      updatePreferences,
      togglePrivacyMask,
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

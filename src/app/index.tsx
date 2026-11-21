import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { WalletModal } from '@/components/wallet-modal';
import { usePennyWise } from '@/context/pennywise-context';
import type { HomeSectionId, Wallet } from '@/domain/types';

export default function HomeScreen() {
  const router = useRouter();
  const {
    engine,
    baseCurrency,
    netWorthMinor,
    wallets,
    categories,
    transactions,
    budgetEvaluations,
    upcomingPayments,
    homeSections,
    preferences,
    theme,
    spendingPaceThisMonth,
    formatAmount,
    openQuickEntry,
    seedDemoData,
    refresh,
  } = usePennyWise();

  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);

  const togglePrivacyMask = () => {
    engine.updatePreferences({
      privacyMaskEnabled: !preferences.privacyMaskEnabled,
    });
    refresh();
  };

  const renderWalletsCarouselSection = () => (
    <View key="WALLETS_CAROUSEL" style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Wallets ({wallets.length})
        </Text>
        <Pressable
          onPress={() => {
            setEditingWallet(null);
            setWalletModalOpen(true);
          }}
        >
          <Text style={[styles.actionLink, { color: theme.accent }]}>
            + Add Wallet
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.carousel}
      >
        {wallets.map((w) => {
          const convertedMinor = engine.convertWalletBalanceToBaseMinor(w);
          const isForeign = w.currencyCode !== baseCurrency;
          return (
            <Pressable
              key={w.id}
              onPress={() => {
                setEditingWallet(w);
                setWalletModalOpen(true);
              }}
              style={[
                styles.walletCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: w.color + '88',
                  borderLeftColor: w.color,
                },
              ]}
            >
              <View style={styles.walletCardHeader}>
                <View
                  style={[
                    styles.walletIconBadge,
                    { backgroundColor: w.color + '22' },
                  ]}
                >
                  <Text style={styles.walletIconText}>{w.icon}</Text>
                </View>
                <View style={styles.currencyPill}>
                  <Text style={[styles.currencyPillText, { color: w.color }]}>
                    {w.currencyCode}
                  </Text>
                </View>
              </View>
              <Text
                style={[styles.walletName, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {w.name}
              </Text>
              <Text
                style={[styles.walletBalance, { color: theme.textPrimary }]}
                numberOfLines={1}
              >
                {formatAmount(w.currentBalanceMinor, w.currencyCode, w.decimalPlaces)}
              </Text>
              {isForeign ? (
                <Text style={[styles.walletConverted, { color: theme.textMuted }]}>
                  ≈ {formatAmount(convertedMinor, baseCurrency)}
                </Text>
              ) : (
                <Text style={[styles.walletConverted, { color: theme.textMuted }]}>
                  {w.includeInNetWorth ? 'Included in Net Worth' : 'Excluded from Total'}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderPinnedBudgetsSection = () => {
    const pinned = budgetEvaluations.filter((e) => e.budget.isPinnedToHome);
    return (
      <View key="PINNED_BUDGETS" style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Budgets & Daily Allowance
          </Text>
          <Pressable onPress={() => router.push('/budgets')}>
            <Text style={[styles.actionLink, { color: theme.accent }]}>
              Manage Budgets →
            </Text>
          </Pressable>
        </View>

        {pinned.length === 0 ? (
          <Pressable
            onPress={() => router.push('/budgets')}
            style={[
              styles.emptyCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.emptyCardTitle, { color: theme.textPrimary }]}>
              🎯 No Active Budgets Yet
            </Text>
            <Text style={[styles.emptyCardSub, { color: theme.textSecondary }]}>
              Create a weekly, monthly, or custom trip budget to see your real-time Daily Spending Allowance.
            </Text>
          </Pressable>
        ) : (
          pinned.map((ev) => {
            const isOver = BigInt(ev.overBudgetMinor) > 0n;
            const fillPct = Math.min(100, ev.percentSpent);
            return (
              <Pressable
                key={ev.budget.id}
                onPress={() => router.push('/budgets')}
                style={[
                  styles.budgetCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={styles.budgetHeader}>
                  <View style={styles.budgetTitleRow}>
                    <Text style={{ fontSize: 18 }}>{ev.budget.icon}</Text>
                    <View>
                      <Text
                        style={[styles.budgetName, { color: theme.textPrimary }]}
                      >
                        {ev.budget.name}
                      </Text>
                      <Text
                        style={[styles.budgetPeriodText, { color: theme.textMuted }]}
                      >
                        {ev.periodStart} → {ev.periodEnd} ({ev.remainingDaysInclusive}d left)
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.allowanceBadge,
                      {
                        backgroundColor: isOver
                          ? theme.danger + '22'
                          : ev.budget.color + '22',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.allowanceAmount,
                        { color: isOver ? theme.danger : ev.budget.color },
                      ]}
                    >
                      {formatAmount(
                        ev.dailySpendingAllowanceMinor,
                        ev.budget.currencyCode,
                        ev.budget.decimalPlaces
                      )}
                      /day
                    </Text>
                    <Text
                      style={[styles.allowanceSub, { color: theme.textSecondary }]}
                    >
                      Daily Allowance
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: theme.surfaceElevated },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${fillPct}%`,
                        backgroundColor: isOver ? theme.danger : ev.budget.color,
                      },
                    ]}
                  />
                  {/* Today Time-Elapsed Pace Marker */}
                  <View
                    style={[
                      styles.todayMarker,
                      {
                        left: `${Math.min(98, ev.percentTimeElapsed)}%`,
                        backgroundColor: theme.textPrimary,
                      },
                    ]}
                  />
                </View>

                <View style={styles.budgetFooter}>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                    Spent:{' '}
                    <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>
                      {formatAmount(
                        ev.spentMinor,
                        ev.budget.currencyCode,
                        ev.budget.decimalPlaces
                      )}
                    </Text>{' '}
                    of{' '}
                    {formatAmount(
                      ev.budget.limitAmountMinor,
                      ev.budget.currencyCode,
                      ev.budget.decimalPlaces
                    )}
                  </Text>
                  <Text
                    style={{
                      color: isOver ? theme.danger : theme.textSecondary,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {isOver
                      ? `Over by ${formatAmount(
                          ev.overBudgetMinor,
                          ev.budget.currencyCode,
                          ev.budget.decimalPlaces
                        )}`
                      : `${formatAmount(
                          ev.remainingMinor,
                          ev.budget.currencyCode,
                          ev.budget.decimalPlaces
                        )} left`}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    );
  };

  const renderSpendingPaceSection = () => {
    const curPoints = spendingPaceThisMonth.currentCumulativeMinorByDay;
    const prevPoints = spendingPaceThisMonth.previousCumulativeMinorByDay;
    const curLatest =
      curPoints.length > 0 ? curPoints[curPoints.length - 1] : '0';
    const prevAtToday =
      prevPoints.length >= spendingPaceThisMonth.referenceDayIndex &&
      spendingPaceThisMonth.referenceDayIndex > 0
        ? prevPoints[spendingPaceThisMonth.referenceDayIndex - 1]
        : '0';
    const isFaster =
      BigInt(spendingPaceThisMonth.deltaAtReferenceDayMinor) > 0n;

    return (
      <View key="SPENDING_PACE" style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Spending Pace Comparison
          </Text>
          <Pressable onPress={() => router.push('/insights')}>
            <Text style={[styles.actionLink, { color: theme.accent }]}>
              Full Charts →
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => router.push('/insights')}
          style={[
            styles.paceCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.paceRow}>
            <View>
              <Text style={[styles.paceLabel, { color: theme.textSecondary }]}>
                This Month (Day {spendingPaceThisMonth.referenceDayIndex})
              </Text>
              <Text style={[styles.paceValue, { color: theme.textPrimary }]}>
                {formatAmount(curLatest, baseCurrency)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.paceLabel, { color: theme.textSecondary }]}>
                Last Month (Day {spendingPaceThisMonth.referenceDayIndex})
              </Text>
              <Text style={[styles.paceValueMuted, { color: theme.textSecondary }]}>
                {formatAmount(prevAtToday, baseCurrency)}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.paceBanner,
              {
                backgroundColor: isFaster
                  ? theme.warning + '20'
                  : theme.success + '20',
              },
            ]}
          >
            <Text
              style={{
                color: isFaster ? theme.warning : theme.success,
                fontSize: 12,
                fontWeight: '700',
              }}
            >
              {BigInt(spendingPaceThisMonth.deltaAtReferenceDayMinor) === 0n
                ? 'On exact pace with last month'
                : isFaster
                  ? `Spending ${formatAmount(
                      spendingPaceThisMonth.deltaAtReferenceDayMinor,
                      baseCurrency
                    )} (+${spendingPaceThisMonth.percentChangeAtReferenceDay}%) faster than last month`
                  : `Saved ${formatAmount(
                      (-BigInt(spendingPaceThisMonth.deltaAtReferenceDayMinor)).toString(),
                      baseCurrency
                    )} (${spendingPaceThisMonth.percentChangeAtReferenceDay}%) vs. last month`}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  const renderUpcomingPaymentsSection = () => (
    <View key="UPCOMING_PAYMENTS" style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Upcoming Bills & Subscriptions ({upcomingPayments.length})
        </Text>
        <Pressable onPress={() => router.push('/bills')}>
          <Text style={[styles.actionLink, { color: theme.accent }]}>
            Manage Bills →
          </Text>
        </Pressable>
      </View>

      {upcomingPayments.length === 0 ? (
        <Pressable
          onPress={() => router.push('/bills')}
          style={[
            styles.emptyCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.emptyCardTitle, { color: theme.textPrimary }]}>
            🗓️ Stay Ahead of Bills
          </Text>
          <Text style={[styles.emptyCardSub, { color: theme.textSecondary }]}>
            Add subscriptions & recurring bills with auto-pay or 1-tap Mark as Paid reminders.
          </Text>
        </Pressable>
      ) : (
        upcomingPayments.slice(0, 3).map((bill) => (
          <View
            key={bill.id}
            style={[
              styles.billCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.billTitle, { color: theme.textPrimary }]}>
                {bill.title}
              </Text>
              <Text style={[styles.billMeta, { color: theme.textSecondary }]}>
                Due {bill.dueDate} • {bill.autoPay ? '⚡ Auto-Pay' : '🔔 Manual Confirm'}
              </Text>
            </View>
            <Text style={[styles.billAmount, { color: theme.textPrimary }]}>
              {formatAmount(bill.amountMinor, bill.currencyCode, bill.decimalPlaces)}
            </Text>
            {!bill.autoPay && (
              <Pressable
                onPress={() => {
                  engine.markUpcomingPaymentAsPaid(bill.id);
                  refresh();
                }}
                style={[styles.payNowBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={styles.payNowText}>Mark Paid</Text>
              </Pressable>
            )}
          </View>
        ))
      )}
    </View>
  );

  const renderRecentTransactionsSection = () => (
    <View key="RECENT_TRANSACTIONS" style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Recent Transactions
        </Text>
        <Pressable onPress={() => router.push('/transactions')}>
          <Text style={[styles.actionLink, { color: theme.accent }]}>
            See All ({transactions.length}) →
          </Text>
        </Pressable>
      </View>

      {transactions.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.emptyCardTitle, { color: theme.textPrimary }]}>
            ⚡ Fast Daily Expense Tracking
          </Text>
          <Text style={[styles.emptyCardSub, { color: theme.textSecondary }]}>
            Tap the floating ＋ button below to log an expense in seconds, or load sample multi-currency data to explore.
          </Text>
          <Pressable
            onPress={seedDemoData}
            style={[styles.demoBtn, { backgroundColor: theme.accent }]}
          >
            <Text style={styles.demoBtnText}>
              ✨ Load Sample Cashew Demo Data (USD, EUR, BTC)
            </Text>
          </Pressable>
        </View>
      ) : (
        transactions.slice(0, 5).map((tx) => {
          const cat = categories.find((c) => c.id === tx.categoryId);
          const sub = categories.find((c) => c.id === tx.subcategoryId);
          const w = wallets.find((item) => item.id === tx.walletId);
          const isExpense = tx.type === 'EXPENSE';
          const isIncome = tx.type === 'INCOME';
          const amountColor = isExpense
            ? theme.danger
            : isIncome
              ? theme.success
              : theme.textPrimary;

          return (
            <Pressable
              key={tx.id}
              onPress={() => openQuickEntry({ editingTransaction: tx })}
              style={[
                styles.txRow,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.txIconBox,
                  { backgroundColor: (cat?.color ?? '#64748B') + '22' },
                ]}
              >
                <Text style={{ fontSize: 18 }}>
                  {tx.type === 'TRANSFER'
                    ? '⇄'
                    : tx.type === 'BALANCE_ADJUSTMENT'
                      ? '⚖️'
                      : cat?.icon ?? '💸'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.txTitle, { color: theme.textPrimary }]}
                  numberOfLines={1}
                >
                  {tx.title}
                </Text>
                <Text style={[styles.txMeta, { color: theme.textSecondary }]}>
                  {w?.name ?? tx.currencyCode}
                  {sub ? ` • ${sub.name}` : cat ? ` • ${cat.name}` : ''} •{' '}
                  {tx.occurredAt.slice(0, 10)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.txAmount, { color: amountColor }]}>
                  {isExpense ? '-' : isIncome ? '+' : ''}
                  {formatAmount(tx.amountMinor, tx.currencyCode, tx.decimalPlaces)}
                </Text>
                {tx.currencyCode !== baseCurrency && (
                  <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                    ≈ {formatAmount(engine.convertTransactionToBaseMinor(tx), baseCurrency)}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );

  const sectionRenderers: Record<HomeSectionId, () => React.ReactNode> = {
    WALLETS_CAROUSEL: renderWalletsCarouselSection,
    PINNED_BUDGETS: renderPinnedBudgetsSection,
    SPENDING_PACE: renderSpendingPaceSection,
    UPCOMING_PAYMENTS: renderUpcomingPaymentsSection,
    RECENT_TRANSACTIONS: renderRecentTransactionsSection,
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Net Worth Hero Banner */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View>
              <Text style={[styles.appBrand, { color: theme.accent }]}>
                PENNYWISE
              </Text>
              <Text style={[styles.netWorthLabel, { color: theme.textSecondary }]}>
                Total Net Worth ({baseCurrency})
              </Text>
            </View>
            <View style={styles.heroActions}>
              <Pressable
                onPress={togglePrivacyMask}
                style={[
                  styles.iconPill,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={{ fontSize: 14 }}>
                  {preferences.privacyMaskEnabled ? '🙈 Hidden' : '👁️ Visible'}
                </Text>
              </Pressable>
            </View>
          </View>

          <Text style={[styles.netWorthValue, { color: theme.textPrimary }]}>
            {formatAmount(netWorthMinor, baseCurrency)}
          </Text>

          <View style={styles.quickActionStrip}>
            <Pressable
              onPress={() => openQuickEntry({ defaultType: 'EXPENSE' })}
              style={[
                styles.quickActionPill,
                { backgroundColor: theme.danger + '18' },
              ]}
            >
              <Text style={[styles.quickActionText, { color: theme.danger }]}>
                － Expense
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openQuickEntry({ defaultType: 'INCOME' })}
              style={[
                styles.quickActionPill,
                { backgroundColor: theme.success + '18' },
              ]}
            >
              <Text style={[styles.quickActionText, { color: theme.success }]}>
                ＋ Income
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openQuickEntry({ defaultType: 'TRANSFER' })}
              style={[
                styles.quickActionPill,
                { backgroundColor: theme.accent + '18' },
              ]}
            >
              <Text style={[styles.quickActionText, { color: theme.accent }]}>
                ⇄ Transfer
              </Text>
            </Pressable>
          </View>
        </View>

        {/* User-Customizable Modular Home Sections */}
        {homeSections
          .filter((sec) => sec.visible)
          .map((sec) => sectionRenderers[sec.id]?.())}
      </ScrollView>

      <WalletModal
        visible={walletModalOpen}
        editingWallet={editingWallet}
        onClose={() => setWalletModalOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 110,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  appBrand: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  netWorthLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  netWorthValue: {
    fontSize: 34,
    fontWeight: '900',
    marginVertical: 10,
  },
  quickActionStrip: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  quickActionPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  actionLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  carousel: {
    flexDirection: 'row',
  },
  walletCard: {
    width: 168,
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 5,
    padding: 14,
    marginRight: 12,
  },
  walletCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  walletIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletIconText: {
    fontSize: 17,
  },
  currencyPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  currencyPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  walletName: {
    fontSize: 12,
    fontWeight: '600',
  },
  walletBalance: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  walletConverted: {
    fontSize: 11,
    marginTop: 4,
  },
  budgetCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
    marginBottom: 10,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  budgetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  budgetName: {
    fontSize: 15,
    fontWeight: '800',
  },
  budgetPeriodText: {
    fontSize: 11,
    marginTop: 2,
  },
  allowanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'flex-end',
  },
  allowanceAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  allowanceSub: {
    fontSize: 10,
    fontWeight: '600',
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  todayMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paceCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
  },
  paceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  paceLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  paceValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  paceValueMuted: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  paceBanner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  billCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    marginBottom: 8,
    gap: 10,
  },
  billTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  billMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  billAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  payNowBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  payNowText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  txIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  txMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyCardSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  demoBtn: {
    marginTop: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  demoBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

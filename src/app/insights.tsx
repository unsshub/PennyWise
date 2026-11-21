import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { usePennyWise } from '@/context/pennywise-context';

export default function InsightsScreen() {
  const {
    engine,
    baseCurrency,
    wallets,
    categories,
    theme,
    t,
    localizeName,
    formatAmount,
    openQuickEntry,
    revision,
  } = usePennyWise();

  const [selectedWalletId, setSelectedWalletId] = useState<string | undefined>(
    undefined
  );
  const [periodWindow, setPeriodWindow] = useState<
    'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM'
  >('MONTH');
  const [customStartDate, setCustomStartDate] = useState(
    () => new Date().toISOString().slice(0, 8) + '01'
  );
  const [customEndDate, setCustomEndDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [breakdownFlow, setBreakdownFlow] = useState<'EXPENSE' | 'INCOME'>(
    'EXPENSE'
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [inspectedDayIdx, setInspectedDayIdx] = useState<number | null>(null);
  const [netWorthHorizon, setNetWorthHorizon] = useState<
    '1M' | '3M' | '6M' | '1Y' | 'ALL'
  >('1M');

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const { startDate, endDate } = useMemo(() => {
    if (periodWindow === 'CUSTOM') {
      return {
        startDate: customStartDate || todayStr,
        endDate: customEndDate || todayStr,
      };
    }
    const [y, m, d] = todayStr.split('-').map(Number);
    if (periodWindow === 'WEEK') {
      const endMs = Date.UTC(y, m - 1, d);
      const startMs = endMs - 6 * 86_400_000;
      const sDt = new Date(startMs);
      return {
        startDate: `${sDt.getUTCFullYear()}-${String(sDt.getUTCMonth() + 1).padStart(2, '0')}-${String(sDt.getUTCDate()).padStart(2, '0')}`,
        endDate: todayStr,
      };
    }
    if (periodWindow === 'YEAR') {
      return {
        startDate: `${y}-01-01`,
        endDate: `${y}-12-31`,
      };
    }
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return {
      startDate: `${y}-${String(m).padStart(2, '0')}-01`,
      endDate: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [todayStr, periodWindow, customStartDate, customEndDate]);

  const paceComparison = useMemo(
    () =>
      engine.computeSpendingPaceComparison({
        currentStart: startDate,
        currentEnd: endDate,
        referenceToday: todayStr,
        walletId: selectedWalletId,
      }),
    [engine, startDate, endDate, todayStr, selectedWalletId, revision]
  );

  const categoryBreakdown = useMemo(
    () =>
      engine.computeCategoryBreakdown({
        startDate,
        endDate,
        walletId: selectedWalletId,
        flowType: breakdownFlow,
      }),
    [engine, startDate, endDate, selectedWalletId, breakdownFlow, revision]
  );

  const cashFlowSummary = useMemo(
    () =>
      engine.summarizePeriodCashFlow({
        startDate,
        endDate,
        walletId: selectedWalletId,
      }),
    [engine, startDate, endDate, selectedWalletId, revision]
  );

  const monthlyCashFlowSeries = useMemo(
    () =>
      engine.computeMonthlyCashFlowSeries({
        endMonthDate: todayStr,
        monthsCount: periodWindow === 'YEAR' ? 12 : 6,
        walletId: selectedWalletId,
      }),
    [engine, todayStr, periodWindow, selectedWalletId, revision]
  );

  const netWorthHistory = useMemo(() => {
    const stepMap: Record<'1M' | '3M' | '6M' | '1Y' | 'ALL', number> = {
      '1M': 4,
      '3M': 12,
      '6M': 24,
      '1Y': 45,
      ALL: 60,
    };
    return engine.computeNetWorthHistory({
      endDate: todayStr,
      pointsCount: 8,
      stepDays: stepMap[netWorthHorizon],
      walletId: selectedWalletId,
    });
  }, [engine, todayStr, netWorthHorizon, selectedWalletId, revision]);

  const activeCategorySlice = useMemo(
    () =>
      categoryBreakdown.categories.find(
        (c) => c.categoryId === selectedCategoryId
      ) ??
      categoryBreakdown.categories[0] ??
      null,
    [categoryBreakdown, selectedCategoryId]
  );

  const matchingCategoryTransactions = useMemo(() => {
    if (!activeCategorySlice) {
      return [];
    }
    return engine.queryTransactions({
      startDate,
      endDate,
      walletId: selectedWalletId,
      categoryId: activeCategorySlice.categoryId,
      types: [breakdownFlow],
    });
  }, [
    engine,
    startDate,
    endDate,
    selectedWalletId,
    activeCategorySlice,
    breakdownFlow,
    revision,
  ]);

  const paceColumns = useMemo(() => {
    const cur = paceComparison.currentCumulativeMinorByDay;
    const prev = paceComparison.previousCumulativeMinorByDay;
    const totalLen = Math.max(cur.length, prev.length, 1);
    const maxVal = [...cur, ...prev].reduce((acc, v) => {
      const n = Number(v);
      return n > acc ? n : acc;
    }, 1);

    const step = Math.max(1, Math.ceil(totalLen / 15));
    const cols: {
      dayNumber: number;
      curMinor: string | null;
      prevMinor: string;
      curHeightPct: number;
      prevHeightPct: number;
    }[] = [];

    for (let i = 0; i < totalLen; i += step) {
      const cVal = i < cur.length ? cur[i] : null;
      const pVal = i < prev.length ? prev[i] : prev[prev.length - 1] ?? '0';
      cols.push({
        dayNumber: i + 1,
        curMinor: cVal,
        prevMinor: pVal,
        curHeightPct: cVal !== null ? Math.round((Number(cVal) / maxVal) * 100) : 0,
        prevHeightPct: Math.round((Number(pVal) / maxVal) * 100),
      });
    }
    return cols;
  }, [paceComparison]);

  const activeDayIdx =
    inspectedDayIdx ?? Math.max(0, paceColumns.length - 1);
  const inspectedCol = paceColumns[activeDayIdx];

  const avgDailySpendMinor = useMemo(() => {
    const days = Math.max(1, paceComparison.referenceDayIndex);
    return (
      BigInt(cashFlowSummary.totalExpenseBaseMinor) / BigInt(days)
    ).toString();
  }, [cashFlowSummary.totalExpenseBaseMinor, paceComparison.referenceDayIndex]);

  const biggestCategory = categoryBreakdown.categories[0] ?? null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>
          {t('insights_title')}
        </Text>
        <Text style={[styles.pageSubtitle, { color: theme.textSecondary }]}>
          {t('insights_sub')}
        </Text>

        {/* Period Window & Wallet Filter Strip */}
        <View style={styles.topFilters}>
          <View
            style={[
              styles.periodSegment,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            {(['WEEK', 'MONTH', 'YEAR', 'CUSTOM'] as const).map((pw) => {
              const active = periodWindow === pw;
              return (
                <Pressable
                  key={pw}
                  onPress={() => setPeriodWindow(pw)}
                  style={[
                    styles.periodBtn,
                    active && { backgroundColor: theme.accent },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#FFFFFF' : theme.textSecondary,
                      fontWeight: '800',
                      fontSize: 12,
                    }}
                  >
                    {pw}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {periodWindow === 'CUSTOM' && (
            <View style={styles.customDateRow}>
              <TextInput
                value={customStartDate}
                onChangeText={setCustomStartDate}
                placeholder="Start YYYY-MM-DD"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.customDateInput,
                  {
                    backgroundColor: theme.surface,
                    color: theme.textPrimary,
                    borderColor: theme.border,
                  },
                ]}
              />
              <TextInput
                value={customEndDate}
                onChangeText={setCustomEndDate}
                placeholder="End YYYY-MM-DD"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.customDateInput,
                  {
                    backgroundColor: theme.surface,
                    color: theme.textPrimary,
                    borderColor: theme.border,
                  },
                ]}
              />
            </View>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
          >
            <Pressable
              onPress={() => setSelectedWalletId(undefined)}
              style={[
                styles.walletChip,
                {
                  backgroundColor: !selectedWalletId
                    ? theme.accent
                    : theme.surface,
                  borderColor: !selectedWalletId ? theme.accent : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color: !selectedWalletId ? '#FFFFFF' : theme.textSecondary,
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                All Wallets
              </Text>
            </Pressable>
            {wallets.map((w) => {
              const active = selectedWalletId === w.id;
              return (
                <Pressable
                  key={w.id}
                  onPress={() => setSelectedWalletId(active ? undefined : w.id)}
                  style={[
                    styles.walletChip,
                    {
                      backgroundColor: active ? w.color : theme.surface,
                      borderColor: active ? w.color : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#FFFFFF' : theme.textPrimary,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {w.icon} {w.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 4 Summary Metric KPI Cards: Average Daily Spend, Biggest Expense Category, Net Cash Flow, % Change vs Previous Period */}
        <View style={styles.kpiGrid}>
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
              {t('avg_daily_spend')}
            </Text>
            <Text style={[styles.kpiValue, { color: theme.danger }]}>
              {formatAmount(avgDailySpendMinor, baseCurrency)}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.textMuted }]}>
              {t('total_label')} {formatAmount(cashFlowSummary.totalExpenseBaseMinor, baseCurrency)}
            </Text>
          </View>

          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
              {t('pct_change_prev')}
            </Text>
            <Text
              style={[
                styles.kpiValue,
                {
                  color:
                    paceComparison.percentChangeAtReferenceDay > 0
                      ? theme.warning
                      : theme.success,
                },
              ]}
            >
              {paceComparison.percentChangeAtReferenceDay > 0 ? '+' : ''}
              {paceComparison.percentChangeAtReferenceDay}%
            </Text>
            <Text style={[styles.kpiSub, { color: theme.textMuted }]}>
              {t('delta_label')}{' '}
              {formatAmount(
                paceComparison.deltaAtReferenceDayMinor,
                baseCurrency,
                undefined,
                { showPlusSign: true }
              )}
            </Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
              {t('biggest_expense_cat')}
            </Text>
            <Text
              style={[styles.kpiValue, { color: theme.textPrimary }]}
              numberOfLines={1}
            >
              {biggestCategory
                ? `${biggestCategory.icon} ${localizeName(biggestCategory.name)}`
                : t('none_label')}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.textMuted }]}>
              {biggestCategory
                ? `${formatAmount(biggestCategory.amountMinor, baseCurrency)} (${biggestCategory.percentage}%)`
                : t('no_expenses_logged')}
            </Text>
          </View>

          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
              {t('net_cash_flow')}
            </Text>
            <Text
              style={[
                styles.kpiValue,
                {
                  color:
                    BigInt(cashFlowSummary.netCashFlowBaseMinor) >= 0n
                      ? theme.success
                      : theme.danger,
                },
              ]}
            >
              {formatAmount(
                cashFlowSummary.netCashFlowBaseMinor,
                baseCurrency,
                undefined,
                { showPlusSign: true }
              )}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.textMuted }]}>
              {t('type_income')}: {formatAmount(cashFlowSummary.totalIncomeBaseMinor, baseCurrency)}
            </Text>
          </View>
        </View>

        {/* Chart 1: Interactive Spending Pace Comparison Line Chart */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.chartTitle, { color: theme.textPrimary }]}>
                {t('pace_chart_title')}
              </Text>
              <Text style={[styles.chartSub, { color: theme.textSecondary }]}>
                {t('pace_chart_sub')}
              </Text>
            </View>
          </View>

          {inspectedCol && (
            <View
              style={[
                styles.tooltipBanner,
                { backgroundColor: theme.surfaceElevated },
              ]}
            >
              <Text style={{ color: theme.textPrimary, fontWeight: '800', fontSize: 12 }}>
                Day {inspectedCol.dayNumber}:{' '}
                {inspectedCol.curMinor !== null
                  ? formatAmount(inspectedCol.curMinor, baseCurrency)
                  : 'Upcoming'}{' '}
                <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>
                  (vs. Last Period:{' '}
                  {formatAmount(inspectedCol.prevMinor, baseCurrency)})
                </Text>
              </Text>
            </View>
          )}

          <View style={styles.pacePlotArea}>
            {paceColumns.map((col, idx) => {
              const isSelected = idx === activeDayIdx;
              return (
                <Pressable
                  key={col.dayNumber}
                  onPress={() => setInspectedDayIdx(idx)}
                  style={[
                    styles.paceColWrapper,
                    isSelected && {
                      backgroundColor: theme.accent + '18',
                      borderRadius: 6,
                    },
                  ]}
                >
                  <View style={styles.paceLineTrack}>
                    {/* Previous Period Dashed Node & Vertical Stem */}
                    <View
                      style={[
                        styles.prevLineNode,
                        {
                          bottom: `${Math.min(92, col.prevHeightPct)}%`,
                          borderColor: theme.textMuted,
                        },
                      ]}
                    />
                    {/* Current Period Solid Line Node & Area Fill */}
                    {col.curMinor !== null && (
                      <>
                        <View
                          style={[
                            styles.curAreaStem,
                            {
                              height: `${Math.max(6, col.curHeightPct)}%`,
                              backgroundColor: theme.accent + '33',
                              borderTopColor: theme.accent,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.curLineNode,
                            {
                              bottom: `${Math.min(92, col.curHeightPct)}%`,
                              backgroundColor: theme.accent,
                            },
                          ]}
                        />
                      </>
                    )}
                  </View>
                  <Text style={[styles.axisTick, { color: theme.textMuted }]}>
                    D{col.dayNumber}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Chart 2: Category & Subcategory Breakdown Donut Chart + Underlying Transactions */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.chartHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.chartTitle, { color: theme.textPrimary }]}>
                {t('donut_chart_title')}
              </Text>
              <Text style={[styles.chartSub, { color: theme.textSecondary }]}>
                {t('donut_chart_sub')}
              </Text>
            </View>
            <View style={styles.flowToggle}>
              {(['EXPENSE', 'INCOME'] as const).map((ft) => (
                <Pressable
                  key={ft}
                  onPress={() => {
                    setBreakdownFlow(ft);
                    setSelectedCategoryId(null);
                  }}
                  style={[
                    styles.miniToggleBtn,
                    {
                      backgroundColor:
                        breakdownFlow === ft
                          ? theme.accent
                          : theme.surfaceElevated,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        breakdownFlow === ft ? '#FFFFFF' : theme.textSecondary,
                      fontSize: 11,
                      fontWeight: '800',
                    }}
                  >
                    {ft === 'EXPENSE'
                      ? t('expenses_filter')
                      : t('income_filter')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Interactive Donut Ring Visual */}
          <View style={styles.donutContainer}>
            <View
              style={[
                styles.donutRingOuter,
                {
                  borderColor:
                    activeCategorySlice?.color ?? theme.accent,
                  backgroundColor: theme.surfaceElevated,
                },
              ]}
            >
              <View
                style={[
                  styles.donutHoleInner,
                  { backgroundColor: theme.surface },
                ]}
              >
                <Text style={{ fontSize: 22 }}>
                  {activeCategorySlice?.icon ?? '🍩'}
                </Text>
                <Text
                  style={{
                    color: theme.textPrimary,
                    fontWeight: '900',
                    fontSize: 14,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {activeCategorySlice
                    ? `${activeCategorySlice.percentage}%`
                    : '0%'}
                </Text>
                <Text
                  style={{ color: theme.textSecondary, fontSize: 10 }}
                  numberOfLines={1}
                >
                  {activeCategorySlice?.name ?? 'Total'}
                </Text>
              </View>
            </View>
          </View>

          {/* Proportional Multi-Color Distribution Ring/Bar */}
          <View
            style={[
              styles.distributionBar,
              { backgroundColor: theme.surfaceElevated },
            ]}
          >
            {categoryBreakdown.categories.length === 0 ? (
              <View style={{ flex: 1, backgroundColor: theme.border }} />
            ) : (
              categoryBreakdown.categories.map((slice) => (
                <View
                  key={slice.categoryId}
                  style={{
                    flex: Math.max(2, slice.percentage),
                    backgroundColor: slice.color,
                    height: '100%',
                  }}
                />
              ))
            )}
          </View>

          {categoryBreakdown.categories.length === 0 ? (
            <Text style={{ color: theme.textSecondary, marginTop: 10 }}>
              No {breakdownFlow.toLowerCase()} transactions recorded in this period.
            </Text>
          ) : (
            <>
              {categoryBreakdown.categories.map((slice) => {
                const isSelected =
                  activeCategorySlice?.categoryId === slice.categoryId;
                return (
                  <View key={slice.categoryId}>
                    <Pressable
                      onPress={() =>
                        setSelectedCategoryId(
                          isSelected ? null : slice.categoryId
                        )
                      }
                      style={[
                        styles.catSliceRow,
                        {
                          backgroundColor: isSelected
                            ? slice.color + '18'
                            : 'transparent',
                          borderColor: isSelected ? slice.color : theme.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.sliceDot,
                          { backgroundColor: slice.color },
                        ]}
                      />
                      <Text style={{ fontSize: 17 }}>{slice.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: theme.textPrimary,
                            fontWeight: '800',
                            fontSize: 14,
                          }}
                        >
                          {localizeName(slice.name)}
                        </Text>
                        <Text
                          style={{ color: theme.textSecondary, fontSize: 11 }}
                        >
                          {slice.percentage}% •{' '}
                          {slice.subcategories.length}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: theme.textPrimary,
                          fontWeight: '800',
                          fontSize: 14,
                        }}
                      >
                        {formatAmount(slice.amountMinor, baseCurrency)}
                      </Text>
                    </Pressable>

                    {/* Subcategory Drill-Down & Underlying Transactions */}
                    {isSelected && (
                      <View
                        style={[
                          styles.subDrillBox,
                          {
                            backgroundColor: theme.surfaceElevated,
                            borderColor: slice.color + '55',
                          },
                        ]}
                      >
                        {slice.subcategories.map((sub, sIdx) => (
                          <View key={sIdx} style={styles.subDrillRow}>
                            <Text
                              style={{
                                color: theme.textPrimary,
                                fontSize: 12,
                                fontWeight: '700',
                              }}
                            >
                              {sub.icon} {localizeName(sub.name)} ({sub.percentage}%)
                            </Text>
                            <Text
                              style={{
                                color: theme.textPrimary,
                                fontSize: 12,
                                fontWeight: '800',
                              }}
                            >
                              {formatAmount(sub.amountMinor, baseCurrency)}
                            </Text>
                          </View>
                        ))}

                        {matchingCategoryTransactions.length > 0 && (
                          <View style={styles.drillTxList}>
                            <Text
                              style={{
                                color: theme.textSecondary,
                                fontSize: 10,
                                fontWeight: '800',
                                textTransform: 'uppercase',
                                marginTop: 6,
                                marginBottom: 4,
                              }}
                            >
                              Transactions in {slice.name} (
                              {matchingCategoryTransactions.length})
                            </Text>
                            {matchingCategoryTransactions
                              .slice(0, 5)
                              .map((tx) => (
                                <Pressable
                                  key={tx.id}
                                  onPress={() =>
                                    openQuickEntry({ editingTransaction: tx })
                                  }
                                  style={styles.drillTxRow}
                                >
                                  <Text
                                    style={{
                                      color: theme.textPrimary,
                                      fontSize: 12,
                                      flex: 1,
                                    }}
                                    numberOfLines={1}
                                  >
                                    {tx.occurredAt.slice(0, 10)} • {tx.title}
                                  </Text>
                                  <Text
                                    style={{
                                      color: theme.textPrimary,
                                      fontSize: 12,
                                      fontWeight: '700',
                                    }}
                                  >
                                    {formatAmount(
                                      tx.amountMinor,
                                      tx.currencyCode,
                                      tx.decimalPlaces
                                    )}
                                  </Text>
                                </Pressable>
                              ))}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* Chart 3: Income vs Expense Cash Flow Bar Graph */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.chartTitle, { color: theme.textPrimary }]}>
            {t('cash_flow_chart_title')}
          </Text>
          <Text style={[styles.chartSub, { color: theme.textSecondary }]}>
            {t('cash_flow_chart_sub')}
          </Text>

          <View style={styles.cashFlowBarsContainer}>
            {(() => {
              const maxBar = monthlyCashFlowSeries.reduce((acc, pt) => {
                const inc = Number(pt.incomeMinor);
                const exp = Number(pt.expenseMinor);
                return Math.max(acc, inc, exp);
              }, 1);

              return monthlyCashFlowSeries.map((pt) => {
                const incPct = Math.round(
                  (Number(pt.incomeMinor) / maxBar) * 100
                );
                const expPct = Math.round(
                  (Number(pt.expenseMinor) / maxBar) * 100
                );
                return (
                  <View key={pt.startDate} style={styles.monthBarCol}>
                    <View style={styles.monthBarPair}>
                      <View
                        style={[
                          styles.incomeBar,
                          {
                            height: `${Math.max(4, incPct)}%`,
                            backgroundColor: theme.success,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.expenseBar,
                          {
                            height: `${Math.max(4, expPct)}%`,
                            backgroundColor: theme.danger,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[styles.monthLabel, { color: theme.textSecondary }]}
                    >
                      {pt.label}
                    </Text>
                  </View>
                );
              });
            })()}
          </View>
        </View>

        {/* Chart 4: Net Worth & Wallet Balance History Line Chart with 1M / 3M / 6M / 1Y / All Horizons */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.chartHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.chartTitle, { color: theme.textPrimary }]}>
                {t('net_worth_chart_title')}
              </Text>
              <Text style={[styles.chartSub, { color: theme.textSecondary }]}>
                {t('net_worth_chart_sub')} ({netWorthHorizon} • {baseCurrency})
              </Text>
            </View>
            <View style={styles.flowToggle}>
              {(['1M', '3M', '6M', '1Y', 'ALL'] as const).map((h) => (
                <Pressable
                  key={h}
                  onPress={() => setNetWorthHorizon(h)}
                  style={[
                    styles.miniToggleBtn,
                    {
                      backgroundColor:
                        netWorthHorizon === h
                          ? theme.accent
                          : theme.surfaceElevated,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        netWorthHorizon === h ? '#FFFFFF' : theme.textSecondary,
                      fontSize: 10,
                      fontWeight: '800',
                    }}
                  >
                    {h}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Visual Line/Area Plot for Net Worth Trajectory */}
          <View style={styles.pacePlotArea}>
            {(() => {
              const vals = netWorthHistory.map((p) => Number(p.netWorthMinor));
              const maxNw = Math.max(...vals, 1);
              const minNw = Math.min(...vals, 0);
              const range = Math.max(1, maxNw - minNw);

              return netWorthHistory.map((pt) => {
                const pct = Math.round(
                  ((Number(pt.netWorthMinor) - minNw) / range) * 85 + 10
                );
                return (
                  <View key={pt.date} style={styles.paceColWrapper}>
                    <View style={styles.paceLineTrack}>
                      <View
                        style={[
                          styles.curAreaStem,
                          {
                            height: `${pct}%`,
                            backgroundColor: theme.accent + '28',
                            borderTopColor: theme.accent,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.curLineNode,
                          {
                            bottom: `${Math.min(92, pct)}%`,
                            backgroundColor: theme.accent,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.axisTick, { color: theme.textMuted }]}>
                      {pt.date.slice(5)}
                    </Text>
                  </View>
                );
              });
            })()}
          </View>

          <View style={styles.nwTimeline}>
            {netWorthHistory.map((pt) => (
              <View
                key={pt.date}
                style={[styles.nwRow, { borderColor: theme.border }]}
              >
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {pt.date}
                </Text>
                <Text
                  style={{
                    color: theme.textPrimary,
                    fontWeight: '800',
                    fontSize: 13,
                  }}
                >
                  {formatAmount(pt.netWorthMinor, baseCurrency)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 110,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 12,
  },
  topFilters: {
    marginBottom: 14,
  },
  periodSegment: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
  },
  customDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  customDateInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
  },
  walletChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '900',
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 11,
  },
  chartCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  chartSub: {
    fontSize: 12,
    marginTop: 2,
  },
  tooltipBanner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  pacePlotArea: {
    flexDirection: 'row',
    height: 135,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  paceColWrapper: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 4,
  },
  paceLineTrack: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  prevLineNode: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  curAreaStem: {
    width: '70%',
    borderTopWidth: 2.5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  curLineNode: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  axisTick: {
    fontSize: 9,
    marginTop: 4,
    fontWeight: '700',
  },
  flowToggle: {
    flexDirection: 'row',
    gap: 4,
  },
  miniToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  donutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  donutRingOuter: {
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutHoleInner: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  distributionBar: {
    height: 14,
    borderRadius: 7,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 12,
  },
  catSliceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
    gap: 10,
  },
  sliceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subDrillBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    marginLeft: 18,
    gap: 6,
  },
  subDrillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  drillTxList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.25)',
    marginTop: 4,
    paddingTop: 4,
  },
  drillTxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  cashFlowBarsContainer: {
    flexDirection: 'row',
    height: 140,
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    marginTop: 14,
  },
  monthBarCol: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    flex: 1,
  },
  monthBarPair: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  incomeBar: {
    width: 11,
    borderRadius: 4,
  },
  expenseBar: {
    width: 11,
    borderRadius: 4,
  },
  monthLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  nwTimeline: {
    marginTop: 10,
  },
  nwRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
});

import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { usePennyWise } from '@/context/pennywise-context';

export default function InsightsScreen() {
  const {
    engine,
    baseCurrency,
    wallets,
    theme,
    formatAmount,
    revision,
  } = usePennyWise();

  const [selectedWalletId, setSelectedWalletId] = useState<string | undefined>(
    undefined
  );
  const [periodWindow, setPeriodWindow] = useState<'WEEK' | 'MONTH' | 'YEAR'>(
    'MONTH'
  );
  const [breakdownFlow, setBreakdownFlow] = useState<'EXPENSE' | 'INCOME'>(
    'EXPENSE'
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [inspectedDayIdx, setInspectedDayIdx] = useState<number | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const { startDate, endDate } = useMemo(() => {
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
  }, [todayStr, periodWindow]);

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
        monthsCount: 6,
        walletId: selectedWalletId,
      }),
    [engine, todayStr, selectedWalletId, revision]
  );

  const netWorthHistory = useMemo(
    () =>
      engine.computeNetWorthHistory({
        endDate: todayStr,
        pointsCount: 7,
        stepDays: 5,
      }),
    [engine, todayStr, revision]
  );

  const activeCategorySlice = useMemo(
    () =>
      categoryBreakdown.categories.find(
        (c) => c.categoryId === selectedCategoryId
      ) ?? categoryBreakdown.categories[0] ?? null,
    [categoryBreakdown, selectedCategoryId]
  );

  // Pace Chart sampling points (up to 15 interactive columns for touch scrubbing)
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>
          Spending Insights & Analytics
        </Text>
        <Text style={[styles.pageSubtitle, { color: theme.textSecondary }]}>
          Spot trends, compare periods, and see where your money goes
        </Text>

        {/* Period Window & Wallet Filter Strip */}
        <View style={styles.topFilters}>
          <View
            style={[
              styles.periodSegment,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            {(['WEEK', 'MONTH', 'YEAR'] as const).map((pw) => {
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

        {/* Summary Metric Cards */}
        <View style={styles.kpiGrid}>
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
              Total Spent
            </Text>
            <Text style={[styles.kpiValue, { color: theme.danger }]}>
              {formatAmount(cashFlowSummary.totalExpenseBaseMinor, baseCurrency)}
            </Text>
            <Text style={[styles.kpiSub, { color: theme.textMuted }]}>
              Avg {formatAmount(avgDailySpendMinor, baseCurrency)}/day
            </Text>
          </View>

          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
              Net Cash Flow
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
              Income: {formatAmount(cashFlowSummary.totalIncomeBaseMinor, baseCurrency)}
            </Text>
          </View>
        </View>

        {/* Chart 1: Interactive Spending Pace Comparison (This Period vs Previous Period) */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.chartTitle, { color: theme.textPrimary }]}>
                📈 Spending Pace Comparison
              </Text>
              <Text style={[styles.chartSub, { color: theme.textSecondary }]}>
                Cumulative expenses: This Period (solid) vs. Last Period (muted)
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
                  <View style={styles.paceBarPair}>
                    {/* Previous Period Bar (Muted) */}
                    <View
                      style={[
                        styles.prevPaceBar,
                        {
                          height: `${Math.max(6, col.prevHeightPct)}%`,
                          backgroundColor: theme.textMuted + '55',
                        },
                      ]}
                    />
                    {/* Current Period Bar (Solid Accent) */}
                    {col.curMinor !== null && (
                      <View
                        style={[
                          styles.curPaceBar,
                          {
                            height: `${Math.max(6, col.curHeightPct)}%`,
                            backgroundColor: theme.accent,
                          },
                        ]}
                      />
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

        {/* Chart 2: Category & Subcategory Breakdown Donut / Stacked Bar */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.chartHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.chartTitle, { color: theme.textPrimary }]}>
                🍩 Where Your Money Goes
              </Text>
              <Text style={[styles.chartSub, { color: theme.textSecondary }]}>
                Tap any Category slice to drill down into its Subcategories
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
                    {ft === 'EXPENSE' ? 'Expenses' : 'Income'}
                  </Text>
                </Pressable>
              ))}
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
                          {slice.name}
                        </Text>
                        <Text
                          style={{ color: theme.textSecondary, fontSize: 11 }}
                        >
                          {slice.percentage}% of total •{' '}
                          {slice.subcategories.length} subcategory(s)
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

                    {/* Subcategory Drill-Down Drawer */}
                    {isSelected && slice.subcategories.length > 0 && (
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
                                fontWeight: '600',
                              }}
                            >
                              {sub.icon} {sub.name} ({sub.percentage}%)
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
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* Chart 3: Monthly Income vs Expense Cash Flow Bar Graph */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.chartTitle, { color: theme.textPrimary }]}>
            📊 6-Month Income vs. Expense Cash Flow
          </Text>
          <Text style={[styles.chartSub, { color: theme.textSecondary }]}>
            Compare monthly inflows (green) against expenses (red)
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

        {/* Chart 4: Net Worth Trajectory History */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.chartTitle, { color: theme.textPrimary }]}>
            💎 Net Worth Trajectory ({baseCurrency})
          </Text>
          <Text style={[styles.chartSub, { color: theme.textSecondary }]}>
            Historical multi-currency wealth progression over time
          </Text>

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
    marginBottom: 14,
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
    fontSize: 20,
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
  paceBarPair: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    width: '72%',
    justifyContent: 'center',
  },
  prevPaceBar: {
    width: 5,
    borderRadius: 3,
  },
  curPaceBar: {
    width: 6,
    borderRadius: 3,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  distributionBar: {
    height: 16,
    borderRadius: 8,
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
    width: 12,
    borderRadius: 4,
  },
  expenseBar: {
    width: 12,
    borderRadius: 4,
  },
  monthLabel: {
    fontSize: 11,
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

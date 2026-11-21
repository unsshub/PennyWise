import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { usePennyWise } from '@/context/pennywise-context';
import { getCurrencyDefinition, parseMajorToMinorUnits } from '@/domain/currency';
import type { Budget, BudgetPeriodType, BudgetScopeType } from '@/domain/types';

export default function BudgetsScreen() {
  const {
    engine,
    baseCurrency,
    wallets,
    categories,
    budgets,
    theme,
    formatAmount,
    refresh,
    revision,
  } = usePennyWise();

  const [cycleOffset, setCycleOffset] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const [name, setName] = useState('');
  const [limitMajor, setLimitMajor] = useState('500');
  const [periodType, setPeriodType] = useState<BudgetPeriodType>('MONTHLY');
  const [intervalCount, setIntervalCount] = useState('14');
  const [intervalUnit, setIntervalUnit] = useState<'DAYS' | 'WEEKS' | 'MONTHS'>('DAYS');
  const [anchorDate, setAnchorDate] = useState(
    () => new Date().toISOString().slice(0, 8) + '01'
  );
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [scopeType, setScopeType] = useState<BudgetScopeType>('AUTOMATIC_FILTER');
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);
  const [filterWalletIds, setFilterWalletIds] = useState<string[]>([]);
  const [color, setColor] = useState('#10B981');
  const [icon, setIcon] = useState('🎯');
  const [isPinnedToHome, setIsPinnedToHome] = useState(true);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const evaluations = useMemo(
    () =>
      budgets.map((b) => engine.evaluateBudget(b.id, todayStr, cycleOffset)),
    [engine, budgets, todayStr, cycleOffset, revision]
  );

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.parentId === null && c.flowType === 'EXPENSE'),
    [categories]
  );

  const openEditor = (budget: Budget | null) => {
    setEditingBudget(budget);
    if (budget) {
      setName(budget.name);
      setLimitMajor(
        (
          Number(budget.limitAmountMinor) / Math.pow(10, budget.decimalPlaces)
        ).toString()
      );
      setPeriodType(budget.periodType);
      setIntervalCount(String(budget.intervalCount ?? 14));
      setIntervalUnit(budget.intervalUnit ?? 'DAYS');
      setAnchorDate(budget.anchorDate);
      setEndDate(budget.endDate ?? todayStr);
      setScopeType(budget.scopeType);
      setFilterCategoryIds(budget.filterCategoryIds);
      setFilterWalletIds(budget.filterWalletIds);
      setColor(budget.color);
      setIcon(budget.icon);
      setIsPinnedToHome(budget.isPinnedToHome);
    } else {
      setName('');
      setLimitMajor('500');
      setPeriodType('MONTHLY');
      setIntervalCount('14');
      setIntervalUnit('DAYS');
      setAnchorDate(todayStr.slice(0, 8) + '01');
      setEndDate(todayStr);
      setScopeType('AUTOMATIC_FILTER');
      setFilterCategoryIds([]);
      setFilterWalletIds([]);
      setColor('#10B981');
      setIcon('🎯');
      setIsPinnedToHome(true);
    }
    setModalOpen(true);
  };

  const handleSave = () => {
    const def = getCurrencyDefinition(baseCurrency);
    const limitAmountMinor = parseMajorToMinorUnits(limitMajor, def.decimalPlaces);
    if (BigInt(limitAmountMinor) <= 0n) {
      return;
    }

    if (editingBudget) {
      engine.updateBudget(editingBudget.id, {
        name: name.trim() || 'Budget',
        limitAmountMinor,
        periodType,
        intervalCount: periodType === 'INTERVAL' ? Number(intervalCount) || 14 : null,
        intervalUnit: periodType === 'INTERVAL' ? intervalUnit : null,
        anchorDate,
        endDate: periodType === 'CUSTOM_RANGE' ? endDate : null,
        scopeType,
        filterCategoryIds,
        filterWalletIds,
        color,
        icon,
        isPinnedToHome,
      });
    } else {
      engine.createBudget({
        name: name.trim() || 'Budget',
        limitAmountMinor,
        currencyCode: baseCurrency,
        decimalPlaces: def.decimalPlaces,
        periodType,
        intervalCount: periodType === 'INTERVAL' ? Number(intervalCount) || 14 : null,
        intervalUnit: periodType === 'INTERVAL' ? intervalUnit : null,
        anchorDate,
        endDate: periodType === 'CUSTOM_RANGE' ? endDate : null,
        scopeType,
        filterCategoryIds,
        filterWalletIds,
        color,
        icon,
        isPinnedToHome,
      });
    }
    refresh();
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (!editingBudget) {
      return;
    }
    engine.deleteBudget(editingBudget.id);
    refresh();
    setModalOpen(false);
  };

  const toggleIdInList = (id: string, list: string[], setter: (v: string[]) => void) => {
    if (list.includes(id)) {
      setter(list.filter((x) => x !== id));
    } else {
      setter([...list, id]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>
              Flexible Budgets
            </Text>
            <Text style={[styles.pageSubtitle, { color: theme.textSecondary }]}>
              Real-time Daily Spending Allowance & pace tracking
            </Text>
          </View>
          <Pressable
            onPress={() => openEditor(null)}
            style={[styles.newBtn, { backgroundColor: theme.accent }]}
          >
            <Text style={styles.newBtnText}>+ New Budget</Text>
          </Pressable>
        </View>

        {/* Cycle Navigator (Inspect Current or Past Budget Periods) */}
        <View
          style={[
            styles.cycleBar,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Pressable
            onPress={() => setCycleOffset((c) => c - 1)}
            style={styles.cycleStepBtn}
          >
            <Text style={{ color: theme.accent, fontWeight: '800' }}>
              ← Prev Cycle
            </Text>
          </Pressable>
          <Text style={[styles.cycleLabel, { color: theme.textPrimary }]}>
            {cycleOffset === 0
              ? 'Current Active Cycle'
              : `${Math.abs(cycleOffset)} Cycle(s) Ago`}
          </Text>
          <Pressable
            onPress={() => setCycleOffset((c) => Math.min(0, c + 1))}
            disabled={cycleOffset === 0}
            style={styles.cycleStepBtn}
          >
            <Text
              style={{
                color: cycleOffset === 0 ? theme.textMuted : theme.accent,
                fontWeight: '800',
              }}
            >
              Next Cycle →
            </Text>
          </Pressable>
        </View>

        {evaluations.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              🎯 Plan a Budget That Fits Your Life
            </Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Plan by week, month (anchored to any payday), year, custom interval, or a custom trip date range—with either Automatic Category/Wallet filtering or Manual Transaction Assignment.
            </Text>
          </View>
        ) : (
          evaluations.map((ev) => {
            const isOver = BigInt(ev.overBudgetMinor) > 0n;
            const fillPct = Math.min(100, ev.percentSpent);

            return (
              <Pressable
                key={ev.budget.id}
                onPress={() => openEditor(ev.budget)}
                style={[
                  styles.budgetCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.titleBlock}>
                    <View
                      style={[
                        styles.iconBadge,
                        { backgroundColor: ev.budget.color + '22' },
                      ]}
                    >
                      <Text style={{ fontSize: 20 }}>{ev.budget.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.budgetName, { color: theme.textPrimary }]}
                      >
                        {ev.budget.name}
                      </Text>
                      <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                        {ev.budget.periodType} • {ev.periodStart} → {ev.periodEnd}
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                        Scope:{' '}
                        {ev.budget.scopeType === 'MANUAL_ASSIGNMENT'
                          ? '📌 Manual Assignment (Trip/Event)'
                          : ev.budget.filterCategoryIds.length === 0 &&
                              ev.budget.filterWalletIds.length === 0
                            ? 'All Categories & Wallets'
                            : `${
                                ev.budget.filterCategoryIds.length || 'All'
                              } Categories • ${
                                ev.budget.filterWalletIds.length || 'All'
                              } Wallets`}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Daily Spending Allowance Banner */}
                <View
                  style={[
                    styles.allowanceBanner,
                    {
                      backgroundColor: isOver
                        ? theme.danger + '18'
                        : ev.budget.color + '18',
                    },
                  ]}
                >
                  <View>
                    <Text
                      style={{
                        color: theme.textSecondary,
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      DAILY SPENDING ALLOWANCE ({ev.remainingDaysInclusive}d remaining)
                    </Text>
                    <Text
                      style={[
                        styles.allowanceHero,
                        { color: isOver ? theme.danger : ev.budget.color },
                      ]}
                    >
                      {formatAmount(
                        ev.dailySpendingAllowanceMinor,
                        ev.budget.currencyCode,
                        ev.budget.decimalPlaces
                      )}{' '}
                      / day
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={{
                        color: theme.textSecondary,
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      {ev.percentSpent.toFixed(0)}% SPENT
                    </Text>
                    <Text
                      style={{
                        color: theme.textMuted,
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      vs {ev.percentTimeElapsed}% time elapsed
                    </Text>
                  </View>
                </View>

                {/* Progress Bar with Today Marker */}
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

                <View style={styles.cardFooterRow}>
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                    Spent:{' '}
                    <Text style={{ color: theme.textPrimary, fontWeight: '800' }}>
                      {formatAmount(
                        ev.spentMinor,
                        ev.budget.currencyCode,
                        ev.budget.decimalPlaces
                      )}
                    </Text>{' '}
                    / Limit:{' '}
                    <Text style={{ color: theme.textPrimary, fontWeight: '800' }}>
                      {formatAmount(
                        ev.budget.limitAmountMinor,
                        ev.budget.currencyCode,
                        ev.budget.decimalPlaces
                      )}
                    </Text>
                  </Text>
                  <Text
                    style={{
                      color: isOver ? theme.danger : theme.success,
                      fontWeight: '800',
                      fontSize: 13,
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
      </ScrollView>

      {/* Budget Create / Edit Modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.headerRow}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                {editingBudget ? 'Edit Budget' : 'Create Flexible Budget'}
              </Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <Text style={{ color: theme.textSecondary, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Budget Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Monthly Living, Food & Dining, Euro Trip"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceElevated,
                    color: theme.textPrimary,
                    borderColor: theme.border,
                  },
                ]}
              />

              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Target Limit ({baseCurrency})
              </Text>
              <TextInput
                value={limitMajor}
                onChangeText={setLimitMajor}
                keyboardType="decimal-pad"
                placeholder="500.00"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceElevated,
                    color: theme.textPrimary,
                    borderColor: theme.border,
                  },
                ]}
              />

              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Budget Period
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipRow}
              >
                {(
                  [
                    { label: 'Weekly', value: 'WEEKLY' },
                    { label: 'Monthly', value: 'MONTHLY' },
                    { label: 'Yearly', value: 'YEARLY' },
                    { label: 'Custom Interval', value: 'INTERVAL' },
                    { label: 'Custom Date Range', value: 'CUSTOM_RANGE' },
                  ] as const
                ).map((p) => {
                  const active = periodType === p.value;
                  return (
                    <Pressable
                      key={p.value}
                      onPress={() => setPeriodType(p.value)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active
                            ? theme.accent
                            : theme.surfaceElevated,
                          borderColor: active ? theme.accent : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? '#FFFFFF' : theme.textPrimary,
                          fontWeight: '700',
                          fontSize: 12,
                        }}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    {periodType === 'CUSTOM_RANGE'
                      ? 'Start Date (YYYY-MM-DD)'
                      : 'Anchor / Payday Date'}
                  </Text>
                  <TextInput
                    value={anchorDate}
                    onChangeText={setAnchorDate}
                    placeholder="2026-11-01"
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surfaceElevated,
                        color: theme.textPrimary,
                        borderColor: theme.border,
                      },
                    ]}
                  />
                </View>

                {periodType === 'CUSTOM_RANGE' && (
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>
                      End Date (YYYY-MM-DD)
                    </Text>
                    <TextInput
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholder="2026-11-30"
                      placeholderTextColor={theme.textMuted}
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.surfaceElevated,
                          color: theme.textPrimary,
                          borderColor: theme.border,
                        },
                      ]}
                    />
                  </View>
                )}

                {periodType === 'INTERVAL' && (
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>
                      Every N Days
                    </Text>
                    <TextInput
                      value={intervalCount}
                      onChangeText={setIntervalCount}
                      keyboardType="number-pad"
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.surfaceElevated,
                          color: theme.textPrimary,
                          borderColor: theme.border,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>

              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Budget Scope
              </Text>
              <View style={styles.scopeRow}>
                {(
                  [
                    {
                      label: 'Automatic Filter (Categories / Wallets)',
                      value: 'AUTOMATIC_FILTER',
                    },
                    {
                      label: 'Manual Assignment (Pin to Trip/Event)',
                      value: 'MANUAL_ASSIGNMENT',
                    },
                  ] as const
                ).map((sc) => {
                  const active = scopeType === sc.value;
                  return (
                    <Pressable
                      key={sc.value}
                      onPress={() => setScopeType(sc.value)}
                      style={[
                        styles.scopeBtn,
                        {
                          backgroundColor: active
                            ? theme.accent
                            : theme.surfaceElevated,
                          borderColor: active ? theme.accent : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? '#FFFFFF' : theme.textPrimary,
                          fontSize: 12,
                          fontWeight: '700',
                          textAlign: 'center',
                        }}
                      >
                        {sc.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {scopeType === 'AUTOMATIC_FILTER' && (
                <>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Filter by Categories (Leave empty for All Categories)
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipRow}
                  >
                    {expenseCategories.map((c) => {
                      const selected = filterCategoryIds.includes(c.id);
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() =>
                            toggleIdInList(
                              c.id,
                              filterCategoryIds,
                              setFilterCategoryIds
                            )
                          }
                          style={[
                            styles.chip,
                            {
                              backgroundColor: selected
                                ? c.color
                                : theme.surfaceElevated,
                              borderColor: selected ? c.color : theme.border,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: selected ? '#FFFFFF' : theme.textPrimary,
                              fontWeight: '700',
                              fontSize: 12,
                            }}
                          >
                            {c.icon} {c.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Filter by Wallets (Leave empty for All Wallets)
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipRow}
                  >
                    {wallets.map((w) => {
                      const selected = filterWalletIds.includes(w.id);
                      return (
                        <Pressable
                          key={w.id}
                          onPress={() =>
                            toggleIdInList(w.id, filterWalletIds, setFilterWalletIds)
                          }
                          style={[
                            styles.chip,
                            {
                              backgroundColor: selected
                                ? w.color
                                : theme.surfaceElevated,
                              borderColor: selected ? w.color : theme.border,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: selected ? '#FFFFFF' : theme.textPrimary,
                              fontWeight: '700',
                              fontSize: 12,
                            }}
                          >
                            {w.icon} {w.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              <View style={styles.switchRow}>
                <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>
                  Pin Budget Card to Home Screen
                </Text>
                <Switch
                  value={isPinnedToHome}
                  onValueChange={setIsPinnedToHome}
                  trackColor={{ false: theme.border, true: theme.accent }}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              {editingBudget && (
                <Pressable
                  onPress={handleDelete}
                  style={[
                    styles.deleteBtn,
                    { backgroundColor: theme.danger + '22' },
                  ]}
                >
                  <Text style={{ color: theme.danger, fontWeight: '800' }}>
                    Delete
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={handleSave}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
                  {editingBudget ? 'Update Budget' : 'Create Budget'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  newBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  newBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  cycleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  cycleStepBtn: {
    paddingVertical: 4,
  },
  cycleLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  budgetCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetName: {
    fontSize: 17,
    fontWeight: '800',
  },
  allowanceBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  allowanceHero: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  progressTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  todayMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2.5,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    lineHeight: 19,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    justifyContent: 'center',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

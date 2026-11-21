import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { usePennyWise } from '@/context/pennywise-context';
import type { Transaction, TransactionType } from '@/domain/types';

export default function TransactionsScreen() {
  const {
    engine,
    baseCurrency,
    wallets,
    categories,
    theme,
    formatAmount,
    openQuickEntry,
    refresh,
    revision,
  } = usePennyWise();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState<string | undefined>(
    undefined
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(
    undefined
  );
  const [selectedType, setSelectedType] = useState<TransactionType | undefined>(
    undefined
  );
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🛍️');
  const [newCatFlow, setNewCatFlow] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [newCatParentId, setNewCatParentId] = useState<string | null>(null);

  const filteredTransactions = useMemo(
    () =>
      engine.queryTransactions({
        searchQuery,
        walletId: selectedWalletId,
        categoryId: selectedCategoryId,
        types: selectedType ? [selectedType] : undefined,
      }),
    [
      engine,
      searchQuery,
      selectedWalletId,
      selectedCategoryId,
      selectedType,
      revision,
    ]
  );

  // Group transactions by YYYY-MM-DD
  const groupedByDay = useMemo(() => {
    const groups = new Map<
      string,
      { date: string; netBaseMinor: bigint; items: Transaction[] }
    >();
    for (const tx of filteredTransactions) {
      const day = tx.occurredAt.slice(0, 10);
      let g = groups.get(day);
      if (!g) {
        g = { date: day, netBaseMinor: 0n, items: [] };
        groups.set(day, g);
      }
      g.items.push(tx);
      const baseMinor = BigInt(engine.convertTransactionToBaseMinor(tx));
      if (tx.type === 'EXPENSE') {
        g.netBaseMinor -= baseMinor;
      } else if (tx.type === 'INCOME') {
        g.netBaseMinor += baseMinor;
      }
    }
    return Array.from(groups.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }, [filteredTransactions, engine]);

  const topCategories = useMemo(
    () => categories.filter((c) => c.parentId === null),
    [categories]
  );

  const handleCreateCategory = () => {
    if (!newCatName.trim()) {
      return;
    }
    engine.createCategory({
      parentId: newCatParentId,
      name: newCatName.trim(),
      flowType: newCatFlow,
      icon: newCatIcon || '🏷️',
      color: newCatFlow === 'INCOME' ? '#10B981' : '#F97316',
    });
    setNewCatName('');
    setNewCatParentId(null);
    refresh();
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
              Transaction History
            </Text>
            <Text style={[styles.pageSubtitle, { color: theme.textSecondary }]}>
              {filteredTransactions.length} matching records
            </Text>
          </View>
          <Pressable
            onPress={() => setCatModalOpen(true)}
            style={[
              styles.manageCatsBtn,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 13 }}>
              🏷️ Categories
            </Text>
          </Pressable>
        </View>

        {/* Search Input */}
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search merchants, titles, categories, notes..."
          placeholderTextColor={theme.textMuted}
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.surface,
              color: theme.textPrimary,
              borderColor: theme.border,
            },
          ]}
        />

        {/* Type Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
        >
          {(
            [
              { label: 'All Types', value: undefined },
              { label: 'Expenses', value: 'EXPENSE' },
              { label: 'Income', value: 'INCOME' },
              { label: 'Transfers', value: 'TRANSFER' },
              { label: 'Adjustments', value: 'BALANCE_ADJUSTMENT' },
            ] as const
          ).map((item) => {
            const active = selectedType === item.value;
            return (
              <Pressable
                key={item.label}
                onPress={() => setSelectedType(item.value)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? theme.accent : theme.surface,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? '#FFFFFF' : theme.textSecondary,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Wallet & Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
        >
          <Pressable
            onPress={() => setSelectedWalletId(undefined)}
            style={[
              styles.filterChip,
              {
                backgroundColor: !selectedWalletId ? theme.accent : theme.surface,
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
                  styles.filterChip,
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

          {topCategories.map((cat) => {
            const active = selectedCategoryId === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategoryId(active ? undefined : cat.id)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? cat.color : theme.surface,
                    borderColor: active ? cat.color : theme.border,
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
                  {cat.icon} {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Date-Grouped Chronological Log */}
        {groupedByDay.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              No Transactions Found
            </Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Tap the ＋ button to add an Expense, Income, or Transfer.
            </Text>
          </View>
        ) : (
          groupedByDay.map((group) => (
            <View key={group.date} style={styles.dayGroup}>
              <View style={styles.dayHeaderRow}>
                <Text style={[styles.dayDateText, { color: theme.textSecondary }]}>
                  {group.date}
                </Text>
                <Text
                  style={[
                    styles.dayNetText,
                    {
                      color:
                        group.netBaseMinor < 0n
                          ? theme.danger
                          : group.netBaseMinor > 0n
                            ? theme.success
                            : theme.textSecondary,
                    },
                  ]}
                >
                  {formatAmount(group.netBaseMinor, baseCurrency, undefined, {
                    showPlusSign: true,
                  })}
                </Text>
              </View>

              {group.items.map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                const sub = categories.find((c) => c.id === tx.subcategoryId);
                const srcWallet = wallets.find((w) => w.id === tx.walletId);
                const dstWallet = wallets.find(
                  (w) => w.id === tx.destinationWalletId
                );

                return (
                  <Pressable
                    key={tx.id}
                    onPress={() => openQuickEntry({ editingTransaction: tx })}
                    style={[
                      styles.txCard,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconCircle,
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
                        {tx.type === 'TRANSFER'
                          ? `${srcWallet?.name ?? tx.currencyCode} → ${
                              dstWallet?.name ?? ''
                            }`
                          : `${srcWallet?.name ?? tx.currencyCode}${
                              cat ? ` • ${cat.name}` : ''
                            }${sub ? ` › ${sub.name}` : ''}`}
                      </Text>
                      {tx.note ? (
                        <Text
                          style={[styles.txNote, { color: theme.textMuted }]}
                          numberOfLines={1}
                        >
                          “{tx.note}”
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={[
                          styles.txAmount,
                          {
                            color:
                              tx.type === 'EXPENSE'
                                ? theme.danger
                                : tx.type === 'INCOME'
                                  ? theme.success
                                  : theme.textPrimary,
                          },
                        ]}
                      >
                        {tx.type === 'EXPENSE'
                          ? '-'
                          : tx.type === 'INCOME'
                            ? '+'
                            : ''}
                        {formatAmount(
                          tx.amountMinor,
                          tx.currencyCode,
                          tx.decimalPlaces
                        )}
                      </Text>
                      {tx.type === 'TRANSFER' &&
                        dstWallet &&
                        tx.destinationAmountMinor &&
                        dstWallet.currencyCode !== tx.currencyCode && (
                          <Text style={{ color: theme.accent, fontSize: 11 }}>
                            → +
                            {formatAmount(
                              tx.destinationAmountMinor,
                              dstWallet.currencyCode,
                              dstWallet.decimalPlaces
                            )}
                          </Text>
                        )}
                      {tx.currencyCode !== baseCurrency && (
                        <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                          Snapshot:{' '}
                          {formatAmount(
                            engine.convertTransactionToBaseMinor(tx),
                            baseCurrency
                          )}{' '}
                          (@{tx.snapshotRateToBase.toFixed(2)})
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {/* Categories & Subcategories Manager Modal */}
      <Modal
        visible={catModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCatModalOpen(false)}
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
                Categories & Subcategories
              </Text>
              <Pressable onPress={() => setCatModalOpen(false)}>
                <Text style={{ color: theme.textSecondary, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.addCatBox}>
              <View style={styles.flowToggleRow}>
                {(['EXPENSE', 'INCOME'] as const).map((ft) => (
                  <Pressable
                    key={ft}
                    onPress={() => {
                      setNewCatFlow(ft);
                      setNewCatParentId(null);
                    }}
                    style={[
                      styles.flowBtn,
                      {
                        backgroundColor:
                          newCatFlow === ft ? theme.accent : theme.surfaceElevated,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: newCatFlow === ft ? '#FFFFFF' : theme.textSecondary,
                        fontWeight: '700',
                        fontSize: 12,
                      }}
                    >
                      {ft}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginVertical: 6 }}
              >
                <Pressable
                  onPress={() => setNewCatParentId(null)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        newCatParentId === null
                          ? theme.accent
                          : theme.surfaceElevated,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        newCatParentId === null ? '#FFFFFF' : theme.textSecondary,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    Top-Level Category
                  </Text>
                </Pressable>
                {topCategories
                  .filter((c) => c.flowType === newCatFlow)
                  .map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setNewCatParentId(c.id)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor:
                            newCatParentId === c.id
                              ? c.color
                              : theme.surfaceElevated,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            newCatParentId === c.id ? '#FFFFFF' : theme.textPrimary,
                          fontSize: 12,
                          fontWeight: '700',
                        }}
                      >
                        Sub of {c.icon} {c.name}
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>

              <View style={styles.addInputRow}>
                <TextInput
                  value={newCatIcon}
                  onChangeText={setNewCatIcon}
                  style={[
                    styles.iconInput,
                    {
                      backgroundColor: theme.surfaceElevated,
                      color: theme.textPrimary,
                      borderColor: theme.border,
                    },
                  ]}
                />
                <TextInput
                  value={newCatName}
                  onChangeText={setNewCatName}
                  placeholder={
                    newCatParentId
                      ? 'New Subcategory name...'
                      : 'New Category name...'
                  }
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.nameInput,
                    {
                      backgroundColor: theme.surfaceElevated,
                      color: theme.textPrimary,
                      borderColor: theme.border,
                    },
                  ]}
                />
                <Pressable
                  onPress={handleCreateCategory}
                  style={[styles.addBtn, { backgroundColor: theme.accent }]}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Add</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 330 }}>
              {topCategories.map((cat) => {
                const subs = categories.filter((s) => s.parentId === cat.id);
                return (
                  <View
                    key={cat.id}
                    style={[styles.catTreeItem, { borderColor: theme.border }]}
                  >
                    <View style={styles.catTreeHeader}>
                      <Text style={{ color: theme.textPrimary, fontWeight: '800' }}>
                        {cat.icon} {cat.name}{' '}
                        <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                          ({cat.flowType})
                        </Text>
                      </Text>
                    </View>
                    {subs.length > 0 && (
                      <View style={styles.subWrap}>
                        {subs.map((sub) => (
                          <View
                            key={sub.id}
                            style={[
                              styles.subBadge,
                              { backgroundColor: theme.surfaceElevated },
                            ]}
                          >
                            <Text
                              style={{ color: theme.textSecondary, fontSize: 12 }}
                            >
                              {sub.icon} {sub.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
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
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  manageCatsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  dayGroup: {
    marginTop: 10,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  dayDateText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  dayNetText: {
    fontSize: 12,
    fontWeight: '800',
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
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
  txNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  addCatBox: {
    marginBottom: 14,
  },
  flowToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  flowBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
  },
  addInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  iconInput: {
    width: 46,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 18,
  },
  nameInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtn: {
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTreeItem: {
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  catTreeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  subBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
});

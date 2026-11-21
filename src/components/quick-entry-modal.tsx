import React, { useEffect, useMemo, useState } from 'react';
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
import { evaluateCalculatorExpression } from '@/domain/calculator';
import { convertMinorUnits, getCurrencyDefinition } from '@/domain/currency';
import type { TransactionType } from '@/domain/types';

const KEYPAD_ROWS = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '-'],
  ['.', '0', '⌫', '+'],
];

export function QuickEntryModal() {
  const {
    engine,
    baseCurrency,
    wallets,
    categories,
    budgets,
    theme,
    isQuickEntryOpen,
    quickEntryDraft,
    closeQuickEntry,
    refresh,
  } = usePennyWise();

  const editingTx = quickEntryDraft?.editingTransaction ?? null;

  const [txType, setTxType] = useState<TransactionType>('EXPENSE');
  const [expression, setExpression] = useState('');
  const [walletId, setWalletId] = useState('');
  const [destinationWalletId, setDestinationWalletId] = useState('');
  const [customDestinationMajor, setCustomDestinationMajor] = useState('');
  const [snapshotRateInput, setSnapshotRateInput] = useState('');
  const [occurredAtInput, setOccurredAtInput] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [manualBudgetId, setManualBudgetId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isQuickEntryOpen) {
      return;
    }
    const defaultWallet =
      quickEntryDraft?.defaultWalletId ?? wallets[0]?.id ?? 'wallet-default-cash';

    if (editingTx) {
      setTxType(editingTx.type);
      const majorVal = (
        Number(editingTx.amountMinor) / Math.pow(10, editingTx.decimalPlaces)
      ).toString();
      setExpression(majorVal);
      setWalletId(editingTx.walletId);
      setDestinationWalletId(
        editingTx.destinationWalletId ??
          wallets.find((w) => w.id !== editingTx.walletId)?.id ??
          editingTx.walletId
      );
      if (editingTx.destinationAmountMinor && editingTx.destinationWalletId) {
        const destW = wallets.find((w) => w.id === editingTx.destinationWalletId);
        const dec = destW?.decimalPlaces ?? 2;
        setCustomDestinationMajor(
          (Number(editingTx.destinationAmountMinor) / Math.pow(10, dec)).toString()
        );
      } else {
        setCustomDestinationMajor('');
      }
      setSnapshotRateInput(String(editingTx.snapshotRateToBase));
      setOccurredAtInput(editingTx.occurredAt.slice(0, 10));
      setCategoryId(editingTx.categoryId);
      setSubcategoryId(editingTx.subcategoryId);
      setManualBudgetId(editingTx.manualBudgetId);
      setTitle(editingTx.title);
      setNote(editingTx.note);
    } else {
      const initialType = quickEntryDraft?.defaultType ?? 'EXPENSE';
      setTxType(initialType);
      setExpression('');
      setWalletId(defaultWallet);
      const secondWallet =
        wallets.find((w) => w.id !== defaultWallet)?.id ?? defaultWallet;
      setDestinationWalletId(secondWallet);
      setCustomDestinationMajor('');
      const wObj = wallets.find((w) => w.id === defaultWallet) ?? wallets[0];
      const liveRate = engine.getExchangeRateToBase(wObj?.currencyCode ?? baseCurrency);
      setSnapshotRateInput(String(liveRate));
      setOccurredAtInput(new Date().toISOString().slice(0, 10));
      const flowCats = categories.filter(
        (c) =>
          c.parentId === null &&
          c.flowType === (initialType === 'INCOME' ? 'INCOME' : 'EXPENSE')
      );
      setCategoryId(flowCats[0]?.id ?? null);
      setSubcategoryId(null);
      setManualBudgetId(null);
      setTitle('');
      setNote('');
    }
  }, [
    isQuickEntryOpen,
    editingTx,
    quickEntryDraft,
    wallets,
    categories,
    engine,
    baseCurrency,
  ]);

  const selectedWallet = useMemo(
    () => wallets.find((w) => w.id === walletId) ?? wallets[0],
    [wallets, walletId]
  );

  const destinationWallet = useMemo(
    () => wallets.find((w) => w.id === destinationWalletId) ?? wallets[0],
    [wallets, destinationWalletId]
  );

  const currencyDef = useMemo(
    () => getCurrencyDefinition(selectedWallet?.currencyCode ?? 'USD'),
    [selectedWallet]
  );

  const evalResult = useMemo(
    () =>
      evaluateCalculatorExpression(
        expression,
        selectedWallet?.decimalPlaces ?? 2,
        { allowNegative: txType === 'BALANCE_ADJUSTMENT' }
      ),
    [expression, selectedWallet, txType]
  );

  const parsedSnapshotRate = useMemo(() => {
    const n = Number(snapshotRateInput);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
    return engine.getExchangeRateToBase(selectedWallet?.currencyCode ?? baseCurrency);
  }, [snapshotRateInput, engine, selectedWallet, baseCurrency]);

  const prefilledDestinationMinor = useMemo(() => {
    if (txType !== 'TRANSFER' || !selectedWallet || !destinationWallet) {
      return '0';
    }
    if (selectedWallet.currencyCode === destinationWallet.currencyCode) {
      return evalResult.amountMinor;
    }
    const dstRate = engine.getExchangeRateToBase(destinationWallet.currencyCode);
    const crossRate = dstRate > 0 ? parsedSnapshotRate / dstRate : 1;
    return convertMinorUnits(
      evalResult.amountMinor,
      selectedWallet.decimalPlaces,
      destinationWallet.decimalPlaces,
      crossRate
    );
  }, [
    txType,
    selectedWallet,
    destinationWallet,
    evalResult.amountMinor,
    parsedSnapshotRate,
    engine,
  ]);

  const topCategories = useMemo(() => {
    if (txType === 'TRANSFER' || txType === 'BALANCE_ADJUSTMENT') {
      return [];
    }
    return categories.filter(
      (c) => c.parentId === null && c.flowType === txType
    );
  }, [categories, txType]);

  const availableSubcategories = useMemo(() => {
    if (!categoryId || txType === 'TRANSFER' || txType === 'BALANCE_ADJUSTMENT') {
      return [];
    }
    return categories.filter((c) => c.parentId === categoryId);
  }, [categories, categoryId, txType]);

  const manualBudgets = useMemo(
    () => budgets.filter((b) => b.scopeType === 'MANUAL_ASSIGNMENT'),
    [budgets]
  );

  const handleKeyPress = (key: string) => {
    if (key === '⌫') {
      setExpression((prev) => prev.slice(0, -1));
      return;
    }
    setExpression((prev) => prev + key);
  };

  const handleSave = () => {
    const amountBig = BigInt(evalResult.amountMinor);
    if (
      !selectedWallet ||
      (txType !== 'BALANCE_ADJUSTMENT' && amountBig <= 0n) ||
      (txType === 'BALANCE_ADJUSTMENT' && amountBig === 0n)
    ) {
      return;
    }

    let finalDestMinor: string | null = null;
    if (txType === 'TRANSFER' && destinationWallet) {
      if (customDestinationMajor.trim()) {
        const customEval = evaluateCalculatorExpression(
          customDestinationMajor,
          destinationWallet.decimalPlaces
        );
        finalDestMinor = customEval.amountMinor;
      } else {
        finalDestMinor = prefilledDestinationMinor;
      }
    }

    const validDatePrefix = /^\d{4}-\d{2}-\d{2}$/.test(occurredAtInput.trim())
      ? occurredAtInput.trim()
      : new Date().toISOString().slice(0, 10);
    const fullOccurredAt =
      editingTx && editingTx.occurredAt.startsWith(validDatePrefix)
        ? editingTx.occurredAt
        : `${validDatePrefix}T12:00:00.000Z`;

    if (editingTx) {
      engine.updateTransaction(editingTx.id, {
        walletId: selectedWallet.id,
        destinationWalletId:
          txType === 'TRANSFER' ? destinationWallet?.id ?? null : null,
        amountMinor: evalResult.amountMinor,
        destinationAmountMinor: finalDestMinor,
        snapshotRateToBase: parsedSnapshotRate,
        categoryId:
          txType === 'TRANSFER' || txType === 'BALANCE_ADJUSTMENT'
            ? null
            : categoryId,
        subcategoryId:
          txType === 'TRANSFER' || txType === 'BALANCE_ADJUSTMENT'
            ? null
            : subcategoryId,
        manualBudgetId: txType === 'EXPENSE' ? manualBudgetId : null,
        title: title.trim() || editingTx.title,
        note,
        occurredAt: fullOccurredAt,
      });
    } else {
      engine.recordTransaction({
        type: txType,
        walletId: selectedWallet.id,
        destinationWalletId:
          txType === 'TRANSFER' ? destinationWallet?.id ?? null : null,
        amountMinor: evalResult.amountMinor,
        destinationAmountMinor: finalDestMinor,
        snapshotRateToBase: parsedSnapshotRate,
        categoryId:
          txType === 'TRANSFER' || txType === 'BALANCE_ADJUSTMENT'
            ? null
            : categoryId,
        subcategoryId:
          txType === 'TRANSFER' || txType === 'BALANCE_ADJUSTMENT'
            ? null
            : subcategoryId,
        manualBudgetId: txType === 'EXPENSE' ? manualBudgetId : null,
        title,
        note,
        occurredAt: fullOccurredAt,
      });
    }

    refresh();
    closeQuickEntry();
  };

  const handleDuplicate = () => {
    if (!editingTx) {
      return;
    }
    engine.duplicateTransaction(editingTx.id);
    refresh();
    closeQuickEntry();
  };

  const handleDelete = () => {
    if (!editingTx) {
      return;
    }
    engine.deleteTransaction(editingTx.id);
    refresh();
    closeQuickEntry();
  };

  return (
    <Modal
      visible={isQuickEntryOpen}
      animationType="slide"
      transparent
      onRequestClose={closeQuickEntry}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {/* Header & Type Switcher */}
          <View style={styles.headerRow}>
            <View
              style={[
                styles.typeSegment,
                { backgroundColor: theme.surfaceElevated },
              ]}
            >
              {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => {
                const active = txType === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      setTxType(t);
                      if (t !== 'TRANSFER') {
                        const firstCat = categories.find(
                          (c) => c.parentId === null && c.flowType === t
                        );
                        setCategoryId(firstCat?.id ?? null);
                        setSubcategoryId(null);
                      }
                    }}
                    style={[
                      styles.typeBtn,
                      active && { backgroundColor: theme.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        { color: active ? '#FFFFFF' : theme.textSecondary },
                      ]}
                    >
                      {t === 'EXPENSE'
                        ? 'Expense'
                        : t === 'INCOME'
                          ? 'Income'
                          : 'Transfer'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={closeQuickEntry} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: theme.textSecondary }]}>
                ✕
              </Text>
            </Pressable>
          </View>

          {/* Amount & Inline Math Display */}
          <View
            style={[
              styles.amountBox,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
            ]}
          >
            <View style={styles.amountTopRow}>
              <Text style={[styles.expressionText, { color: theme.textSecondary }]}>
                {expression || '0'}
              </Text>
              <Text style={[styles.rateBadge, { color: theme.textMuted }]}>
                {selectedWallet?.currencyCode} (Snapshot Rate:{' '}
                {parsedSnapshotRate.toFixed(4)})
              </Text>
            </View>
            <Text style={[styles.evaluatedAmountText, { color: theme.textPrimary }]}>
              {currencyDef.symbol}
              {evalResult.displayMajor}
            </Text>
          </View>

          <ScrollView
            style={styles.configScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Source Wallet Selector */}
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              {txType === 'TRANSFER' ? 'From Wallet' : 'Wallet'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
            >
              {wallets.map((w) => {
                const selected = w.id === selectedWallet?.id;
                return (
                  <Pressable
                    key={w.id}
                    onPress={() => {
                      setWalletId(w.id);
                      setSnapshotRateInput(
                        String(engine.getExchangeRateToBase(w.currencyCode))
                      );
                    }}
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
                      style={[
                        styles.chipText,
                        { color: selected ? '#FFFFFF' : theme.textPrimary },
                      ]}
                    >
                      {w.icon} {w.name} ({w.currencyCode})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Destination Wallet for Transfers */}
            {txType === 'TRANSFER' && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  To Destination Wallet
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipRow}
                >
                  {wallets
                    .filter((w) => w.id !== selectedWallet?.id)
                    .map((w) => {
                      const selected = w.id === destinationWallet?.id;
                      return (
                        <Pressable
                          key={w.id}
                          onPress={() => setDestinationWalletId(w.id)}
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
                            style={[
                              styles.chipText,
                              { color: selected ? '#FFFFFF' : theme.textPrimary },
                            ]}
                          >
                            {w.icon} {w.name} ({w.currencyCode})
                          </Text>
                        </Pressable>
                      );
                    })}
                </ScrollView>
                {destinationWallet &&
                  selectedWallet &&
                  destinationWallet.currencyCode !==
                    selectedWallet.currencyCode && (
                    <View style={styles.crossCurrencyBox}>
                      <Text
                        style={[
                          styles.sectionLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Destination Inflow ({destinationWallet.currencyCode}) —
                        Auto-converted:{' '}
                        {(
                          Number(prefilledDestinationMinor) /
                          Math.pow(10, destinationWallet.decimalPlaces)
                        ).toFixed(destinationWallet.decimalPlaces)}
                      </Text>
                      <TextInput
                        value={customDestinationMajor}
                        onChangeText={setCustomDestinationMajor}
                        placeholder="Optional exact bank conversion amount"
                        placeholderTextColor={theme.textMuted}
                        keyboardType="decimal-pad"
                        style={[
                          styles.inputField,
                          {
                            backgroundColor: theme.surfaceElevated,
                            color: theme.textPrimary,
                            borderColor: theme.border,
                          },
                        ]}
                      />
                    </View>
                  )}
              </>
            )}

            {/* Category & Subcategory Chips */}
            {txType !== 'TRANSFER' && txType !== 'BALANCE_ADJUSTMENT' && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Category
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipRow}
                >
                  {topCategories.map((c) => {
                    const selected = c.id === categoryId;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => {
                          setCategoryId(c.id);
                          setSubcategoryId(null);
                        }}
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
                          style={[
                            styles.chipText,
                            { color: selected ? '#FFFFFF' : theme.textPrimary },
                          ]}
                        >
                          {c.icon} {c.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {availableSubcategories.length > 0 && (
                  <>
                    <Text
                      style={[styles.sectionLabel, { color: theme.textSecondary }]}
                    >
                      Subcategory (Optional)
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.chipRow}
                    >
                      <Pressable
                        onPress={() => setSubcategoryId(null)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor:
                              subcategoryId === null
                                ? theme.accent
                                : theme.surfaceElevated,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color:
                                subcategoryId === null
                                  ? '#FFFFFF'
                                  : theme.textSecondary,
                            },
                          ]}
                        >
                          General
                        </Text>
                      </Pressable>
                      {availableSubcategories.map((sub) => {
                        const selected = sub.id === subcategoryId;
                        return (
                          <Pressable
                            key={sub.id}
                            onPress={() => setSubcategoryId(sub.id)}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: selected
                                  ? sub.color
                                  : theme.surfaceElevated,
                                borderColor: selected ? sub.color : theme.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                {
                                  color: selected ? '#FFFFFF' : theme.textPrimary,
                                },
                              ]}
                            >
                              {sub.icon} {sub.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </>
                )}
              </>
            )}

            {/* Manual Assignment Trip/Event Budget Pin */}
            {txType === 'EXPENSE' && manualBudgets.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Pin to Trip / Event Budget (Manual Assignment)
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipRow}
                >
                  <Pressable
                    onPress={() => setManualBudgetId(null)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor:
                          manualBudgetId === null
                            ? theme.accent
                            : theme.surfaceElevated,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color:
                            manualBudgetId === null
                              ? '#FFFFFF'
                              : theme.textSecondary,
                        },
                      ]}
                    >
                      None
                    </Text>
                  </Pressable>
                  {manualBudgets.map((b) => {
                    const selected = b.id === manualBudgetId;
                    return (
                      <Pressable
                        key={b.id}
                        onPress={() => setManualBudgetId(b.id)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: selected
                              ? b.color
                              : theme.surfaceElevated,
                            borderColor: selected ? b.color : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: selected ? '#FFFFFF' : theme.textPrimary },
                          ]}
                        >
                          {b.icon} {b.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Title & Note Inputs */}
            <View style={styles.inputRow}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Title / Merchant (optional)"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.inputField,
                  {
                    flex: 1,
                    backgroundColor: theme.surfaceElevated,
                    color: theme.textPrimary,
                    borderColor: theme.border,
                  },
                ]}
              />
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Note"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.inputField,
                  {
                    flex: 1,
                    backgroundColor: theme.surfaceElevated,
                    color: theme.textPrimary,
                    borderColor: theme.border,
                  },
                ]}
              />
            </View>

            {/* Date (occurredAt) & Editable Snapshot Rate Inputs */}
            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={occurredAtInput}
                  onChangeText={setOccurredAtInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.inputField,
                    {
                      backgroundColor: theme.surfaceElevated,
                      color: theme.textPrimary,
                      borderColor: theme.border,
                    },
                  ]}
                />
              </View>
              {selectedWallet && selectedWallet.currencyCode !== baseCurrency && (
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                    Snapshot Rate (to {baseCurrency})
                  </Text>
                  <TextInput
                    value={snapshotRateInput}
                    onChangeText={setSnapshotRateInput}
                    keyboardType="decimal-pad"
                    placeholder="1.00"
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.inputField,
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
          </ScrollView>

          {/* Calculator Keypad */}
          <View style={styles.keypadGrid}>
            {KEYPAD_ROWS.map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((key) => {
                  const isOp = ['÷', '×', '-', '+'].includes(key);
                  return (
                    <Pressable
                      key={key}
                      onPress={() => handleKeyPress(key)}
                      style={[
                        styles.keyButton,
                        {
                          backgroundColor: isOp
                            ? theme.accent + '22'
                            : theme.surfaceElevated,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.keyText,
                          { color: isOp ? theme.accent : theme.textPrimary },
                        ]}
                      >
                        {key}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.footerRow}>
            {editingTx && (
              <>
                <Pressable
                  onPress={handleDelete}
                  style={[
                    styles.deleteButton,
                    { backgroundColor: theme.danger + '22' },
                  ]}
                >
                  <Text style={[styles.deleteText, { color: theme.danger }]}>
                    Delete
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleDuplicate}
                  style={[
                    styles.deleteButton,
                    { backgroundColor: theme.accent + '22' },
                  ]}
                >
                  <Text style={[styles.deleteText, { color: theme.accent }]}>
                    Duplicate
                  </Text>
                </Pressable>
              </>
            )}
            <Pressable
              onPress={handleSave}
              style={[
                styles.saveButton,
                {
                  backgroundColor:
                    BigInt(evalResult.amountMinor) !== 0n
                      ? theme.accent
                      : theme.textMuted,
                },
              ]}
            >
              <Text style={styles.saveText}>
                {editingTx ? 'Update' : `Save ${txType}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
    maxHeight: '94%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  typeSegment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    flex: 1,
    marginRight: 10,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 8,
  },
  closeText: {
    fontSize: 18,
    fontWeight: '700',
  },
  amountBox: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  amountTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expressionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rateBadge: {
    fontSize: 11,
  },
  evaluatedAmountText: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  configScroll: {
    maxHeight: 220,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  crossCurrencyBox: {
    marginVertical: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  inputField: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  keypadGrid: {
    gap: 6,
    marginTop: 4,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 6,
  },
  keyButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 20,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  deleteButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});

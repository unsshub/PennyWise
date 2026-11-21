import React, { useState } from 'react';
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
import {
  SUPPORTED_CURRENCIES,
  parseMajorToMinorUnits,
} from '@/domain/currency';
import type {
  RecurringFrequency,
  ThemeMode,
  UpcomingPayment,
} from '@/domain/types';
import {
  scheduleUpcomingBillNotifications,
  shareExportedContent,
} from '@/services/device-services';

const ACCENT_PALETTES = [
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Ocean Blue', hex: '#3B82F6' },
  { name: 'Royal Violet', hex: '#8B5CF6' },
  { name: 'Sunset Orange', hex: '#F97316' },
  { name: 'Rose Pink', hex: '#EC4899' },
  { name: 'Cyber Cyan', hex: '#06B6D4' },
];

export default function BillsAndSettingsScreen() {
  const {
    engine,
    baseCurrency,
    wallets,
    categories,
    upcomingPayments,
    exchangeRates,
    homeSections,
    preferences,
    theme,
    formatAmount,
    refresh,
    syncExchangeRatesNow,
  } = usePennyWise();

  const [billModalOpen, setBillModalOpen] = useState(false);
  const [billTitle, setBillTitle] = useState('');
  const [billAmountMajor, setBillAmountMajor] = useState('15.99');
  const [billWalletId, setBillWalletId] = useState(wallets[0]?.id ?? '');
  const [billCategoryId, setBillCategoryId] = useState(
    categories.find((c) => c.parentId === null && c.flowType === 'EXPENSE')?.id ??
      'cat-housing'
  );
  const [billDueDate, setBillDueDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [billIsRecurring, setBillIsRecurring] = useState(true);
  const [billFrequency, setBillFrequency] =
    useState<RecurringFrequency>('MONTHLY');
  const [billAutoPay, setBillAutoPay] = useState(false);
  const [billReminderDays, setBillReminderDays] = useState('1');

  // Mark as Paid with editable amount modal
  const [payingBill, setPayingBill] = useState<UpcomingPayment | null>(null);
  const [payOverrideMajor, setPayOverrideMajor] = useState('');

  // Exchange Rate Manual Override state
  const [editingRateCode, setEditingRateCode] = useState<string | null>(null);
  const [customRateInput, setCustomRateInput] = useState('');

  // Backup Snapshot JSON Modal (Export / Restore)
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupJsonText, setBackupJsonText] = useState('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const handleCreateBill = () => {
    const w = wallets.find((item) => item.id === billWalletId) ?? wallets[0];
    if (!w || !billTitle.trim()) {
      return;
    }
    const amountMinor = parseMajorToMinorUnits(billAmountMajor, w.decimalPlaces);
    if (BigInt(amountMinor) <= 0n) {
      return;
    }

    if (billIsRecurring) {
      engine.createRecurringRule({
        title: billTitle.trim(),
        type: 'EXPENSE',
        walletId: w.id,
        categoryId: billCategoryId,
        amountMinor,
        frequency: billFrequency,
        intervalCount: 1,
        nextDueDate: billDueDate,
        autoPay: billAutoPay,
        reminderDaysBefore: Number(billReminderDays) || 1,
      });
    } else {
      engine.createUpcomingPayment({
        title: billTitle.trim(),
        type: 'EXPENSE',
        walletId: w.id,
        categoryId: billCategoryId,
        amountMinor,
        dueDate: billDueDate,
        autoPay: billAutoPay,
        reminderDaysBefore: Number(billReminderDays) || 1,
      });
    }

    void scheduleUpcomingBillNotifications(engine.listUpcomingPayments());
    refresh();
    setBillModalOpen(false);
    setBillTitle('');
  };

  const handleConfirmMarkPaid = () => {
    if (!payingBill) {
      return;
    }
    const overrideMinor = parseMajorToMinorUnits(
      payOverrideMajor,
      payingBill.decimalPlaces
    );
    engine.markUpcomingPaymentAsPaid(payingBill.id, {
      actualAmountMinor:
        BigInt(overrideMinor) > 0n ? overrideMinor : payingBill.amountMinor,
    });
    refresh();
    setPayingBill(null);
  };

  const moveHomeSection = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= homeSections.length) {
      return;
    }
    const copy = [...homeSections];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    const reordered = copy.map((sec, idx) => ({ ...sec, order: idx }));
    engine.updateHomeSections(reordered);
    refresh();
  };

  const toggleHomeSectionVisibility = (id: string) => {
    const updated = homeSections.map((s) =>
      s.id === id ? { ...s, visible: !s.visible } : s
    );
    engine.updateHomeSections(updated);
    refresh();
  };

  const handleExportCsv = async () => {
    const csv = engine.exportTransactionsToCsv();
    await shareExportedContent({
      filename: `pennywise-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      content: csv,
      mimeType: 'text/csv',
    });
    setStatusBanner('CSV exported successfully!');
  };

  const handleOpenBackupExport = async () => {
    const json = engine.exportBackupSnapshotJson();
    setBackupJsonText(json);
    setBackupModalOpen(true);
  };

  const handleShareBackupFile = async () => {
    const json = engine.exportBackupSnapshotJson();
    await shareExportedContent({
      filename: `pennywise-backup-${new Date().toISOString().slice(0, 10)}.json`,
      content: json,
      mimeType: 'application/json',
    });
    setStatusBanner('Backup Snapshot exported!');
  };

  const handleRestoreBackup = () => {
    try {
      engine.restoreBackupSnapshotJson(backupJsonText);
      refresh();
      setBackupModalOpen(false);
      setStatusBanner('Backup Snapshot restored 100%!');
    } catch (err: any) {
      setStatusBanner(`Restore error: ${err?.message ?? 'Invalid JSON'}`);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>
          Bills, Personalization & Privacy
        </Text>
        <Text style={[styles.pageSubtitle, { color: theme.textSecondary }]}>
          Subscriptions, multi-currency rates, custom layout, and local backups
        </Text>

        {statusBanner && (
          <Pressable
            onPress={() => setStatusBanner(null)}
            style={[
              styles.banner,
              { backgroundColor: theme.accent + '22', borderColor: theme.accent },
            ]}
          >
            <Text style={{ color: theme.accent, fontWeight: '800', fontSize: 13 }}>
              ✓ {statusBanner} (Tap to dismiss)
            </Text>
          </Pressable>
        )}

        {/* Section 1: Stay Ahead of Bills (Recurring Rules & Upcoming Payments) */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                🗓️ Upcoming Bills & Subscriptions
              </Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                Future payments stay isolated from Wallet balances until settled
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setBillWalletId(wallets[0]?.id ?? '');
                setBillModalOpen(true);
              }}
              style={[styles.primarySmallBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={styles.primarySmallBtnText}>+ Add Bill</Text>
            </Pressable>
          </View>

          {upcomingPayments.length === 0 ? (
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              No upcoming bills or recurring subscriptions scheduled.
            </Text>
          ) : (
            upcomingPayments.map((bill) => (
              <View
                key={bill.id}
                style={[styles.billItem, { borderColor: theme.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: theme.textPrimary,
                      fontWeight: '800',
                      fontSize: 14,
                    }}
                  >
                    {bill.title}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                    Due {bill.dueDate} •{' '}
                    {bill.autoPay ? '⚡ Auto-Pay on Due Date' : '🔔 Manual Confirm'}{' '}
                    • Remind {bill.reminderDaysBefore}d before
                  </Text>
                </View>

                <Text
                  style={{
                    color: theme.textPrimary,
                    fontWeight: '900',
                    fontSize: 14,
                    marginRight: 8,
                  }}
                >
                  {formatAmount(
                    bill.amountMinor,
                    bill.currencyCode,
                    bill.decimalPlaces
                  )}
                </Text>

                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable
                    onPress={() => {
                      setPayingBill(bill);
                      setPayOverrideMajor(
                        (
                          Number(bill.amountMinor) /
                          Math.pow(10, bill.decimalPlaces)
                        ).toString()
                      );
                    }}
                    style={[
                      styles.actionChip,
                      { backgroundColor: theme.accent },
                    ]}
                  >
                    <Text
                      style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}
                    >
                      Mark Paid
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      engine.skipUpcomingPayment(bill.id);
                      refresh();
                    }}
                    style={[
                      styles.actionChip,
                      { backgroundColor: theme.surfaceElevated },
                    ]}
                  >
                    <Text
                      style={{
                        color: theme.textSecondary,
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      Skip
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Section 2: Make It Yours — Theme, Accent Colors & Home Screen Layout */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
            🎨 Make It Yours: Themes & Home Layout
          </Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            Customize theme mode, accent colors, and Home Section order
          </Text>

          <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
            Theme Mode
          </Text>
          <View style={styles.segmentRow}>
            {(['SYSTEM', 'LIGHT', 'DARK', 'AMOLED'] as ThemeMode[]).map((tm) => {
              const active = preferences.themeMode === tm;
              return (
                <Pressable
                  key={tm}
                  onPress={() => {
                    engine.updatePreferences({ themeMode: tm });
                    refresh();
                  }}
                  style={[
                    styles.segmentBtn,
                    {
                      backgroundColor: active
                        ? theme.accent
                        : theme.surfaceElevated,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#FFFFFF' : theme.textSecondary,
                      fontSize: 11,
                      fontWeight: '800',
                    }}
                  >
                    {tm}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
            Accent Color Palette
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginVertical: 6 }}
          >
            {ACCENT_PALETTES.map((pal) => {
              const selected = preferences.accentColor === pal.hex;
              return (
                <Pressable
                  key={pal.hex}
                  onPress={() => {
                    engine.updatePreferences({ accentColor: pal.hex });
                    refresh();
                  }}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: pal.hex,
                      borderWidth: selected ? 3 : 0,
                      borderColor: theme.textPrimary,
                    },
                  ]}
                />
              );
            })}
          </ScrollView>

          <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
            Modular Home Sections (Reorder & Toggle)
          </Text>
          {homeSections.map((sec, idx) => (
            <View
              key={sec.id}
              style={[styles.sectionOrderRow, { borderColor: theme.border }]}
            >
              <Switch
                value={sec.visible}
                onValueChange={() => toggleHomeSectionVisibility(sec.id)}
                trackColor={{ false: theme.border, true: theme.accent }}
              />
              <Text
                style={{
                  flex: 1,
                  color: theme.textPrimary,
                  fontWeight: '700',
                  fontSize: 13,
                  marginLeft: 8,
                }}
              >
                {sec.title}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable
                  onPress={() => moveHomeSection(idx, -1)}
                  style={[
                    styles.arrowBtn,
                    { backgroundColor: theme.surfaceElevated },
                  ]}
                >
                  <Text style={{ color: theme.textPrimary, fontWeight: '800' }}>
                    ↑
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => moveHomeSection(idx, 1)}
                  style={[
                    styles.arrowBtn,
                    { backgroundColor: theme.surfaceElevated },
                  ]}
                >
                  <Text style={{ color: theme.textPrimary, fontWeight: '800' }}>
                    ↓
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        {/* Section 3: Multi-Currency Base Currency & Exchange Rate Overrides */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                🌍 Multi-Currency & Exchange Rates
              </Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                Base Currency: {baseCurrency} • Cached offline + manual overrides
              </Text>
            </View>
            <Pressable
              onPress={async () => {
                const ok = await syncExchangeRatesNow();
                setStatusBanner(
                  ok
                    ? 'Synced latest live Exchange Rates!'
                    : 'Offline: Using cached local SQLite rates'
                );
              }}
              style={[
                styles.primarySmallBtn,
                { backgroundColor: theme.surfaceElevated },
              ]}
            >
              <Text
                style={{
                  color: theme.accent,
                  fontWeight: '800',
                  fontSize: 12,
                }}
              >
                ↻ Sync Live
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
            Select Base Currency
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10 }}
          >
            {SUPPORTED_CURRENCIES.map((curr) => {
              const active = curr.code === baseCurrency;
              return (
                <Pressable
                  key={curr.code}
                  onPress={() => {
                    engine.setBaseCurrency(curr.code);
                    refresh();
                  }}
                  style={[
                    styles.currencyChip,
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
                      fontWeight: '800',
                      fontSize: 12,
                    }}
                  >
                    {curr.symbol} {curr.code}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
            Exchange Rates (1 Unit = X {baseCurrency}) — Tap to Override
          </Text>
          {exchangeRates
            .filter((r) => r.currencyCode !== baseCurrency)
            .map((rate) => {
              const isEditing = editingRateCode === rate.currencyCode;
              return (
                <View
                  key={rate.currencyCode}
                  style={[styles.rateRow, { borderColor: theme.border }]}
                >
                  <Text
                    style={{
                      color: theme.textPrimary,
                      fontWeight: '800',
                      width: 60,
                    }}
                  >
                    1 {rate.currencyCode}
                  </Text>
                  {isEditing ? (
                    <View style={styles.rateEditRow}>
                      <TextInput
                        value={customRateInput}
                        onChangeText={setCustomRateInput}
                        keyboardType="decimal-pad"
                        style={[
                          styles.rateInput,
                          {
                            backgroundColor: theme.surfaceElevated,
                            color: theme.textPrimary,
                            borderColor: theme.border,
                          },
                        ]}
                      />
                      <Pressable
                        onPress={() => {
                          const num = Number(customRateInput);
                          if (Number.isFinite(num) && num > 0) {
                            engine.setExchangeRate({
                              currencyCode: rate.currencyCode,
                              rateToBase: num,
                              isManualOverride: true,
                            });
                            refresh();
                          }
                          setEditingRateCode(null);
                        }}
                        style={[
                          styles.actionChip,
                          { backgroundColor: theme.accent },
                        ]}
                      >
                        <Text
                          style={{
                            color: '#FFFFFF',
                            fontWeight: '800',
                            fontSize: 11,
                          }}
                        >
                          Save
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => {
                        setEditingRateCode(rate.currencyCode);
                        setCustomRateInput(String(rate.rateToBase));
                      }}
                      style={styles.rateDisplayRow}
                    >
                      <Text
                        style={{
                          color: theme.textPrimary,
                          fontWeight: '700',
                          fontSize: 13,
                        }}
                      >
                        = {rate.rateToBase.toFixed(4)} {baseCurrency}
                      </Text>
                      <Text
                        style={{
                          color: rate.isManualOverride
                            ? theme.warning
                            : theme.textMuted,
                          fontSize: 11,
                        }}
                      >
                        {rate.isManualOverride ? 'Manual Override ✎' : 'Auto ✎'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
        </View>

        {/* Section 4: Private & Secure — Biometric App Lock, CSV Export & Offline Backup Snapshot */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
            🔒 Private & Secure (On-Device Data)
          </Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            Your financial data stays on your device and is never collected or sold.
          </Text>

          <View style={styles.switchItem}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: theme.textPrimary,
                  fontWeight: '700',
                  fontSize: 14,
                }}
              >
                Biometric App Lock
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                Require Android fingerprint / face unlock when opening PennyWise
              </Text>
            </View>
            <Switch
              value={preferences.biometricLockEnabled}
              onValueChange={(val) => {
                engine.updatePreferences({ biometricLockEnabled: val });
                refresh();
              }}
              trackColor={{ false: theme.border, true: theme.accent }}
            />
          </View>

          <View style={styles.switchItem}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: theme.textPrimary,
                  fontWeight: '700',
                  fontSize: 14,
                }}
              >
                Privacy Mask (Blur Balances)
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                Hide sensitive monetary amounts when viewing in public
              </Text>
            </View>
            <Switch
              value={preferences.privacyMaskEnabled}
              onValueChange={(val) => {
                engine.updatePreferences({ privacyMaskEnabled: val });
                refresh();
              }}
              trackColor={{ false: theme.border, true: theme.accent }}
            />
          </View>

          <View style={styles.backupBtnColumn}>
            <Pressable
              onPress={handleExportCsv}
              style={[
                styles.portabilityBtn,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color: theme.textPrimary,
                  fontWeight: '800',
                  fontSize: 14,
                }}
              >
                📄 Export Transactions to CSV
              </Text>
            </Pressable>

            <Pressable
              onPress={handleShareBackupFile}
              style={[
                styles.portabilityBtn,
                {
                  backgroundColor: theme.accent + '22',
                  borderColor: theme.accent,
                },
              ]}
            >
              <Text
                style={{
                  color: theme.accent,
                  fontWeight: '800',
                  fontSize: 14,
                }}
              >
                💾 Export Full Backup Snapshot (.json)
              </Text>
            </Pressable>

            <Pressable
              onPress={handleOpenBackupExport}
              style={[
                styles.portabilityBtn,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color: theme.textPrimary,
                  fontWeight: '800',
                  fontSize: 14,
                }}
              >
                🔄 Inspect / Restore Backup Snapshot
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Add Bill / Recurring Subscription Modal */}
      <Modal
        visible={billModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setBillModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                Add Subscription or Upcoming Bill
              </Text>
              <Pressable onPress={() => setBillModalOpen(false)}>
                <Text style={{ color: theme.textSecondary, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>

            <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
              Title / Service
            </Text>
            <TextInput
              value={billTitle}
              onChangeText={setBillTitle}
              placeholder="e.g. Netflix, Electric Bill, Car Insurance"
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

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
                  Amount
                </Text>
                <TextInput
                  value={billAmountMajor}
                  onChangeText={setBillAmountMajor}
                  keyboardType="decimal-pad"
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
              <View style={{ flex: 1 }}>
                <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
                  Next Due Date
                </Text>
                <TextInput
                  value={billDueDate}
                  onChangeText={setBillDueDate}
                  placeholder="YYYY-MM-DD"
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
            </View>

            <View style={styles.switchItem}>
              <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>
                Recurring Subscription / Bill
              </Text>
              <Switch
                value={billIsRecurring}
                onValueChange={setBillIsRecurring}
                trackColor={{ false: theme.border, true: theme.accent }}
              />
            </View>

            {billIsRecurring && (
              <View style={styles.segmentRow}>
                {(['WEEKLY', 'MONTHLY', 'YEARLY'] as RecurringFrequency[]).map(
                  (freq) => (
                    <Pressable
                      key={freq}
                      onPress={() => setBillFrequency(freq)}
                      style={[
                        styles.segmentBtn,
                        {
                          backgroundColor:
                            billFrequency === freq
                              ? theme.accent
                              : theme.surfaceElevated,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            billFrequency === freq
                              ? '#FFFFFF'
                              : theme.textSecondary,
                          fontSize: 11,
                          fontWeight: '800',
                        }}
                      >
                        {freq}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>
            )}

            <View style={styles.switchItem}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>
                  Auto-Pay on Due Date
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                  Automatically posts as a Transaction when due date arrives
                </Text>
              </View>
              <Switch
                value={billAutoPay}
                onValueChange={setBillAutoPay}
                trackColor={{ false: theme.border, true: theme.accent }}
              />
            </View>

            <Pressable
              onPress={handleCreateBill}
              style={[
                styles.saveBtn,
                { backgroundColor: theme.accent, marginTop: 12 },
              ]}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
                Save Upcoming Bill
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Mark as Paid Confirmation Modal (with editable utility bill amount) */}
      <Modal
        visible={!!payingBill}
        animationType="fade"
        transparent
        onRequestClose={() => setPayingBill(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
              Mark “{payingBill?.title}” as Paid
            </Text>
            <Text
              style={{
                color: theme.textSecondary,
                fontSize: 12,
                marginVertical: 6,
              }}
            >
              Adjust the final amount if your bill varied this cycle:
            </Text>
            <TextInput
              value={payOverrideMajor}
              onChangeText={setPayOverrideMajor}
              keyboardType="decimal-pad"
              style={[
                styles.input,
                {
                  backgroundColor: theme.surfaceElevated,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                },
              ]}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => setPayingBill(null)}
                style={[
                  styles.saveBtn,
                  { backgroundColor: theme.surfaceElevated },
                ]}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: '800' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmMarkPaid}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
                  Confirm & Post
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Backup Snapshot Inspect & Restore Modal */}
      <Modal
        visible={backupModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setBackupModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                Backup Snapshot JSON (Export / Restore)
              </Text>
              <Pressable onPress={() => setBackupModalOpen(false)}>
                <Text style={{ color: theme.textSecondary, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 8 }}>
              Copy this JSON bundle to back up your entire local database, or paste a Backup Snapshot below and tap Restore:
            </Text>
            <TextInput
              value={backupJsonText}
              onChangeText={setBackupJsonText}
              multiline
              style={[
                styles.backupTextarea,
                {
                  backgroundColor: theme.surfaceElevated,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                },
              ]}
            />
            <Pressable
              onPress={handleRestoreBackup}
              style={[
                styles.saveBtn,
                { backgroundColor: theme.accent, marginTop: 12 },
              ]}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
                Restore Backup Snapshot
              </Text>
            </Pressable>
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
  pageTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 14,
  },
  banner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  primarySmallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primarySmallBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  billItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  actionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
  },
  sectionOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  arrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 8,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  rateDisplayRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rateEditRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rateInput: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  backupBtnColumn: {
    gap: 10,
    marginTop: 16,
  },
  portabilityBtn: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
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
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveBtn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupTextarea: {
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    fontSize: 11,
    textAlignVertical: 'top',
  },
});

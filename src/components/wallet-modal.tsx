import React, { useEffect, useState } from 'react';
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
import { SUPPORTED_CURRENCIES, parseMajorToMinorUnits } from '@/domain/currency';
import type { Wallet } from '@/domain/types';

const WALLET_COLORS = [
  '#10B981',
  '#3B82F6',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#EF4444',
  '#14B8A6',
];

const WALLET_ICONS = ['💵', '€', '₿', '🏦', '💳', '🪙', '💼', '🐖'];

export function WalletModal({
  visible,
  editingWallet,
  onClose,
}: {
  visible: boolean;
  editingWallet: Wallet | null;
  onClose: () => void;
}) {
  const {
    engine,
    allWalletsIncludingArchived,
    theme,
    t,
    localizeName,
    refresh,
  } = usePennyWise();

  const [name, setName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [balanceMajor, setBalanceMajor] = useState('0');
  const [color, setColor] = useState('#10B981');
  const [icon, setIcon] = useState('💵');
  const [includeInNetWorth, setIncludeInNetWorth] = useState(true);
  const [isArchived, setIsArchived] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (editingWallet) {
      setName(editingWallet.name);
      setCurrencyCode(editingWallet.currencyCode);
      const major = (
        Number(editingWallet.currentBalanceMinor) /
        Math.pow(10, editingWallet.decimalPlaces)
      ).toString();
      setBalanceMajor(major);
      setColor(editingWallet.color);
      setIcon(editingWallet.icon);
      setIncludeInNetWorth(editingWallet.includeInNetWorth);
      setIsArchived(editingWallet.isArchived);
    } else {
      setName('');
      setCurrencyCode('USD');
      setBalanceMajor('0');
      setColor('#3B82F6');
      setIcon('🏦');
      setIncludeInNetWorth(true);
      setIsArchived(false);
    }
  }, [visible, editingWallet]);

  const handleMoveWallet = (direction: -1 | 1) => {
    if (!editingWallet) {
      return;
    }
    const ids = allWalletsIncludingArchived.map((w) => w.id);
    const idx = ids.indexOf(editingWallet.id);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= ids.length) {
      return;
    }
    const copy = [...ids];
    const tmp = copy[idx];
    copy[idx] = copy[targetIdx];
    copy[targetIdx] = tmp;
    engine.reorderWallets(copy);
    refresh();
  };

  const handleSave = () => {
    const currDef =
      SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode) ??
      SUPPORTED_CURRENCIES[0];
    const targetMinor = parseMajorToMinorUnits(
      balanceMajor,
      currDef.decimalPlaces
    );

    if (editingWallet) {
      engine.updateWallet(editingWallet.id, {
        name: name.trim() || currDef.name,
        currencyCode: currDef.code,
        decimalPlaces: currDef.decimalPlaces,
        color,
        icon,
        includeInNetWorth,
        isArchived,
      });
      if (targetMinor !== editingWallet.currentBalanceMinor) {
        engine.reconcileWalletBalance(
          editingWallet.id,
          targetMinor,
          'Manual wallet balance reconciliation'
        );
      }
    } else {
      engine.createWallet({
        name: name.trim() || currDef.name,
        currencyCode: currDef.code,
        decimalPlaces: currDef.decimalPlaces,
        initialBalanceMinor: targetMinor,
        color,
        icon,
        includeInNetWorth,
      });
    }

    refresh();
    onClose();
  };

  const handleDelete = () => {
    if (!editingWallet) {
      return;
    }
    engine.deleteWallet(editingWallet.id);
    refresh();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.titleText, { color: theme.textPrimary }]}>
              {editingWallet
                ? `${t('edit_wallet')} (${localizeName(editingWallet.name)})`
                : t('new_wallet')}
            </Text>
            <Pressable onPress={onClose}>
              <Text style={[styles.closeText, { color: theme.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              {t('wallet_name')}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('wallet_name_placeholder')}
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
              {t('currency_fiat_crypto')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
              {SUPPORTED_CURRENCIES.map((c) => {
                const selected = c.code === currencyCode;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => {
                      setCurrencyCode(c.code);
                      if (!editingWallet) {
                        setIcon(c.symbol.length <= 2 ? c.symbol : '🏦');
                      }
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? theme.accent : theme.surfaceElevated,
                        borderColor: selected ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: selected ? '#FFFFFF' : theme.textPrimary,
                        fontWeight: '700',
                        fontSize: 13,
                      }}
                    >
                      {c.symbol} {c.code} ({c.decimalPlaces}d)
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[styles.label, { color: theme.textSecondary }]}>
              {editingWallet
                ? t('current_balance_reconcile')
                : t('starting_balance')}
            </Text>
            <TextInput
              value={balanceMajor}
              onChangeText={setBalanceMajor}
              keyboardType="decimal-pad"
              placeholder="0.00"
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
              {t('icon_and_color')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
              {WALLET_ICONS.map((ic) => (
                <Pressable
                  key={ic}
                  onPress={() => setIcon(ic)}
                  style={[
                    styles.iconChip,
                    {
                      backgroundColor:
                        icon === ic ? theme.accent + '33' : theme.surfaceElevated,
                      borderColor: icon === ic ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 18 }}>{ic}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
              {WALLET_COLORS.map((col) => (
                <Pressable
                  key={col}
                  onPress={() => setColor(col)}
                  style={[
                    styles.colorCircle,
                    {
                      backgroundColor: col,
                      borderWidth: color === col ? 3 : 0,
                      borderColor: '#FFFFFF',
                    },
                  ]}
                />
              ))}
            </ScrollView>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: theme.textPrimary }]}>
                  {t('include_net_worth_title')}
                </Text>
                <Text style={[styles.switchSub, { color: theme.textSecondary }]}>
                  {t('include_net_worth_sub')}
                </Text>
              </View>
              <Switch
                value={includeInNetWorth}
                onValueChange={setIncludeInNetWorth}
                trackColor={{ false: theme.border, true: theme.accent }}
              />
            </View>

            {editingWallet && (
              <>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: theme.textPrimary }]}>
                      {t('archive_wallet_title')}
                    </Text>
                    <Text style={[styles.switchSub, { color: theme.textSecondary }]}>
                      {t('archive_wallet_sub')}
                    </Text>
                  </View>
                  <Switch
                    value={isArchived}
                    onValueChange={setIsArchived}
                    trackColor={{ false: theme.border, true: theme.accent }}
                  />
                </View>

                <View style={styles.reorderRow}>
                  <Text style={[styles.switchTitle, { color: theme.textPrimary }]}>
                    {t('carousel_order')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={() => handleMoveWallet(-1)}
                      style={[
                        styles.orderBtn,
                        { backgroundColor: theme.surfaceElevated },
                      ]}
                    >
                      <Text style={{ color: theme.textPrimary, fontWeight: '800' }}>
                        {t('move_earlier')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleMoveWallet(1)}
                      style={[
                        styles.orderBtn,
                        { backgroundColor: theme.surfaceElevated },
                      ]}
                    >
                      <Text style={{ color: theme.textPrimary, fontWeight: '800' }}>
                        {t('move_later')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footerRow}>
            {editingWallet && editingWallet.id !== 'wallet-default-cash' && (
              <Pressable
                onPress={handleDelete}
                style={[styles.deleteBtn, { backgroundColor: theme.danger + '22' }]}
              >
                <Text style={{ color: theme.danger, fontWeight: '700' }}>
                  {t('delete_btn')}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleSave}
              style={[styles.saveBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={styles.saveText}>
                {editingWallet ? t('save_wallet') : t('create_wallet')}
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
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '700',
    padding: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  row: {
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
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  colorCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 6,
  },
  orderBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  switchSub: {
    fontSize: 11,
    marginTop: 2,
  },
  footerRow: {
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
  saveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

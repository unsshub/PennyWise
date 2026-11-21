import { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuickEntryModal } from '@/components/quick-entry-modal';
import { PennyWiseProvider, usePennyWise } from '@/context/pennywise-context';

function BiometricLockGate({ children }: { children: React.ReactNode }) {
  const { isAppLocked, unlockApp, theme, t } = usePennyWise();

  const handleAuthenticate = async () => {
    unlockApp();
  };

  if (!isAppLocked) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.lockContainer, { backgroundColor: theme.background }]}>
      <Text style={styles.lockIcon}>🔒</Text>
      <Text style={[styles.lockTitle, { color: theme.textPrimary }]}>
        {t('lock_title')}
      </Text>
      <Text style={[styles.lockSubtitle, { color: theme.textSecondary }]}>
        {t('lock_subtitle')}
      </Text>
      <Pressable
        onPress={handleAuthenticate}
        style={[styles.unlockButton, { backgroundColor: theme.accent }]}
      >
        <Text style={styles.unlockButtonText}>{t('lock_btn')}</Text>
      </Pressable>
    </View>
  );
}

function AppNavigationShell() {
  const { theme, openQuickEntry, t } = usePennyWise();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 16);
  const topInset = Math.max(insets.top, 12);

  return (
    <BiometricLockGate>
      <View
        style={[
          styles.root,
          { backgroundColor: theme.background, paddingTop: topInset },
        ]}
      >
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: theme.surface,
              borderTopColor: theme.border,
              height: 60 + bottomInset,
              paddingBottom: bottomInset + 6,
              paddingTop: 8,
            },
            tabBarActiveTintColor: theme.accent,
            tabBarInactiveTintColor: theme.textMuted,
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '700',
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: t('tab_home'),
              tabBarIcon: ({ color }) => (
                <Text style={{ fontSize: 18, color }}>🏠</Text>
              ),
            }}
          />
          <Tabs.Screen
            name="transactions"
            options={{
              title: t('tab_history'),
              tabBarIcon: ({ color }) => (
                <Text style={{ fontSize: 18, color }}>📋</Text>
              ),
            }}
          />
          <Tabs.Screen
            name="budgets"
            options={{
              title: t('tab_budgets'),
              tabBarIcon: ({ color }) => (
                <Text style={{ fontSize: 18, color }}>🎯</Text>
              ),
            }}
          />
          <Tabs.Screen
            name="insights"
            options={{
              title: t('tab_insights'),
              tabBarIcon: ({ color }) => (
                <Text style={{ fontSize: 18, color }}>📊</Text>
              ),
            }}
          />
          <Tabs.Screen
            name="bills"
            options={{
              title: t('tab_bills'),
              tabBarIcon: ({ color }) => (
                <Text style={{ fontSize: 18, color }}>🗓️</Text>
              ),
            }}
          />
        </Tabs>

        {/* Global Floating Quick-Entry (+) Action Button */}
        <Pressable
          onPress={() => openQuickEntry()}
          accessibilityLabel="Quick Add Transaction"
          style={[
            styles.fab,
            {
              backgroundColor: theme.accent,
              shadowColor: theme.accent,
              bottom: 74 + bottomInset,
            },
          ]}
        >
          <Text style={styles.fabText}>＋</Text>
        </Pressable>

        <QuickEntryModal />
      </View>
    </BiometricLockGate>
  );
}

export default function RootLayout() {
  return (
    <PennyWiseProvider>
      <AppNavigationShell />
    </PennyWiseProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  lockContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lockIcon: {
    fontSize: 54,
    marginBottom: 16,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  lockSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  unlockButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});

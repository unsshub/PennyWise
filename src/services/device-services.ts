import { Directory, File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { Platform, Share } from 'react-native';

import type { FinanceEngine } from '@/domain/finance-engine';
import type { UpcomingPayment } from '@/domain/types';

const BILL_CHANNEL_ID = 'pennywise-bill-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function syncLiveExchangeRates(engine: FinanceEngine): Promise<boolean> {
  const base = engine.getBaseCurrency().toLowerCase();
  try {
    const response = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`
    );
    if (!response.ok) {
      return false;
    }
    const json = (await response.json()) as Record<string, Record<string, number>>;
    const ratesFromBase = json[base];
    if (!ratesFromBase) {
      return false;
    }

    const existing = engine.listExchangeRates();
    for (const item of existing) {
      if (item.isManualOverride) {
        continue;
      }
      const lower = item.currencyCode.toLowerCase();
      const baseToCurr = ratesFromBase[lower];
      if (baseToCurr && baseToCurr > 0) {
        // 1 unit of currencyCode = (1 / baseToCurr) units of Base Currency
        engine.setExchangeRate({
          currencyCode: item.currencyCode,
          rateToBase: 1 / baseToCurr,
          isManualOverride: false,
        });
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function scheduleUpcomingBillNotifications(
  upcomingPayments: UpcomingPayment[]
): Promise<number> {
  if (Platform.OS === 'web') {
    return 0;
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(BILL_CHANNEL_ID, {
        name: 'Upcoming Bill Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    const perm = await Notifications.getPermissionsAsync();
    let granted = perm.granted;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) {
      return 0;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    let scheduledCount = 0;

    for (const bill of upcomingPayments) {
      if (bill.autoPay) {
        continue;
      }
      const [y, m, d] = bill.dueDate.split('-').map(Number);
      // 1. Advance reminder notification (when reminderDaysBefore > 0)
      if (bill.reminderDaysBefore > 0) {
        const advanceTrigger = new Date(
          y,
          m - 1,
          d - bill.reminderDaysBefore,
          9,
          0,
          0
        );
        if (advanceTrigger.getTime() > now) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `Upcoming Bill: ${bill.title}`,
              body: `${bill.title} is due in ${bill.reminderDaysBefore} day(s) (${bill.dueDate}).`,
              sound: 'default',
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: advanceTrigger,
              channelId: Platform.OS === 'android' ? BILL_CHANNEL_ID : undefined,
            },
          });
          scheduledCount++;
        }
      }
      // 2. Due-date notification on the due date itself
      const dueDayTrigger = new Date(y, m - 1, d, 9, 0, 0);
      if (dueDayTrigger.getTime() > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Bill Due Today: ${bill.title}`,
            body: `${bill.title} is due today (${bill.dueDate}).`,
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: dueDayTrigger,
            channelId: Platform.OS === 'android' ? BILL_CHANNEL_ID : undefined,
          },
        });
        scheduledCount++;
      }
    }
    return scheduledCount;
  } catch {
    return 0;
  }
}

export async function shareExportedContent(params: {
  filename: string;
  content: string;
  mimeType: string;
}): Promise<string> {
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      const blob = new Blob([params.content], { type: params.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = params.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
    return params.filename;
  }

  try {
    const dir = new Directory(Paths.document, 'exports');
    if (!dir.exists) {
      dir.create({ idempotent: true });
    }
    const file = new File(dir, params.filename);
    file.write(params.content);
    await Share.share({
      title: params.filename,
      message: params.content,
      url: file.uri,
    });
    return file.uri;
  } catch {
    await Share.share({
      title: params.filename,
      message: params.content,
    });
    return params.filename;
  }
}

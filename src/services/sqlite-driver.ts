import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { FinanceEngine } from '@/domain/finance-engine';
import type { SQLiteDriver } from '@/domain/types';

const DB_NAME = 'pennywise_v1.db';
const WEB_STORAGE_KEY = 'pennywise_web_snapshot_v1';

class WebMemorySQLiteFallbackEngine {
  /**
   * For web preview where native expo-sqlite C++ bindings are unavailable,
   * we store a lightweight in-memory relational table emulator backed by localStorage.
   */
  private tables: Record<string, Record<string, any>[]> = {
    app_settings: [],
    wallets: [],
    exchange_rates: [],
    categories: [],
    transactions: [],
    budgets: [],
    recurring_rules: [],
    standalone_upcoming_payments: [],
  };

  constructor() {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      try {
        const raw = (globalThis as any).localStorage.getItem(WEB_STORAGE_KEY);
        if (raw) {
          this.tables = { ...this.tables, ...JSON.parse(raw) };
        }
      } catch {
        // ignore storage read error
      }
    }
  }

  private persist(): void {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      try {
        (globalThis as any).localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(this.tables));
      } catch {
        // ignore storage write error
      }
    }
  }

  public createDriver(): SQLiteDriver {
    const self = this;
    return {
      exec(sql: string): void {
        if (sql.includes('DELETE FROM transactions;')) {
          self.tables.transactions = [];
          self.tables.budgets = [];
          self.tables.recurring_rules = [];
          self.tables.standalone_upcoming_payments = [];
          self.tables.categories = [];
          self.tables.wallets = [];
          self.tables.exchange_rates = [];
          self.persist();
        }
      },
      run(sql: string, params: unknown[] = []): void {
        const norm = sql.replace(/\s+/g, ' ').trim();
        if (norm.startsWith('INSERT INTO app_settings') || norm.startsWith('INSERT OR REPLACE INTO app_settings')) {
          const [key, value] = params as [string, string];
          self.tables.app_settings = self.tables.app_settings.filter((r) => r.key !== key);
          self.tables.app_settings.push({ key, value });
        } else if (norm.startsWith('INSERT OR REPLACE INTO exchange_rates')) {
          const [currency_code, base_currency_code, rate_to_base, is_manual_override, updated_at] = params;
          self.tables.exchange_rates = self.tables.exchange_rates.filter((r) => r.currency_code !== currency_code);
          self.tables.exchange_rates.push({ currency_code, base_currency_code, rate_to_base, is_manual_override, updated_at });
        } else if (norm.startsWith('INSERT INTO wallets')) {
          const [id, name, currency_code, decimal_places, initial_balance_minor, current_balance_minor, color, icon, include_in_net_worth, sort_order, is_archived] = params;
          self.tables.wallets.push({ id, name, currency_code, decimal_places, initial_balance_minor, current_balance_minor, color, icon, include_in_net_worth, sort_order, is_archived });
        } else if (norm.startsWith('UPDATE wallets SET current_balance_minor = ? WHERE id = ?')) {
          const [current_balance_minor, id] = params;
          self.tables.wallets = self.tables.wallets.map((w) => (w.id === id ? { ...w, current_balance_minor } : w));
        } else if (norm.startsWith('UPDATE wallets SET sort_order = ? WHERE id = ?')) {
          const [sort_order, id] = params;
          self.tables.wallets = self.tables.wallets.map((w) => (w.id === id ? { ...w, sort_order } : w));
        } else if (norm.startsWith('UPDATE wallets SET')) {
          const [name, currency_code, decimal_places, initial_balance_minor, current_balance_minor, color, icon, include_in_net_worth, is_archived, id] = params;
          self.tables.wallets = self.tables.wallets.map((w) =>
            w.id === id
              ? { ...w, name, currency_code, decimal_places, initial_balance_minor, current_balance_minor, color, icon, include_in_net_worth, is_archived }
              : w
          );
        } else if (norm.startsWith('DELETE FROM wallets WHERE id = ?')) {
          self.tables.wallets = self.tables.wallets.filter((w) => w.id !== params[0]);
        } else if (norm.startsWith('INSERT INTO categories')) {
          const [id, parent_id, name, flow_type, color, icon, sort_order] = params;
          self.tables.categories.push({ id, parent_id, name, flow_type, color, icon, sort_order });
        } else if (norm.startsWith('UPDATE categories SET sort_order = ? WHERE id = ?')) {
          const [sort_order, id] = params;
          self.tables.categories = self.tables.categories.map((c) => (c.id === id ? { ...c, sort_order } : c));
        } else if (norm.startsWith('UPDATE categories SET')) {
          const [name, color, icon, flow_type, id] = params;
          self.tables.categories = self.tables.categories.map((c) => (c.id === id ? { ...c, name, color, icon, flow_type } : c));
        } else if (norm.startsWith('DELETE FROM categories WHERE parent_id = ?')) {
          self.tables.categories = self.tables.categories.filter((c) => c.parent_id !== params[0]);
        } else if (norm.startsWith('DELETE FROM categories WHERE id = ?')) {
          self.tables.categories = self.tables.categories.filter((c) => c.id !== params[0]);
        } else if (norm.startsWith('INSERT INTO transactions')) {
          const [id, type, wallet_id, destination_wallet_id, amount_minor, destination_amount_minor, currency_code, decimal_places, snapshot_rate_to_base, category_id, subcategory_id, manual_budget_id, title, note, occurred_at, recurring_rule_id] = params;
          self.tables.transactions.push({ id, type, wallet_id, destination_wallet_id, amount_minor, destination_amount_minor, currency_code, decimal_places, snapshot_rate_to_base, category_id, subcategory_id, manual_budget_id, title, note, occurred_at, recurring_rule_id });
        } else if (norm.startsWith('UPDATE transactions SET snapshot_rate_to_base = ? WHERE id = ?')) {
          const [snapshot_rate_to_base, id] = params;
          self.tables.transactions = self.tables.transactions.map((t) => (t.id === id ? { ...t, snapshot_rate_to_base } : t));
        } else if (norm.startsWith('UPDATE transactions SET')) {
          const [wallet_id, destination_wallet_id, amount_minor, destination_amount_minor, currency_code, decimal_places, snapshot_rate_to_base, category_id, subcategory_id, manual_budget_id, title, note, occurred_at, id] = params;
          self.tables.transactions = self.tables.transactions.map((t) =>
            t.id === id
              ? { ...t, wallet_id, destination_wallet_id, amount_minor, destination_amount_minor, currency_code, decimal_places, snapshot_rate_to_base, category_id, subcategory_id, manual_budget_id, title, note, occurred_at }
              : t
          );
        } else if (norm.startsWith('DELETE FROM transactions WHERE id = ?')) {
          self.tables.transactions = self.tables.transactions.filter((t) => t.id !== params[0]);
        } else if (norm.startsWith('INSERT INTO budgets')) {
          const [id, name, limit_amount_minor, currency_code, decimal_places, period_type, interval_count, interval_unit, anchor_date, end_date, scope_type, filter_category_ids_json, filter_wallet_ids_json, color, icon, is_pinned_to_home, sort_order] = params;
          self.tables.budgets.push({ id, name, limit_amount_minor, currency_code, decimal_places, period_type, interval_count, interval_unit, anchor_date, end_date, scope_type, filter_category_ids_json, filter_wallet_ids_json, color, icon, is_pinned_to_home, sort_order });
        } else if (norm.startsWith('UPDATE budgets SET sort_order = ? WHERE id = ?')) {
          const [sort_order, id] = params;
          self.tables.budgets = self.tables.budgets.map((b) => (b.id === id ? { ...b, sort_order } : b));
        } else if (norm.startsWith('UPDATE budgets SET')) {
          const [name, limit_amount_minor, currency_code, decimal_places, period_type, interval_count, interval_unit, anchor_date, end_date, scope_type, filter_category_ids_json, filter_wallet_ids_json, color, icon, is_pinned_to_home, id] = params;
          self.tables.budgets = self.tables.budgets.map((b) =>
            b.id === id
              ? { ...b, name, limit_amount_minor, currency_code, decimal_places, period_type, interval_count, interval_unit, anchor_date, end_date, scope_type, filter_category_ids_json, filter_wallet_ids_json, color, icon, is_pinned_to_home }
              : b
          );
        } else if (norm.startsWith('DELETE FROM budgets WHERE id = ?')) {
          self.tables.budgets = self.tables.budgets.filter((b) => b.id !== params[0]);
        } else if (norm.startsWith('INSERT INTO recurring_rules')) {
          const [id, title, type, wallet_id, category_id, subcategory_id, amount_minor, currency_code, decimal_places, frequency, interval_count, next_due_date, auto_pay, reminder_days_before, is_active] = params;
          self.tables.recurring_rules.push({ id, title, type, wallet_id, category_id, subcategory_id, amount_minor, currency_code, decimal_places, frequency, interval_count, next_due_date, auto_pay, reminder_days_before, is_active });
        } else if (norm.startsWith('UPDATE recurring_rules SET')) {
          const [title, type, wallet_id, category_id, subcategory_id, amount_minor, currency_code, decimal_places, frequency, interval_count, next_due_date, auto_pay, reminder_days_before, is_active, id] = params;
          self.tables.recurring_rules = self.tables.recurring_rules.map((r) =>
            r.id === id
              ? { ...r, title, type, wallet_id, category_id, subcategory_id, amount_minor, currency_code, decimal_places, frequency, interval_count, next_due_date, auto_pay, reminder_days_before, is_active }
              : r
          );
        } else if (norm.startsWith('DELETE FROM recurring_rules WHERE id = ?')) {
          self.tables.recurring_rules = self.tables.recurring_rules.filter((r) => r.id !== params[0]);
        } else if (norm.startsWith('INSERT INTO standalone_upcoming_payments')) {
          const [id, title, type, wallet_id, category_id, subcategory_id, amount_minor, currency_code, decimal_places, due_date, auto_pay, reminder_days_before] = params;
          self.tables.standalone_upcoming_payments.push({ id, title, type, wallet_id, category_id, subcategory_id, amount_minor, currency_code, decimal_places, due_date, auto_pay, reminder_days_before });
        } else if (norm.startsWith('DELETE FROM standalone_upcoming_payments WHERE id = ?')) {
          self.tables.standalone_upcoming_payments = self.tables.standalone_upcoming_payments.filter((u) => u.id !== params[0]);
        }
        self.persist();
      },
      get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
        const norm = sql.replace(/\s+/g, ' ').trim();
        if (norm.includes('FROM app_settings WHERE key = ?')) {
          return self.tables.app_settings.find((r) => r.key === params[0]) as T | undefined;
        }
        if (norm.includes('FROM exchange_rates WHERE currency_code = ?')) {
          return self.tables.exchange_rates.find((r) => r.currency_code === params[0]) as T | undefined;
        }
        if (norm.includes('FROM transactions WHERE id = ?')) {
          return self.tables.transactions.find((r) => r.id === params[0]) as T | undefined;
        }
        if (norm.includes('FROM budgets WHERE id = ?')) {
          return self.tables.budgets.find((r) => r.id === params[0]) as T | undefined;
        }
        if (norm.includes('FROM recurring_rules WHERE id = ?')) {
          return self.tables.recurring_rules.find((r) => r.id === params[0]) as T | undefined;
        }
        return undefined;
      },
      all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
        const norm = sql.replace(/\s+/g, ' ').trim();
        if (norm.includes('FROM exchange_rates')) {
          return [...self.tables.exchange_rates].sort((a, b) => a.currency_code.localeCompare(b.currency_code)) as T[];
        }
        if (norm.includes('FROM wallets WHERE is_archived = 0')) {
          return self.tables.wallets
            .filter((w) => !w.is_archived)
            .sort((a, b) => a.sort_order - b.sort_order) as T[];
        }
        if (norm.includes('FROM wallets')) {
          return [...self.tables.wallets].sort((a, b) => a.sort_order - b.sort_order) as T[];
        }
        if (norm.includes('FROM categories')) {
          return [...self.tables.categories].sort((a, b) => a.sort_order - b.sort_order) as T[];
        }
        if (norm.includes('FROM transactions')) {
          return [...self.tables.transactions].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)) as T[];
        }
        if (norm.includes('FROM budgets')) {
          return [...self.tables.budgets].sort((a, b) => a.sort_order - b.sort_order) as T[];
        }
        if (norm.includes('FROM recurring_rules WHERE is_active = 1')) {
          return self.tables.recurring_rules
            .filter((r) => Boolean(r.is_active))
            .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)) as T[];
        }
        if (norm.includes('FROM recurring_rules')) {
          return [...self.tables.recurring_rules].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)) as T[];
        }
        if (norm.includes('FROM standalone_upcoming_payments WHERE auto_pay = 1 AND due_date <= ?')) {
          const refDay = String(params[0]);
          return self.tables.standalone_upcoming_payments.filter((u) => Boolean(u.auto_pay) && u.due_date <= refDay) as T[];
        }
        if (norm.includes('FROM standalone_upcoming_payments')) {
          return [...self.tables.standalone_upcoming_payments].sort((a, b) => a.due_date.localeCompare(b.due_date)) as T[];
        }
        return [];
      },
    };
  }
}

function createDeviceSQLiteDriver(): SQLiteDriver {
  if (Platform.OS !== 'web') {
    try {
      const db = SQLite.openDatabaseSync(DB_NAME);
      return {
        exec(sql: string): void {
          db.execSync(sql);
        },
        run(sql: string, params: unknown[] = []): void {
          db.runSync(sql, params as any[]);
        },
        get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
          const row = db.getFirstSync<T>(sql, params as any[]);
          return row ?? undefined;
        },
        all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
          return db.getAllSync<T>(sql, params as any[]);
        },
      };
    } catch {
      // Fallback to web/memory driver if native SQLite open fails
    }
  }

  return new WebMemorySQLiteFallbackEngine().createDriver();
}

let singletonEngine: FinanceEngine | null = null;

export function getDeviceFinanceEngine(): FinanceEngine {
  if (!singletonEngine) {
    singletonEngine = new FinanceEngine(createDeviceSQLiteDriver());
  }
  return singletonEngine;
}

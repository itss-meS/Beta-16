import { create } from 'zustand';
import { loadTable, saveRows } from '@/services/repository';
import { SETTING_KEYS } from '@/constants/categories';

export type ThemeChoice = 'system' | 'light' | 'dark';

interface SettingsState {
  loaded: boolean;
  values: Record<string, string>;
  load(): Promise<void>;
  set(key: string, value: string): Promise<void>;
  flag(key: string): boolean;
  theme(): ThemeChoice;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  loaded: false,
  values: {},
  async load() {
    const rows = await loadTable('settings_kv');
    const values: Record<string, string> = {};
    for (const row of rows) values[row.key] = row.value;
    set({ loaded: true, values });
  },
  async set(key, value) {
    set((state) => ({ values: { ...state.values, [key]: value } }));
    await saveRows('settings_kv', [{ key, value }]);
  },
  flag(key) {
    return get().values[key] === '1';
  },
  theme() {
    const value = get().values[SETTING_KEYS.theme];
    return value === 'light' || value === 'dark' ? value : 'system';
  }
}));

import { useLocalStorage } from './useLocalStorage';
import type { Settings } from '../types';

const DEFAULT_SETTINGS: Settings = {
  autoExecute: true,
  autoExecuteDelay: 500,
  executionTimeout: 5000,
  splitRatio: 60,
};

export function useSettings() {
  const [settings, setSettings] = useLocalStorage<Settings>(
    'jspad-settings',
    DEFAULT_SETTINGS
  );

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings({ ...settings, ...updates });
  };

  return {
    settings,
    updateSettings,
  };
}

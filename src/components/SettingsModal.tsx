import { useEffect } from 'react';
import type { Settings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  settings: Settings;
  onClose: () => void;
  onUpdateSettings: (settings: Partial<Settings>) => void;
}

export function SettingsModal({
  isOpen,
  settings,
  onClose,
  onUpdateSettings,
}: SettingsModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-dark-bg border border-dark-border rounded-lg p-6 w-[500px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">Settings</h2>

        <div className="space-y-6">
          {/* Execution Mode */}
          <div>
            <h3 className="text-sm font-medium mb-2">Execution Mode</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoExecute}
                onChange={(e) =>
                  onUpdateSettings({ autoExecute: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm">
                Auto-execute (runs 1.5s after typing stops)
              </span>
            </label>
          </div>

          {/* Execution Timeout */}
          <div>
            <h3 className="text-sm font-medium mb-2">Execution Timeout</h3>
            <select
              value={settings.executionTimeout}
              onChange={(e) =>
                onUpdateSettings({
                  executionTimeout: parseInt(e.target.value, 10),
                })
              }
              className="w-full bg-dark-hover border border-dark-border rounded px-3 py-2 text-sm"
            >
              <option value={3000}>3 seconds</option>
              <option value={5000}>5 seconds</option>
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
            </select>
          </div>

          {/* Keyboard Shortcuts */}
          <div>
            <h3 className="text-sm font-medium mb-2">Keyboard Shortcuts</h3>
            <div className="text-xs space-y-1 text-gray-400 font-mono">
              <div>⌘+T - New tab</div>
              <div>⌘+W - Close tab (quit if last tab)</div>
              <div>⌘+1~9 - Jump to nth tab</div>
              <div>⌘+Enter - Run code (manual mode)</div>
              <div>⌘+, - Open settings</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

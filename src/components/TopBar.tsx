
interface TopBarProps {
  autoExecute: boolean;
  onRun: () => void;
  onSettings: () => void;
}

export function TopBar({ autoExecute, onRun, onSettings }: TopBarProps) {
  return (
    <div className="h-12 bg-dark-bg border-b border-dark-border flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        {/* macOS window controls */}
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSettings}
          className="px-3 py-1.5 rounded hover:bg-dark-hover transition-colors text-sm"
          title="Settings (Cmd+,)"
        >
          ⚙️
        </button>

        {!autoExecute && (
          <button
            onClick={onRun}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-sm font-medium"
            title="Run (Cmd+Enter)"
          >
            Run ▶
          </button>
        )}
      </div>
    </div>
  );
}

import React, { useState, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { TopBar } from './components/TopBar';
import { TabBar } from './components/TabBar';
import { EditorPanel } from './components/EditorPanel';
import { ConsolePanel } from './components/ConsolePanel';
import { SettingsModal } from './components/SettingsModal';
import { useTabs } from './hooks/useTabs';
import { useSettings } from './hooks/useSettings';
import { useCodeExecution } from './hooks/useCodeExecution';
import type { ConsoleMessage } from './types';

function App() {
  const {
    tabs,
    activeTab,
    activeTabId,
    createTab,
    closeTab,
    updateTabName,
    updateTabCode,
    updateTabConsole,
    switchToTab,
    reorderTabs,
    canCreateTab,
  } = useTabs();

  const { settings, updateSettings } = useSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleConsoleOutput = useCallback(
    (output: ConsoleMessage[]) => {
      updateTabConsole(activeTabId, output);
    },
    [activeTabId, updateTabConsole]
  );

  const { executeCode } = useCodeExecution({
    code: activeTab?.code || '',
    autoExecute: settings.autoExecute,
    timeout: settings.executionTimeout,
    onOutput: handleConsoleOutput,
  });

  const handleCodeChange = useCallback(
    (code: string) => {
      updateTabCode(activeTabId, code);
    },
    [activeTabId, updateTabCode]
  );

  const handleTabClose = useCallback(
    (tabId: string) => {
      const result = closeTab(tabId);
      if (result === 'quit-app') {
        // In Tauri, we would call the quit command here
        window.close();
      }
    },
    [closeTab]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 't') {
          e.preventDefault();
          createTab();
        } else if (e.key === 'w') {
          e.preventDefault();
          handleTabClose(activeTabId);
        } else if (e.key === ',') {
          e.preventDefault();
          setIsSettingsOpen(true);
        } else if (e.key === 'Enter' && !settings.autoExecute) {
          e.preventDefault();
          executeCode();
        } else if (e.key >= '1' && e.key <= '9') {
          e.preventDefault();
          const index = parseInt(e.key, 10) - 1;
          if (tabs[index]) {
            switchToTab(tabs[index].id);
          }
        }
      }
    },
    [
      createTab,
      handleTabClose,
      activeTabId,
      settings.autoExecute,
      executeCode,
      tabs,
      switchToTab,
    ]
  );

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  if (!activeTab) {
    return <div className="w-full h-full bg-dark-bg" />;
  }

  return (
    <div className="w-full h-full bg-dark-bg flex flex-col">
      <TopBar
        autoExecute={settings.autoExecute}
        onRun={executeCode}
        onSettings={() => setIsSettingsOpen(true)}
      />

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        canCreateTab={canCreateTab}
        onTabClick={switchToTab}
        onTabClose={handleTabClose}
        onTabCreate={createTab}
        onTabRename={updateTabName}
        onTabReorder={reorderTabs}
      />

      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={settings.splitRatio} minSize={20} maxSize={80}>
            <EditorPanel
              code={activeTab.code}
              onChange={handleCodeChange}
            />
          </Panel>

          <PanelResizeHandle className="w-1 bg-dark-border hover:bg-blue-500 transition-colors" />

          <Panel minSize={20} maxSize={80}>
            <ConsolePanel output={activeTab.consoleOutput} />
          </Panel>
        </PanelGroup>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onUpdateSettings={updateSettings}
      />
    </div>
  );
}

export default App;

import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useLocalStorage } from './useLocalStorage';
import type { Tab } from '../types';

const MAX_TABS = 10;

export function useTabs() {
  const [tabs, setTabs] = useLocalStorage<Tab[]>('jspad-tabs', [
    {
      id: nanoid(),
      name: 'Untitled 1',
      code: '',
      consoleOutput: [],
    },
  ]);

  const [activeTabId, setActiveTabId] = useLocalStorage<string>(
    'jspad-active-tab',
    tabs[0]?.id || ''
  );

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];

  const createTab = useCallback(() => {
    setTabs((currentTabs) => {
      if (currentTabs.length >= MAX_TABS) return currentTabs;

      const untitledCount = currentTabs.filter(t => t.name.startsWith('Untitled')).length;
      const newTab: Tab = {
        id: nanoid(),
        name: `Untitled ${untitledCount + 1}`,
        code: '',
        consoleOutput: [],
      };

      setActiveTabId(newTab.id);
      return [...currentTabs, newTab];
    });
  }, [setTabs, setActiveTabId]);

  const closeTab = useCallback((tabId: string) => {
    let result: 'quit-app' | 'closed' = 'closed';

    setTabs((currentTabs) => {
      if (currentTabs.length === 1) {
        // Quit app logic handled by parent
        result = 'quit-app';
        return currentTabs;
      }

      const tabIndex = currentTabs.findIndex(t => t.id === tabId);
      const newTabs = currentTabs.filter(t => t.id !== tabId);

      if (activeTabId === tabId) {
        const nextIndex = Math.min(tabIndex, newTabs.length - 1);
        setActiveTabId(newTabs[nextIndex].id);
      }

      return newTabs;
    });

    return result;
  }, [activeTabId, setTabs, setActiveTabId]);

  const updateTabName = useCallback((tabId: string, name: string) => {
    setTabs((currentTabs) =>
      currentTabs.map((tab, index) =>
        tab.id === tabId
          ? { ...tab, name: name.trim() || `Untitled ${index + 1}` }
          : tab
      )
    );
  }, [setTabs]);

  const updateTabCode = useCallback((tabId: string, code: string) => {
    setTabs((currentTabs) =>
      currentTabs.map(tab =>
        tab.id === tabId ? { ...tab, code } : tab
      )
    );
  }, [setTabs]);

  const updateTabConsole = useCallback((tabId: string, consoleOutput: any[]) => {
    setTabs((currentTabs) =>
      currentTabs.map(tab =>
        tab.id === tabId ? { ...tab, consoleOutput } : tab
      )
    );
  }, [setTabs]);

  const switchToTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, [setActiveTabId]);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs((currentTabs) => {
      const newTabs = [...currentTabs];
      const [removed] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, removed);
      return newTabs;
    });
  }, [setTabs]);

  return {
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
    canCreateTab: tabs.length < MAX_TABS,
  };
}

import { useState, useCallback, useEffect } from 'react';
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
    if (tabs.length >= MAX_TABS) return;

    const untitledCount = tabs.filter(t => t.name.startsWith('Untitled')).length;
    const newTab: Tab = {
      id: nanoid(),
      name: `Untitled ${untitledCount + 1}`,
      code: '',
      consoleOutput: [],
    };

    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs, setTabs, setActiveTabId]);

  const closeTab = useCallback((tabId: string) => {
    if (tabs.length === 1) {
      // Quit app logic handled by parent
      return 'quit-app';
    }

    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      const nextIndex = Math.min(tabIndex, newTabs.length - 1);
      setActiveTabId(newTabs[nextIndex].id);
    }

    return 'closed';
  }, [tabs, activeTabId, setTabs, setActiveTabId]);

  const updateTabName = useCallback((tabId: string, name: string) => {
    setTabs(tabs.map(tab =>
      tab.id === tabId
        ? { ...tab, name: name.trim() || `Untitled ${tabs.indexOf(tab) + 1}` }
        : tab
    ));
  }, [tabs, setTabs]);

  const updateTabCode = useCallback((tabId: string, code: string) => {
    setTabs(tabs.map(tab =>
      tab.id === tabId ? { ...tab, code } : tab
    ));
  }, [tabs, setTabs]);

  const updateTabConsole = useCallback((tabId: string, consoleOutput: any[]) => {
    setTabs(tabs.map(tab =>
      tab.id === tabId ? { ...tab, consoleOutput } : tab
    ));
  }, [tabs, setTabs]);

  const switchToTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, [setActiveTabId]);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    const newTabs = [...tabs];
    const [removed] = newTabs.splice(fromIndex, 1);
    newTabs.splice(toIndex, 0, removed);
    setTabs(newTabs);
  }, [tabs, setTabs]);

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

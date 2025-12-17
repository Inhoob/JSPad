import { useState, useRef, useEffect } from 'react';
import type { Tab } from '../types';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  canCreateTab: boolean;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabCreate: () => void;
  onTabRename: (tabId: string, name: string) => void;
  onTabReorder: (fromIndex: number, toIndex: number) => void;
}

export function TabBar({
  tabs,
  activeTabId,
  canCreateTab,
  onTabClick,
  onTabClose,
  onTabCreate,
  onTabRename,
}: TabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const handleDoubleClick = (tab: Tab) => {
    setEditingTabId(tab.id);
    setEditingName(tab.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter') {
      onTabRename(tabId, editingName);
      setEditingTabId(null);
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  };

  const handleBlur = (tabId: string) => {
    if (editingName.trim()) {
      onTabRename(tabId, editingName);
    }
    setEditingTabId(null);
  };

  return (
    <div className="h-10 bg-dark-bg border-b border-dark-border flex items-center px-2 gap-1">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`
            group relative h-8 px-3 rounded flex items-center gap-2 cursor-pointer
            ${tab.id === activeTabId
              ? 'bg-dark-hover text-dark-text'
              : 'text-gray-400 hover:text-dark-text hover:bg-dark-hover/50'
            }
          `}
          onClick={() => onTabClick(tab.id)}
          onDoubleClick={() => handleDoubleClick(tab)}
        >
          {editingTabId === tab.id ? (
            <input
              ref={inputRef}
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              onBlur={() => handleBlur(tab.id)}
              className="bg-transparent outline-none w-24 text-sm"
            />
          ) : (
            <span className="text-sm select-none">{tab.name}</span>
          )}

          {tabs.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
            >
              ×
            </button>
          )}
        </div>
      ))}

      <button
        onClick={onTabCreate}
        disabled={!canCreateTab}
        className={`
          h-8 w-8 rounded flex items-center justify-center text-lg
          ${canCreateTab
            ? 'hover:bg-dark-hover text-gray-400 hover:text-dark-text'
            : 'text-gray-600 cursor-not-allowed'
          }
        `}
        title={canCreateTab ? 'New tab (Cmd+T)' : 'Maximum 10 tabs'}
      >
        +
      </button>
    </div>
  );
}

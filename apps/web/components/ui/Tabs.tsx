'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import styles from './Tabs.module.css';

export interface Tab {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  children?: React.ReactNode;
}

export default function Tabs({ tabs, activeTab, onChange, children }: TabsProps) {
  return (
    <div className={styles.tabs}>
      <div className={styles.tabList} role="tablist" aria-label="Navigation tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            data-tab={tab.id}
            className={[styles.tab, activeTab === tab.id ? styles.active : ''].join(' ')}
            onClick={() => onChange(tab.id)}
          >
            {tab.icon && <tab.icon size={15} aria-hidden="true" />}
            {tab.label}
          </button>
        ))}
      </div>
      {children && (
        <div
          className={styles.content}
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

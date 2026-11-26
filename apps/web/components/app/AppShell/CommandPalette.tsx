'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Bot, Languages, LogOut, Moon, Plus, Search, Sun, type LucideIcon } from 'lucide-react';
import { APP_NAV_ITEMS } from '@/lib/app-nav';
import { trapTab } from '@/lib/focus-trap';
import { useTranslation } from '@/hooks/useTranslation';
import { getChannelMeta } from '@/components/app/Inbox/channelMeta';
import type { ShellAgent } from './useShellData';
import styles from './CommandPalette.module.css';

export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

interface PaletteGroup {
  id: 'goto' | 'actions' | 'agents';
  label: string;
  commands: PaletteCommand[];
}

export interface CommandPaletteProps {
  onClose: () => void;
  navigate: (href: string) => void;
  theme: 'light' | 'dark' | null;
  onToggleTheme: () => void;
  otherLanguage: 'es' | 'en';
  onToggleLanguage: () => void;
  onLogout: () => void;
  agents: ShellAgent[] | null;
}

/** Sin tildes ni mayúsculas: "facturacion" encuentra "Facturación". */
export function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export default function CommandPalette({
  onClose,
  navigate,
  theme,
  onToggleTheme,
  otherLanguage,
  onToggleLanguage,
  onLogout,
  agents,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const baseId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const groups = useMemo<PaletteGroup[]>(() => {
    const dark = theme === 'dark';
    const all: PaletteGroup[] = [
      {
        id: 'goto',
        label: t('shell.palette.goTo'),
        commands: APP_NAV_ITEMS.map((item) => ({
          id: `goto-${item.id}`,
          label: t(item.labelKey),
          icon: item.icon,
          run: () => navigate(item.href),
        })),
      },
      {
        id: 'actions',
        label: t('shell.palette.actions'),
        commands: [
          { id: 'create-agent', label: t('shell.palette.createAgent'), icon: Plus, run: () => navigate('/dashboard/agents/new') },
          { id: 'theme', label: dark ? t('shell.palette.toLight') : t('shell.palette.toDark'), icon: dark ? Sun : Moon, run: onToggleTheme },
          {
            id: 'language',
            label: t('shell.palette.toLanguage', { language: t(`shell.languages.${otherLanguage}`) }),
            icon: Languages,
            run: onToggleLanguage,
          },
          { id: 'logout', label: t('shell.palette.logout'), icon: LogOut, run: onLogout },
        ],
      },
      {
        id: 'agents',
        label: t('shell.palette.agents'),
        commands: (agents ?? []).map((agent) => ({
          id: `agent-${agent.id}`,
          label: agent.name,
          hint: agent.channels.length ? agent.channels.map((c) => getChannelMeta(c).label).join(' · ') : undefined,
          icon: Bot,
          run: () => navigate(`/dashboard/agents/${agent.id}`),
        })),
      },
    ];
    const q = normalize(query);
    return all
      .map((group) => ({
        ...group,
        commands: q
          ? group.commands.filter((c) => normalize(`${c.label} ${c.hint ?? ''}`).includes(q))
          : group.commands,
      }))
      .filter((group) => group.commands.length > 0);
  }, [t, theme, otherLanguage, agents, query, navigate, onToggleTheme, onToggleLanguage, onLogout]);

  const flat = useMemo(() => groups.flatMap((g) => g.commands), [groups]);
  const current = Math.min(activeIndex, Math.max(flat.length - 1, 0));
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${current}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  function run(command: PaletteCommand | undefined) {
    if (!command) return;
    onClose();
    command.run();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (flat.length === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current + step + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(flat[current]);
    } else {
      trapTab(e, dialogRef.current);
    }
  }

  let index = -1;
  const listId = `${baseId}-list`;

  return (
    <div
      className={styles.scrim}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('shell.palette.label')}
        className={styles.dialog}
        onKeyDown={onKeyDown}
      >
        <div className={styles.field}>
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={flat.length ? optionId(current) : undefined}
            aria-label={t('shell.palette.input')}
            placeholder={t('shell.palette.label')}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
          />
          <kbd className={styles.kbd}>Esc</kbd>
        </div>

        <div ref={listRef} id={listId} role="listbox" aria-label={t('shell.palette.label')} className={styles.list}>
          {groups.map((group) => {
            const headingId = `${baseId}-${group.id}`;
            return (
              <div key={group.id} role="group" aria-labelledby={headingId}>
                <span id={headingId} className={styles.groupTitle} role="presentation">{group.label}</span>
                {group.commands.map((command) => {
                  index += 1;
                  const i = index;
                  const selected = i === current;
                  const Icon = command.icon;
                  return (
                    <div
                      key={command.id}
                      id={optionId(i)}
                      data-index={i}
                      role="option"
                      aria-selected={selected}
                      className={`${styles.option} ${selected ? styles.selected : ''}`}
                      onMouseMove={() => {
                        if (!selected) setActiveIndex(i);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => run(command)}
                    >
                      <Icon size={17} className={styles.icon} aria-hidden="true" />
                      <span className={styles.label}>{command.label}</span>
                      {command.hint && <small className={styles.hint}>{command.hint}</small>}
                      {selected && <kbd className={styles.kbd} aria-hidden="true">Enter</kbd>}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {flat.length === 0 && (
            <p className={styles.empty} role="status">{t('shell.palette.empty')}</p>
          )}
        </div>

        <div className={styles.foot} aria-hidden="true">
          <span>{t('shell.palette.hintMove')}</span>
          <span>{t('shell.palette.hintOpen')}</span>
          <span>{t('shell.palette.hintClose')}</span>
        </div>
      </div>
    </div>
  );
}

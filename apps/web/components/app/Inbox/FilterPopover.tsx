'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { trapTab } from '@/lib/focus-trap';
import { useTranslation } from '@/hooks/useTranslation';
import CheckList, { type CheckOption } from './CheckList';
import type { InboxFilters } from './types';
import styles from './FilterPopover.module.css';

export interface FilterPopoverProps {
  filters: InboxFilters;
  channels: CheckOption[];
  agents: CheckOption[];
  labels: CheckOption[];
  onChange: (patch: Partial<InboxFilters>) => void;
  onClose: () => void;
  /** El botón que lo abrió: el foco vuelve a él y un clic en él no cuenta como "afuera". */
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  id: string;
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Panel de filtros (web-44): Canal, Agente, Etiqueta y Puntaje 7 o más. Se aplica al marcar, sin botón
 * "Aplicar". Esc o un clic afuera lo cierran y el foco vuelve al botón; el foco queda atrapado adentro.
 */
export default function FilterPopover({ filters, channels, agents, labels, onChange, onClose, anchorRef, id }: FilterPopoverProps) {
  const { t } = useTranslation();
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    boxRef.current?.querySelector<HTMLElement>('input')?.focus();
    const anchor = anchorRef.current;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (boxRef.current?.contains(target) || anchor?.contains(target)) return;
      closeRef.current();
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      if (anchor?.isConnected) anchor.focus();
    };
  }, [anchorRef]);

  return (
    <div
      ref={boxRef}
      id={id}
      className={styles.pop}
      role="dialog"
      aria-label={t('inbox.filters.title')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeRef.current();
        } else {
          trapTab(e, boxRef.current);
        }
      }}
    >
      {channels.length > 0 && (
        <CheckList
          legend={t('inbox.filters.channel')}
          options={channels}
          selected={filters.channels}
          onToggle={(v) => onChange({ channels: toggle(filters.channels, v) })}
        />
      )}
      {agents.length > 0 && (
        <CheckList
          legend={t('inbox.filters.agent')}
          options={agents}
          selected={filters.agentIds}
          onToggle={(v) => onChange({ agentIds: toggle(filters.agentIds, v) })}
        />
      )}
      <CheckList
        legend={t('inbox.filters.label')}
        options={labels}
        selected={filters.labelIds}
        onToggle={(v) => onChange({ labelIds: toggle(filters.labelIds, v) })}
        searchPlaceholder={t('inbox.filters.labelSearch')}
        emptyText={t('inbox.filters.noLabels')}
      />
      <fieldset className={styles.score}>
        <legend className={styles.legend}>{t('inbox.filters.score')}</legend>
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={filters.minScore === 7}
            onChange={() => onChange({ minScore: filters.minScore === 7 ? null : 7 })}
          />
          <span>{t('inbox.filters.score7')}</span>
        </label>
      </fieldset>
    </div>
  );
}

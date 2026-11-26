'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { CircleCheckBig, Inbox, Menu, RefreshCw, Search, SearchX, TriangleAlert, User, type LucideIcon } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import InboxButton from './InboxButton';
import InboxRow from './InboxRow';
import { mineGroup } from './inboxFormat';
import { CLOSE_OUTCOMES, type CloseOutcome, type ConversationRow, type InboxView } from './types';
import styles from './InboxList.module.css';

export interface InboxListProps {
  title: string;
  view: InboxView;
  /** Hay un agente o canal elegido (cambia el texto del estado vacío). */
  scoped: boolean;
  allTime: boolean;
  showPeriod: boolean;
  onPeriod: (allTime: boolean) => void;
  /** "Cerradas" (web-42): filtro por resultado; null = todos. */
  outcome?: CloseOutcome | null;
  onOutcome?: (outcome: CloseOutcome | null) => void;
  /** Zona de la organización (la hora en que vuelve una pospuesta). */
  timeZone?: string;
  search: string;
  onSearch: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  rows: ConversationRow[];
  loading: boolean;
  error: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  currentId: string | null;
  onOpen: (id: string) => void;
  userId: string | undefined;
  now: number;
  /** Bajo 1180 px: abre el cajón con el riel de la Bandeja. */
  onOpenRail?: () => void;
  railOpen?: boolean;
}

const EMPTY_ICON: Record<InboxView, LucideIcon> = { all: Inbox, needs: CircleCheckBig, mine: User, closed: CircleCheckBig };

export default function InboxList({ searchRef, onLoadMore, ...props }: InboxListProps) {
  const { t } = useTranslation();
  const { rows, view, loading, error, hasMore, loadingMore } = props;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(onLoadMore);
  useLayoutEffect(() => {
    loadMoreRef.current = onLoadMore;
  });

  // Al llegar al final con el scroll se pide la página siguiente
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMoreRef.current();
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, rows.length]);

  const renderRows = (list: ConversationRow[]) =>
    list.map((row) => (
      <li key={row.id}>
        <InboxRow
          row={row}
          current={row.id === props.currentId}
          userId={props.userId}
          now={props.now}
          onOpen={props.onOpen}
          timeZone={props.timeZone}
          showOutcome={view === 'closed'}
        />
      </li>
    ));

  let body: React.ReactNode;
  if (loading) {
    body = (
      <div aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className={styles.skeleton}>
            <i className={styles.skAvatar} />
            <div>
              <i className={`${styles.skLine} ${styles.skShort}`} />
              <i className={styles.skLine} />
              <i className={`${styles.skLine} ${styles.skTiny}`} />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (error) {
    body = (
      <div className={styles.state} role="alert">
        <span className={`${styles.stateIcon} ${styles.stateIconBad}`}>
          <TriangleAlert size={24} aria-hidden="true" />
        </span>
        <b>{t('inbox.list.errorTitle')}</b>
        <p>{t('inbox.list.errorText')}</p>
        <InboxButton variant="primary" icon={RefreshCw} onClick={props.onRetry}>
          {t('inbox.retry')}
        </InboxButton>
      </div>
    );
  } else if (rows.length === 0) {
    const searching = !!props.search.trim();
    const key = searching ? 'search' : props.scoped && view === 'all' ? 'scoped' : view;
    const Icon = searching ? SearchX : EMPTY_ICON[view];
    body = (
      <div className={styles.state}>
        <span className={styles.stateIcon}>
          <Icon size={24} aria-hidden="true" />
        </span>
        <b>{t(`inbox.empty.${key}.title`, { query: props.search.trim() })}</b>
        <p>{t(`inbox.empty.${key}.text`)}</p>
        {searching && (
          <InboxButton onClick={() => props.onSearch('')}>{t('inbox.list.clearSearch')}</InboxButton>
        )}
      </div>
    );
  } else if (view === 'all' && !props.search.trim()) {
    const help = rows.filter((r) => r.needsAttention);
    const fine = rows.filter((r) => !r.needsAttention);
    body = (
      <>
        {help.length > 0 && (
          <section aria-labelledby="inbox-group-help">
            <h2 id="inbox-group-help" className={`${styles.group} ${styles.groupUrgent}`}>
              <TriangleAlert size={13} aria-hidden="true" />
              {t('inbox.list.groupHelp')}
            </h2>
            <ul className={styles.rows}>{renderRows(help)}</ul>
          </section>
        )}
        {fine.length > 0 && (
          <section aria-labelledby="inbox-group-fine">
            <h2 id="inbox-group-fine" className={styles.group}>
              {t('inbox.list.groupFine')}
            </h2>
            <ul className={styles.rows}>{renderRows(fine)}</ul>
          </section>
        )}
      </>
    );
  } else if (view === 'mine' && !props.search.trim()) {
    // Como en el prototipo: Seguimiento para hoy, En curso y Pospuestas (solo los grupos con algo)
    const groups = (['followUp', 'active', 'snoozed'] as const)
      .map((key) => ({ key, rows: rows.filter((r) => mineGroup(r) === key) }))
      .filter((g) => g.rows.length > 0);
    body = (
      <>
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`inbox-group-${g.key}`}>
            <h2 id={`inbox-group-${g.key}`} className={`${styles.group} ${g.key === 'followUp' ? styles.groupUrgent : ''}`}>
              {t(`inbox.list.mineGroups.${g.key}`)}
              <span className={styles.groupCount}>{g.rows.length}</span>
            </h2>
            <ul className={styles.rows}>{renderRows(g.rows)}</ul>
          </section>
        ))}
      </>
    );
  } else {
    body = <ul className={styles.rows}>{renderRows(rows)}</ul>;
  }

  return (
    <section className={styles.list} aria-label={t('inbox.list.label')}>
      <div className={styles.top}>
        <div className={styles.topLine}>
          {props.onOpenRail && (
            <InboxButton
              variant="icon"
              icon={Menu}
              className={styles.railButton}
              onClick={props.onOpenRail}
              aria-label={t('inbox.list.openRail')}
              aria-expanded={props.railOpen}
              aria-haspopup="dialog"
            />
          )}
          <h1 className={styles.title}>{props.title}</h1>
        </div>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            placeholder={t('inbox.list.searchPlaceholder')}
            aria-label={t('inbox.list.searchLabel')}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && props.search) {
                e.stopPropagation();
                props.onSearch('');
              }
            }}
          />
          <kbd className={styles.kbd} aria-hidden="true">
            /
          </kbd>
        </label>
        {view === 'closed' && props.onOutcome && (
          <div className={styles.outcomes} role="group" aria-label={t('inbox.list.outcomeFilter')}>
            {([null, ...CLOSE_OUTCOMES] as const).map((o) => (
              <button
                key={o ?? 'all'}
                type="button"
                aria-pressed={(props.outcome ?? null) === o}
                onClick={() => props.onOutcome?.(o)}
              >
                {o ? t(`inbox.outcomes.${o}`) : t('inbox.list.outcomeAll')}
              </button>
            ))}
          </div>
        )}
        {props.showPeriod && (
          <div className={styles.period} role="group" aria-label={t('inbox.list.period')}>
            <span>{t('inbox.list.period')}</span>
            <button type="button" aria-pressed={!props.allTime} onClick={() => props.onPeriod(false)}>
              {t('inbox.list.last8days')}
            </button>
            <button type="button" aria-pressed={props.allTime} onClick={() => props.onPeriod(true)}>
              {t('inbox.list.allTime')}
            </button>
          </div>
        )}
      </div>
      <div className={styles.scroll} aria-busy={loading || undefined}>
        {body}
        {!loading && !error && hasMore && (
          <div ref={sentinelRef} className={styles.more}>
            <InboxButton onClick={onLoadMore} loading={loadingMore}>
              {t('inbox.list.loadMore')}
            </InboxButton>
          </div>
        )}
      </div>
    </section>
  );
}

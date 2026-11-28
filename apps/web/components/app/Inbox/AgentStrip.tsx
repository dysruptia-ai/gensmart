'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PauseCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import InboxButton from './InboxButton';
import InboxDialog from './InboxDialog';
import InboxNotice from './InboxNotice';
import InboxSwitch from './InboxSwitch';
import { sinceLabel } from './inboxFormat';
import styles from './AgentStrip.module.css';

export interface AgentPause {
  pausedAt: string | null;
  pausedByName: string | null;
}

interface AgentStats {
  today: number;
  solvedAlone: number;
  askedHelp: number;
}

export interface AgentStripProps {
  agentId: string;
  agentName: string;
  pause: AgentPause;
  onPaused: (next: AgentPause) => void;
  isManager: boolean;
  /** false en Solo: el interruptor se ve bloqueado. */
  canPause: boolean;
  /** Cuántas personas del equipo están en línea (para el diálogo). */
  onlineCount: number | null;
  openCount: number;
  timeZone?: string;
  now: number;
  /** Cambia cuando llega algo nuevo: recarga los números. */
  refreshKey?: unknown;
}

/** Vista de un agente (web-45, mockup Pausa): los números del día y pausar o reactivar. */
export default function AgentStrip(props: AgentStripProps) {
  const { t, language } = useTranslation();
  const { agentId, pause, isManager, canPause } = props;
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const paused = !!pause.pausedAt;

  useEffect(() => {
    let alive = true;
    api
      .get<AgentStats>(`/api/conversations/agent-stats?agentId=${encodeURIComponent(agentId)}`)
      .then((s) => alive && setStats(s))
      .catch(() => alive && setStats(null));
    return () => {
      alive = false;
    };
  }, [agentId, props.refreshKey]);

  async function setPaused(next: boolean) {
    setBusy(true);
    setError(false);
    try {
      const r = await api.patch<{ inboxPausedAt: string | null; inboxPausedByName: string | null }>(
        `/api/agents/${encodeURIComponent(agentId)}/inbox-pause`,
        { paused: next },
      );
      props.onPaused({ pausedAt: r.inboxPausedAt, pausedByName: r.inboxPausedByName });
      setConfirm(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const switchLabel = paused ? t('inbox.pause.paused') : t('inbox.pause.active');
  const lockedId = `agent-locked-${agentId}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.strip}>
        {(
          [
            ['today', stats?.today],
            ['solvedAlone', stats?.solvedAlone],
            ['askedHelp', stats?.askedHelp],
          ] as const
        ).map(([key, value]) => (
          <div key={key}>
            <b>{value ?? '–'}</b>
            <span>{t(`inbox.pause.stats.${key}`)}</span>
          </div>
        ))}
      </div>

      <div className={styles.switchRow}>
        <span>
          <b>{switchLabel}</b>
          <small id={`agent-sw-help-${agentId}`}>{paused ? t('inbox.pause.pausedHelp') : t('inbox.pause.activeHelp')}</small>
          {!canPause && (
            <small id={lockedId} className={styles.locked}>
              {t('inbox.pause.solo')}{' '}
              <Link href="/dashboard/billing" className={styles.link}>
                {t('inbox.pause.seePlans')}
              </Link>
            </small>
          )}
        </span>
        <InboxSwitch
          checked={!paused}
          label={t('inbox.pause.switchLabel', { agent: props.agentName })}
          describedBy={canPause ? `agent-sw-help-${agentId}` : lockedId}
          locked={!canPause}
          disabled={canPause && (!isManager || busy)}
          onChange={(on) => (on ? void setPaused(false) : setConfirm(true))}
        />
      </div>

      {paused && (
        <InboxNotice tone="warn" icon={PauseCircle}>
          <b>{t('inbox.pause.pausedBy', { name: pause.pausedByName ?? t('inbox.row.team') })}</b>{' '}
          {t('inbox.pause.pausedSince', { since: sinceLabel(pause.pausedAt!, language, t, props.timeZone, props.now) })}
        </InboxNotice>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {t('inbox.pause.error')}
        </p>
      )}

      {confirm && (
        <InboxDialog
          title={t('inbox.pause.confirmTitle', { agent: props.agentName })}
          onClose={() => setConfirm(false)}
          initialFocusRef={cancelRef}
          footer={
            <>
              <InboxButton ref={cancelRef} onClick={() => setConfirm(false)}>
                {t('inbox.settings.cancel')}
              </InboxButton>
              <InboxButton variant="primary" onClick={() => void setPaused(true)} loading={busy}>
                {t('inbox.pause.confirm')}
              </InboxButton>
            </>
          }
        >
          <p>{t('inbox.pause.confirmText')}</p>
          <p>{t('inbox.pause.confirmOpen')}</p>
          {props.onlineCount !== null &&
            (props.onlineCount > 0 ? (
              <p>{t('inbox.pause.online', { count: props.onlineCount })}</p>
            ) : (
              <InboxNotice tone="warn" icon={PauseCircle}>
                {t('inbox.pause.nobodyOnline')}
              </InboxNotice>
            ))}
        </InboxDialog>
      )}
    </div>
  );
}

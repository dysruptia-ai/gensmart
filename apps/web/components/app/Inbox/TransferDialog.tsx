'use client';

import React, { useEffect, useId, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import ChoiceList from './ChoiceList';
import InboxButton from './InboxButton';
import InboxDialog from './InboxDialog';
import type { TeamMember } from './types';
import styles from './TransferDialog.module.css';

const NOTE_MAX = 500;
const AGENT = '__agent';

export interface TransferDialogProps {
  contactName: string;
  agentName: string | null;
  userId: string | undefined;
  /** Quién la tiene ahora (no aparece en la lista: ya la tiene). */
  holderId: string | null;
  /** Solo si está tomada se ofrece "Devolver al agente". */
  canReturnToAgent: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (toUserId: string | null, toName: string | null, note: string) => void;
}

/** "Transferir conversación" (web-42): a otra persona del equipo o de vuelta al agente, con una nota opcional. */
export default function TransferDialog(props: TransferDialogProps) {
  const { t } = useTranslation();
  const noteId = useId();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get<TeamMember[]>('/api/organization/members')
      .then((list) => {
        if (!alive) return;
        setFailed(false);
        setMembers(list.filter((m) => m.id !== props.userId && m.id !== props.holderId));
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [props.userId, props.holderId, attempt]);

  const options = [
    ...(members ?? []).map((m) => ({
      value: m.id,
      label: m.name?.trim() || m.email,
      hint: t(`inbox.transferDialog.roles.${m.role === 'owner' || m.role === 'admin' ? m.role : 'member'}`),
    })),
    ...(props.canReturnToAgent
      ? [
          {
            value: AGENT,
            label: t('inbox.transferDialog.toAgent'),
            hint: props.agentName ? t('inbox.transferDialog.toAgentHint', { agent: props.agentName }) : undefined,
          },
        ]
      : []),
  ];
  const selected = choice ?? options[0]?.value ?? null;
  const ready = members !== null && selected !== null;

  const confirm = () => {
    if (!selected) return;
    if (selected === AGENT) {
      props.onConfirm(null, null, note);
      return;
    }
    const m = members?.find((x) => x.id === selected);
    props.onConfirm(selected, m?.name ?? m?.email ?? null, note);
  };

  return (
    <InboxDialog
      title={t('inbox.transferDialog.title')}
      onClose={props.onCancel}
      footer={
        <>
          <InboxButton onClick={props.onCancel}>{t('inbox.transferDialog.cancel')}</InboxButton>
          <InboxButton variant="primary" onClick={confirm} loading={props.busy} disabled={!ready}>
            {t('inbox.transferDialog.confirm')}
          </InboxButton>
        </>
      }
    >
      <p>{t('inbox.transferDialog.text', { name: props.contactName })}</p>
      {failed ? (
        <div className={styles.state} role="alert">
          <span>{t('inbox.transferDialog.loadError')}</span>
          <InboxButton icon={RefreshCw} onClick={() => setAttempt((n) => n + 1)}>
            {t('inbox.retry')}
          </InboxButton>
        </div>
      ) : members === null ? (
        <div className={styles.state} aria-busy="true">
          {t('inbox.transferDialog.loading')}
        </div>
      ) : (
        <>
          {members.length === 0 && <div className={styles.state}>{t('inbox.transferDialog.noTeam')}</div>}
          {options.length > 0 && (
            <ChoiceList
              name="inbox-transfer-to"
              legend={t('inbox.transferDialog.legend')}
              value={selected}
              onChange={setChoice}
              options={options}
            />
          )}
        </>
      )}
      <label className={styles.field} htmlFor={noteId}>
        <span>{t('inbox.transferDialog.noteLabel')}</span>
        <textarea
          id={noteId}
          rows={3}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('inbox.transferDialog.notePlaceholder')}
          aria-describedby={`${noteId}-count`}
        />
        <small id={`${noteId}-count`} className={styles.count}>
          {t('inbox.transferDialog.noteCount', { n: note.length, max: NOTE_MAX })}
        </small>
      </label>
    </InboxDialog>
  );
}

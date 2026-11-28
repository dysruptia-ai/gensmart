'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import InboxButton from './InboxButton';
import InboxSwitch from './InboxSwitch';
import type { AssignmentMode, InboxSettingsResponse } from './useInboxSettings';
import styles from './InboxSettings.module.css';

const MODES: AssignmentMode[] = ['rotating', 'agent', 'none'];

interface MemberDraft {
  capacity: string;
  receives: boolean;
}

export interface AssignmentSettingsProps {
  data: InboxSettingsResponse;
  onSaved: (next: InboxSettingsResponse) => void;
  isManager: boolean;
  userId: string | undefined;
}

function roleLabel(role: string, t: (k: string) => string): string {
  return role === 'owner' || role === 'admin' ? t(`inbox.settings.roles.${role}`) : t('inbox.settings.roles.member');
}

/** Ajustes › Asignación (web-45, mockup Main). Owner y admin editan; los miembros solo leen. */
export default function AssignmentSettings({ data, onSaved, isManager, userId }: AssignmentSettingsProps) {
  const { t } = useTranslation();
  const solo = !data.canTakeOver;
  const readOnly = !isManager || solo;

  const [mode, setMode] = useState<AssignmentMode>(data.settings.assignmentMode);
  const [keepLast, setKeepLast] = useState(data.settings.keepLastPerson);
  const initialMembers = useMemo(
    () => Object.fromEntries(data.team.map((m) => [m.userId, { capacity: String(m.capacity), receives: m.receives }])),
    [data.team],
  );
  const [members, setMembers] = useState<Record<string, MemberDraft>>(initialMembers);
  const initialAssignees = useMemo(() => Object.fromEntries(data.agentAssignees.map((a) => [a.agentId, a.userId])), [data.agentAssignees]);
  const [assignees, setAssignees] = useState<Record<string, string | null>>(initialAssignees);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'saved' | 'error' | null>(null);

  const capacityError = (userId: string): boolean => {
    const raw = members[userId]?.capacity ?? '';
    const n = Number(raw);
    return !/^\d+$/.test(raw) || n < 1 || n > 100;
  };

  const changedMembers = data.team.filter((m) => {
    const d = members[m.userId];
    return d && (d.capacity !== String(m.capacity) || d.receives !== m.receives);
  });
  const changedAssignees = data.agentAssignees.filter((a) => (assignees[a.agentId] ?? null) !== a.userId);
  const dirty =
    mode !== data.settings.assignmentMode ||
    keepLast !== data.settings.keepLastPerson ||
    changedMembers.length > 0 ||
    changedAssignees.length > 0;
  const invalid = data.team.some((m) => capacityError(m.userId));

  async function save() {
    if (!dirty || invalid || readOnly) return;
    setSaving(true);
    setStatus(null);
    try {
      const next = await api.put<InboxSettingsResponse>('/api/inbox-settings', {
        assignmentMode: mode,
        keepLastPerson: keepLast,
        members: changedMembers.map((m) => ({
          userId: m.userId,
          capacity: Number(members[m.userId]!.capacity),
          receives: members[m.userId]!.receives,
        })),
        agentAssignees: changedAssignees.map((a) => ({ agentId: a.agentId, userId: assignees[a.agentId] ?? null })),
      });
      onSaved(next);
      setStatus('saved');
    } catch (err) {
      setStatus('error');
      if (err instanceof ApiError && err.code === 'PLAN_LIMIT') setMode('none');
    } finally {
      setSaving(false);
    }
  }

  const memberName = (id: string | null) => data.team.find((m) => m.userId === id)?.name ?? t('inbox.row.team');

  return (
    <div className={styles.tabStack}>
      {solo && (
        <div className={styles.planNotice} role="status">
          <Lock size={16} aria-hidden="true" />
          <span>
            <b>{t('inbox.settings.assign.soloTitle')}</b> {t('inbox.settings.assign.soloText')}{' '}
            <Link href="/dashboard/billing" className={styles.inlineLink}>
              {t('inbox.settings.assign.soloLink')}
            </Link>
          </span>
        </div>
      )}

      <section className={`${styles.card} ${styles.cardWide}`} aria-labelledby="assign-title">
        <div>
          <h2 id="assign-title" className={styles.cardTitle}>
            {t('inbox.settings.assign.title')}
          </h2>
          <p className={styles.cardText}>{t('inbox.settings.assign.text')}</p>
        </div>
        <fieldset className={styles.options} disabled={readOnly}>
          <legend className="gsSr">{t('inbox.settings.assign.title')}</legend>
          {MODES.map((m) => (
            <label key={m} className={styles.option}>
              <input type="radio" name="assignment-mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
              <span>
                <b>{t(`inbox.settings.assign.modes.${m}.title`)}</b>
                <small>{t(`inbox.settings.assign.modes.${m}.text`)}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className={styles.switchRow}>
          <span id="keep-last-label">
            {t('inbox.settings.assign.keepLast')}
            <small id="keep-last-help">{t('inbox.settings.assign.keepLastHelp')}</small>
          </span>
          <InboxSwitch
            checked={keepLast}
            onChange={setKeepLast}
            label={t('inbox.settings.assign.keepLast')}
            describedBy="keep-last-help"
            disabled={readOnly}
          />
        </div>
      </section>

      <section className={`${styles.card} ${styles.cardWide}`} aria-labelledby="team-title">
        <h2 id="team-title" className={styles.cardTitle}>
          {t('inbox.settings.assign.team')}
        </h2>
        <table className={`${styles.table} ${styles.teamTable}`}>
          <thead>
            <tr>
              <th scope="col">{t('inbox.settings.assign.cols.name')}</th>
              <th scope="col">{t('inbox.settings.assign.cols.role')}</th>
              <th scope="col">{t('inbox.settings.assign.cols.status')}</th>
              <th scope="col" className={styles.num}>
                {t('inbox.settings.assign.cols.open')}
              </th>
              <th scope="col">{t('inbox.settings.assign.cols.capacity')}</th>
              <th scope="col">{t('inbox.settings.assign.cols.receives')}</th>
            </tr>
          </thead>
          <tbody>
            {data.team.map((m) => {
              const d = members[m.userId] ?? { capacity: String(m.capacity), receives: m.receives };
              const name = m.name ?? t('inbox.row.team');
              const full = m.openCount >= (Number(d.capacity) || m.capacity);
              const capErr = capacityError(m.userId);
              return (
                <tr key={m.userId}>
                  <td data-label={t('inbox.settings.assign.cols.name')} className={styles.strong}>
                    {m.userId === userId ? t('inbox.settings.assign.you', { name }) : name}
                  </td>
                  <td data-label={t('inbox.settings.assign.cols.role')}>{roleLabel(m.role, t)}</td>
                  <td data-label={t('inbox.settings.assign.cols.status')}>
                    <span className={`${styles.presence} ${m.online ? styles.presenceOn : ''}`}>
                      <i aria-hidden="true" />
                      {m.online ? t('inbox.settings.assign.online') : t('inbox.settings.assign.offline')}
                    </span>
                  </td>
                  <td data-label={t('inbox.settings.assign.cols.open')} className={styles.num}>
                    {m.openCount}
                    {full && <span className={styles.full}> · {t('inbox.settings.assign.full')}</span>}
                  </td>
                  <td data-label={t('inbox.settings.assign.cols.capacity')}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      className={`${styles.inlineInput} ${styles.capInput} ${capErr ? styles.invalid : ''}`}
                      value={d.capacity}
                      disabled={readOnly}
                      aria-label={t('inbox.settings.assign.capacityOf', { name })}
                      aria-invalid={capErr || undefined}
                      aria-describedby={capErr ? `cap-err-${m.userId}` : undefined}
                      onChange={(e) => setMembers((prev) => ({ ...prev, [m.userId]: { ...d, capacity: e.target.value } }))}
                    />
                    {capErr && (
                      <span id={`cap-err-${m.userId}`} className={styles.error}>
                        {t('inbox.settings.assign.capacityError')}
                      </span>
                    )}
                  </td>
                  <td data-label={t('inbox.settings.assign.cols.receives')}>
                    <InboxSwitch
                      checked={d.receives}
                      onChange={(v) => setMembers((prev) => ({ ...prev, [m.userId]: { ...d, receives: v } }))}
                      label={t('inbox.settings.assign.receivesOf', { name })}
                      disabled={readOnly}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {mode === 'agent' && (
          <div className={styles.assignees}>
            <h3 className={styles.subTitle}>{t('inbox.settings.assign.byAgentTitle')}</h3>
            {data.agentAssignees.length === 0 ? (
              <p className={styles.cardText}>{t('inbox.settings.assign.noAgents')}</p>
            ) : (
              <ul className={styles.assigneeList}>
                {data.agentAssignees.map((a) => (
                  <li key={a.agentId}>
                    <label htmlFor={`assignee-${a.agentId}`} className={styles.strong}>
                      {a.agentName}
                    </label>
                    <select
                      id={`assignee-${a.agentId}`}
                      className={styles.select}
                      value={assignees[a.agentId] ?? ''}
                      disabled={readOnly}
                      onChange={(e) => setAssignees((prev) => ({ ...prev, [a.agentId]: e.target.value || null }))}
                    >
                      <option value="">{t('inbox.settings.assign.noAssignee')}</option>
                      {data.team.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {memberName(m.userId)}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className={styles.help}>{t('inbox.settings.assign.nobody')}</p>
      </section>

      <footer className={`${styles.saveBar} ${styles.cardWide}`}>
        <p className={styles.help}>{t('inbox.settings.managersOnly')}</p>
        {status && (
          <span role="status" className={status === 'error' ? styles.error : styles.saved}>
            {status === 'error' ? t('inbox.settings.saveError') : t('inbox.settings.saved')}
          </span>
        )}
        {isManager && (
          <InboxButton variant="primary" onClick={save} disabled={!dirty || invalid || readOnly} loading={saving}>
            {t('inbox.settings.saveChanges')}
          </InboxButton>
        )}
      </footer>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Clock, Copy } from 'lucide-react';
import {
  BUSINESS_DAYS,
  DEFAULT_PROPOSED_HOURS,
  hhmmToMinutes,
  isOpenAt,
  isValidHHMM,
  nextOpening,
  type BusinessDay,
  type BusinessHours,
  type DayHours,
} from '@gensmart/shared';
import { api, ApiError } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import InboxButton from './InboxButton';
import InboxSwitch from './InboxSwitch';
import { formatOpening } from './inboxFormat';
import type { InboxSettingsResponse } from './useInboxSettings';
import styles from './InboxSettings.module.css';

type DayDraft = Record<BusinessDay, DayHours | null>;
const WEEKDAYS: BusinessDay[] = ['2', '3', '4', '5'];

function toDraft(hours: BusinessHours): DayDraft | null {
  if (hours === null) return null;
  return Object.fromEntries(BUSINESS_DAYS.map((d) => [d, hours[d] ?? null])) as DayDraft;
}

function dayInvalid(h: DayHours | null): boolean {
  if (!h) return false;
  return !isValidHHMM(h.open) || !isValidHHMM(h.close) || hhmmToMinutes(h.open) >= hhmmToMinutes(h.close);
}

/**
 * La próxima vez que abre después de cerrar (si ahora está abierto, la apertura siguiente al cierre de
 * hoy): es lo que diría el agente a alguien que escribe fuera de horario.
 */
export function nextOpeningAfterClose(hours: BusinessHours, timeZone: string, from: Date): Date | null {
  let at = from;
  for (let i = 0; i < 8 * 96 && isOpenAt(hours, timeZone, at); i++) at = new Date(at.getTime() + 15 * 60_000);
  return nextOpening(hours, timeZone, at);
}

function sameHours(a: DayDraft | null, b: DayDraft | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface HoursSettingsProps {
  data: InboxSettingsResponse;
  onSaved: (next: InboxSettingsResponse) => void;
  isManager: boolean;
}

/** Ajustes › Horarios y meta (web-45, mockup Horarios). Sin horario = siempre abierto. */
export default function HoursSettings({ data, onSaved, isManager }: HoursSettingsProps) {
  const { t, language } = useTranslation();
  const readOnly = !isManager;
  const saved = data.settings;
  const initialHours = toDraft(saved.businessHours);

  const [hours, setHours] = useState<DayDraft | null>(initialHours);
  const [notice, setNotice] = useState(saved.outOfHoursNotice);
  const [goal, setGoal] = useState(String(saved.responseGoalMinutes));
  const [alertOn, setAlertOn] = useState(saved.alertEmailMinutes !== null);
  const [alert, setAlert] = useState(String(saved.alertEmailMinutes ?? Math.max(30, saved.responseGoalMinutes + 15)));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'saved' | 'error' | null>(null);
  const [serverAlertError, setServerAlertError] = useState(false);

  const goalN = Number(goal);
  const goalError = !/^\d+$/.test(goal) || goalN < 1 || goalN > 240;
  const alertN = Number(alert);
  const alertFormatError = alertOn && (!/^\d+$/.test(alert) || alertN > 1440);
  const alertNotAbove = alertOn && !alertFormatError && !goalError && alertN <= goalN;
  const hoursError = !!hours && BUSINESS_DAYS.some((d) => dayInvalid(hours[d]));
  const invalid = goalError || alertFormatError || alertNotAbove || hoursError;

  const nextAlert = alertOn ? alertN : null;
  const dirty =
    !sameHours(hours, initialHours) ||
    notice !== saved.outOfHoursNotice ||
    goalN !== saved.responseGoalMinutes ||
    nextAlert !== saved.alertEmailMinutes;

  const setDay = (day: BusinessDay, value: DayHours | null) => setHours((prev) => (prev ? { ...prev, [day]: value } : prev));
  const copyToWeekdays = () =>
    setHours((prev) => (prev ? { ...prev, ...Object.fromEntries(WEEKDAYS.map((d) => [d, prev['1'] ? { ...prev['1'] } : null])) } : prev));

  async function save() {
    if (!dirty || invalid || readOnly) return;
    setSaving(true);
    setStatus(null);
    setServerAlertError(false);
    try {
      const next = await api.put<InboxSettingsResponse>('/api/inbox-settings', {
        businessHours: hours,
        outOfHoursNotice: notice,
        responseGoalMinutes: goalN,
        alertEmailMinutes: nextAlert,
      });
      onSaved(next);
      setStatus('saved');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'alert_not_above_goal') setServerAlertError(true);
      setStatus('error');
    } finally {
      setSaving(false);
    }
  }

  const tz = data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  // web-45b: el ejemplo usa la próxima apertura real del horario que se está editando
  const exampleOpening = hours && !hoursError ? nextOpeningAfterClose(hours, tz, new Date()) : null;
  const exampleWhen = exampleOpening ? formatOpening(exampleOpening, language, t, data.timezone ?? undefined) : null;
  const showAlertError = alertNotAbove || serverAlertError;

  return (
    <div className={styles.tabStack}>
      <section className={`${styles.card} ${styles.cardWide}`} aria-labelledby="hours-title">
        <div className={styles.cardHead}>
          <div>
            <h2 id="hours-title" className={styles.cardTitle}>
              {t('inbox.settings.hours.title')}
            </h2>
            <p className={styles.cardText}>
              {t('inbox.settings.hours.zone', { zone: tz })} ·{' '}
              <Link href="/dashboard/settings" className={styles.inlineLink}>
                {t('inbox.settings.hours.changeZone')}
              </Link>
            </p>
          </div>
          {hours && isManager && (
            <InboxButton icon={Copy} onClick={copyToWeekdays} disabled={readOnly}>
              {t('inbox.settings.hours.copyWeekdays')}
            </InboxButton>
          )}
        </div>

        {hours === null ? (
          <div className={styles.emptyBox}>
            <Clock size={20} aria-hidden="true" />
            <b>{t('inbox.settings.hours.alwaysOpen')}</b>
            <p>{t('inbox.settings.hours.alwaysOpenText')}</p>
            {isManager && (
              <InboxButton onClick={() => setHours({ ...DEFAULT_PROPOSED_HOURS })}>{t('inbox.settings.hours.define')}</InboxButton>
            )}
          </div>
        ) : (
          <>
            <ul className={styles.days}>
              {BUSINESS_DAYS.map((day) => {
                const h = hours[day];
                const dayName = t(`inbox.settings.hours.days.${day}`);
                const bad = dayInvalid(h);
                return (
                  <li key={day} className={styles.day}>
                    <span className={styles.dayName} id={`day-${day}`}>
                      {dayName}
                    </span>
                    <InboxSwitch
                      checked={!!h}
                      onChange={(open) => setDay(day, open ? (DEFAULT_PROPOSED_HOURS[day] ?? { open: '08:00', close: '18:00' }) : null)}
                      label={t('inbox.settings.hours.openOn', { day: dayName })}
                      disabled={readOnly}
                    />
                    {h ? (
                      <span className={styles.range}>
                        <input
                          type="time"
                          className={`${styles.inlineInput} ${bad ? styles.invalid : ''}`}
                          value={h.open}
                          disabled={readOnly}
                          aria-label={t('inbox.settings.hours.from', { day: dayName })}
                          aria-invalid={bad || undefined}
                          aria-describedby={bad ? `day-err-${day}` : undefined}
                          onChange={(e) => setDay(day, { ...h, open: e.target.value })}
                        />
                        <span aria-hidden="true">{t('inbox.settings.hours.to')}</span>
                        <input
                          type="time"
                          className={`${styles.inlineInput} ${bad ? styles.invalid : ''}`}
                          value={h.close}
                          disabled={readOnly}
                          aria-label={t('inbox.settings.hours.until', { day: dayName })}
                          aria-invalid={bad || undefined}
                          aria-describedby={bad ? `day-err-${day}` : undefined}
                          onChange={(e) => setDay(day, { ...h, close: e.target.value })}
                        />
                      </span>
                    ) : (
                      <span className={styles.closedTag}>{t('inbox.settings.hours.closed')}</span>
                    )}
                    {bad && (
                      <span id={`day-err-${day}`} className={`${styles.error} ${styles.dayError}`}>
                        {t('inbox.settings.hours.rangeError')}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {isManager && (
              <button type="button" className={styles.linkButton} onClick={() => setHours(null)}>
                {t('inbox.settings.hours.useAlwaysOpen')}
              </button>
            )}
          </>
        )}

        <div className={styles.switchRow}>
          <span>
            {t('inbox.settings.hours.notice')}
            <small id="notice-help">
              {hours ? t('inbox.settings.hours.noticeHelp') : t('inbox.settings.hours.noticeNeedsHours')}
            </small>
          </span>
          {/* web-45b: sin horario el aviso no hace nada: apagado a la vista y deshabilitado (el valor se conserva) */}
          <InboxSwitch
            checked={hours ? notice : false}
            onChange={setNotice}
            label={t('inbox.settings.hours.notice')}
            describedBy="notice-help"
            disabled={readOnly || !hours}
          />
        </div>
        {exampleWhen && <p className={styles.example}>{t('inbox.settings.hours.noticeExample', { when: exampleWhen })}</p>}
      </section>

      <section className={`${styles.card} ${styles.cardWide}`} aria-labelledby="goal-title">
        <h2 id="goal-title" className={styles.cardTitle}>
          {t('inbox.settings.goal.title')}
        </h2>
        <div className={styles.goalGrid}>
          <div className={styles.field}>
            <label htmlFor="goal-minutes">{t('inbox.settings.goal.respondIn')}</label>
            <span className={styles.suffixed}>
              <input
                id="goal-minutes"
                aria-label={t('inbox.settings.goal.goalAria')}
                type="number"
                inputMode="numeric"
                min={1}
                max={240}
                className={`${styles.inlineInput} ${goalError ? styles.invalid : ''}`}
                value={goal}
                disabled={readOnly}
                aria-invalid={goalError || undefined}
                aria-describedby={goalError ? 'goal-err' : undefined}
                onChange={(e) => setGoal(e.target.value)}
              />
              <span>min</span>
            </span>
            {goalError && (
              <span id="goal-err" className={styles.error}>
                {t('inbox.settings.goal.goalError')}
              </span>
            )}
          </div>
          <div className={styles.field}>
            <span className={styles.switchRow}>
              <label htmlFor="alert-minutes">{t('inbox.settings.goal.alertIf')}</label>
              <InboxSwitch checked={alertOn} onChange={setAlertOn} label={t('inbox.settings.goal.alertToggle')} disabled={readOnly} />
            </span>
            <span className={styles.suffixed}>
              <input
                id="alert-minutes"
                aria-label={t('inbox.settings.goal.alertAria')}
                type="number"
                inputMode="numeric"
                min={2}
                max={1440}
                className={`${styles.inlineInput} ${showAlertError || alertFormatError ? styles.invalid : ''}`}
                value={alert}
                disabled={readOnly || !alertOn}
                aria-invalid={showAlertError || alertFormatError || undefined}
                aria-describedby={showAlertError || alertFormatError ? 'alert-err' : undefined}
                onChange={(e) => {
                  setAlert(e.target.value);
                  setServerAlertError(false);
                }}
              />
              <span>min</span>
            </span>
            {(showAlertError || alertFormatError) && (
              <span id="alert-err" className={styles.error}>
                {alertFormatError
                  ? t('inbox.settings.goal.alertRange')
                  : t('inbox.settings.goal.alertNotAbove', { goal: goalError ? saved.responseGoalMinutes : goalN })}
              </span>
            )}
          </div>
        </div>
        <p className={styles.help}>{t('inbox.settings.goal.help')}</p>
      </section>

      <footer className={`${styles.saveBar} ${styles.cardWide}`}>
        <p className={styles.help}>{t('inbox.settings.managersOnly')}</p>
        {status && (
          <span role="status" className={status === 'error' ? styles.error : styles.saved}>
            {status === 'error' ? t('inbox.settings.saveError') : t('inbox.settings.saved')}
          </span>
        )}
        {isManager && (
          <InboxButton variant="primary" onClick={save} disabled={!dirty || invalid} loading={saving}>
            {t('inbox.settings.saveChanges')}
          </InboxButton>
        )}
      </footer>
    </div>
  );
}

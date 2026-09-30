'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, ChevronDown, ChevronUp, ExternalLink, UserRound, Copy } from 'lucide-react';
import {
  HANDOFF_BUTTON_TEXT_MAX,
  HANDOFF_MAX_CONTACTS,
  type HandoffConfig,
} from '@gensmart/shared';
import { api, ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Toggle from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './HandoffConfigurator.module.css';

interface HandoffConfiguratorProps {
  agentId: string;
  orgPlan: string;
  initialConfig?: HandoffConfig;
  onSaved?: (config: HandoffConfig) => void;
}

interface CalendarOption {
  id: string;
  name: string;
  timezone: string | null;
  available_days: number[] | null;
  available_hours: { start: string; end: string } | null;
}

interface ContactForm {
  key: string;
  id?: string;
  name: string;
  phone: string;
  calendarIds: string[];
}

interface FormState {
  enabled: boolean;
  buttonText: string;
  cooldownMinutes: string;
  labelTtlHours: string;
  contacts: ContactForm[];
}

const MAX_CALENDARS_PER_CONTACT = 5;
const DEFAULTS = { buttonText: 'Hablar con el equipo', cooldownMinutes: 10, labelTtlHours: 24 };

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `new-${keyCounter}`;
}

function toForm(config?: HandoffConfig): FormState {
  return {
    enabled: config?.enabled ?? false,
    buttonText: config?.buttonText ?? DEFAULTS.buttonText,
    cooldownMinutes: String(config?.cooldownMinutes ?? DEFAULTS.cooldownMinutes),
    labelTtlHours: String(config?.labelTtlHours ?? DEFAULTS.labelTtlHours),
    contacts: (config?.contacts ?? []).map((c) => ({
      key: c.id,
      id: c.id,
      name: c.name,
      phone: c.phone,
      calendarIds: c.calendarIds,
    })),
  };
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function toPayload(form: FormState) {
  return {
    enabled: form.enabled,
    buttonText: form.buttonText,
    cooldownMinutes: Number(form.cooldownMinutes),
    labelTtlHours: Number(form.labelTtlHours),
    contacts: form.contacts.map((c) => ({
      ...(c.id ? { id: c.id } : {}),
      name: c.name.trim(),
      phone: digitsOnly(c.phone),
      calendarIds: c.calendarIds,
    })),
  };
}

function isIntInRange(value: string, min: number, max: number): boolean {
  if (!/^\d+$/.test(value.trim())) return false;
  const n = Number(value);
  return n >= min && n <= max;
}

export default function HandoffConfigurator({ agentId, orgPlan, initialConfig, onSaved }: HandoffConfiguratorProps) {
  const { t, language } = useTranslation();
  const { success, error: toastError } = useToast();
  const isFreePlan = orgPlan === 'free';

  const [form, setForm] = useState<FormState>(() => toForm(initialConfig));
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(toPayload(toForm(initialConfig))));
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ calendars: CalendarOption[] }>('/api/calendars');
        setCalendars(res.calendars);
      } catch {
        // Non-critical — the contact can still be saved without calendars
      }
    })();
  }, []);

  const describeCalendar = useCallback(
    (cal: CalendarOption): string => {
      const days = [...new Set((cal.available_days ?? []).map(Number))].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
      const label = (d: number) =>
        new Intl.DateTimeFormat(language === 'es' ? 'es' : 'en', { weekday: 'short', timeZone: 'UTC' }).format(
          new Date(Date.UTC(2024, 0, d)) // 2024-01-01 is a Monday
        );
      const ranges: string[] = [];
      let i = 0;
      while (i < days.length) {
        let j = i;
        while (j + 1 < days.length && days[j + 1] === days[j]! + 1) j++;
        ranges.push(j > i ? `${label(days[i]!)}-${label(days[j]!)}` : label(days[i]!));
        i = j + 1;
      }
      const hours = cal.available_hours ? `${cal.available_hours.start}-${cal.available_hours.end}` : '';
      return [ranges.join(', '), hours, cal.timezone ? `(${cal.timezone})` : ''].filter(Boolean).join(' ');
    },
    [language]
  );

  // ── Validation (mirrors the server) ────────────────────────────────────────
  const errors = useMemo(() => {
    const contactErrors: Record<string, { name?: string; phone?: string }> = {};
    const seen = new Map<string, number>();
    for (const c of form.contacts) {
      const digits = digitsOnly(c.phone);
      seen.set(digits, (seen.get(digits) ?? 0) + 1);
    }
    for (const c of form.contacts) {
      const e: { name?: string; phone?: string } = {};
      const name = c.name.trim();
      if (name.length < 1) e.name = t('agents.editor.handoff.errors.nameRequired');
      else if (name.length > 60) e.name = t('agents.editor.handoff.errors.nameTooLong');
      const digits = digitsOnly(c.phone);
      if (digits.length < 10 || digits.length > 15) e.phone = t('agents.editor.handoff.errors.phoneInvalid');
      else if ((seen.get(digits) ?? 0) > 1) e.phone = t('agents.editor.handoff.errors.phoneDuplicate');
      if (e.name || e.phone) contactErrors[c.key] = e;
    }
    return {
      contacts: contactErrors,
      needContact: form.enabled && form.contacts.length === 0 ? t('agents.editor.handoff.errors.needContact') : undefined,
      buttonText:
        form.buttonText.length < 1 || form.buttonText.length > HANDOFF_BUTTON_TEXT_MAX
          ? t('agents.editor.handoff.errors.buttonText', { max: HANDOFF_BUTTON_TEXT_MAX })
          : undefined,
      cooldown: isIntInRange(form.cooldownMinutes, 1, 1440) ? undefined : t('agents.editor.handoff.errors.cooldownRange'),
      labelTtl: isIntInRange(form.labelTtlHours, 1, 720) ? undefined : t('agents.editor.handoff.errors.labelTtlRange'),
    };
  }, [form, t]);

  const hasErrors =
    Object.keys(errors.contacts).length > 0 ||
    !!errors.needContact ||
    !!errors.buttonText ||
    !!errors.cooldown ||
    !!errors.labelTtl;
  const isChanged = JSON.stringify(toPayload(form)) !== baseline;

  // Re-sync when the parent holds newer data, but never overwrite unsaved local edits.
  useEffect(() => {
    if (isChanged) return;
    const incoming = JSON.stringify(toPayload(toForm(initialConfig)));
    if (incoming === baseline) return;
    setForm(toForm(initialConfig));
    setBaseline(incoming);
  }, [initialConfig, isChanged, baseline]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function updateContact(key: string, patch: Partial<ContactForm>) {
    setForm((prev) => ({ ...prev, contacts: prev.contacts.map((c) => (c.key === key ? { ...c, ...patch } : c)) }));
  }

  function addContact() {
    setForm((prev) =>
      prev.contacts.length >= HANDOFF_MAX_CONTACTS
        ? prev
        : { ...prev, contacts: [...prev.contacts, { key: nextKey(), name: '', phone: '', calendarIds: [] }] }
    );
  }

  function removeContact(key: string) {
    setForm((prev) => ({ ...prev, contacts: prev.contacts.filter((c) => c.key !== key) }));
  }

  function toggleCalendar(contact: ContactForm, calendarId: string) {
    const has = contact.calendarIds.includes(calendarId);
    if (!has && contact.calendarIds.length >= MAX_CALENDARS_PER_CONTACT) return;
    updateContact(contact.key, {
      calendarIds: has ? contact.calendarIds.filter((id) => id !== calendarId) : [...contact.calendarIds, calendarId],
    });
  }

  function applyCalendarsToAll(calendarIds: string[]) {
    setForm((prev) => ({ ...prev, contacts: prev.contacts.map((c) => ({ ...c, calendarIds: [...calendarIds] })) }));
  }

  async function handleSave() {
    if (hasErrors || !isChanged) return;
    setSaving(true);
    try {
      const res = await api.put<{ agent: { handoffConfig: HandoffConfig } }>(`/api/agents/${agentId}`, {
        handoffConfig: toPayload(form),
      });
      const next = toForm(res.agent.handoffConfig);
      setForm(next);
      setBaseline(JSON.stringify(toPayload(next)));
      success(t('agents.editor.handoff.saved'));
      onSaved?.(res.agent.handoffConfig);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PLAN_LIMIT') {
        toastError(t('agents.editor.handoff.planLimit'));
      } else {
        toastError(err instanceof ApiError ? err.message : t('agents.editor.handoff.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.title}>
            <UserRound size={16} aria-hidden="true" />
            {t('agents.editor.handoff.title')}
          </div>
          <p className={styles.description}>{t('agents.editor.handoff.description')}</p>
        </div>
        <Toggle
          checked={form.enabled}
          onChange={(checked) => setForm((prev) => ({ ...prev, enabled: checked }))}
          disabled={isFreePlan}
          id="handoff-enabled"
          label={t('agents.editor.handoff.enable')}
        />
      </div>

      {isFreePlan && (
        <p className={styles.planNotice}>
          {t('agents.editor.handoff.freePlanNotice')}{' '}
          <Link href="/pricing" target="_blank" className={styles.link}>
            {t('agents.editor.handoff.viewPlans')}
          </Link>
        </p>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>{t('agents.editor.handoff.contactsTitle')}</div>
          <Link href="/dashboard/calendar" className={styles.link}>
            {t('agents.editor.handoff.manageCalendars')} <ExternalLink size={11} aria-hidden="true" />
          </Link>
        </div>
        <p className={styles.hint}>{t('agents.editor.handoff.calendarsHelp')}</p>

        {form.contacts.map((contact) => {
          const e = errors.contacts[contact.key];
          return (
            <div key={contact.key} className={styles.contactCard}>
              <div className={styles.contactRow}>
                <Input
                  label={t('agents.editor.handoff.contactName')}
                  value={contact.name}
                  onChange={(ev) => updateContact(contact.key, { name: ev.target.value })}
                  placeholder={t('agents.editor.handoff.contactNamePlaceholder')}
                  error={e?.name}
                  maxLength={60}
                />
                <Input
                  label={t('agents.editor.handoff.contactPhone')}
                  value={contact.phone}
                  onChange={(ev) => updateContact(contact.key, { phone: ev.target.value })}
                  placeholder="573001234567"
                  error={e?.phone}
                  hint={t('agents.editor.handoff.phoneHelp')}
                  inputMode="tel"
                />
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeContact(contact.key)}
                  aria-label={t('agents.editor.handoff.removeContact')}
                  title={t('agents.editor.handoff.removeContact')}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>

              <div className={styles.calendarBlock}>
                <div className={styles.calendarLabel}>{t('agents.editor.handoff.calendars')}</div>
                {calendars.length === 0 ? (
                  <p className={styles.hint}>{t('agents.editor.handoff.noCalendars')}</p>
                ) : (
                  <div className={styles.calendarList}>
                    {calendars.map((cal) => {
                      const checked = contact.calendarIds.includes(cal.id);
                      const atMax = !checked && contact.calendarIds.length >= MAX_CALENDARS_PER_CONTACT;
                      return (
                        <label key={cal.id} className={`${styles.calendarOption} ${atMax ? styles.calendarOptionDisabled : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={atMax}
                            onChange={() => toggleCalendar(contact, cal.id)}
                            className={styles.checkbox}
                          />
                          <span className={styles.calendarName}>{cal.name}</span>
                          <span className={styles.calendarSummary}>{describeCalendar(cal)}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {form.contacts.length > 1 && contact.calendarIds.length > 0 && (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => applyCalendarsToAll(contact.calendarIds)}
                  >
                    <Copy size={12} aria-hidden="true" /> {t('agents.editor.handoff.applyToAll')}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {errors.needContact && <p className={styles.error}>{errors.needContact}</p>}

        <div className={styles.addRow}>
          <Button
            variant="outline"
            size="sm"
            icon={Plus}
            onClick={addContact}
            disabled={form.contacts.length >= HANDOFF_MAX_CONTACTS}
          >
            {t('agents.editor.handoff.addContact')}
          </Button>
          {form.contacts.length >= HANDOFF_MAX_CONTACTS && (
            <span className={styles.hint}>{t('agents.editor.handoff.contactsMax', { max: HANDOFF_MAX_CONTACTS })}</span>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <Input
          label={t('agents.editor.handoff.buttonText')}
          value={form.buttonText}
          onChange={(ev) => setForm((prev) => ({ ...prev, buttonText: ev.target.value }))}
          error={errors.buttonText}
          hint={`${form.buttonText.length}/${HANDOFF_BUTTON_TEXT_MAX}`}
        />
      </div>

      <div className={styles.section}>
        <button
          type="button"
          className={styles.advancedToggle}
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {t('agents.editor.handoff.advanced')}
        </button>
        {showAdvanced && (
          <div className={styles.advancedBody}>
            <Input
              label={t('agents.editor.handoff.cooldownMinutes')}
              type="number"
              min={1}
              max={1440}
              value={form.cooldownMinutes}
              onChange={(ev) => setForm((prev) => ({ ...prev, cooldownMinutes: ev.target.value }))}
              error={errors.cooldown}
              hint={t('agents.editor.handoff.cooldownHelp')}
            />
            <Input
              label={t('agents.editor.handoff.labelTtlHours')}
              type="number"
              min={1}
              max={720}
              value={form.labelTtlHours}
              onChange={(ev) => setForm((prev) => ({ ...prev, labelTtlHours: ev.target.value }))}
              error={errors.labelTtl}
              hint={t('agents.editor.handoff.labelTtlHelp')}
            />
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Button size="sm" onClick={() => void handleSave()} loading={saving} disabled={hasErrors || !isChanged}>
          {t('agents.editor.handoff.save')}
        </Button>
      </div>
    </div>
  );
}

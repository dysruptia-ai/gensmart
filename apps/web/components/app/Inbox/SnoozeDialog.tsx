'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import ChoiceList from './ChoiceList';
import InboxButton from './InboxButton';
import InboxDialog from './InboxDialog';
import { clockTime, snoozeOptions, type SnoozeOption } from './inboxFormat';

export interface SnoozeDialogProps {
  /** Zona de la organización (Ajustes); sin ella, la del navegador. */
  timeZone?: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (until: Date) => void;
}

/** "Posponer" (web-42): vuelve a "Mías" a la hora elegida, o antes si el cliente escribe. */
export default function SnoozeDialog({ timeZone, busy, onCancel, onConfirm }: SnoozeDialogProps) {
  const { t, language } = useTranslation();
  // Las opciones se calculan al abrir: "Hoy 4:00 p. m." no aparece si ya pasó
  const [opened] = useState(() => new Date());
  const options = useMemo(() => snoozeOptions(opened, timeZone), [opened, timeZone]);
  const [choice, setChoice] = useState<SnoozeOption>('tomorrow9');
  const selected = options.find((o) => o.key === choice) ?? options[0]!;

  const label = (key: SnoozeOption, until: Date): { label: string; hint?: string } => {
    const time = clockTime(until.toISOString(), language, timeZone);
    if (key === 'in1h') return { label: t('inbox.snoozeDialog.in1h'), hint: time };
    if (key === 'today16') return { label: t('inbox.snoozeDialog.today', { time }) };
    if (key === 'tomorrow9') return { label: t('inbox.snoozeDialog.tomorrow', { time }) };
    return { label: t('inbox.snoozeDialog.nextWeek'), hint: t('inbox.snoozeDialog.nextWeekHint', { time }) };
  };

  return (
    <InboxDialog
      title={t('inbox.snoozeDialog.title')}
      onClose={onCancel}
      footer={
        <>
          <InboxButton onClick={onCancel}>{t('inbox.snoozeDialog.cancel')}</InboxButton>
          <InboxButton variant="primary" onClick={() => onConfirm(selected.until)} loading={busy}>
            {t('inbox.snoozeDialog.confirm')}
          </InboxButton>
        </>
      }
    >
      <p>{t('inbox.snoozeDialog.text')}</p>
      <ChoiceList
        name="inbox-snooze"
        legend={t('inbox.snoozeDialog.title')}
        value={selected.key}
        onChange={setChoice}
        options={options.map((o) => ({ value: o.key, ...label(o.key, o.until) }))}
      />
    </InboxDialog>
  );
}

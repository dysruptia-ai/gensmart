'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import ChoiceList from './ChoiceList';
import InboxButton from './InboxButton';
import InboxDialog from './InboxDialog';
import { CLOSE_OUTCOMES, type CloseOutcome } from './types';
import styles from './CloseDialog.module.css';

export interface CloseDialogProps {
  contactName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (outcome: CloseOutcome) => void;
}

/**
 * "Cerrar conversación" con el resultado (web-42). También se abre con E.
 * Ninguna opción viene marcada (web-42b): un "Vendido" por defecto llenaría los Informes de ventas falsas.
 */
export default function CloseDialog({ contactName, busy, onCancel, onConfirm }: CloseDialogProps) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState<CloseOutcome | null>(null);
  return (
    <InboxDialog
      title={t('inbox.closeDialog.title')}
      onClose={onCancel}
      footer={
        <>
          {!outcome && (
            <span id="inbox-close-help" className={styles.help}>
              {t('inbox.closeDialog.pickOutcome')}
            </span>
          )}
          <InboxButton onClick={onCancel}>{t('inbox.closeDialog.cancel')}</InboxButton>
          <InboxButton
            variant="primary"
            onClick={() => outcome && onConfirm(outcome)}
            disabled={!outcome}
            aria-describedby={outcome ? undefined : 'inbox-close-help'}
            loading={busy}
          >
            {t('inbox.closeDialog.confirm')}
          </InboxButton>
        </>
      }
    >
      <p>{t('inbox.closeDialog.question', { name: contactName })}</p>
      <ChoiceList
        name="inbox-close-outcome"
        legend={t('inbox.closeDialog.outcomeLegend')}
        value={outcome}
        onChange={setOutcome}
        options={CLOSE_OUTCOMES.map((o) => ({
          value: o,
          label: t(`inbox.outcomes.${o}`),
          hint: t(`inbox.closeDialog.hints.${o}`),
        }))}
      />
    </InboxDialog>
  );
}

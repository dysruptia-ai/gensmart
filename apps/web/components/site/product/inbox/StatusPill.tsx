'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import { cx } from '../ProductSubpage/cx';
import { STATUS_CLASS, type ConversationStatus } from './inboxData';

/** Píldora de estado de una conversación (design: `em.st`). */
export default function StatusPill({ status }: { status: ConversationStatus }) {
  const { t } = useSiteTranslation();
  return <em className={cx('st', STATUS_CLASS[status])}>{t(`site.productShared.status.${status}`)}</em>;
}

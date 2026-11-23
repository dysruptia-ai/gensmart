'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { CHANNEL_NAMES, type MockChannel } from './ChannelIcon';

/** Nombre visible de un canal: las marcas van tal cual; correo y sitio web, traducidos. */
export function useChannelName(): (c: MockChannel) => string {
  const { t } = useTranslation();
  return (c) =>
    c === 'email' ? t('site.channels.email') : c === 'web' ? t('site.channels.website') : CHANNEL_NAMES[c];
}

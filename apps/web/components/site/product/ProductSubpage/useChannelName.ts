'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import { CHANNEL_NAMES, type MockChannel } from './ChannelIcon';

/** Nombre visible de un canal: las marcas van tal cual; correo y sitio web, traducidos. */
export function useChannelName(): (c: MockChannel) => string {
  const { t } = useSiteTranslation();
  return (c) =>
    c === 'email' ? t('site.channels.email') : c === 'web' ? t('site.channels.website') : CHANNEL_NAMES[c];
}

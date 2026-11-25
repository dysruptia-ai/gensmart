'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import ChannelsSection from '../ProductSubpage/ChannelsSection';
import { subpageValues } from '../ProductSubpage/subpageData';

const K = 'site.productInbox.channels';

export default function InboxChannels() {
  const { t, language } = useSiteTranslation();
  const values = subpageValues(language);
  return <ChannelsSection title={t(`${K}.title`, values)} lead={t(`${K}.lead`)} label={t(`${K}.label`)} />;
}

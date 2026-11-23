'use client';

import { useTranslation } from '@/hooks/useTranslation';
import ChannelsSection from '../ProductSubpage/ChannelsSection';
import { subpageValues } from '../ProductSubpage/subpageData';

const K = 'site.productInbox.channels';

export default function InboxChannels() {
  const { t, language } = useTranslation();
  const values = subpageValues(language);
  return <ChannelsSection title={t(`${K}.title`, values)} lead={t(`${K}.lead`)} label={t(`${K}.label`)} />;
}

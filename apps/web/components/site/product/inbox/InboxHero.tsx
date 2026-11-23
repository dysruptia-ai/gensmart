'use client';

import { useTranslation } from '@/hooks/useTranslation';
import SubpageHero from '../ProductSubpage/SubpageHero';
import { subpageValues } from '../ProductSubpage/subpageData';
import InboxMock from './InboxMock';

const H = 'site.productInbox.hero';

export default function InboxHero() {
  const { t, language } = useTranslation();
  const values = subpageValues(language);
  return (
    <SubpageHero
      id="productInbox"
      title={{ before: t(`${H}.titleBefore`, values), accent: t(`${H}.titleAccent`) }}
      lead={t(`${H}.lead`)}
      primary={t('site.productShared.primary')}
      secondary={{ to: 'productAgents', label: t(`${H}.secondary`) }}
      mock={<InboxMock />}
    />
  );
}

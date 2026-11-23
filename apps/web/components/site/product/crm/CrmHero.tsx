'use client';

import { useTranslation } from '@/hooks/useTranslation';
import SubpageHero from '../ProductSubpage/SubpageHero';
import CrmRecordMock from './CrmRecordMock';

const H = 'site.productCrm.hero';

export default function CrmHero() {
  const { t } = useTranslation();
  return (
    <SubpageHero
      id="productCrm"
      title={{ before: t(`${H}.titleBefore`), accent: t(`${H}.titleAccent`), after: t(`${H}.titleAfter`) }}
      lead={t(`${H}.lead`)}
      primary={t('site.productShared.primary')}
      secondary={{ to: 'productInbox', label: t(`${H}.secondary`) }}
      mock={<CrmRecordMock />}
    />
  );
}

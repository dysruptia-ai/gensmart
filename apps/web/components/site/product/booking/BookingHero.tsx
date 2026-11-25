'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import SubpageHero from '../ProductSubpage/SubpageHero';
import BookingDayMock from './BookingDayMock';

const H = 'site.productBooking.hero';

export default function BookingHero() {
  const { t } = useSiteTranslation();
  return (
    <SubpageHero
      id="productBooking"
      title={{ before: t(`${H}.titleBefore`), accent: t(`${H}.titleAccent`) }}
      lead={t(`${H}.lead`)}
      primary={t('site.productShared.primary')}
      secondary={{ to: 'productCrm', label: t(`${H}.secondary`) }}
      mock={<BookingDayMock />}
    />
  );
}

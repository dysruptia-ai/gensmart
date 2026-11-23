'use client';

import { useTranslation } from '@/hooks/useTranslation';
import SubpageHero from '../ProductSubpage/SubpageHero';
import BookingDayMock from './BookingDayMock';

const H = 'site.productBooking.hero';

export default function BookingHero() {
  const { t } = useTranslation();
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

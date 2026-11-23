import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import SubpageShell from '@/components/site/product/ProductSubpage/SubpageShell';
import { subpageMetadata } from '@/components/site/product/ProductSubpage/subpageMeta';
import BookingHero from '@/components/site/product/booking/BookingHero';
import BookingSteps from '@/components/site/product/booking/BookingSteps';
import BookingChannels from '@/components/site/product/booking/BookingChannels';
import BookingCalendars from '@/components/site/product/booking/BookingCalendars';
import { isSiteLanguage, type SiteLanguage } from '@/lib/site-routes';

interface PageProps {
  params: Promise<{ lang: string }>;
}

async function resolveLang(params: PageProps['params']): Promise<SiteLanguage> {
  const { lang } = await params;
  if (!isSiteLanguage(lang)) notFound();
  return lang;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return subpageMetadata('productBooking', await resolveLang(params));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

export default async function ProductBookingPage({ params }: PageProps) {
  const lang = await resolveLang(params);
  return (
    <SubpageShell id="productBooking" lang={lang} variants={['isInbox', 'isCrm', 'isDay']}>
      <BookingHero />
      <BookingSteps />
      <BookingChannels />
      <BookingCalendars />
    </SubpageShell>
  );
}

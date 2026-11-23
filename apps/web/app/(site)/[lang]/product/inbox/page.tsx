import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import SubpageShell from '@/components/site/product/ProductSubpage/SubpageShell';
import { subpageMetadata } from '@/components/site/product/ProductSubpage/subpageMeta';
import InboxHero from '@/components/site/product/inbox/InboxHero';
import InboxStatus from '@/components/site/product/inbox/InboxStatus';
import InboxHandoff from '@/components/site/product/inbox/InboxHandoff';
import InboxChannels from '@/components/site/product/inbox/InboxChannels';
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
  return subpageMetadata('productInbox', await resolveLang(params));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

export default async function ProductInboxPage({ params }: PageProps) {
  const lang = await resolveLang(params);
  return (
    <SubpageShell id="productInbox" lang={lang} variants={['isInbox']}>
      <InboxHero />
      <InboxStatus />
      <InboxHandoff />
      <InboxChannels />
    </SubpageShell>
  );
}

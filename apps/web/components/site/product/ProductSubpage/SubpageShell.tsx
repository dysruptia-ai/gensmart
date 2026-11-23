import type { ReactNode } from 'react';
import SiteRoot from '../../SiteRoot';
import SkipLink from '../../SkipLink';
import AnnounceBar from '../../AnnounceBar';
import SiteHeader from '../../SiteHeader';
import SiteFooter from '../../SiteFooter';
import SiteChatWidget from '../../SiteChatWidget';
import FinalCtaSection from '../../home/FinalCtaSection';
import type { SiteLanguage } from '@/lib/site-routes';
import ProductSubpage, { type SubpageVariant } from './ProductSubpage';
import { subpageJsonLd } from './subpageMeta';
import type { ProductSubpageId } from './subpageData';

interface SubpageShellProps {
  id: ProductSubpageId;
  lang: SiteLanguage;
  variants: readonly SubpageVariant[];
  children: ReactNode;
}

/** Marco de una subpágina de Producto: JSON-LD, header, secciones, CTA final y footer. */
export default function SubpageShell({ id, lang, variants, children }: SubpageShellProps) {
  return (
    <SiteRoot>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(subpageJsonLd(id, lang)) }}
      />
      <SkipLink />
      <AnnounceBar />
      <SiteHeader />
      <main id="main">
        <ProductSubpage variants={variants}>{children}</ProductSubpage>
        <FinalCtaSection />
      </main>
      <SiteFooter />
      <SiteChatWidget />
    </SiteRoot>
  );
}

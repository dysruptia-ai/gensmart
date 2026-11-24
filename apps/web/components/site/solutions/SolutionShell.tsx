import type { ReactNode } from 'react';
import SiteRoot from '../SiteRoot';
import SkipLink from '../SkipLink';
import AnnounceBar from '../AnnounceBar';
import SiteHeader from '../SiteHeader';
import SiteFooter from '../SiteFooter';
import SiteChatWidget from '../SiteChatWidget';
import FinalCtaSection from '../home/FinalCtaSection';

interface SolutionShellProps {
  /** JSON-LD de la página (se serializa en el servidor). */
  jsonLd: object;
  children: ReactNode;
}

/** Marco de las páginas de Soluciones: cabecera, `main` con el CTA final y pie. */
export default function SolutionShell({ jsonLd, children }: SolutionShellProps) {
  return (
    <SiteRoot>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SkipLink />
      <AnnounceBar />
      <SiteHeader />
      <main id="main">
        {children}
        <FinalCtaSection />
      </main>
      <SiteFooter />
      <SiteChatWidget />
    </SiteRoot>
  );
}

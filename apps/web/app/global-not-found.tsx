import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Sora, Geist } from 'next/font/google';
import './(site)/site-base.css';
import { FixedLanguageProvider } from '@/contexts/LanguageContext';
import SiteRoot from '@/components/site/SiteRoot';
import SiteLogo from '@/components/site/SiteLogo';
import SkipLink from '@/components/site/SkipLink';
import NotFoundContent from '@/components/site/NotFound';
import { siteT } from '@/lib/site-i18n';
import { SITE_LANG_HEADER, type SiteLanguage } from '@/lib/site-routes';
import styles from './global-not-found.module.css';

const sora = Sora({ subsets: ['latin'], weight: ['600'], display: 'swap', variable: '--font-sora' });
const geist = Geist({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--font-geist' });

/** Idioma que fijó `proxy.ts` según el prefijo de la URL (`/en/…` → inglés). */
async function requestLang(): Promise<SiteLanguage> {
  return (await headers()).get(SITE_LANG_HEADER) === 'en' ? 'en' : 'es';
}

export async function generateMetadata(): Promise<Metadata> {
  const t = siteT(await requestLang());
  return {
    title: { absolute: t('site.notFound.title') },
    robots: { index: false, follow: true },
  };
}

/**
 * 404 para URL que no coinciden con ninguna ruta (hay dos layouts raíz, así que va fuera
 * de ambos): cabecera mínima con el logo y el contenido de la 404 del sitio.
 */
export default async function GlobalNotFound() {
  const lang = await requestLang();
  const t = siteT(lang);
  return (
    <html lang={lang} className={`${sora.variable} ${geist.variable}`}>
      <body>
        <FixedLanguageProvider language={lang}>
          <SiteRoot>
            <SkipLink />
            <header className={styles.header}>
              <SiteLogo className={styles.logo} ariaLabel={t('site.notFound.logoHome')} />
            </header>
            <main id="main">
              <NotFoundContent />
            </main>
          </SiteRoot>
        </FixedLanguageProvider>
      </body>
    </html>
  );
}

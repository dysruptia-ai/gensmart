'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { counterpart, isSiteLanguage, type SiteLanguage } from '@/lib/site-routes';
import en from '@/i18n/en.json';
import es from '@/i18n/es.json';
import Container from '../Container';
import styles from './LanguageSuggestion.module.css';
import { storageGet, storageSet } from '@/lib/safe-storage';

const DISMISS_KEY = 'gs_lang_hint_dismissed';

/** Los textos van en el idioma sugerido, no en el de la página. */
const HINTS: Record<SiteLanguage, typeof en.site.langHint> = {
  en: en.site.langHint,
  es: es.site.langHint,
};

interface Suggestion {
  lang: SiteLanguage;
  path: string;
}

/**
 * Barra descartable que sugiere la otra versión del sitio si el navegador está
 * en ese idioma. Nunca redirige y no se renderiza en el servidor.
 */
export default function LanguageSuggestion() {
  const { language } = useLanguage();
  const pathname = usePathname();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (storageGet(DISMISS_KEY) === '1') return;
    const browser = (navigator.languages?.[0] ?? navigator.language ?? '').slice(0, 2).toLowerCase();
    if (!isSiteLanguage(browser) || browser === language) return;
    const target = counterpart(pathname);
    if (!target || target.lang !== browser) return;
    // Primero se monta cerrada y en el cuadro siguiente se abre (transición corta)
    let frame = requestAnimationFrame(() => {
      setSuggestion(target);
      frame = requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [language, pathname]);

  if (!suggestion) return null;

  const hint = HINTS[suggestion.lang];
  const dismiss = () => {
    storageSet(DISMISS_KEY, '1');
    setSuggestion(null);
  };

  return (
    <div
      className={[styles.wrap, visible ? styles.open : ''].filter(Boolean).join(' ')}
      role="region"
      aria-label={hint.region}
      lang={suggestion.lang}
    >
      <div className={styles.clip}>
        <Container className={styles.inner}>
          <p className={styles.text}>
            {hint.text}{' '}
            <Link className={styles.link} href={suggestion.path} hrefLang={suggestion.lang}>
              {hint.link}
            </Link>
          </p>
          <button type="button" className={styles.close} aria-label={hint.dismiss} onClick={dismiss}>
            <X size={16} aria-hidden="true" />
          </button>
        </Container>
      </div>
    </div>
  );
}

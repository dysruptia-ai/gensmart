'use client';

import Link from 'next/link';
import { Facebook, Globe } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './Footer.module.css';

const PRODUCT_LINKS = [
  { labelKey: 'landing.footer.features', href: '/#features' },
  { labelKey: 'landing.footer.pricing', href: '/pricing' },
  { labelKey: 'landing.footer.blog', href: '/blog' },
  { labelKey: 'landing.footer.docs', href: '/docs/whatsapp-setup' },
];

const LEGAL_LINKS = [
  { labelKey: 'landing.footer.privacy', href: '/legal/privacy-policy' },
  { labelKey: 'landing.footer.terms', href: '/legal/terms-of-service' },
  { labelKey: 'landing.footer.cookie', href: '/legal/cookie-policy' },
];

const SOCIAL_LINKS = [
  { label: 'Facebook', href: 'https://facebook.com/gensmartai', icon: Facebook },
];

const LANGUAGES = [
  { code: 'en' as const, label: 'EN' },
  { code: 'es' as const, label: 'ES' },
];

export function Footer() {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.columns}>
          <div className={styles.column}>
            <h3 className={styles.columnTitle}>{t('landing.footer.product')}</h3>
            <ul className={styles.linkList}>
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={styles.link}>
                    {t(l.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.column}>
            <h3 className={styles.columnTitle}>{t('landing.footer.legal')}</h3>
            <ul className={styles.linkList}>
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={styles.link}>
                    {t(l.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.column}>
            <h3 className={styles.columnTitle}>{t('landing.footer.connect')}</h3>
            <ul className={styles.linkList}>
              {SOCIAL_LINKS.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    className={styles.socialLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                  >
                    <s.icon size={16} aria-hidden="true" />
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.bottom}>
          <div className={styles.bottomLeft}>
            <Logo size="md" variant="full" color="white" href="/" />
            <div className={styles.copyright}>
              <p className={styles.trademark}>GenSmart is a registered trademark of Dysruptia LLC</p>
              <p>&copy; {new Date().getFullYear()} Dysruptia LLC. All rights reserved.</p>
            </div>
          </div>

          <div className={styles.languageSelector} aria-label="Language selector">
            <Globe size={14} aria-hidden="true" />
            {LANGUAGES.map((lang, i) => (
              <span key={lang.code} className={styles.langGroup}>
                {i > 0 && <span className={styles.langDivider}>/</span>}
                <button
                  className={`${styles.langBtn} ${language === lang.code ? styles.langBtnActive : ''}`}
                  aria-label={`Switch to ${lang.label}`}
                  onClick={() => setLanguage(lang.code)}
                >
                  {lang.label}
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

import Link from 'next/link';
import { Twitter, Linkedin, Globe } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import styles from './Footer.module.css';

const PRODUCT_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
  { label: 'Docs', href: '/docs/whatsapp-setup' },
];

const COMPANY_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '/legal/privacy-policy' },
  { label: 'Terms of Service', href: '/legal/terms-of-service' },
  { label: 'Cookie Policy', href: '/legal/cookie-policy' },
];

const SOCIAL_LINKS = [
  { label: 'Twitter / X', href: 'https://twitter.com/gensmart_ai', icon: Twitter },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/gensmart-ai', icon: Linkedin },
];

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
];

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.columns}>
          <div className={styles.column}>
            <h3 className={styles.columnTitle}>Product</h3>
            <ul className={styles.linkList}>
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={styles.link}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.column}>
            <h3 className={styles.columnTitle}>Company</h3>
            <ul className={styles.linkList}>
              {COMPANY_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={styles.link}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.column}>
            <h3 className={styles.columnTitle}>Legal</h3>
            <ul className={styles.linkList}>
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={styles.link}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.column}>
            <h3 className={styles.columnTitle}>Connect</h3>
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
            <p className={styles.copyright}>
              © 2026 GenSmart. All rights reserved.
            </p>
          </div>

          <div className={styles.languageSelector} aria-label="Language selector">
            <Globe size={14} aria-hidden="true" />
            {LANGUAGES.map((lang, i) => (
              <span key={lang.code} className={styles.langGroup}>
                {i > 0 && <span className={styles.langDivider}>/</span>}
                <button className={styles.langBtn} aria-label={`Switch to ${lang.label}`}>
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

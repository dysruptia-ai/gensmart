'use client';

import { useSyncExternalStore } from 'react';
import { Facebook, Instagram, Youtube } from 'lucide-react';
// Excepción documentada: lucide-react no incluye el logo de TikTok.
// Se usa react-icons/fa6 (el mismo paquete que ya usa el proyecto para logos de marca).
import { FaTiktok } from 'react-icons/fa6';
import type { SiteLinkKey } from '@/lib/site-links';
import { useTranslation } from '@/hooks/useTranslation';
import Container from '../Container';
import SiteLink from '../SiteLink';
import SiteLogo from '../SiteLogo';
import styles from './SiteFooter.module.css';

interface FooterColumn {
  id: string;
  links: Array<{ to: SiteLinkKey; label: string }>;
}

const COLUMNS: FooterColumn[] = [
  {
    id: 'product',
    links: [
      { to: 'product', label: 'features' },
      { to: 'integrations', label: 'integrations' },
      { to: 'pricing', label: 'pricing' },
    ],
  },
  {
    id: 'solutions',
    links: [
      { to: 'ecommerce', label: 'ecommerce' },
      { to: 'industries', label: 'industries' },
      { to: 'teamSales', label: 'sales' },
      { to: 'teamCustomerSupport', label: 'support' },
      { to: 'teamMarketing', label: 'marketing' },
      { to: 'cases', label: 'cases' },
    ],
  },
  {
    id: 'resources',
    links: [
      { to: 'resources', label: 'resources' },
      { to: 'blog', label: 'blog' },
      { to: 'docsWhatsappSetup', label: 'docs' },
      { to: 'academy', label: 'academy' },
      { to: 'community', label: 'community' },
    ],
  },
  {
    id: 'partners',
    links: [
      { to: 'partners', label: 'partners' },
      { to: 'referrals', label: 'referrals' },
      { to: 'partnersWhiteLabel', label: 'whiteLabel' },
    ],
  },
  {
    id: 'company',
    links: [
      { to: 'contact', label: 'contact' },
      { to: 'legalPrivacy', label: 'privacy' },
      { to: 'legalTerms', label: 'terms' },
      { to: 'legalCookies', label: 'cookies' },
    ],
  },
];

const SOCIALS: Array<{ to: SiteLinkKey; name: string; icon: React.ReactNode }> = [
  { to: 'socialFacebook', name: 'Facebook', icon: <Facebook size={18} aria-hidden="true" /> },
  { to: 'socialInstagram', name: 'Instagram', icon: <Instagram size={18} aria-hidden="true" /> },
  { to: 'socialTiktok', name: 'TikTok', icon: <FaTiktok size={18} aria-hidden="true" /> },
  { to: 'socialYoutube', name: 'YouTube', icon: <Youtube size={18} aria-hidden="true" /> },
];

// Año fijo en SSR para evitar desajuste de hidratación con el reloj del cliente
const SSR_YEAR = 2026;

const subscribeNoop = () => () => {};
const getClientYear = () => new Date().getFullYear();
const getServerYear = () => SSR_YEAR;

export default function SiteFooter() {
  const { t } = useTranslation();
  const year = useSyncExternalStore(subscribeNoop, getClientYear, getServerYear);

  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <SiteLogo className={styles.logo} />
            <p className={styles.description}>{t('site.footer.description')}</p>
            <div className={styles.socials}>
              {SOCIALS.map((s) => (
                <SiteLink key={s.to} to={s.to} className={styles.social} aria-label={s.name}>
                  {s.icon}
                </SiteLink>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.id}>
              <h3 className={styles.colTitle}>{t(`site.footer.cols.${col.id}`)}</h3>
              <ul className={styles.list}>
                {col.links.map((l) => (
                  <li key={`${col.id}-${l.to}`}>
                    <SiteLink to={l.to} className={styles.link}>
                      {t(`site.footer.links.${l.label}`)}
                    </SiteLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.bottom}>
          <span>{t('site.footer.legal', { year })}</span>
          <span>{t('site.footer.domain')}</span>
        </div>
      </Container>
    </footer>
  );
}

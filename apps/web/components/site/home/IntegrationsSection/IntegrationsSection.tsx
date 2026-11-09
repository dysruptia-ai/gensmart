'use client';

import { useTranslation } from '@/hooks/useTranslation';
import Container from '../../Container';
import LogoTile, { BRAND_LOGOS } from '../../LogoTile';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import SiteButton from '../../SiteButton';
import styles from './IntegrationsSection.module.css';

const NAMES = [
  'Tiendanube',
  'Shopify',
  'WooCommerce',
  'Venndelo',
  'Dropi',
  'Dropea',
  'Mastershop',
  'HubSpot',
  'Zoho',
  'Odoo',
  'Google Calendar',
  'Calendly',
  'Google Sheets',
  'Notion',
  'Stripe',
  'PayPal',
  'Mercado Pago',
  'Zendesk',
  'Mailchimp',
];

export default function IntegrationsSection() {
  const { t } = useTranslation();
  const P = 'site.home.integrations';
  return (
    <Section surface="alt" className={styles.integrations}>
      <Container>
        <SectionHead title={t(`${P}.title`)} lead={t(`${P}.lead`)} />
        <ul className={styles.grid} aria-label={t(`${P}.listLabel`)}>
          {NAMES.map((name) => {
            const logo = BRAND_LOGOS[name];
            return logo ? (
              <li key={name} className={styles.item}>
                <LogoTile logo={logo} size="md" className={styles.tile} />
              </li>
            ) : null;
          })}
        </ul>
        <div className={styles.cta}>
          <SiteButton to="integrations" variant="ghost">
            {t(`${P}.cta`)}
          </SiteButton>
        </div>
      </Container>
    </Section>
  );
}

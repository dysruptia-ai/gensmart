'use client';

import { useTranslation } from '@/hooks/useTranslation';
import ChannelsStrip from '../../ChannelsStrip';
import Container from '../../Container';
import LogoTile, { BRAND_LOGOS } from '../../LogoTile';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import SiteButton from '../../SiteButton';
import { productValues } from '../productData';
import styles from './ConnectSection.module.css';

const C = 'site.product.connect';

const TOOLS = ['Shopify', 'Tiendanube', 'WooCommerce', 'HubSpot', 'Google Calendar', 'Stripe'];

export default function ConnectSection() {
  const { t, language } = useTranslation();
  const values = productValues(t, language);
  return (
    <Section id="conexion" rhythm="m">
      <Container>
        <SectionHead title={t(`${C}.title`)} />
        <div className={styles.duo}>
          <div className={styles.col}>
            <h3 className={styles.h3}>{t(`${C}.channelsTitle`, values)}</h3>
            <p className={styles.text}>{t(`${C}.channelsText`)}</p>
            <ChannelsStrip label={t(`${C}.channelsLabel`)} align="start" />
          </div>
          <div className={styles.col}>
            <h3 className={styles.h3}>{t(`${C}.toolsTitle`, values)}</h3>
            <p className={styles.text}>{t(`${C}.toolsText`)}</p>
            <ul className={styles.logos} aria-label={t(`${C}.toolsLabel`)}>
              {TOOLS.map((name) => {
                const logo = BRAND_LOGOS[name];
                return logo ? (
                  <li key={name}>
                    <LogoTile logo={logo} size="md" />
                  </li>
                ) : null;
              })}
            </ul>
            <div>
              <SiteButton to="integrations" variant="ghost">
                {t(`${C}.toolsCta`)}
              </SiteButton>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

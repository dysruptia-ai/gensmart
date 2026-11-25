'use client';

import Image from 'next/image';
import { ArrowRight, Globe, Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import type { SiteLinkKey } from '@/lib/site-links';
import Container from '../../Container';
import LogoTile, { BRAND_LOGOS } from '../../LogoTile';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import SiteLink from '../../SiteLink';
import { productValues } from '../productData';
import styles from './PlatformBento.module.css';

const B = 'site.product.bento';

const CHANNEL_LOGOS = ['whatsapp', 'instagram', 'messenger', 'telegram'];
const TOOL_LOGOS = ['Shopify', 'Tiendanube', 'HubSpot', 'Stripe'];

interface TileProps {
  to: SiteLinkKey;
  n: number;
  title: string;
  desc: string;
  className: string;
  children: ReactNode;
}

/** Tarjeta enlazada a su subpágina. Con `href: null` en el registro queda lista, sin navegar. */
function Tile({ to, n, title, desc, className, children }: TileProps) {
  return (
    <li className={className}>
      <SiteLink to={to} className={styles.tile}>
        <span className={styles.n} aria-hidden="true">
          {String(n).padStart(2, '0')}
        </span>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.desc}>{desc}</p>
        {children}
        <ArrowRight className={styles.go} aria-hidden="true" />
      </SiteLink>
    </li>
  );
}

export default function PlatformBento() {
  const { t, language } = useSiteTranslation();
  const values = productValues(t, language);
  const week = t(`${B}.week`).split(',');
  return (
    <Section id="plataforma" rhythm="l">
      <Container>
        <SectionHead title={t(`${B}.title`)} lead={t(`${B}.lead`)} />
        <ul className={styles.bento}>
          <Tile
            to="productAgents"
            n={1}
            title={t(`${B}.agentsTitle`)}
            desc={t(`${B}.agentsDesc`)}
            className={`${styles.cell} ${styles.a}`}
          >
            <dl className={styles.spec}>
              {(['Goal', 'Tone', 'Rule'] as const).map((k) => (
                <div key={k}>
                  <dt>{t(`${B}.spec${k}`)}</dt>
                  <dd>{t(`${B}.spec${k}Value`)}</dd>
                </div>
              ))}
            </dl>
          </Tile>
          <Tile
            to="productInbox"
            n={2}
            title={t(`${B}.inboxTitle`)}
            desc={t(`${B}.inboxDesc`)}
            className={`${styles.cell} ${styles.b}`}
          >
            <span className={styles.logos} aria-hidden="true">
              {CHANNEL_LOGOS.map((name) => (
                <span key={name} className={styles.ch}>
                  <Image src={`/site/img/logos/${name}.svg`} alt="" width={20} height={20} unoptimized />
                </span>
              ))}
              <span className={styles.ch}>
                <Mail size={20} />
              </span>
              <span className={styles.ch}>
                <Globe size={20} />
              </span>
            </span>
          </Tile>
          <Tile
            to="productCrm"
            n={3}
            title={t(`${B}.crmTitle`)}
            desc={t(`${B}.crmDesc`)}
            className={`${styles.cell} ${styles.c}`}
          >
            <span className={styles.funnel} aria-hidden="true">
              {[1, 2, 3, 4].map((i) => (
                <i key={i} className={i <= 2 ? styles.on : undefined}>
                  {t(`${B}.crm${i}`)}
                </i>
              ))}
            </span>
          </Tile>
          <Tile
            to="productBooking"
            n={4}
            title={t(`${B}.bookingTitle`)}
            desc={t(`${B}.bookingDesc`)}
            className={`${styles.cell} ${styles.d}`}
          >
            <span className={styles.week} aria-hidden="true">
              {week.map((day, i) => (
                <span key={i} className={i === 2 ? styles.on : undefined}>
                  {day}
                </span>
              ))}
            </span>
          </Tile>
          <Tile
            to="integrations"
            n={5}
            title={t(`${B}.integrationsTitle`)}
            desc={t(`${B}.integrationsDesc`, values)}
            className={`${styles.cell} ${styles.e}`}
          >
            <span className={styles.logos} aria-hidden="true">
              {TOOL_LOGOS.map((name) => {
                const logo = BRAND_LOGOS[name];
                return logo ? <LogoTile key={name} logo={logo} size="sm" /> : null;
              })}
            </span>
          </Tile>
        </ul>
      </Container>
    </Section>
  );
}

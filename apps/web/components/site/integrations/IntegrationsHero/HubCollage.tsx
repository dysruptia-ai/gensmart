import LogoTile, { BRAND_LOGOS } from '../../LogoTile';
import SiteLogo from '../../SiteLogo';
import styles from './HubCollage.module.css';

/** Ocho logos alrededor de GenSmart, en el orden del diseño (desde arriba, en sentido horario). */
const NODES = [
  'Tiendanube',
  'HubSpot',
  'Shopify',
  'Google Calendar',
  'Slack',
  'Stripe',
  'WooCommerce',
  'Zendesk',
] as const;

/** Collage decorativo del hero: los mismos logos están, con texto, en el directorio. */
export default function HubCollage() {
  return (
    <div className={styles.hub} aria-hidden="true">
      <svg className={styles.lines} viewBox="0 0 100 100" focusable="false">
        <line x1="50" y1="50" x2="50" y2="12" />
        <line x1="50" y1="50" x2="76.87" y2="23.13" />
        <line x1="50" y1="50" x2="88" y2="50" />
        <line x1="50" y1="50" x2="76.87" y2="76.87" />
        <line x1="50" y1="50" x2="50" y2="88" />
        <line x1="50" y1="50" x2="23.13" y2="76.87" />
        <line x1="50" y1="50" x2="12" y2="50" />
        <line x1="50" y1="50" x2="23.13" y2="23.13" />
      </svg>
      {NODES.map((name, i) => (
        <span key={`dot-${name}`} className={`${styles.dot} ${styles[`n${i + 1}`]}`} />
      ))}
      <span className={styles.core}>
        <SiteLogo variant="mark" to={null} tone="onLight" className={styles.mark} />
      </span>
      {NODES.map((name, i) => {
        const logo = BRAND_LOGOS[name];
        return logo ? (
          <span
            key={name}
            className={[styles.node, styles[`n${i + 1}`], logo.wordmark ? styles.wide : '']
              .filter(Boolean)
              .join(' ')}
          >
            <LogoTile logo={{ ...logo, wordmark: true }} className={styles.tile} />
          </span>
        ) : null;
      })}
    </div>
  );
}

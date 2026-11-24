import { GraduationCap, MessageCircle, Users, type LucideIcon } from 'lucide-react';
import SiteLink from '@/components/site/SiteLink';
import type { SiteLinkKey } from '@/lib/site-links';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import styles from './DocsHelp.module.css';

const PATHS: readonly { key: 'community' | 'academy' | 'contact'; to: SiteLinkKey; icon: LucideIcon }[] = [
  { key: 'community', to: 'community', icon: Users },
  // Academy sigue pendiente (`href: null`) hasta web-31
  { key: 'academy', to: 'academy', icon: GraduationCap },
  { key: 'contact', to: 'contact', icon: MessageCircle },
];

interface DocsHelpProps {
  lang: SiteLanguage;
  /** Dentro de la columna de una guía: una sola columna de enlaces. */
  compact?: boolean;
}

/** "¿Necesitas más ayuda?" (design/web: `dxHelp`). */
export default function DocsHelp({ lang, compact }: DocsHelpProps) {
  const t = siteT(lang);
  const id = compact ? 'docs-help-guide' : 'docs-help';
  return (
    <section className={[styles.help, compact ? styles.compact : ''].filter(Boolean).join(' ')} aria-labelledby={id}>
      <h2 id={id}>{t('site.docs.help.title')}</h2>
      <p>{t('site.docs.help.lead')}</p>
      <div className={styles.grid}>
        {PATHS.map(({ key, to, icon: Icon }) => (
          <SiteLink key={key} to={to} className={styles.card}>
            <span className={styles.icon} aria-hidden="true">
              <Icon size={19} />
            </span>
            <strong>{t(`site.docs.help.${key}.title`)}</strong>
            <span className={styles.desc}>{t(`site.docs.help.${key}.desc`)}</span>
          </SiteLink>
        ))}
      </div>
    </section>
  );
}

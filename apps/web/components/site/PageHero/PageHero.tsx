import type { ReactNode } from 'react';
import Breadcrumbs, { type Crumb } from '../Breadcrumbs';
import Container from '../Container';
import GlowBackdrop from '../GlowBackdrop';
import styles from './PageHero.module.css';

interface PageHeroProps {
  crumbs: readonly Crumb[];
  /** Único `h1` de la página: texto, con un tramo opcional resaltado en verde. */
  title: { before: string; accent?: string; after?: string };
  lead?: ReactNode;
  /** Botones (`SiteButton`). */
  actions?: ReactNode;
  /** Nota corta bajo los botones. */
  note?: ReactNode;
  /** Ilustración de la columna derecha (decorativa o con su propio rótulo). */
  aside?: ReactNode;
  /** Ilustración a todo el ancho, debajo del texto (subpáginas de Producto). */
  below?: ReactNode;
  /** `default`: `page-hero` de las páginas interiores. `feature`: `pr-hero` (título y aire mayores). */
  size?: 'default' | 'feature';
  className?: string;
}

/** Hero de las páginas interiores (design/web: `.page-hero` y `.pr-hero`). */
export default function PageHero({
  crumbs,
  title,
  lead,
  actions,
  note,
  aside,
  below,
  size = 'default',
  className,
}: PageHeroProps) {
  const classes = [
    styles.hero,
    size === 'feature' ? styles.feature : '',
    below ? styles.stacked : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <section className={classes}>
      <GlowBackdrop />
      <Container className={aside ? `${styles.inner} ${styles.split}` : styles.inner}>
        <div className={styles.copy}>
          <Breadcrumbs crumbs={crumbs} />
          <h1 className={styles.title}>
            {title.before}
            {title.accent ? (
              <>
                {' '}
                <span className={styles.accent}>{title.accent}</span>
              </>
            ) : null}
            {title.after ? ` ${title.after}` : null}
          </h1>
          {lead ? <p className={styles.lead}>{lead}</p> : null}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
          {note ? <p className={styles.note}>{note}</p> : null}
        </div>
        {aside ? <div className={styles.aside}>{aside}</div> : null}
        {below ? <div className={styles.below}>{below}</div> : null}
      </Container>
    </section>
  );
}

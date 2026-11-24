import type { ReactNode } from 'react';
import Image from 'next/image';
import Breadcrumbs, { type Crumb } from '../Breadcrumbs';
import Container from '../Container';
import GlowBackdrop from '../GlowBackdrop';
import styles from './PageHero.module.css';

interface PageHeroProps {
  crumbs: readonly Crumb[];
  /** La última miga también enlaza (artículos del blog: Inicio / Blog / {Categoría}). */
  linkLastCrumb?: boolean;
  /** Único `h1` de la página: texto, con un tramo opcional resaltado en verde. */
  title: { before: string; accent?: string; after?: string };
  /** Etiqueta corta sobre el título (p. ej. el tipo de un curso de Academy, que no tiene página). */
  eyebrow?: string;
  lead?: ReactNode;
  /** Subsectores en una línea bajo el lead (design/web: `.sub-line`), hasta 6. */
  subs?: readonly string[];
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
  /**
   * Foto de fondo (design/web: `.page-hero-bg`), en duotono verde y con velo para
   * el contraste. Decorativa y con `priority`, porque es el LCP de la página.
   * `light: false` para una foto oscura, que se aclara menos (design/web: sin `.is-light`).
   */
  photo?: { src: string; position?: string; light?: boolean };
  className?: string;
}

/** Hero de las páginas interiores (design/web: `.page-hero` y `.pr-hero`). */
export default function PageHero({
  crumbs,
  linkLastCrumb = false,
  title,
  eyebrow,
  lead,
  subs,
  actions,
  note,
  aside,
  below,
  size = 'default',
  photo,
  className,
}: PageHeroProps) {
  const classes = [
    styles.hero,
    size === 'feature' ? styles.feature : '',
    below ? styles.stacked : '',
    photo ? styles.photo : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <section className={classes}>
      {photo ? (
        <div className={styles.photoLayer} aria-hidden="true">
          <Image
            src={photo.src}
            alt=""
            fill
            priority
            sizes="100vw"
            className={photo.light === false ? `${styles.photoImg} ${styles.photoDark}` : styles.photoImg}
            style={photo.position ? { objectPosition: photo.position } : undefined}
          />
          <span className={styles.tone} />
        </div>
      ) : (
        <GlowBackdrop />
      )}
      <Container className={aside ? `${styles.inner} ${styles.split}` : styles.inner}>
        <div className={styles.copy}>
          <Breadcrumbs crumbs={crumbs} linkLast={linkLastCrumb} />
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
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
          {subs && subs.length > 0 ? (
            <p className={styles.subs}>
              {subs.slice(0, 6).map((sub) => (
                <span key={sub}>{sub}</span>
              ))}
            </p>
          ) : null}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
          {note ? <p className={styles.note}>{note}</p> : null}
        </div>
        {aside ? <div className={styles.aside}>{aside}</div> : null}
        {below ? <div className={styles.below}>{below}</div> : null}
      </Container>
    </section>
  );
}

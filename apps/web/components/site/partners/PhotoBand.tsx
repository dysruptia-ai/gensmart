import type { ReactNode } from 'react';
import Image from 'next/image';
import Container from '../Container';
import styles from './PhotoBand.module.css';

interface PhotoBandProps {
  id?: string;
  /** Foto decorativa de fondo, en duotono verde. */
  photo: { src: string; position?: string };
  pill: string;
  title: string;
  lead: string;
  /** Botones (`SiteButton`). */
  actions: ReactNode;
}

/** Banda con foto de fondo, etiqueta, título y botones (design/web: `.band-ph` de Partners). */
export default function PhotoBand({ id, photo, pill, title, lead, actions }: PhotoBandProps) {
  return (
    <section id={id} className={styles.band}>
      <div className={styles.photoLayer} aria-hidden="true">
        <Image
          src={photo.src}
          alt=""
          fill
          sizes="100vw"
          className={styles.photo}
          style={photo.position ? { objectPosition: photo.position } : undefined}
        />
        <span className={styles.tone} />
      </div>
      <Container className={styles.inner}>
        <span className={styles.pill}>{pill}</span>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.lead}>{lead}</p>
        <div className={styles.actions}>{actions}</div>
      </Container>
    </section>
  );
}

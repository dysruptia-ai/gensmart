import type { ReactNode } from 'react';
import Container from '../Container';
import Section from '../Section';
import styles from './ResourceBlock.module.css';

interface ResourceBlockProps {
  id: string;
  name: string;
  when: string;
  lead: string;
  /** Botón de la sección (`SiteButton`). */
  action: ReactNode;
  /** Vista previa de lo que hay dentro. */
  children: ReactNode;
  /** Cabecera a la derecha (design/web: `.rc-sec:nth-of-type(odd)`). */
  flip?: boolean;
  surface?: 'dark' | 'alt';
  first?: boolean;
}

/** Bloque de una sección del centro de recursos (design/web: `rcBlk`). */
export default function ResourceBlock({
  id,
  name,
  when,
  lead,
  action,
  children,
  flip = false,
  surface = 'dark',
  first = false,
}: ResourceBlockProps) {
  return (
    <Section surface={surface} rhythm="l" id={id} className={first ? styles.first : undefined}>
      <Container className={flip ? `${styles.block} ${styles.flip}` : styles.block}>
        <div className={styles.head}>
          <h2 className={styles.name}>{name}</h2>
          <p className={styles.when}>{when}</p>
          <p className={styles.lead}>{lead}</p>
          {action}
        </div>
        <div className={styles.preview}>{children}</div>
      </Container>
    </Section>
  );
}

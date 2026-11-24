import type { ReactNode } from 'react';
import Container from '../Container';
import Section from '../Section';
import styles from './BlogLayout.module.css';

interface BlogLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  id?: string;
}

/** Contenido y barra lateral del blog (design/web: `.bl-layout`, `.bl-main`). */
export default function BlogLayout({ children, sidebar, id }: BlogLayoutProps) {
  return (
    <Section surface="dark" rhythm="m" id={id}>
      <Container className={styles.layout}>
        <div className={styles.main}>{children}</div>
        <div className={styles.side}>{sidebar}</div>
      </Container>
    </Section>
  );
}

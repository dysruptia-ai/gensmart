import type { ReactNode } from 'react';
import DocsSearch from './DocsSearch';
import styles from './DocsShell.module.css';

/**
 * Aplica el tema guardado antes del primer pintado (sin parpadeo). Solo toca un atributo de
 * <html> que únicamente leen los estilos de la base de conocimiento.
 */
const THEME_SCRIPT =
  "try{var r=document.documentElement;if(localStorage.getItem('gs-docs-theme')==='light')r.setAttribute('data-docs-theme','light');else r.removeAttribute('data-docs-theme')}catch(e){}";

interface DocsShellProps {
  children: ReactNode;
}

/** Marco de la base de conocimiento: tema, buscador (botones y diálogo) y fondo propio. */
export default function DocsShell({ children }: DocsShellProps) {
  return (
    <div className={styles.shell}>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <DocsSearch>{children}</DocsSearch>
    </div>
  );
}

import type { ReactNode } from 'react';
import { cx } from './cx';

interface MockWindowProps {
  /** Qué muestra la maqueta (nombre accesible del grupo). */
  label: string;
  /** Texto de la barra de la ventana. */
  bar: string;
  /** Clases del diseño además de `ag-win` (p. ej. `bx-win`, `crm-ex`). */
  variant?: readonly string[];
  children: ReactNode;
}

/**
 * Ventana de la plataforma (design: `figure.ag-win`). Es una ilustración: `role="group"`
 * con nombre, el texto de adentro se lee y nada es enfocable.
 */
export default function MockWindow({ label, bar, variant = [], children }: MockWindowProps) {
  return (
    <div role="group" aria-label={label} className={cx('ag-win', ...variant)}>
      <div className={cx('ag-bar')}>
        <i aria-hidden="true" />
        <i aria-hidden="true" />
        <i aria-hidden="true" />
        <span>{bar}</span>
      </div>
      {children}
    </div>
  );
}

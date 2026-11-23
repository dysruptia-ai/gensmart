import styles from './ProductSubpage.module.css';

/**
 * Clases del módulo compartido por nombre del diseño: `cx('ag-win', on && 'on')`.
 * Así el marcado de las maquetas se lee igual que el HTML de referencia.
 */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names
    .filter((n): n is string => Boolean(n))
    .map((n) => styles[n])
    .filter(Boolean)
    .join(' ');
}

export { styles };

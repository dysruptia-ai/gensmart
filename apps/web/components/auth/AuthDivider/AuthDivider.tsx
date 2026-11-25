import React from 'react';
import styles from './AuthDivider.module.css';

/** Separador "o con tu correo" entre el ingreso con un proveedor y el formulario. */
export default function AuthDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.divider}>
      <span>{children}</span>
    </div>
  );
}

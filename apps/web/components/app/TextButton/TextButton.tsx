import React from 'react';
import styles from './TextButton.module.css';

export interface TextButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** `link`: verde subrayado. `back`: gris, para "Volver". */
  tone?: 'link' | 'back';
}

/** Acción con aspecto de enlace (abrir el código promocional, código de respaldo, volver). */
export default function TextButton({ tone = 'link', className, type = 'button', ...rest }: TextButtonProps) {
  return <button {...rest} type={type} className={[styles.btn, styles[tone], className].filter(Boolean).join(' ')} />;
}

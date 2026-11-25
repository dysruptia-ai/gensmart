'use client';

import React, { useEffect, useRef } from 'react';
import styles from './AuthHeading.module.css';

/** La primera pantalla que se abre no mueve el foco; las siguientes (pantalla o paso), sí. */
let firstScreen = true;

export interface AuthHeadingProps {
  title: string;
  subtitle?: React.ReactNode;
}

/**
 * Título de cada pantalla de acceso. Al cambiar de pantalla o de paso recibe el foco
 * (`tabIndex=-1`), como pide el diseño. Para un paso nuevo dentro de la misma ruta,
 * dale un `key` distinto para que se vuelva a montar.
 */
export default function AuthHeading({ title, subtitle }: AuthHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const shouldFocus = useRef<boolean | null>(null);
  if (shouldFocus.current === null) shouldFocus.current = !firstScreen;

  useEffect(() => {
    firstScreen = false;
    if (shouldFocus.current) ref.current?.focus();
  }, []);

  return (
    <>
      <h1 ref={ref} tabIndex={-1} className={styles.title}>
        {title}
      </h1>
      {subtitle && <p className={styles.lead}>{subtitle}</p>}
    </>
  );
}

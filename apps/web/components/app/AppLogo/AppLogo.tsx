import React from 'react';
import Link from 'next/link';
import styles from './AppLogo.module.css';

export interface AppLogoProps {
  /** Destino del logo. Sin `href` se pinta sin enlace. */
  href?: string;
  /** Nombre accesible del enlace. */
  label?: string;
  /** Alto en px (el ancho sale de la proporción del SVG). */
  height?: number;
}

const RATIO = 26640 / 9120;

/**
 * Logo de GenSmart con los SVG de `public/app/`: el oscuro en tema claro y el invertido en
 * tema noche. Se cambia por CSS, así no parpadea antes de hidratar.
 */
export default function AppLogo({ href, label = 'GenSmart', height = 30 }: AppLogoProps) {
  const width = Math.round(height * RATIO);
  const imgs = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático, sin optimizar */}
      <img className={styles.onLight} src="/app/logo-gensmart.svg" alt={href ? '' : label} width={width} height={height} />
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático, sin optimizar */}
      <img className={styles.onDark} src="/app/logo-gensmart-inv.svg" alt="" aria-hidden="true" width={width} height={height} />
    </>
  );
  if (!href) return <span className={styles.logo}>{imgs}</span>;
  return (
    <Link href={href} className={styles.logo} aria-label={label}>
      {imgs}
    </Link>
  );
}

import styles from './GlowBackdrop.module.css';

interface GlowBackdropProps {
  /** Punto de extensión: hoy 'hero' y 'cta' son idénticos */
  variant?: 'hero' | 'cta';
}

/** Rejilla de puntos + brillos verdes. El contenedor debe ser `position: relative; overflow: clip`. */
export default function GlowBackdrop({ variant = 'hero' }: GlowBackdropProps) {
  return (
    <div
      className={[styles.backdrop, variant === 'cta' ? styles.cta : styles.hero].join(' ')}
      aria-hidden="true"
    />
  );
}

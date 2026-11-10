import Image from 'next/image';
import type { BrandLogo } from './logoData';
import styles from './LogoTile.module.css';

interface LogoTileProps {
  logo: BrandLogo;
  /** sm: mega menú (40px); md: rejilla de integraciones (52px) */
  size?: 'sm' | 'md';
  /** Hover (opacidad + elevación). Solo en la rejilla de integraciones. */
  interactive?: boolean;
  className?: string;
}

/** Ficha blanca con el logo de una marca de terceros (no enlazada). */
export default function LogoTile({ logo, size = 'md', interactive = false, className }: LogoTileProps) {
  const classes = [styles.tile, size === 'sm' ? styles.sm : styles.md, interactive ? styles.interactive : null, className]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes}>
      <Image
        src={logo.src}
        alt={logo.wordmark ? logo.name : ''}
        width={logo.width}
        height={logo.height}
        unoptimized
        className={logo.wordmark ? styles.word : styles.mark}
      />
      {logo.wordmark ? null : logo.name}
    </span>
  );
}

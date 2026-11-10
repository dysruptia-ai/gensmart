import localFont from 'next/font/local';

/**
 * Handjet 700 recortada a las letras de "GenSmart" (≈1 KB). Instancia estática
 * (wght=700, ELGR=1, ELSH=2 = valores por defecto). Licencia: ./fonts/OFL.txt
 */
export const handjetLogo = localFont({
  src: './fonts/handjet-logo-700.woff2',
  weight: '700',
  display: 'block',
  preload: true,
  variable: '--font-site-logo',
  fallback: ['monospace'],
});

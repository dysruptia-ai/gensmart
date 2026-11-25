import localFont from 'next/font/local';

/**
 * Fuentes del dashboard viejo, solo en el layout de la plataforma (antes `next/font/google`).
 * Inter 4.001 variable (100–900) y Handjet 2.003 en 700, los mismos archivos que servía Google.
 * Licencias: ./files/OFL-*.txt. Respaldos: ./fallbacks.css
 */

export const inter = localFont({
  src: './files/inter-latin-variable.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-family',
  adjustFontFallback: false,
  fallback: ['Inter Fallback'],
  // Rango "latin" de Google Fonts, el mismo de antes (alcanza para ES y EN)
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
});

export const handjet = localFont({
  src: './files/handjet-latin-700.woff2',
  weight: '700',
  style: 'normal',
  display: 'swap',
  variable: '--font-logo',
  adjustFontFallback: false,
  fallback: ['Handjet Fallback'],
  // Rango "latin" de Google Fonts, el mismo de antes (alcanza para ES y EN)
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
});

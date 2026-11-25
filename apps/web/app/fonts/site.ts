import localFont from 'next/font/local';

/**
 * Sora y Geist servidas desde el proyecto (antes `next/font/google`): sitio público y plataforma.
 * Son los mismos archivos que servía Google (variables, subconjunto latino): Geist 1.800, Sora 2.000.
 * Cada peso es una cara propia apuntando al mismo archivo, como lo generaba `next/font/google`:
 * así un peso intermedio (650) sigue cayendo en el peso declarado más cercano. Licencias: ./files/OFL-*.txt.
 * Respaldos mientras carga: ./fallbacks.css
 */

export const sora = localFont({
  src: [
    { path: './files/sora-latin-variable.woff2', weight: '600', style: 'normal' },
    { path: './files/sora-latin-variable.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-sora',
  adjustFontFallback: false,
  fallback: ['Sora Fallback'],
  // Rango "latin" de Google Fonts, el mismo de antes (alcanza para ES y EN)
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
});

export const geist = localFont({
  src: [
    { path: './files/geist-latin-variable.woff2', weight: '400', style: 'normal' },
    { path: './files/geist-latin-variable.woff2', weight: '500', style: 'normal' },
    { path: './files/geist-latin-variable.woff2', weight: '600', style: 'normal' },
    { path: './files/geist-latin-variable.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-geist',
  adjustFontFallback: false,
  fallback: ['Geist Fallback'],
  // Rango "latin" de Google Fonts, el mismo de antes (alcanza para ES y EN)
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
});

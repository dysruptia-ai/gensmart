import localFont from 'next/font/local';

/**
 * La 404 global (fuera de los layouts) pedía menos pesos que el sitio: Sora 600 y Geist 400–600.
 * Se conservan igual, para que un 700 siga cayendo en 600 como antes. Geist es el mismo archivo que `site.ts`; Sora, su instancia estática 600.
 */

export const soraNotFound = localFont({
  // Con un solo peso, Google servía la instancia estática SemiBold (no la variable): se conserva
  src: [{ path: './files/sora-latin-600.woff2', weight: '600', style: 'normal' }],
  display: 'swap',
  variable: '--font-sora',
  adjustFontFallback: false,
  fallback: ['Sora Fallback'],
  // Rango "latin" de Google Fonts, el mismo de antes (alcanza para ES y EN)
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
});

export const geistNotFound = localFont({
  src: [
    { path: './files/geist-latin-variable.woff2', weight: '400', style: 'normal' },
    { path: './files/geist-latin-variable.woff2', weight: '500', style: 'normal' },
    { path: './files/geist-latin-variable.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-geist',
  adjustFontFallback: false,
  fallback: ['Geist Fallback'],
  // Rango "latin" de Google Fonts, el mismo de antes (alcanza para ES y EN)
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
});

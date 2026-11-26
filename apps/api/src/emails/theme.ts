/**
 * Colores y fuentes de los correos (tokens de design/04-documentacion/DESIGN.md y de
 * apps/web/app/(platform)/gs-tokens.css). Todo en colores sólidos: Outlook no entiende rgba.
 */
export const LIGHT = {
  bg: '#f6f8f7',
  card: '#ffffff',
  text: '#0c1014',
  muted: '#4b5753',
  line: '#dfe3e1',
  lineSoft: '#e3e7e5',
  link: '#0b6b36',
  soft: '#eef2f0',
  okBg: '#e4f6ec',
  ok: '#0b6b36',
  warn: '#8a5a00',
  warnText: '#5c3c00',
  warnBg: '#fbf1dc',
  err: '#b42318',
  errText: '#7a1a12',
  errBg: '#fdecea',
  logoGen: '#0c1014',
} as const;

/** Modo oscuro (`prefers-color-scheme: dark`); los fondos con transparencia, ya mezclados sobre la tarjeta. */
export const DARK = {
  bg: '#0c1014',
  card: '#151b21',
  text: '#f0f4f2',
  muted: '#a9b4b0',
  line: '#2a3239',
  link: '#3ddc84',
  soft: '#1c242b',
  okBg: '#1a322d',
  ok: '#3ddc84',
  warn: '#e8c98e',
  warnBg: '#2e302e',
  err: '#ff8a7e',
  errBg: '#31282c',
  logoGen: '#ffffff',
} as const;

/** Siempre igual en los dos temas. */
export const BRAND = {
  smart: '#25D366',
  button: '#3ddc84',
  buttonText: '#04170c',
  video: '#070a0e',
  videoText: '#f0f4f2',
  videoMuted: '#a9b4b0',
} as const;

const FALLBACK = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const FONT_BODY = `'Geist', ${FALLBACK}`;
export const FONT_HEADING = `'Sora', ${FALLBACK}`;
export const FONT_LOGO = `'Handjet', ${FALLBACK}`;

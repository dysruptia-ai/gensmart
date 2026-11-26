/**
 * Plantilla base de los correos de la plataforma.
 *
 * Cada correo se describe con bloques (`Block`), y de los mismos bloques salen el HTML y el texto
 * plano. El HTML va con tablas y estilos en línea (Gmail, Outlook de escritorio y web, Apple Mail,
 * móviles): sin flex, sin grid, sin imágenes y sin JavaScript. El modo oscuro va en un `<style>` con
 * `prefers-color-scheme` para los clientes que lo respetan; los que invierten solos siguen legibles
 * porque no hay grises medios ni texto sobre colores parecidos.
 *
 * Todo texto de los bloques se escapa aquí: los correos pasan los datos tal cual.
 */
import { escapeHtml, escapeHtmlWithBreaks, stripLineBreaks } from '../utils/html';
import { BRAND, DARK, FONT_BODY, FONT_HEADING, FONT_LOGO, LIGHT } from './theme';
import { siteUrl } from './links';
import type { EmailLang, RenderedEmail } from './types';
import { getStrings } from './strings';

/** Trozo de texto de un párrafo: texto suelto, en negrita o enlace. */
export type Inline = string | { bold: string } | { link: string; href: string };

export type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; parts: Inline[]; small?: boolean }
  | { type: 'button'; label: string; href: string }
  /** "¿El botón no funciona? Copia y pega este enlace" con la URL visible. */
  | { type: 'linkFallback'; intro: string; href: string }
  | { type: 'notice'; tone: 'warn' | 'err'; parts: Inline[] }
  | { type: 'details'; rows: Array<{ label: string; value: string }> }
  | { type: 'panel'; title: string; text: string }
  | { type: 'bullets'; title: string; items: string[] }
  | { type: 'score'; score: string; outOf: string; title: string; lines: string[] }
  | { type: 'video'; href: string; ariaLabel: string; title: string; meta: string; source: string; note: string }
  | {
      type: 'guides';
      title: string;
      items: Array<{ href: string; title: string; description: string }>;
      allLabel: string;
      allHref: string;
    }
  /** HTML ya armado (y ya escapado) por quien llama: solo el contenedor del agente. */
  | { type: 'rawHtml'; html: string; text: string };

export interface EmailContent {
  lang: EmailLang;
  subject: string;
  preheader: string;
  blocks: Block[];
  /** Línea del pie: por qué la persona recibe el correo. */
  footerReason: string;
}

// ── Utilidades ────────────────────────────────────────────────────────────────

const e = escapeHtml;

function inlineHtml(parts: Inline[]): string {
  return parts
    .map((p) => {
      if (typeof p === 'string') return escapeHtmlWithBreaks(p);
      if ('bold' in p) return `<b class="gs-text" style="color:${LIGHT.text};font-weight:600;">${e(p.bold)}</b>`;
      return `<a class="gs-link" href="${e(p.href)}" style="color:${LIGHT.link};text-decoration:underline;">${e(p.link)}</a>`;
    })
    .join('');
}

function inlineText(parts: Inline[]): string {
  return parts
    .map((p) => {
      if (typeof p === 'string') return p;
      if ('bold' in p) return p.bold;
      return `${p.link} (${p.href})`;
    })
    .join('');
}

/** Fila de la tarjeta con el relleno lateral de siempre. */
function row(inner: string, padding = '0 40px 20px'): string {
  return `<tr><td class="gs-pad" style="padding:${padding};">${inner}</td></tr>`;
}

// ── Bloques a HTML ────────────────────────────────────────────────────────────

/** Botón "a prueba de balas": el fondo en la celda, y un v:roundrect para Outlook de escritorio. */
function buttonHtml(label: string, href: string): string {
  const width = Math.max(160, Math.round(label.length * 9.5) + 56);
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
<tr><td>
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${e(href)}" style="height:48px;v-text-anchor:middle;width:${width}px;" arcsize="21%" stroke="f" fillcolor="${BRAND.button}">
<w:anchorlock/>
<center style="color:${BRAND.buttonText};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${e(label)}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;"><tr>
<td align="center" bgcolor="${BRAND.button}" style="background:${BRAND.button};border-radius:10px;">
<a href="${e(href)}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${FONT_BODY};font-size:16px;font-weight:600;line-height:20px;color:${BRAND.buttonText};text-decoration:none;border-radius:10px;">${e(label)}</a>
</td></tr></table>
<!--<![endif]-->
</td></tr></table>`;
}

function blockHtml(b: Block): string {
  switch (b.type) {
    case 'heading':
      return row(
        `<h1 class="gs-text" style="margin:0;font-family:${FONT_HEADING};font-weight:700;font-size:26px;line-height:1.25;color:${LIGHT.text};">${e(b.text)}</h1>`,
        '28px 40px 16px'
      );
    case 'paragraph': {
      const size = b.small ? '13px' : '16px';
      return row(
        `<p class="gs-muted" style="margin:0;font-family:${FONT_BODY};font-size:${size};line-height:1.6;color:${LIGHT.muted};">${inlineHtml(b.parts)}</p>`,
        b.small ? '0 40px 14px' : '0 40px 16px'
      );
    }
    case 'button':
      return row(buttonHtml(b.label, b.href), '8px 40px 24px');
    case 'linkFallback':
      return row(
        `<p class="gs-muted" style="margin:0;font-family:${FONT_BODY};font-size:13px;line-height:1.6;color:${LIGHT.muted};">${e(b.intro)}<br><a class="gs-link" href="${e(b.href)}" style="color:${LIGHT.link};text-decoration:underline;word-break:break-all;">${e(b.href)}</a></p>`,
        '0 40px 14px'
      );
    case 'notice': {
      const c =
        b.tone === 'warn'
          ? { cls: 'gs-warn', fg: LIGHT.warn, text: LIGHT.warnText, bg: LIGHT.warnBg }
          : { cls: 'gs-err', fg: LIGHT.err, text: LIGHT.errText, bg: LIGHT.errBg };
      return row(
        `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
<tr><td class="${c.cls}-box" bgcolor="${c.bg}" style="background:${c.bg};border-left:4px solid ${c.fg};border-radius:12px;padding:16px 18px;font-family:${FONT_BODY};font-size:15px;line-height:1.55;color:${c.text};">
<span class="${c.cls}-text" style="color:${c.text};">${inlineHtml(b.parts)}</span>
</td></tr></table>`,
        '4px 40px 20px'
      );
    }
    case 'details': {
      const rows = b.rows
        .map(
          (r, i) => `<tr>
<td class="gs-muted gs-line" valign="top" width="110" style="padding:10px 16px 10px 0;${i > 0 ? `border-top:1px solid ${LIGHT.lineSoft};` : ''}font-family:${FONT_BODY};font-size:14px;line-height:1.5;color:${LIGHT.muted};">${e(r.label)}</td>
<td class="gs-text gs-line" valign="top" style="padding:10px 0;${i > 0 ? `border-top:1px solid ${LIGHT.lineSoft};` : ''}font-family:${FONT_BODY};font-size:15px;line-height:1.5;font-weight:600;color:${LIGHT.text};">${escapeHtmlWithBreaks(r.value)}</td>
</tr>`
        )
        .join('');
      return row(
        `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
<tr><td class="gs-line" style="border:1px solid ${LIGHT.line};border-radius:12px;padding:6px 20px;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">${rows}</table>
</td></tr></table>`,
        '4px 40px 20px'
      );
    }
    case 'panel':
      return row(
        `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
<tr><td class="gs-soft" bgcolor="${LIGHT.soft}" style="background:${LIGHT.soft};border-radius:12px;padding:16px 18px;font-family:${FONT_BODY};">
<p class="gs-text" style="margin:0 0 6px;font-size:14px;font-weight:600;line-height:1.4;color:${LIGHT.text};">${e(b.title)}</p>
<p class="gs-muted" style="margin:0;font-size:15px;line-height:1.55;color:${LIGHT.muted};">${escapeHtmlWithBreaks(b.text)}</p>
</td></tr></table>`,
        '0 40px 20px'
      );
    case 'bullets':
      return row(
        `<p class="gs-text" style="margin:0 0 8px;font-family:${FONT_BODY};font-size:14px;font-weight:600;color:${LIGHT.text};">${e(b.title)}</p>
${b.items
  .map(
    (it) =>
      `<p class="gs-muted" style="margin:0 0 6px;font-family:${FONT_BODY};font-size:14px;line-height:1.5;color:${LIGHT.muted};">&middot;&nbsp;${e(it)}</p>`
  )
  .join('\n')}`,
        '0 40px 16px'
      );
    case 'score':
      return row(
        `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
<tr><td class="gs-line" style="border:1px solid ${LIGHT.line};border-radius:12px;padding:18px 20px;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>
<td class="gs-ok-box" width="72" height="72" align="center" valign="middle" bgcolor="${LIGHT.okBg}" style="width:72px;height:72px;background:${LIGHT.okBg};border-radius:14px;font-family:${FONT_BODY};">
<span class="gs-ok-text" style="display:block;font-family:${FONT_HEADING};font-weight:700;font-size:26px;line-height:30px;color:${LIGHT.ok};">${e(b.score)}</span>
<span class="gs-ok-text" style="display:block;font-size:12px;line-height:16px;color:${LIGHT.ok};">${e(b.outOf)}</span>
</td>
<td style="padding-left:16px;font-family:${FONT_BODY};" valign="middle">
<p class="gs-text" style="margin:0 0 4px;font-size:17px;font-weight:600;line-height:1.35;color:${LIGHT.text};">${e(b.title)}</p>
${b.lines.map((l) => `<p class="gs-muted" style="margin:0 0 2px;font-size:14px;line-height:1.5;color:${LIGHT.muted};">${e(l)}</p>`).join('\n')}
</td>
</tr></table>
</td></tr></table>`,
        '4px 40px 20px'
      );
    case 'video':
      // Bloque oscuro igual en los dos temas, todo un enlace. El triángulo es texto (con el selector
      // de variación de texto para que iOS no lo pinte como emoji); en Outlook el círculo puede verse cuadrado.
      return row(
        `<a href="${e(b.href)}" target="_blank" aria-label="${e(b.ariaLabel)}" style="display:block;text-decoration:none;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
<tr><td bgcolor="${BRAND.video}" style="background:${BRAND.video};border-radius:14px;padding:22px 24px;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
<tr><td style="padding-bottom:64px;font-family:${FONT_LOGO};font-weight:700;font-size:24px;line-height:28px;letter-spacing:-0.02em;"><span style="color:#ffffff;">Gen</span><span style="color:${BRAND.smart};">Smart</span></td></tr>
<tr><td>
<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>
<td width="64" height="64" align="center" valign="middle" bgcolor="${BRAND.button}" style="width:64px;height:64px;background:${BRAND.button};border-radius:999px;font-family:Arial,sans-serif;font-size:22px;line-height:64px;color:${BRAND.buttonText};">&#9654;&#65038;</td>
<td valign="middle" style="padding-left:18px;font-family:${FONT_BODY};">
<p style="margin:0 0 4px;font-family:${FONT_HEADING};font-weight:600;font-size:20px;line-height:1.3;color:${BRAND.videoText};">${e(b.title)}</p>
<p style="margin:0;font-size:14px;line-height:1.4;color:${BRAND.videoMuted};">${e(b.meta)}</p>
</td>
</tr></table>
</td></tr>
<tr><td style="padding-top:56px;font-family:${FONT_BODY};font-size:12px;line-height:1.4;color:${BRAND.videoMuted};">${e(b.source)}</td></tr>
</table>
</td></tr></table>
</a>
<p class="gs-muted" style="margin:10px 0 0;font-family:${FONT_BODY};font-size:13px;line-height:1.5;color:${LIGHT.muted};">${e(b.note)}</p>`,
        '8px 40px 24px'
      );
    case 'guides': {
      const items = b.items
        .map(
          (it, i) => `<tr>
<td class="gs-line" valign="top" width="44" style="padding:14px 0;border-top:1px solid ${LIGHT.lineSoft};">
<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="gs-ok-box" width="28" height="28" align="center" valign="middle" bgcolor="${LIGHT.okBg}" style="width:28px;height:28px;background:${LIGHT.okBg};border-radius:999px;font-family:${FONT_BODY};font-size:14px;font-weight:700;line-height:28px;"><a class="gs-ok-text" href="${e(it.href)}" target="_blank" style="color:${LIGHT.ok};text-decoration:none;">${i + 1}</a></td></tr></table>
</td>
<td class="gs-line" valign="top" style="padding:14px 0;border-top:1px solid ${LIGHT.lineSoft};font-family:${FONT_BODY};">
<a class="gs-text" href="${e(it.href)}" target="_blank" style="display:block;font-size:15px;font-weight:600;line-height:1.4;color:${LIGHT.text};text-decoration:none;">${e(it.title)}</a>
<p class="gs-muted" style="margin:3px 0 0;font-size:14px;line-height:1.5;color:${LIGHT.muted};">${e(it.description)}</p>
</td>
</tr>`
        )
        .join('');
      return row(
        `<h2 class="gs-text" style="margin:0 0 8px;font-family:${FONT_HEADING};font-weight:600;font-size:20px;line-height:1.3;color:${LIGHT.text};">${e(b.title)}</h2>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">${items}</table>
<p style="margin:10px 0 0;font-family:${FONT_BODY};font-size:15px;font-weight:600;"><a class="gs-link" href="${e(b.allHref)}" target="_blank" style="color:${LIGHT.link};text-decoration:underline;">${e(b.allLabel)}</a></p>`,
        '12px 40px 24px'
      );
    }
    case 'rawHtml':
      return row(b.html, '0 40px 20px');
  }
}

// ── Bloques a texto plano ─────────────────────────────────────────────────────

function blockText(b: Block): string {
  switch (b.type) {
    case 'heading':
      return b.text;
    case 'paragraph':
      return inlineText(b.parts);
    case 'button':
      return `${b.label}: ${b.href}`;
    case 'linkFallback':
      return `${b.intro}\n${b.href}`;
    case 'notice':
      return inlineText(b.parts);
    case 'details':
      return b.rows.map((r) => `${r.label}: ${r.value}`).join('\n');
    case 'panel':
      return `${b.title}\n${b.text}`;
    case 'bullets':
      return [b.title, ...b.items.map((i) => `- ${i}`)].join('\n');
    case 'score':
      return [`${b.score} ${b.outOf}: ${b.title}`, ...b.lines].join('\n');
    case 'video':
      return `${b.title} (${b.meta})\n${b.href}\n${b.note}`;
    case 'guides':
      return [
        b.title,
        ...b.items.map((it, i) => `${i + 1}. ${it.title}: ${it.description}\n   ${it.href}`),
        `${b.allLabel}: ${b.allHref}`,
      ].join('\n');
    case 'rawHtml':
      return b.text;
  }
}

// ── Documento ─────────────────────────────────────────────────────────────────

const DARK_CSS = `
@media (prefers-color-scheme: dark) {
  .gs-bg { background:${DARK.bg} !important; }
  .gs-card { background:${DARK.card} !important; border-color:${DARK.line} !important; }
  .gs-text { color:${DARK.text} !important; }
  .gs-muted { color:${DARK.muted} !important; }
  .gs-link { color:${DARK.link} !important; }
  .gs-line { border-color:${DARK.line} !important; }
  .gs-soft { background:${DARK.soft} !important; }
  .gs-ok-box { background:${DARK.okBg} !important; }
  .gs-ok-text { color:${DARK.ok} !important; }
  .gs-warn-box { background:${DARK.warnBg} !important; border-color:${DARK.warn} !important; }
  .gs-warn-text { color:${DARK.warn} !important; }
  .gs-err-box { background:${DARK.errBg} !important; border-color:${DARK.err} !important; }
  .gs-err-text { color:${DARK.err} !important; }
  .gs-gen { color:${DARK.logoGen} !important; }
}
[data-ogsc] .gs-gen { color:${DARK.logoGen} !important; }`;

const BASE_CSS = `
body { margin:0 !important; padding:0 !important; width:100% !important; }
table { border-collapse:collapse; }
a { color:${LIGHT.link}; }
@media only screen and (max-width:620px) {
  .gs-wrap { width:100% !important; }
  .gs-outer { padding:16px 8px !important; }
  .gs-pad { padding-left:22px !important; padding-right:22px !important; }
}`;

/** Relleno para que la bandeja no muestre el comienzo del cuerpo después del preencabezado. */
const PREHEADER_FILL = '&#847;&zwnj;&nbsp;'.repeat(60);

function footerHtml(lang: EmailLang, reason: string): string {
  const s = getStrings(lang).layout;
  const year = new Date().getFullYear();
  const p = (inner: string) =>
    `<p class="gs-muted" style="margin:0 0 8px;font-family:${FONT_BODY};font-size:12px;line-height:1.6;color:${LIGHT.muted};">${inner}</p>`;
  return `${p(e(reason))}
${p(`<a class="gs-link" href="${e(siteUrl('home', lang))}" style="color:${LIGHT.link};text-decoration:underline;">${e(s.siteLabel)}</a> &middot; <a class="gs-link" href="${e(siteUrl('privacy', lang))}" style="color:${LIGHT.link};text-decoration:underline;">${e(s.privacy)}</a>`)}
${p(`&copy; ${year} Dysruptia LLC`)}`;
}

function footerText(lang: EmailLang, reason: string): string {
  const s = getStrings(lang).layout;
  const year = new Date().getFullYear();
  return [reason, `${s.siteLabel}: ${siteUrl('home', lang)}`, `${s.privacy}: ${siteUrl('privacy', lang)}`, `© ${year} Dysruptia LLC`].join(
    '\n'
  );
}

export function renderEmail(content: EmailContent): RenderedEmail {
  const { lang, preheader, blocks, footerReason } = content;
  const subject = stripLineBreaks(content.subject);
  const s = getStrings(lang).layout;

  const html = `<!doctype html>
<html lang="${lang}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${e(subject)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>* { font-family: Arial, sans-serif !important; }</style>
<![endif]-->
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }${BASE_CSS}${DARK_CSS}
</style>
</head>
<body class="gs-bg" style="margin:0;padding:0;background:${LIGHT.bg};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${e(preheader)}${PREHEADER_FILL}</div>
<table role="presentation" class="gs-bg" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${LIGHT.bg}" style="background:${LIGHT.bg};">
<tr><td class="gs-outer" align="center" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" class="gs-wrap" width="600" border="0" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
<tr><td>
<table role="presentation" class="gs-card" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${LIGHT.card}" style="background:${LIGHT.card};border:1px solid ${LIGHT.line};border-radius:16px;border-collapse:separate;">
<tr><td class="gs-pad" style="padding:28px 40px 0;">
<a href="${e(siteUrl('home', lang))}" target="_blank" aria-label="${e(s.logoLabel)}" style="text-decoration:none;font-family:${FONT_LOGO};font-weight:700;font-size:32px;line-height:36px;letter-spacing:-0.02em;"><span class="gs-gen" style="color:${LIGHT.logoGen};">Gen</span><span style="color:${BRAND.smart};">Smart</span></a>
</td></tr>
${blocks.map(blockHtml).join('\n')}
<tr><td style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>
</table>
</td></tr>
<tr><td class="gs-pad" align="center" style="padding:24px 40px 0;text-align:center;">
${footerHtml(lang, footerReason)}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;

  const text = [blocks.map(blockText).join('\n\n'), '---', footerText(lang, footerReason)].join('\n\n');

  return { subject, html, text };
}

/**
 * Contenedor de los correos internos (contacto con ventas, comentarios de docs): reciben HTML ya
 * armado por su servicio (por inyección, `wrapHtml`). En inglés, para el equipo.
 */
export function wrapInternalHtml(contentHtml: string): string {
  return renderEmail({
    lang: 'en',
    subject: 'GenSmart',
    preheader: '',
    blocks: [{ type: 'rawHtml', html: contentHtml, text: '' }],
    footerReason: getStrings('en').layout.footerInternal,
  }).html;
}

/** Texto plano aproximado de un HTML (para los correos que solo traen HTML, como los internos). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(head|style|title)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // El espacio entre etiquetas (sangría del HTML) no es texto
    .replace(/>\s*\n\s*</g, '><')
    .replace(/<br\s*\/?>/gi, '\n')
    // Tablas de etiqueta y valor: "Name: María Gómez", una fila por línea
    .replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, '\uE000')
    // Esas filas van una por línea; las de una sola celda (el logo, cada bloque) cierran un párrafo
    .replace(/<tr[^>]*>((?:(?!<tr[\s>])[^\uE000])*?\uE000(?:(?!<\/tr>)[\s\S])*)<\/tr>/gi, '$1\n')
    .replace(/\uE000/g, ': ')
    .replace(/<\/tr>/gi, '\n\n')
    .replace(/<\/(div|li)>/gi, '\n')
    .replace(/<\/(p|h[1-6]|table)>/gi, '\n\n')
    // mailto con la misma dirección como texto: solo la dirección
    .replace(/<a [^>]*href="mailto:([^"]*)"[^>]*>\1<\/a>/gi, '$1')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#847;|&zwnj;/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&middot;/g, '·')
    .replace(/&copy;/g, '©')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';
import { EMAIL_REGISTRY } from './registry';
import { es } from './strings/es';
import { en } from './strings/en';
import { EMAIL_ASSETS_URL, SITE_PATHS, UTM_VALUE, getWebUrl, WELCOME_VIDEO, withUtm } from './links';
import { buildFromAddress, parseFromAddress } from './from-address';
import { highScoreLeadEmail, htmlToText, invitationEmail, planLimitEmail, welcomeEmail, wrapInternalHtml } from './index';
import { WELCOME_UTM_CONTENT } from './templates/welcome';
import { buildContactEmail, contactSalesSchema } from '../services/contact-sales.service';
import { buildDocsFeedbackEmail, docsFeedbackSchema } from '../services/docs-feedback.service';
import { formatAppointment } from './parts';

const WEB_LIB = path.resolve(__dirname, '../../../web/lib');

/** Claves de un objeto de textos, en profundidad ("welcome.subject"…). */
function keysOf(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keysOf(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]
  );
}

/** Todos los textos (las funciones con un valor de ejemplo). */
function valuesOf(obj: Record<string, unknown>): string[] {
  return Object.values(obj).flatMap((v) => {
    if (typeof v === 'string') return [v];
    if (typeof v === 'function') return [String((v as (...a: string[]) => string)('X', 'Y', 'Z'))];
    return v && typeof v === 'object' ? valuesOf(v as Record<string, unknown>) : [];
  });
}

void test('es.ts y en.ts tienen las mismas claves', () => {
  const a = keysOf(es).sort();
  const b = keysOf(en as unknown as Record<string, unknown>).sort();
  assert.deepEqual(a.filter((k) => !b.includes(k)), [], 'claves que faltan en en.ts');
  assert.deepEqual(b.filter((k) => !a.includes(k)), [], 'claves que faltan en es.ts');
});

void test('cada correo del registro se genera en sus idiomas, con asunto, HTML y texto', () => {
  assert.ok(EMAIL_REGISTRY.length >= 16);
  for (const entry of EMAIL_REGISTRY) {
    for (const lang of entry.languages) {
      const m = entry.build(lang);
      assert.ok(m.subject.trim(), `${entry.id}/${lang}: asunto vacío`);
      assert.ok(m.html.startsWith('<!doctype html>'), `${entry.id}/${lang}: HTML`);
      assert.ok(m.html.includes(`<html lang="${lang}"`), `${entry.id}/${lang}: lang`);
      assert.ok(m.html.includes('name="color-scheme" content="light dark"'), `${entry.id}/${lang}: color-scheme`);
      assert.ok(m.text.trim().length > 20, `${entry.id}/${lang}: texto plano`);
      assert.ok(m.text.includes('Dysruptia LLC'), `${entry.id}/${lang}: pie en el texto`);
      assert.ok(!/[\r\n]/.test(m.subject), `${entry.id}/${lang}: salto de línea en el asunto`);
    }
  }
});

void test('ningún asunto ni texto tiene rayas largas', () => {
  for (const entry of EMAIL_REGISTRY) {
    for (const lang of entry.languages) {
      const m = entry.build(lang);
      assert.ok(!m.subject.includes('—'), `${entry.id}/${lang}: raya en el asunto`);
      assert.ok(!m.text.includes('—'), `${entry.id}/${lang}: raya en el texto`);
      assert.ok(!m.html.includes('—') && !m.html.includes('&mdash;'), `${entry.id}/${lang}: raya en el HTML`);
    }
  }
  for (const v of [...valuesOf(es), ...valuesOf(en as unknown as Record<string, unknown>)]) {
    assert.ok(!v.includes('—'), `raya en "${v}"`);
  }
});

void test('el HTML no usa flex, grid, más imágenes que el logo ni JavaScript; el botón no lleva texto blanco', () => {
  for (const entry of EMAIL_REGISTRY) {
    for (const lang of entry.languages) {
      const { html } = entry.build(lang);
      assert.ok(!/display\s*:\s*(flex|grid)/i.test(html), `${entry.id}: flex o grid`);
      const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
      assert.ok(imgs.every((i) => /\/email\/gensmart-logo(-dark)?\.png"/.test(i)), `${entry.id}: imagen que no es el logo`);
      assert.ok(!/Handjet/i.test(html), `${entry.id}: fuente Handjet`);
      assert.ok(!/<script\b/i.test(html), `${entry.id}: script`);
      assert.ok(!/background-image/i.test(html), `${entry.id}: imagen de fondo`);
      assert.ok(!/rgba\(/i.test(html), `${entry.id}: rgba`);
      assert.ok(!/fonts\.googleapis/i.test(html), `${entry.id}: Google Fonts`);
      // Botón verde: siempre con texto oscuro
      assert.ok(!/background:#3ddc84[^>]*>\s*<a[^>]*color:#fff/i.test(html), `${entry.id}: texto blanco en el botón`);
    }
  }
});

void test('logo: una imagen clara y una oscura (dos en la bienvenida, por el video), con alt, width y height', () => {
  const builds = [
    ...EMAIL_REGISTRY.flatMap((entry) => entry.languages.map((lang) => ({ id: `${entry.id}/${lang}`, html: entry.build(lang).html }))),
    { id: 'internal', html: wrapInternalHtml('<p>x</p>') },
  ];
  for (const { id, html } of builds) {
    const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
    const light = imgs.filter((i) => i.includes('/email/gensmart-logo.png"'));
    const dark = imgs.filter((i) => i.includes('/email/gensmart-logo-dark.png"'));
    const isWelcome = id.startsWith('welcome/');
    assert.equal(light.length, 1, `${id}: logo claro`);
    assert.equal(dark.length, isWelcome ? 2 : 1, `${id}: logo oscuro`);
    for (const i of imgs) {
      assert.match(i, /alt="GenSmart"/, `${id}: alt`);
      assert.match(i, /width="\d+"/, `${id}: width`);
      assert.match(i, /height="32"/, `${id}: height`);
      assert.match(i, new RegExp(`src="${EMAIL_ASSETS_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`), `${id}: URL de las imágenes`);
    }
  }
});

void test('los enlaces usan la URL de la web, nunca la de la API', () => {
  const web = getWebUrl();
  const api = env.API_URL.replace(/\/+$/, '');
  assert.notEqual(web, api);
  for (const entry of EMAIL_REGISTRY) {
    for (const lang of entry.languages) {
      const { html, text } = entry.build(lang);
      assert.ok(!html.includes(api) && !text.includes(api), `${entry.id}/${lang}: enlace a la API`);
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? '');
      for (const h of hrefs) {
        const ok =
          h.startsWith(web) ||
          h.startsWith('https://www.youtube.com/') ||
          h.startsWith('https://calendar.google.com/') ||
          h.startsWith('mailto:');
        assert.ok(ok, `${entry.id}/${lang}: enlace inesperado ${h}`);
      }
    }
  }
});

void test('el año del pie sale de la fecha actual', () => {
  const { html, text } = welcomeEmail({ name: 'Ana' }, 'es');
  const year = String(new Date().getFullYear());
  assert.ok(html.includes(`&copy; ${year} Dysruptia LLC`));
  assert.ok(text.includes(`© ${year} Dysruptia LLC`));
});

void test('un nombre con <script> o saltos de línea queda escapado en el HTML y limpio en el asunto', () => {
  const evil = 'Ana <script>alert(1)</script>\r\nBcc: x@evil.co';
  const w = welcomeEmail({ name: evil, organizationName: '<b>Org</b>' }, 'es');
  assert.ok(!w.html.includes('<script>alert(1)</script>'));
  assert.ok(w.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!w.html.includes('<b>Org</b>'));
  assert.ok(!/[\r\n]/.test(w.subject));
  assert.ok(w.subject.includes('Bcc: x@evil.co'), 'el texto queda en una sola línea');

  const inv = invitationEmail({ inviterName: evil, organizationName: 'Org\nX', token: 't' }, 'en');
  assert.ok(!/[\r\n]/.test(inv.subject));
  assert.ok(!inv.html.includes('<script>'));

  const lead = highScoreLeadEmail({ name: 'Ana', score: 9, contactName: '<img src=x onerror=alert(1)>' }, 'es');
  assert.ok(!lead.html.includes('<img src=x'));
});

void test('el lead muestra el nombre del contacto (o "Contacto sin nombre"), no el id', () => {
  const named = highScoreLeadEmail({ name: 'Ana', score: 9, contactName: 'María', service: 'bodas' }, 'es');
  assert.match(named.subject, /^Lead con puntaje 9\/10: María$/);
  assert.ok(named.html.includes('Servicio: bodas'));
  assert.ok(!/Contact ID|ID de contacto/.test(named.html));
  const unnamed = highScoreLeadEmail({ name: 'Ana', score: 8, contactName: null }, 'es');
  assert.ok(unnamed.subject.endsWith('Contacto sin nombre'));
  assert.ok(highScoreLeadEmail({ name: 'Ana', score: 8 }, 'en').subject.endsWith('Unnamed contact'));
});

void test('la suspensión tiene un título por causa', () => {
  const trial = EMAIL_REGISTRY.find((e) => e.id === 'trial-ended')!.build('es');
  const paused = EMAIL_REGISTRY.find((e) => e.id === 'subscription-paused')!.build('es');
  assert.equal(trial.subject, 'Tu prueba gratis de GenSmart terminó');
  assert.equal(paused.subject, 'Tu suscripción de GenSmart está en pausa');
  assert.ok(!/\d+\s*d[ií]as?/.test(trial.text), 'sin número de días');
});

void test('la bienvenida lleva el video, las cinco guías con UTM y el enlace a crear un agente', () => {
  for (const lang of ['es', 'en'] as const) {
    const { html } = welcomeEmail({ name: 'Ana', organizationName: 'Org' }, lang);
    assert.ok(html.includes(WELCOME_VIDEO.url));
    assert.ok(html.includes(WELCOME_VIDEO.duration));
    assert.ok(html.includes(`${getWebUrl()}/dashboard/agents/new`));
    const utm = [...html.matchAll(/utm_campaign=welcome/g)].length;
    // Cinco guías (número y título) más "Ver todas las guías"
    assert.equal(utm, 12, `${lang}: enlaces con UTM`);
    for (const id of ['blogStartPyme', 'docFirstAgent', 'blogKnowledgeBase', 'blogConnectWhatsApp', 'blogChecklist', 'docs'] as const) {
      assert.ok(html.includes(`${getWebUrl()}${SITE_PATHS[id][lang]}?utm_source=gensmart`), `${lang}: ${id}`);
    }
  }
});

void test('las rutas del sitio coinciden con el registro de la web', () => {
  const blog = JSON.parse(fs.readFileSync(path.join(WEB_LIB, 'blog-index.generated.json'), 'utf8')) as {
    posts: Array<{ slug: { es: string; en: string } }>;
  };
  const blogPaths = new Set(blog.posts.flatMap((p) => [`/blog/${p.slug.es}`, `/en/blog/${p.slug.en}`]));
  for (const id of ['blogStartPyme', 'blogKnowledgeBase', 'blogConnectWhatsApp', 'blogChecklist'] as const) {
    assert.ok(blogPaths.has(SITE_PATHS[id].es), `${id} es`);
    assert.ok(blogPaths.has(SITE_PATHS[id].en), `${id} en`);
  }
  const docs = fs.readFileSync(path.join(WEB_LIB, 'docs-routes.ts'), 'utf8');
  assert.ok(docs.includes("slug: { es: 'crear-tu-primer-agente', en: 'create-your-first-agent' }"));
  const legal = fs.readFileSync(path.join(WEB_LIB, 'legal-routes.ts'), 'utf8');
  assert.ok(legal.includes("slug: { es: 'politica-de-privacidad', en: 'privacy-policy' }"));
  assert.ok(legal.length > 0 && SITE_PATHS.privacy.es === '/legal/politica-de-privacidad');
  const routes = fs.readFileSync(path.join(WEB_LIB, 'site-routes.ts'), 'utf8');
  assert.ok(routes.includes("paths: { es: '/contacto', en: '/en/contact' }"));
  assert.ok(routes.includes("paths: { es: '/docs', en: '/en/docs' }"));
});

void test('helper del remitente: con y sin nombre en SMTP_FROM, y nombres con comillas', () => {
  assert.equal(parseFromAddress('noreply@x.co'), 'noreply@x.co');
  assert.equal(parseFromAddress('GenSmart <noreply@x.co>'), 'noreply@x.co');
  assert.equal(parseFromAddress('"Gen, \\"Smart\\"" <noreply@x.co>'), 'noreply@x.co');
  assert.equal(buildFromAddress('Floristería Ana', 'noreply@x.co'), '"Floristería Ana" <noreply@x.co>');
  assert.equal(buildFromAddress('Floristería Ana', 'GenSmart <noreply@x.co>'), '"Floristería Ana" <noreply@x.co>');
  assert.equal(buildFromAddress('Ana "La Mejor" <x>', 'GenSmart <noreply@x.co>'), '"Ana La Mejor x" <noreply@x.co>');
  assert.equal(buildFromAddress('Ana\r\nBcc: a@b.co', 'GenSmart <noreply@x.co>'), '"Ana Bcc: a@b.co" <noreply@x.co>');
  // Sin nombre: SMTP_FROM tal cual
  assert.equal(buildFromAddress('', 'GenSmart <noreply@x.co>'), 'GenSmart <noreply@x.co>');
  assert.equal(buildFromAddress(undefined, 'noreply@x.co'), 'noreply@x.co');
});

void test('las citas se escriben en palabras del idioma', () => {
  assert.deepEqual(formatAppointment('2026-12-03', '15:00', 'es').date, 'jueves 3 de diciembre');
  assert.match(formatAppointment('2026-12-03', '15:00', 'es').time, /^3:00\sp\.\sm\.$/);
  assert.equal(formatAppointment('2026-12-03', '15:00', 'en').date, 'Thursday, December 3');
  assert.match(formatAppointment('2026-12-03', '09:30', 'en').time, /^9:30\sAM$/);
  assert.deepEqual(formatAppointment('mañana', 'tarde', 'es'), { date: 'mañana', time: 'tarde' });
});

void test('UTM: utm_content en cada enlace al sitio de la bienvenida, con valores válidos', () => {
  assert.equal(
    withUtm('https://x.co/a', { campaign: 'welcome', content: 'guia-pymes' }),
    'https://x.co/a?utm_source=gensmart&utm_medium=email&utm_campaign=welcome&utm_content=guia-pymes'
  );
  assert.equal(withUtm('https://x.co/a?b=1', { campaign: 'welcome' }), 'https://x.co/a?b=1&utm_source=gensmart&utm_medium=email&utm_campaign=welcome');
  for (const v of ['welcome', ...Object.values(WELCOME_UTM_CONTENT)]) assert.match(v, UTM_VALUE, v);
  for (const bad of ['Guia', 'guia_pymes', 'guía', '-a', 'a--b', '']) assert.doesNotMatch(bad, UTM_VALUE, bad);
  for (const lang of ['es', 'en'] as const) {
    const { html, text } = welcomeEmail({ name: 'Ana', organizationName: 'Org' }, lang);
    for (const [id, content] of Object.entries(WELCOME_UTM_CONTENT)) {
      const url = withUtm(`${getWebUrl()}${SITE_PATHS[id as keyof typeof SITE_PATHS][lang]}`, { campaign: 'welcome', content });
      assert.ok(text.includes(url), `${lang}: ${id}`);
    }
    // Ni el video ni la plataforma llevan UTM
    assert.ok(!html.includes(`${WELCOME_VIDEO.url}?utm`) && !html.includes(`${WELCOME_VIDEO.url}&amp;utm`));
    assert.ok(!html.includes('/dashboard/agents/new?utm'));
  }
});

void test('ningún enlace queda con la URL en medio de la frase (texto plano)', () => {
  for (const entry of EMAIL_REGISTRY) {
    for (const lang of entry.languages) {
      const { text } = entry.build(lang);
      for (const m of text.matchAll(/\((https?:[^)\s]+)\)(.?)/g)) {
        // Después de la URL: fin de línea, punto, o el separador del pie
        assert.ok(['', '.', ' '].includes(m[2] ?? ''), `${entry.id} ${lang}: ${m[0]}`);
        if (m[2] === ' ') assert.ok(text.slice((m.index ?? 0) + m[0].length).startsWith('· '), `${entry.id} ${lang}: ${m[0]}`);
      }
    }
  }
  const en = welcomeEmail({ name: 'Ana' }, 'en').text;
  assert.match(en, /Questions\? Write to us from our contact page \(http[^)]+\/en\/contact\?[^)]*\)\./);
});

void test('texto plano de los correos internos: etiqueta y valor, el logo una vez', () => {
  const c = buildContactEmail(
    contactSalesSchema.parse({ name: 'María Gómez', email: 'maria@example.com', company: 'Floristería Ana', message: 'Queremos ver el plan para varias sucursales.', type: 'demo', language: 'es' })
  );
  const text = htmlToText(wrapInternalHtml(c.content));
  assert.ok(
    text.includes('Demo request\n\nName: María Gómez\nEmail: maria@example.com\nCompany: Floristería Ana\nType: demo\nLanguage: es\n\nMessage\nQueremos ver el plan para varias sucursales.'),
    text
  );
  assert.equal([...text.matchAll(/GenSmart/g)].length, 2, 'logo una vez + pie "Internal GenSmart notification."');
  const d = buildDocsFeedbackEmail(docsFeedbackSchema.parse({ page: 'primer-agente', language: 'es', helpful: false, reason: 'inexacto', comment: 'Faltan capturas.' }));
  const dt = htmlToText(wrapInternalHtml(d.content));
  assert.ok(dt.includes('Guide: primer-agente\nLanguage: es\nHelpful: No\nReason: inexacto\n\nComment\nFaltan capturas.'), dt);
});

void test('límite de mensajes: las cifras con el formato del idioma, y sin ellas si no llegan', () => {
  const es = planLimitEmail({ name: 'Ana', organizationName: 'Org', used: 1000, limit: 1000 }, 'es').text;
  assert.ok(es.includes('Usaste 1.000 de 1.000 mensajes de tu plan en este período.'));
  const enText = planLimitEmail({ name: 'Ana', organizationName: 'Org', used: 2500, limit: 2500 }, 'en').text;
  assert.ok(enText.includes('You used 2,500 of 2,500 messages in your plan for this period.'));
  assert.ok(!planLimitEmail({ name: 'Ana', organizationName: 'Org', used: 5 }, 'es').text.includes('Usaste'));
});

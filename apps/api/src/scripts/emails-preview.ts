/**
 * Vista previa local de los correos: un HTML por correo y por idioma, más un índice, en
 * `apps/web/public/dev-emails/` (http://localhost:3000/dev-emails/index.html). Esa carpeta está en
 * `.gitignore`. No corre con NODE_ENV=production.
 *
 *   npm run emails:preview --workspace=apps/api
 */
import fs from 'node:fs';
import path from 'node:path';
import { EMAIL_REGISTRY } from '../emails/registry';
import { escapeHtml } from '../utils/html';

if (process.env['NODE_ENV'] === 'production') {
  console.error('[emails:preview] Not available with NODE_ENV=production');
  process.exit(1);
}

const OUT = path.resolve(__dirname, '../../../web/public/dev-emails');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const rows: string[] = [];
let count = 0;
for (const entry of EMAIL_REGISTRY) {
  for (const lang of entry.languages) {
    const email = entry.build(lang);
    const file = `${entry.id}.${lang}.html`;
    fs.writeFileSync(path.join(OUT, file), email.html);
    fs.writeFileSync(path.join(OUT, `${entry.id}.${lang}.txt`), email.text);
    count++;
    rows.push(`<section>
<h2>${escapeHtml(entry.label)} <small>${lang.toUpperCase()} · ${escapeHtml(entry.recipient)}</small></h2>
<p><b>Asunto:</b> ${escapeHtml(email.subject)}</p>
<p><a href="./${file}" target="_blank">Abrir el HTML</a> · <a href="./${entry.id}.${lang}.txt" target="_blank">Texto plano</a></p>
<details><summary>Texto plano</summary><pre>${escapeHtml(email.text)}</pre></details>
</section>`);
  }
}

fs.writeFileSync(
  path.join(OUT, 'index.html'),
  `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Correos de GenSmart (vista previa local)</title>
<style>
body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:860px;margin:32px auto;padding:0 16px;color:#0c1014;background:#f6f8f7}
section{background:#fff;border:1px solid #dfe3e1;border-radius:12px;padding:16px 20px;margin:0 0 14px}
h1{font-size:24px}h2{font-size:17px;margin:0 0 8px}small{font-weight:400;color:#4b5753}
a{color:#0b6b36}pre{white-space:pre-wrap;font-size:13px;background:#eef2f0;padding:12px;border-radius:8px}
p{margin:4px 0}
</style></head><body>
<h1>Correos de GenSmart</h1>
<p>${count} correos generados con los datos de ejemplo de <code>apps/api/src/emails/registry.ts</code>.</p>
${rows.join('\n')}
</body></html>`
);

console.log(`[emails:preview] ${count} emails written to ${OUT}`);
console.log('[emails:preview] Open http://localhost:3000/dev-emails/index.html');

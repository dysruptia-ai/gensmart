/**
 * Manda todos los correos de ejemplo del registro a una dirección, por el SMTP configurado,
 * para revisarlos en Gmail, Outlook y Apple Mail. No corre con NODE_ENV=production.
 *
 *   npm run emails:send-test --workspace=apps/api -- --to=persona@example.com
 *   (opcional: --only=welcome,verify-email  --lang=es)
 */
import { sendRendered } from '../config/email';
import { EMAIL_REGISTRY } from '../emails/registry';

if (process.env['NODE_ENV'] === 'production') {
  console.error('[emails:send-test] Not available with NODE_ENV=production');
  process.exit(1);
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main(): Promise<void> {
  const to = arg('to');
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error('Usage: npm run emails:send-test --workspace=apps/api -- --to=<email> [--only=id,id] [--lang=es|en]');
    process.exit(1);
  }
  const only = arg('only')?.split(',').map((s) => s.trim()).filter(Boolean);
  const lang = arg('lang');

  let sent = 0;
  for (const entry of EMAIL_REGISTRY) {
    if (only && !only.includes(entry.id)) continue;
    for (const l of entry.languages) {
      if (lang && l !== lang) continue;
      const email = entry.build(l);
      const result = await sendRendered(to, { ...email, subject: `[${entry.id}.${l}] ${email.subject}` });
      sent++;
      console.log(`[emails:send-test] ${entry.id}.${l}: ${result.messageId ? 'sent' : 'not sent (SMTP not configured)'}`);
    }
  }
  console.log(`[emails:send-test] ${sent} emails processed`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('[emails:send-test] Failed:', err instanceof Error ? err.message : 'unknown error');
  process.exit(1);
});

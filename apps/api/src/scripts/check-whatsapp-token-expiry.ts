/**
 * Read-only check of the real expiry of the WhatsApp customer tokens stored in
 * agents.whatsapp_config. Only SELECTs and GET requests to Meta's debug_token.
 * Never prints tokens, encrypted tokens, or the debug_token URL.
 *
 * Run: npm run check:wa-tokens --workspace=apps/api
 */
import { pool } from '../config/database';
import { decryptAccessToken } from '../services/whatsapp.service';
import { getWhatsAppToken } from '../services/platform-settings.service';

const ALERT_DAYS = 30;
const DAY_MS = 86_400_000;

interface AgentRow {
  id: string;
  name: string;
  organization_id: string | null;
  phone_number_id: string | null;
  waba_id: string | null;
  connected: string | null;
  access_token_encrypted: string;
}

interface DebugTokenData {
  is_valid?: boolean;
  type?: string;
  issued_at?: number;
  expires_at?: number;
  data_access_expires_at?: number;
  scopes?: string[];
}

interface DebugTokenResponse {
  data?: DebugTokenData;
  error?: { code?: number; message?: string };
}

function iso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function fmtTimestamp(seconds: number | undefined): string {
  if (seconds === undefined) return 'n/a';
  if (seconds === 0) return '0 (sin vencimiento)';
  return `${seconds} (${iso(seconds)})`;
}

async function main(): Promise<void> {
  const { rows } = await pool.query<AgentRow>(
    `SELECT id, name, organization_id,
            whatsapp_config->>'phone_number_id' AS phone_number_id,
            whatsapp_config->>'waba_id' AS waba_id,
            whatsapp_config->>'connected' AS connected,
            whatsapp_config->>'access_token_encrypted' AS access_token_encrypted
       FROM agents
      WHERE COALESCE(whatsapp_config->>'access_token_encrypted', '') <> ''
      ORDER BY created_at`
  );

  const platformToken = await getWhatsAppToken();
  if (!platformToken) {
    console.error('Platform WhatsApp token not configured; cannot call debug_token.');
    return;
  }

  let reviewed = 0;
  let withExpiry = 0;
  let nearestExpiry: number | null = null;
  const nowMs = Date.now();

  for (const row of rows) {
    reviewed++;
    console.log('----------------------------------------');
    console.log(`agent id:        ${row.id}`);
    console.log(`name:            ${row.name}`);
    console.log(`organization id: ${row.organization_id ?? 'n/a'}`);
    console.log(`phone_number_id: ${row.phone_number_id ?? 'n/a'}`);
    console.log(`waba_id:         ${row.waba_id ?? 'n/a'}`);
    console.log(`connected:       ${row.connected ?? 'n/a'}`);

    let token: string;
    try {
      token = decryptAccessToken(row.access_token_encrypted);
    } catch {
      console.log('status:          decrypt_failed');
      continue;
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(platformToken)}`
      );
      const body = (await res.json().catch(() => ({}))) as DebugTokenResponse;

      if (!res.ok || !body.data) {
        console.log(
          `status:          meta_error HTTP ${res.status} code=${body.error?.code ?? 'n/a'} message=${body.error?.message ?? 'n/a'}`
        );
        continue;
      }

      const d = body.data;
      console.log(`is_valid:        ${String(d.is_valid)}`);
      console.log(`type:            ${d.type ?? 'n/a'}`);
      console.log(`issued_at:       ${d.issued_at ? iso(d.issued_at) : 'n/a'}`);
      console.log(`expires_at:      ${fmtTimestamp(d.expires_at)}`);
      if (d.expires_at) {
        const daysLeft = Math.floor((d.expires_at * 1000 - nowMs) / DAY_MS);
        console.log(`days remaining:  ${daysLeft}`);
        withExpiry++;
        if (nearestExpiry === null || d.expires_at < nearestExpiry) nearestExpiry = d.expires_at;
        if (daysLeft < ALERT_DAYS) {
          console.log(`ALERTA: token expires in less than ${ALERT_DAYS} days`);
        }
      }
      console.log(`data_access_expires_at: ${fmtTimestamp(d.data_access_expires_at)}`);
      console.log(`scopes:          ${d.scopes?.join(', ') ?? 'n/a'}`);
    } catch (err) {
      // Only the error class/message; the message from fetch does not include the URL query in Node
      console.log(`status:          request_failed (${err instanceof Error ? err.name : 'unknown'})`);
    }
  }

  console.log('========================================');
  console.log(`agents reviewed:            ${reviewed}`);
  console.log(`with expires_at != 0:       ${withExpiry}`);
  console.log(`nearest expiry:             ${nearestExpiry ? iso(nearestExpiry) : 'none'}`);
}

main()
  .catch((err: unknown) => {
    console.error('check failed:', err instanceof Error ? err.message : 'unknown error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    process.exit(process.exitCode ?? 0);
  });

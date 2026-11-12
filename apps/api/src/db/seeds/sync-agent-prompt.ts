/**
 * Copies the CURRENT prompt of an agent's template onto ONE agent (templates are
 * copied at creation time, so seeding a template never touches existing agents).
 *
 *   npm run sync-agent-prompt --workspace=apps/api -- <agentId>            # dry run
 *   npm run sync-agent-prompt --workspace=apps/api -- <agentId> --apply    # writes
 *
 * Never prints the prompt text, only sizes. Only the agent id you pass is touched.
 * With --apply it also replaces the widget texts, but only when they are still the
 * English defaults and the template language is Spanish.
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

async function main(): Promise<void> {
  const [agentId, ...flags] = process.argv.slice(2);
  const apply = flags.includes('--apply');
  if (!agentId || !/^[0-9a-f-]{36}$/i.test(agentId)) {
    throw new Error('Usage: sync-agent-prompt <agentId> [--apply]');
  }
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  try {
    const res = await pool.query<{
      id: string;
      name: string;
      template_id: string | null;
      agent_prompt: string;
      tpl_prompt: string | null;
      tpl_name: string | null;
      tpl_language: string | null;
      web_config: Record<string, unknown> | null;
    }>(
      `SELECT a.id, a.name, a.template_id, a.system_prompt AS agent_prompt, a.web_config,
              t.system_prompt AS tpl_prompt, t.name AS tpl_name, t.language AS tpl_language
       FROM agents a LEFT JOIN agent_templates t ON t.id = a.template_id
       WHERE a.id = $1`,
      [agentId]
    );
    const row = res.rows[0];
    if (!row) throw new Error('Agent not found');
    if (!row.tpl_prompt) throw new Error('Agent has no template (template_id is null)');

    const same = row.agent_prompt === row.tpl_prompt;
    console.log(`Agent: ${row.name} | template: ${row.tpl_name} (${row.tpl_language})`);
    console.log(`Prompt length: agent=${row.agent_prompt.length} template=${row.tpl_prompt.length} identical=${same}`);

    const web = row.web_config ?? {};
    const englishDefaults =
      web['welcome_message'] === 'Hello! How can I help you?' || web['bubble_text'] === 'Chat with us';
    const fixWidget = row.tpl_language === 'es' && englishDefaults;
    console.log(`Widget texts still English defaults: ${englishDefaults}`);

    if (!apply) {
      console.log('Dry run. Re-run with --apply to write.');
      return;
    }
    await pool.query('BEGIN');
    try {
    await pool.query('UPDATE agents SET system_prompt = $1, updated_at = NOW() WHERE id = $2', [
      row.tpl_prompt,
      agentId,
    ]);
    if (fixWidget) {
      await pool.query(
        `UPDATE agents SET web_config = COALESCE(web_config, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
        [JSON.stringify({ welcome_message: '¡Hola! ¿En qué te puedo ayudar?', bubble_text: 'Chatea con nosotros' }), agentId]
      );
    }
    await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
    console.log(`Updated prompt${fixWidget ? ' and widget texts' : ''}.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});

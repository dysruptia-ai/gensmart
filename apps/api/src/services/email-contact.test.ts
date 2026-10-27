import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, query } from '../config/database';
import { fillContactPhone, findOrCreateEmailContact } from './email.service';
import { classifyFormFields, detectFormSubmission, extractFormFields } from './email-parsing';

/**
 * Needs the local Postgres (docker compose up -d postgres) with migrations applied; skipped otherwise.
 * Mirrors the identity selection in routes/email.ts processEmail.
 */
async function dbAvailable(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

function identityFor(body: string, technicalSender: string, senderName: string | null) {
  const classified = detectFormSubmission(body) ? classifyFormFields(extractFormFields(body)) : null;
  const effectivePhone = !classified?.email ? classified?.phone ?? null : null;
  return {
    email: classified?.email ?? (effectivePhone ? null : technicalSender),
    phone: effectivePhone,
    name: classified?.name ?? senderName,
  };
}

const slug = `email-test-${Date.now()}`;
let orgId = '';

after(async () => {
  if (orgId) await query('DELETE FROM organizations WHERE id = $1', [orgId]);
  await pool.end();
});

test('web forms from one technical sender create one contact per lead; phone-only leads use the phone', async (t) => {
  if (!(await dbAvailable())) return t.skip('Postgres not reachable');
  orgId = (await query<{ id: string }>(`INSERT INTO organizations (name, slug) VALUES ('Email test', $1) RETURNING id`, [slug])).rows[0]!.id;
  const agentId = (await query<{ id: string }>(
    `INSERT INTO agents (organization_id, name, system_prompt, llm_provider, llm_model) VALUES ($1, 'Test', 'x', 'openai', 'gpt-4o-mini') RETURNING id`,
    [orgId]
  )).rows[0]!.id;
  const agent = { id: agentId, organization_id: orgId };
  const wp = 'wordpress@sitio.com';

  const formA = 'Nombre: Ana\nCorreo electrónico: ana@lead.com\nTeléfono: 111\nMensaje: Hola';
  const formB = 'Nombre: Beto\nCorreo electrónico: beto@lead.com\nTeléfono: 222\nMensaje: Hola';
  const a1 = await findOrCreateEmailContact(agent, identityFor(formA, wp, null));
  const b1 = await findOrCreateEmailContact(agent, identityFor(formB, wp, null));
  const a2 = await findOrCreateEmailContact(agent, identityFor(formA, wp, null));
  assert.notEqual(a1, b1, 'two leads behind the same wordpress@ sender must be two contacts');
  assert.equal(a1, a2, 'the same lead resubmitting maps to the same contact');

  const phoneOnlyA = 'Nombre: Carla\nTeléfono: 3009998888\nCiudad: Cali\nMensaje: Hola';
  const phoneOnlyB = 'Nombre: Dario\nTeléfono: 3001112222\nCiudad: Cali\nMensaje: Hola';
  const c1 = await findOrCreateEmailContact(agent, identityFor(phoneOnlyA, wp, null));
  const d1 = await findOrCreateEmailContact(agent, identityFor(phoneOnlyB, wp, null));
  const c2 = await findOrCreateEmailContact(agent, identityFor(phoneOnlyA, wp, null));
  assert.notEqual(c1, d1);
  assert.equal(c1, c2);
  const row = (await query<{ phone: string | null; email: string | null; name: string | null }>('SELECT phone, email, name FROM contacts WHERE id = $1', [c1])).rows[0]!;
  assert.deepEqual(row, { phone: '3009998888', email: null, name: 'Carla' });

  // A normal human email keeps today's behaviour: identity is the sender address
  const human = identityFor('Hola, me interesa el producto.\nGracias', 'jane@example.com', 'Jane');
  assert.deepEqual(human, { email: 'jane@example.com', phone: null, name: 'Jane' });
});

test('a form with email AND phone keeps both; a later submission never overwrites or clears the stored phone', async (t) => {
  if (!(await dbAvailable())) return t.skip('Postgres not reachable');
  const agentId = (await query<{ id: string }>(
    `INSERT INTO agents (organization_id, name, system_prompt, llm_provider, llm_model) VALUES ($1, 'Test2', 'x', 'openai', 'gpt-4o-mini') RETURNING id`,
    [orgId]
  )).rows[0]!.id;
  const agent = { id: agentId, organization_id: orgId };
  const phoneOf = async (id: string) => (await query<{ phone: string | null; email: string | null }>('SELECT phone, email FROM contacts WHERE id = $1', [id])).rows[0]!;

  // Mirrors processEmail: identity from the email, then the phone is filled in
  const submit = async (body: string) => {
    const classified = classifyFormFields(extractFormFields(body));
    const id = await findOrCreateEmailContact(agent, { email: classified.email, phone: null, name: classified.name });
    if (classified.phone && classified.email) await fillContactPhone(id, classified.phone);
    return id;
  };

  const first = await submit('Nombre: Eva\nCorreo electrónico: eva@lead.com\nTeléfono: 3015550000\nMensaje: Hola');
  assert.deepEqual(await phoneOf(first), { phone: '3015550000', email: 'eva@lead.com' });

  const second = await submit('Nombre: Eva\nCorreo electrónico: eva@lead.com\nTeléfono: 3999999999\nMensaje: Otra vez');
  assert.equal(second, first);
  assert.equal((await phoneOf(first)).phone, '3015550000', 'stored phone must not be overwritten');

  const third = await submit('Nombre: Eva\nCorreo electrónico: eva@lead.com\nCiudad: Cali\nMensaje: Sin teléfono');
  assert.equal(third, first);
  assert.equal((await phoneOf(first)).phone, '3015550000', 'a submission without phone must not clear it');
});

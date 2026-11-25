/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Cuestionario de bienvenida (web-37).
 * - Siempre: esquema compartido, regla de plantilla sugerida, quién lo ve y el UPDATE parcial.
 * - Con WELCOME_SURVEY_DB_TEST=1 (Postgres local con la migración 076): el endpoint real
 *   (GET/PATCH /api/organization/onboarding) con guardado parcial, complete, skip, 403 y 400.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { registerSchema, suggestWelcomeTemplate, welcomeSurveyPatchSchema } from '@gensmart/shared';
import { buildWelcomeSurveyUpdate, resolveWelcomeStatus } from './welcome-survey.service';

// ── Esquema ──
test('el esquema acepta un guardado parcial y recorta los textos', () => {
  const r = welcomeSurveyPatchSchema.safeParse({ industry: 'other', industryOther: '  Veterinaria  ' });
  assert.ok(r.success);
  assert.deepEqual(r.data, { industry: 'other', industryOther: 'Veterinaria' });
  const empty = welcomeSurveyPatchSchema.safeParse({ partner: '   ' });
  assert.ok(empty.success);
  assert.equal(empty.data.partner, null);
});

test('el esquema rechaza valores fuera de la lista y combinaciones inválidas', () => {
  const bad: unknown[] = [
    { industry: 'clinicas' },
    { teamSize: '3' },
    { monthlyVolume: 'mucho' },
    { goals: ['sales', 'support', 'booking'] },
    { goals: ['sales', 'sales'] },
    { goals: ['marketing'] },
    { channels: ['whatsapp', 'unknown'] },
    { channels: ['fax'] },
    { source: 'tv' },
    { partner: 'x'.repeat(121) },
    { complete: true, skip: true },
    { complete: false },
    { onboarding_completed_at: '2026-01-01' },
  ];
  for (const body of bad) assert.equal(welcomeSurveyPatchSchema.safeParse(body).success, false, JSON.stringify(body));
});

test('registerSchema acepta un ref corto de letras, números, - y _', () => {
  const base = {
    name: 'Ana Pérez',
    email: 'ana@example.com',
    password: 'Secreta123',
    organizationName: 'Clínica Ana',
    turnstileToken: 'token',
    acceptTerms: true,
  };
  assert.ok(registerSchema.safeParse({ ...base, ref: 'SOCIO-123_a' }).success);
  assert.ok(registerSchema.safeParse(base).success);
  assert.equal(registerSchema.safeParse({ ...base, ref: 'con espacio' }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, ref: 'a'.repeat(65) }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, ref: '<script>' }).success, false);
});

// ── Plantilla sugerida ──
test('plantilla sugerida: industria propia primero, luego tienda, citas, ventas y atención', () => {
  assert.equal(suggestWelcomeTemplate({ industry: 'industryClinics', goals: ['store'] }), 'Clinic Receptionist');
  assert.equal(suggestWelcomeTemplate({ industry: 'industryRealEstate', goals: [] }), 'Real Estate Agent');
  assert.equal(suggestWelcomeTemplate({ industry: 'industryRestaurants', goals: ['sales'] }), 'Restaurant Assistant');
  assert.equal(suggestWelcomeTemplate({ industry: 'industryEcommerce', goals: ['sales', 'store'] }), 'WooCommerce Store Assistant');
  assert.equal(suggestWelcomeTemplate({ industry: null, goals: ['sales', 'booking'] }), 'Appointment Scheduler');
  assert.equal(suggestWelcomeTemplate({ industry: 'other', goals: ['sales'] }), 'Lead Capture Agent');
  assert.equal(suggestWelcomeTemplate({ industry: 'industryB2b', goals: ['hr'] }), 'Customer Service Agent');
  assert.equal(suggestWelcomeTemplate({ industry: null, goals: [] }), 'Customer Service Agent');
});

// ── Quién lo ve ──
test('estado: solo el dueño de una organización elegible, mientras no lo terminó ni lo omitió', () => {
  const fresh = { onboarding_survey_eligible: true, onboarding_completed_at: null, onboarding_skipped_at: null };
  assert.equal(resolveWelcomeStatus(fresh, 'owner', false), 'pending');
  assert.equal(resolveWelcomeStatus(fresh, 'admin', false), 'none');
  assert.equal(resolveWelcomeStatus(fresh, 'member', false), 'none');
  assert.equal(resolveWelcomeStatus(fresh, 'owner', true), 'none');
  assert.equal(resolveWelcomeStatus({ ...fresh, onboarding_survey_eligible: false }, 'owner', false), 'none');
  assert.equal(resolveWelcomeStatus({ ...fresh, onboarding_completed_at: new Date() }, 'owner', false), 'completed');
  assert.equal(resolveWelcomeStatus({ ...fresh, onboarding_skipped_at: new Date() }, 'owner', false), 'skipped');
  assert.equal(resolveWelcomeStatus(undefined, 'owner', false), 'none');
});

test('el UPDATE solo lleva los campos presentes, parametrizados', () => {
  const u = buildWelcomeSurveyUpdate('org-1', { teamSize: '2-5', goals: [] });
  assert.ok(u);
  assert.equal(u.sql, 'UPDATE organizations SET onboarding_team_size = $1, onboarding_goals = $2, updated_at = NOW() WHERE id = $3');
  assert.deepEqual(u.params, ['2-5', null, 'org-1']);
  assert.equal(buildWelcomeSurveyUpdate('org-1', {}), null);
  const done = buildWelcomeSurveyUpdate('org-1', { source: 'partner', partner: 'SOCIO-1', complete: true });
  assert.ok(done && done.sql.includes('onboarding_completed_at = COALESCE(onboarding_completed_at, NOW())'));
});

// ── Endpoint real (opt-in, base local) ──
const dbEnabled = process.env['WELCOME_SURVEY_DB_TEST'] === '1';

test('endpoint: guardado parcial, complete, skip, 403 y valores fuera de la lista', { skip: !dbEnabled }, async () => {
  const express = (await import('express')).default;
  const { pool, query } = await import('../config/database');
  const { generateAccessToken } = await import('../config/jwt');
  const { errorHandler } = await import('../middleware/errorHandler');
  const organizationRouter = (await import('../routes/organization')).default;

  after(async () => {
    await pool.end();
  });

  const app = express();
  app.use(express.json());
  app.use('/api/organization', organizationRouter);
  app.use(errorHandler);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/organization/onboarding`;

  const suffix = Math.random().toString(36).slice(2, 10);
  const orgIds: string[] = [];
  const userIds: string[] = [];
  async function makeOrg(eligible: boolean, ref: string | null): Promise<string> {
    const r = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, onboarding_survey_eligible, signup_ref_code)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [`ws-test-${suffix}`, `ws-test-${suffix}-${orgIds.length}`, eligible, ref]
    );
    orgIds.push(r.rows[0]!.id);
    return r.rows[0]!.id;
  }
  async function makeUser(orgId: string, role: string): Promise<string> {
    const r = await query<{ id: string }>(
      `INSERT INTO users (organization_id, email, name, password_hash, role, email_verified)
       VALUES ($1, $2, 'Test', 'x', $3, true) RETURNING id`,
      [orgId, `ws-${suffix}-${userIds.length}@example.com`, role]
    );
    const id = r.rows[0]!.id;
    userIds.push(id);
    await query('INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, $3)', [id, orgId, role]);
    return generateAccessToken({ userId: id, orgId, role, email: `ws-${suffix}@example.com`, isSuperAdmin: false });
  }
  async function call(token: string, method: 'GET' | 'PATCH', body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
    const res = await fetch(base, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  }

  try {
    const orgA = await makeOrg(true, 'SOCIO-123');
    const owner = await makeUser(orgA, 'owner');
    const member = await makeUser(orgA, 'member');
    const admin = await makeUser(orgA, 'admin');

    let r = await call(owner, 'GET');
    assert.equal(r.status, 200);
    assert.equal(r.json['status'], 'pending');
    assert.equal(r.json['refCode'], 'SOCIO-123');

    // Guardado parcial: cada paso solo escribe sus campos
    await call(owner, 'PATCH', { industry: 'industryClinics' });
    r = await call(owner, 'PATCH', { teamSize: '2-5', monthlyVolume: 'unknown' });
    assert.equal(r.status, 200);
    let answers = r.json['answers'] as Record<string, unknown>;
    assert.equal(answers['industry'], 'industryClinics');
    assert.equal(answers['teamSize'], '2-5');
    assert.deepEqual(answers['goals'], []);
    assert.equal(r.json['status'], 'pending');

    // Fuera de la lista → 400, sin tocar lo guardado
    r = await call(owner, 'PATCH', { goals: ['sales', 'support', 'hr'] });
    assert.equal(r.status, 400);
    r = await call(owner, 'PATCH', { industry: 'veterinaria' });
    assert.equal(r.status, 400);

    // Quien no es dueño → 403 (lectura y escritura)
    assert.equal((await call(member, 'GET')).status, 403);
    assert.equal((await call(member, 'PATCH', { teamSize: '1' })).status, 403);
    assert.equal((await call(admin, 'PATCH', { teamSize: '1' })).status, 403);

    // complete
    r = await call(owner, 'PATCH', { goals: ['booking'], complete: true });
    assert.equal(r.json['status'], 'completed');
    answers = r.json['answers'] as Record<string, unknown>;
    assert.deepEqual(answers['goals'], ['booking']);
    assert.equal(answers['industry'], 'industryClinics');
    // skip después de completar no cambia el estado
    r = await call(owner, 'PATCH', { skip: true });
    assert.equal(r.json['status'], 'completed');

    // skip en otra organización
    const orgB = await makeOrg(true, null);
    const ownerB = await makeUser(orgB, 'owner');
    r = await call(ownerB, 'PATCH', { skip: true });
    assert.equal(r.status, 200);
    assert.equal(r.json['status'], 'skipped');

    // Organización no elegible (anterior a la migración, subcuenta, Tiendanube) → none y 403 al escribir
    const orgC = await makeOrg(false, null);
    const ownerC = await makeUser(orgC, 'owner');
    assert.equal((await call(ownerC, 'GET')).json['status'], 'none');
    r = await call(ownerC, 'PATCH', { teamSize: '1' });
    assert.equal(r.status, 403);
  } finally {
    server.close();
    if (userIds.length) await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    if (orgIds.length) await query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [orgIds]);
  }
});

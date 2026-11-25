/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Ingreso con Google (web-38).
 * - Sin base de datos: verificación del ID token con la librería real y una clave de prueba (firma,
 *   iss, aud, exp, nonce), `state` de un solo uso y vencido, la política de vínculo, el handoff del
 *   2FA y el esquema de `complete` con y sin Términos.
 * - Con SOCIAL_AUTH_DB_TEST=1 (Postgres local con la migración 077): vínculo por correo (verificado
 *   y sin verificar), usuario con 2FA, usuario nuevo → registro pendiente → complete.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { createGoogleProvider, identityFromGooglePayload, type GoogleOAuthClient } from './oauth/google';
import { OAuthVerificationError, type OAuthProvider } from './oauth/types';
import {
  consumeOAuthState,
  consumeTwoFactorHandoff,
  decideLink,
  oauthCompleteSchema,
  pkceChallenge,
  safeFrom,
  startOAuth,
  type KeyValueStore,
} from './social-auth.service';

/** Redis en memoria, con vencimiento. */
function memoryStore(): KeyValueStore & { data: Map<string, { v: string; exp: number }>; now: number } {
  const data = new Map<string, { v: string; exp: number }>();
  const store = {
    data,
    now: Date.now(),
    async set(key: string, value: string, _mode: 'EX', seconds: number) {
      data.set(key, { v: value, exp: store.now + seconds * 1000 });
      return 'OK';
    },
    async get(key: string) {
      const e = data.get(key);
      if (!e || e.exp <= store.now) return null;
      return e.v;
    },
    async getdel(key: string) {
      const v = await store.get(key);
      data.delete(key);
      return v;
    },
    async del(key: string) {
      data.delete(key);
      return 1;
    },
  };
  return store;
}

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-kid';

/** OAuth2Client real, con las claves públicas de Google reemplazadas por la de prueba. */
class TestKeyClient extends OAuth2Client {
  constructor(private readonly idToken: string) {
    super({ clientId: CLIENT_ID });
  }
  override async getFederatedSignonCertsAsync() {
    return {
      certs: { [KID]: publicKey.export({ type: 'spki', format: 'pem' }).toString() },
      format: 'PEM',
    } as unknown as Awaited<ReturnType<OAuth2Client['getFederatedSignonCertsAsync']>>;
  }
}

function signIdToken(claims: Record<string, unknown>, key: crypto.KeyObject = privateKey): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: '1234567890', email: 'Ana@Example.com', email_verified: true, name: 'Ana', nonce: 'n-1', iat: now, exp: now + 600, ...claims },
    key.export({ type: 'pkcs8', format: 'pem' }),
    { algorithm: 'RS256', keyid: KID }
  );
}

function providerWithToken(idToken: string): OAuthProvider {
  const real = new TestKeyClient(idToken);
  const client: GoogleOAuthClient = {
    getToken: async () => ({ tokens: { id_token: idToken } }),
    verifyIdToken: (o) => real.verifyIdToken(o),
  };
  return createGoogleProvider(() => ({ clientId: CLIENT_ID, clientSecret: 'x', redirectUri: 'http://localhost:4000/cb' }), () => client);
}

test('ID token válido: firma con la clave de prueba, iss, aud, exp y nonce', async () => {
  const id = await providerWithToken(signIdToken({})).exchangeAndVerify({ code: 'c', codeVerifier: 'v', nonce: 'n-1' });
  assert.deepEqual(id, { sub: '1234567890', email: 'ana@example.com', emailVerified: true, name: 'Ana' });
});

test('ID token rechazado: firma de otra clave, otra audiencia, otro emisor, vencido o nonce distinto', async () => {
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const now = Math.floor(Date.now() / 1000);
  const cases = [
    signIdToken({}, other),
    signIdToken({ aud: 'otro-cliente' }),
    signIdToken({ iss: 'https://evil.example' }),
    signIdToken({ iat: now - 7200, exp: now - 3600 }),
  ];
  for (const token of cases) {
    await assert.rejects(
      providerWithToken(token).exchangeAndVerify({ code: 'c', codeVerifier: 'v', nonce: 'n-1' }),
      OAuthVerificationError
    );
  }
  await assert.rejects(
    providerWithToken(signIdToken({ nonce: 'otro' })).exchangeAndVerify({ code: 'c', codeVerifier: 'v', nonce: 'n-1' }),
    /Nonce mismatch/
  );
});

test('el contenido se revisa también sin la librería (defensa en profundidad)', () => {
  const base = { iss: 'accounts.google.com', aud: CLIENT_ID, sub: 's', exp: 2000, email: 'a@b.co', nonce: 'n' };
  const ok = { clientId: CLIENT_ID, nonce: 'n', nowSeconds: 1000 };
  assert.equal(identityFromGooglePayload(base, ok).emailVerified, false); // sin email_verified: false
  assert.throws(() => identityFromGooglePayload({ ...base, exp: 999 }, ok), /expired/);
  assert.throws(() => identityFromGooglePayload({ ...base, nonce: undefined }, ok), /Nonce/);
  assert.throws(() => identityFromGooglePayload(undefined, ok), /payload/);
});

test('el intercambio fallido no propaga el error de la librería', async () => {
  const p = createGoogleProvider(
    () => ({ clientId: CLIENT_ID, clientSecret: 'x', redirectUri: 'r' }),
    () => ({
      getToken: async () => {
        throw new Error('invalid_grant token=secret-value');
      },
      verifyIdToken: async () => ({ getPayload: () => undefined }),
    })
  );
  await assert.rejects(p.exchangeAndVerify({ code: 'c', codeVerifier: 'v', nonce: 'n' }), (err: Error) => {
    assert.equal(err.message, 'Token exchange failed');
    return true;
  });
});

test('state: un solo uso, vence a los 10 minutos y es de un proveedor', async () => {
  const store = memoryStore();
  const provider = providerWithToken('x');
  const { url, state } = await startOAuth(provider, { intent: 'register', from: '/dashboard', lang: 'en', plan: 'starter', ref: 'SOCIO-9' }, store);
  const u = new URL(url);
  assert.equal(u.searchParams.get('scope'), 'openid email profile');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');

  const saved = await consumeOAuthState(state, 'google', store);
  assert.ok(saved);
  assert.equal(u.searchParams.get('code_challenge'), pkceChallenge(saved.codeVerifier));
  assert.equal(u.searchParams.get('nonce'), saved.nonce);
  assert.equal(saved.ref, 'SOCIO-9');
  // Reusado
  assert.equal(await consumeOAuthState(state, 'google', store), null);

  // Vencido
  const second = await startOAuth(provider, { intent: 'login', from: '/dashboard', lang: 'es' }, store);
  store.now += 10 * 60 * 1000 + 1;
  assert.equal(await consumeOAuthState(second.state, 'google', store), null);
  assert.equal(await consumeOAuthState('', 'google', store), null);
});

test('from: solo rutas internas', () => {
  assert.equal(safeFrom('/dashboard/agents'), '/dashboard/agents');
  for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', undefined, 42]) assert.equal(safeFrom(bad), '/dashboard');
});

test('política de vínculo por correo', () => {
  assert.deepEqual(decideLink({ email_verified: true, linkedSub: 's' }, 's'), { action: 'signin' });
  assert.deepEqual(decideLink({ email_verified: true, linkedSub: 'otro' }, 's'), { action: 'reject' });
  assert.deepEqual(decideLink({ email_verified: true, linkedSub: null }, 's'), {
    action: 'link', markVerified: false, resetPassword: false, notify: true,
  });
  assert.deepEqual(decideLink({ email_verified: false, linkedSub: null }, 's'), {
    action: 'link', markVerified: true, resetPassword: true, notify: false,
  });
});

test('handoff del 2FA: un solo uso', async () => {
  const store = memoryStore();
  await store.set('oauth:2fa-handoff:h1', 'temp-token', 'EX', 300);
  assert.equal(await consumeTwoFactorHandoff('h1', store), 'temp-token');
  await assert.rejects(consumeTwoFactorHandoff('h1', store), /Invalid or expired/);
});

test('complete: exige aceptar los Términos', () => {
  const body = { token: 't', name: 'Ana Pérez', organizationName: 'Tienda Ana' };
  assert.equal(oauthCompleteSchema.safeParse({ ...body, acceptTerms: true }).success, true);
  assert.equal(oauthCompleteSchema.safeParse(body).success, false);
  assert.equal(oauthCompleteSchema.safeParse({ ...body, acceptTerms: false }).success, false);
});

// ---------- con base de datos ----------

const dbEnabled = process.env['SOCIAL_AUTH_DB_TEST'] === '1';

test('base de datos: vínculo por correo, 2FA y registro pendiente → complete', { skip: !dbEnabled }, async () => {
  const { query, pool } = await import('../config/database');
  const bcrypt = (await import('bcryptjs')).default;
  const { encrypt } = await import('../config/encryption');
  const { resolveOAuthIdentity, completeOAuthSignup, getPendingSignup } = await import('./social-auth.service');
  const store = memoryStore();
  const provider = providerWithToken('x');
  const tag = crypto.randomBytes(4).toString('hex');
  const mail = (n: string) => `web38-${n}-${tag}@example.test`;
  const state = (intent: 'login' | 'register' = 'login') => ({
    provider: 'google' as const, nonce: 'n', codeVerifier: 'v', intent, from: '/dashboard', lang: 'es' as const,
  });
  const orgIds: string[] = [];

  async function seedUser(email: string, opts: { verified: boolean; totp?: boolean }): Promise<string> {
    const org = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, plan, subscription_status) VALUES ($1, $1, 'starter', 'active') RETURNING id`,
      [`web38-${email}`]
    );
    orgIds.push(org.rows[0].id);
    const user = await query<{ id: string }>(
      `INSERT INTO users (organization_id, email, name, password_hash, role, email_verified, totp_enabled, totp_secret_encrypted)
       VALUES ($1, $2, 'Prueba', $3, 'owner', $4, $5, $6) RETURNING id`,
      [org.rows[0].id, email, await bcrypt.hash('Clave1234', 4), opts.verified, opts.totp ?? false, opts.totp ? encrypt('JBSWY3DPEHPK3PXP') : null]
    );
    await query(`INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, 'owner')`, [user.rows[0].id, org.rows[0].id]);
    return user.rows[0].id;
  }

  try {
    // Verificado: vincula y entra
    const verified = mail('verified');
    const vId = await seedUser(verified, { verified: true });
    const out1 = await resolveOAuthIdentity(provider, { sub: `sub-v-${tag}`, email: verified, emailVerified: true, name: 'X' }, state(), store);
    assert.equal(out1.kind, 'session');
    const v = await query<{ google_sub: string; password_set: boolean }>('SELECT google_sub, password_set FROM users WHERE id = $1', [vId]);
    assert.equal(v.rows[0].google_sub, `sub-v-${tag}`);
    assert.equal(v.rows[0].password_set, true);
    // Otro `sub` con el mismo correo: rechazado
    await assert.rejects(
      resolveOAuthIdentity(provider, { sub: `otro-${tag}`, email: verified, emailVerified: true, name: 'X' }, state(), store),
      (e: Error & { code?: string }) => e.code === 'conflict'
    );

    // Sin verificar: vincula, verifica y reemplaza la contraseña
    const unverified = mail('unverified');
    const uId = await seedUser(unverified, { verified: false });
    const out2 = await resolveOAuthIdentity(provider, { sub: `sub-u-${tag}`, email: unverified, emailVerified: true, name: 'X' }, state(), store);
    assert.equal(out2.kind, 'session');
    const u = await query<{ email_verified: boolean; password_set: boolean; password_hash: string }>(
      'SELECT email_verified, password_set, password_hash FROM users WHERE id = $1', [uId]
    );
    assert.equal(u.rows[0].email_verified, true);
    assert.equal(u.rows[0].password_set, false);
    assert.equal(await bcrypt.compare('Clave1234', u.rows[0].password_hash), false);

    // Con 2FA: no se salta, deja un handoff con el tempToken
    const twofa = mail('2fa');
    await seedUser(twofa, { verified: true, totp: true });
    const out3 = await resolveOAuthIdentity(provider, { sub: `sub-t-${tag}`, email: twofa, emailVerified: true, name: 'X' }, state(), store);
    assert.equal(out3.kind, 'twoFactor');
    if (out3.kind === 'twoFactor') assert.ok((await consumeTwoFactorHandoff(out3.handle, store)).length > 20);

    // Correo sin verificar en Google: rechazado
    await assert.rejects(
      resolveOAuthIdentity(provider, { sub: `sub-n-${tag}`, email: mail('nv'), emailVerified: false, name: 'X' }, state(), store),
      (e: Error & { code?: string }) => e.code === 'unverified'
    );

    // Nuevo: registro pendiente → complete
    const fresh = mail('new');
    const out4 = await resolveOAuthIdentity(provider, { sub: `sub-new-${tag}`, email: fresh, emailVerified: true, name: 'Nueva' }, { ...state('login'), plan: 'starter', ref: 'SOCIO-9' }, store);
    assert.equal(out4.kind, 'signup');
    if (out4.kind !== 'signup') return;
    assert.equal(out4.noAccount, true);
    assert.equal((await getPendingSignup(out4.token, store)).email, fresh);
    const done = await completeOAuthSignup({ token: out4.token, name: 'Nueva Persona', organizationName: `Negocio ${tag}`, acceptTerms: true, language: 'en' }, store);
    assert.equal(done.tokens.user.welcomeSurvey, 'pending');
    const created = await query<{ email_verified: boolean; password_set: boolean; google_sub: string; language: string; terms_version: string | null; organization_id: string }>(
      'SELECT email_verified, password_set, google_sub, language, terms_version, organization_id FROM users WHERE email = $1', [fresh]
    );
    orgIds.push(created.rows[0].organization_id);
    assert.equal(created.rows[0].email_verified, true);
    assert.equal(created.rows[0].password_set, false);
    assert.equal(created.rows[0].google_sub, `sub-new-${tag}`);
    assert.equal(created.rows[0].language, 'en');
    assert.ok(created.rows[0].terms_version);
    const org = await query<{ plan: string; signup_ref_code: string; trial_ends_at: string | null }>(
      'SELECT plan, signup_ref_code, trial_ends_at FROM organizations WHERE id = $1', [created.rows[0].organization_id]
    );
    assert.equal(org.rows[0].plan, 'starter');
    assert.equal(org.rows[0].signup_ref_code, 'SOCIO-9');
    assert.ok(org.rows[0].trial_ends_at);
    const verifications = await query('SELECT 1 FROM email_verifications ev JOIN users u ON u.id = ev.user_id WHERE u.email = $1', [fresh]);
    assert.equal(verifications.rows.length, 0); // sin correo de verificación
    // El token de registro ya no sirve
    await assert.rejects(getPendingSignup(out4.token, store), /expired/);
  } finally {
    await query(`DELETE FROM users WHERE email LIKE $1`, [`web38-%-${tag}@example.test`]);
    if (orgIds.length) await query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [orgIds]);
    await pool.end();
  }
});

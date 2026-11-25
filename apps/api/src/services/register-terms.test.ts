import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema, TERMS_VERSION } from '@gensmart/shared';

const base = {
  name: 'Ana Pérez',
  email: 'ana@example.com',
  password: 'Secreta123',
  organizationName: 'Clínica Ana',
  turnstileToken: 'token',
};

test('registerSchema exige acceptTerms: true', () => {
  assert.equal(registerSchema.safeParse(base).success, false);
  assert.equal(registerSchema.safeParse({ ...base, acceptTerms: false }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, acceptTerms: 'true' }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, acceptTerms: true }).success, true);
});

test('TERMS_VERSION es una fecha AAAA-MM-DD', () => {
  assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

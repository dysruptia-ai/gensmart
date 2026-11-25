/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema } from '@gensmart/shared';
import { languageFromRequest, resolveUserLanguage } from './language';

const req = (h?: string) => ({ headers: h === undefined ? {} : { 'accept-language': h } });

test('Accept-Language: es si empieza por es; si no, en', () => {
  assert.equal(languageFromRequest(req('es-CO,es;q=0.9,en;q=0.8')), 'es');
  assert.equal(languageFromRequest(req('ES')), 'es');
  assert.equal(languageFromRequest(req('en-US,es;q=0.9')), 'en');
  assert.equal(languageFromRequest(req('pt-BR')), 'en');
  assert.equal(languageFromRequest(req()), 'en');
});

test('el idioma de la pantalla manda sobre la cabecera', () => {
  assert.equal(resolveUserLanguage('es', req('en-US')), 'es');
  assert.equal(resolveUserLanguage(undefined, req('es-MX')), 'es');
});

test('registerSchema acepta language es|en y nada más', () => {
  const base = { name: 'Ana', email: 'a@example.com', password: 'Secreta123', organizationName: 'Neg', turnstileToken: 't', acceptTerms: true };
  assert.ok(registerSchema.safeParse({ ...base, language: 'es' }).success);
  assert.ok(registerSchema.safeParse(base).success);
  assert.equal(registerSchema.safeParse({ ...base, language: 'fr' }).success, false);
});

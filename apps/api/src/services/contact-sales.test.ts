/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * POST /api/contact-sales logic: validation, honeypot, default type and Turnstile.
 * Injected email and Turnstile: no SMTP, Redis or network.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTACT_RECIPIENT,
  handleContactSales,
  type ContactSalesDeps,
} from './contact-sales.service';

interface Sent { to: string; subject: string; html: string }

function deps(overrides: Partial<ContactSalesDeps> = {}): { deps: ContactSalesDeps; sent: Sent[]; verified: string[] } {
  const sent: Sent[] = [];
  const verified: string[] = [];
  return {
    sent,
    verified,
    deps: {
      turnstileConfigured: false,
      verifyTurnstile: async (token) => {
        verified.push(token);
        return token === 'good-token';
      },
      sendEmail: async (mail) => {
        sent.push(mail);
      },
      wrapHtml: (c) => c,
      ...overrides,
    },
  };
}

const VALID = { name: 'Ana', email: 'ana@example.com', message: 'Quiero una demo' };

describe('contact-sales', () => {
  test('valid submission sends one email to the fixed recipient', async () => {
    const d = deps();
    const r = await handleContactSales(VALID, '1.2.3.4', d.deps);
    assert.equal(r.status, 200);
    assert.equal(d.sent.length, 1);
    assert.equal(d.sent[0]?.to, CONTACT_RECIPIENT);
  });

  test('type defaults to sales (Enterprise inquiry) for the sales dialog', async () => {
    const d = deps();
    await handleContactSales({ ...VALID, company: 'ACME' }, undefined, d.deps);
    assert.match(d.sent[0]?.subject ?? '', /^GenSmart Enterprise inquiry from Ana$/);
    assert.match(d.sent[0]?.html ?? '', />sales</);
  });

  test('subject and body reflect type, WhatsApp and language', async () => {
    const d = deps();
    await handleContactSales(
      { ...VALID, type: 'partner', whatsapp: '+57 (300) 123-4567', language: 'es' },
      undefined,
      d.deps
    );
    assert.match(d.sent[0]?.subject ?? '', /Partner: agency path/);
    assert.match(d.sent[0]?.html ?? '', /\+57 \(300\) 123-4567/);
    assert.match(d.sent[0]?.html ?? '', />es</);
  });

  test('invalid email → 400 and nothing sent', async () => {
    const d = deps();
    const r = await handleContactSales({ ...VALID, email: 'no-arroba' }, undefined, d.deps);
    assert.equal(r.status, 400);
    assert.equal(d.sent.length, 0);
  });

  test('invalid WhatsApp, unknown type or language → 400', async () => {
    for (const extra of [
      { whatsapp: '300-abc' },
      { whatsapp: '1'.repeat(41) },
      { type: 'otro' },
      { language: 'fr' },
    ]) {
      const d = deps();
      const r = await handleContactSales({ ...VALID, ...extra }, undefined, d.deps);
      assert.equal(r.status, 400, JSON.stringify(extra));
      assert.equal(d.sent.length, 0);
    }
  });

  test('missing required fields → 400', async () => {
    const d = deps();
    const r = await handleContactSales({ name: '', email: 'a@b.co', message: '' }, undefined, d.deps);
    assert.equal(r.status, 400);
  });

  test('filled honeypot → 200 without sending (even with invalid data)', async () => {
    const d = deps({ turnstileConfigured: true });
    const r = await handleContactSales({ email: 'x', website: 'http://spam' }, undefined, d.deps);
    assert.equal(r.status, 200);
    assert.equal(d.sent.length, 0);
    assert.equal(d.verified.length, 0);
  });

  test('Turnstile configured: missing token → 400 CAPTCHA_FAILED', async () => {
    const d = deps({ turnstileConfigured: true });
    const r = await handleContactSales(VALID, undefined, d.deps);
    assert.equal(r.status, 400);
    assert.equal(r.status === 400 && r.body.error.code, 'CAPTCHA_FAILED');
    assert.equal(d.sent.length, 0);
  });

  test('Turnstile configured: bad token → 400, good token → 200', async () => {
    const bad = deps({ turnstileConfigured: true });
    assert.equal((await handleContactSales({ ...VALID, turnstileToken: 'bad' }, undefined, bad.deps)).status, 400);
    assert.equal(bad.sent.length, 0);
    const good = deps({ turnstileConfigured: true });
    assert.equal((await handleContactSales({ ...VALID, turnstileToken: 'good-token' }, undefined, good.deps)).status, 200);
    assert.equal(good.sent.length, 1);
  });

  test('Turnstile not configured: token is not required nor verified', async () => {
    const d = deps();
    const r = await handleContactSales(VALID, undefined, d.deps);
    assert.equal(r.status, 200);
    assert.equal(d.verified.length, 0);
  });

  test('name with line breaks cannot inject headers into the subject', async () => {
    const d = deps();
    await handleContactSales({ ...VALID, name: 'Ana\r\nBcc: x@y.z' }, undefined, d.deps);
    assert.doesNotMatch(d.sent[0]?.subject ?? '', /[\r\n]/);
  });
});

/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * POST /api/docs-feedback logic: page and reason validation, honeypot, comment length,
 * no personal data in the email, and send failures surfacing as errors.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DOC_IDS } from '@gensmart/shared';
import {
  DOCS_FEEDBACK_RECIPIENT,
  handleDocsFeedback,
  type DocsFeedbackDeps,
} from './docs-feedback.service';
import { CONTACT_RECIPIENT } from './contact-sales.service';

interface Sent { to: string; subject: string; html: string }

function deps(overrides: Partial<DocsFeedbackDeps> = {}): { deps: DocsFeedbackDeps; sent: Sent[] } {
  const sent: Sent[] = [];
  return {
    sent,
    deps: {
      sendEmail: async (mail) => {
        sent.push(mail);
      },
      wrapHtml: (c) => c,
      ...overrides,
    },
  };
}

describe('docs-feedback', () => {
  test('there are 12 guide ids', () => {
    assert.equal(DOC_IDS.length, 12);
  });

  test('"Yes" sends one summary to the contact-sales recipient', async () => {
    const d = deps();
    const r = await handleDocsFeedback({ page: 'traspaso', language: 'es', helpful: true }, d.deps);
    assert.equal(r.status, 200);
    assert.equal(d.sent.length, 1);
    assert.equal(d.sent[0]?.to, DOCS_FEEDBACK_RECIPIENT);
    assert.equal(DOCS_FEEDBACK_RECIPIENT, CONTACT_RECIPIENT);
    assert.match(d.sent[0]?.subject ?? '', /traspaso \(Helpful\)/);
  });

  test('"No" with a reason and a comment includes both, escaped', async () => {
    const d = deps();
    const r = await handleDocsFeedback(
      { page: 'crm', language: 'en', helpful: false, reason: 'falta', comment: 'Missing <b>step</b> 3' },
      d.deps
    );
    assert.equal(r.status, 200);
    assert.match(d.sent[0]?.html ?? '', /falta/);
    assert.match(d.sent[0]?.html ?? '', /Missing &lt;b&gt;step&lt;\/b&gt; 3/);
  });

  test('"No" without a reason is rejected', async () => {
    const d = deps();
    const r = await handleDocsFeedback({ page: 'crm', language: 'en', helpful: false }, d.deps);
    assert.equal(r.status, 400);
    assert.equal(d.sent.length, 0);
  });

  test('unknown page, unknown reason, bad language and long comment are rejected', async () => {
    const d = deps();
    const bad = [
      { page: 'whatsapp-setup', language: 'es', helpful: true },
      { page: 'crm', language: 'es', helpful: false, reason: 'spam' },
      { page: 'crm', language: 'fr', helpful: true },
      { page: 'crm', language: 'es', helpful: false, reason: 'otro', comment: 'x'.repeat(601) },
      { page: 'crm', language: 'es', helpful: 'yes' },
    ];
    for (const body of bad) {
      const r = await handleDocsFeedback(body, d.deps);
      assert.equal(r.status, 400, JSON.stringify(body));
    }
    assert.equal(d.sent.length, 0);
  });

  test('extra fields (personal data) are rejected, not forwarded', async () => {
    const d = deps();
    const r = await handleDocsFeedback(
      { page: 'crm', language: 'es', helpful: true, email: 'ana@example.com' },
      d.deps
    );
    assert.equal(r.status, 400);
    assert.equal(d.sent.length, 0);
  });

  test('a 600-character comment is accepted', async () => {
    const d = deps();
    const r = await handleDocsFeedback(
      { page: 'agenda', language: 'es', helpful: false, reason: 'otro', comment: 'x'.repeat(600) },
      d.deps
    );
    assert.equal(r.status, 200);
  });

  test('honeypot: looks successful, sends nothing', async () => {
    const d = deps();
    const r = await handleDocsFeedback({ page: 'crm', language: 'es', helpful: true, website: 'http://spam' }, d.deps);
    assert.equal(r.status, 200);
    assert.equal(d.sent.length, 0);
  });

  test('a failed send throws (the route answers 500, the page shows an error)', async () => {
    const d = deps({
      sendEmail: async () => {
        throw new Error('SMTP down');
      },
    });
    await assert.rejects(handleDocsFeedback({ page: 'crm', language: 'es', helpful: true }, d.deps), /SMTP down/);
  });
});

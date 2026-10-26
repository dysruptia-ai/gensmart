import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReferences,
  detectAutomatedEmail,
  extractNewMessage,
  parseAddress,
  replySubject,
  resolveAgentId,
} from './email-parsing';

const AGENT = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';

test('resolveAgentId routes agent-{uuid}@inbound domain, ignores others', () => {
  assert.equal(resolveAgentId([`Agent <agent-${AGENT}@inbound.gensmart.co>`], 'inbound.gensmart.co'), AGENT);
  assert.equal(resolveAgentId([`agent-${AGENT.toUpperCase()}@Inbound.GenSmart.co`], 'inbound.gensmart.co'), AGENT);
  assert.equal(resolveAgentId([`agent-${AGENT}@evil.com`], 'inbound.gensmart.co'), null);
  assert.equal(resolveAgentId(['agent-123@inbound.gensmart.co'], 'inbound.gensmart.co'), null);
  assert.equal(resolveAgentId(['x@y.com', `agent-${AGENT}@inbound.gensmart.co`], 'inbound.gensmart.co'), AGENT);
});

test('parseAddress handles display names and bare addresses', () => {
  assert.deepEqual(parseAddress('"Doe, Jane" <Jane@Example.com>'), { name: 'Doe, Jane', address: 'jane@example.com' });
  assert.deepEqual(parseAddress('jane@example.com'), { name: null, address: 'jane@example.com' });
  assert.equal(parseAddress('not an address'), null);
});

test('auto-reply / loop detection', () => {
  assert.match(detectAutomatedEmail({ 'Auto-Submitted': 'auto-replied' }, 'a@b.co') ?? '', /Auto-Submitted/);
  assert.match(detectAutomatedEmail({ 'auto-submitted': 'auto-generated' }, 'a@b.co') ?? '', /Auto-Submitted/);
  assert.equal(detectAutomatedEmail({ 'Auto-Submitted': 'no' }, 'a@b.co'), null);
  assert.ok(detectAutomatedEmail({ 'X-Autoreply': 'yes' }, 'a@b.co'));
  assert.ok(detectAutomatedEmail({ 'X-Autorespond': 'yes' }, 'a@b.co'));
  assert.ok(detectAutomatedEmail({ Precedence: 'bulk' }, 'a@b.co'));
  assert.ok(detectAutomatedEmail({ Precedence: 'auto_reply' }, 'a@b.co'));
  assert.ok(detectAutomatedEmail({ 'X-Auto-Response-Suppress': 'DR, OOF, AutoReply' }, 'a@b.co'));
  assert.ok(detectAutomatedEmail({ 'Content-Type': 'multipart/report; report-type=delivery-status' }, 'a@b.co'));
  assert.ok(detectAutomatedEmail({}, 'mailer-daemon@googlemail.com'));
  assert.ok(detectAutomatedEmail({}, 'no-reply@shop.com'));
  assert.equal(detectAutomatedEmail({ 'Content-Type': 'text/plain', Precedence: 'first-class' }, 'jane@example.com'), null);
});

const GMAIL_EN = `Yes, Tuesday works for me.

On Mon, Oct 26, 2026 at 10:15 AM Sales Agent <agent-${AGENT}@inbound.gensmart.co> wrote:
> Hi! When can we talk?
>
> Best,
> Agent`;
const GMAIL_ES = `Sí, el martes me va bien.

El lun, 26 oct 2026 a las 10:15, Agente <agent-${AGENT}@inbound.gensmart.co> escribió:
> Hola, ¿cuándo hablamos?`;
const OUTLOOK_EN = `Yes, Tuesday works for me.

From: Sales Agent <agent-${AGENT}@inbound.gensmart.co>
Sent: Monday, October 26, 2026 10:15 AM
To: Jane Doe
Subject: Re: Demo request

Hi! When can we talk?`;
const OUTLOOK_ES = `Sí, el martes me va bien.

De: Agente <agent-${AGENT}@inbound.gensmart.co>
Enviado el: lunes, 26 de octubre de 2026 10:15
Para: Juan
Asunto: RE: Demo

Hola, ¿cuándo hablamos?`;

test('extractNewMessage drops quoted history (Gmail + Outlook, EN + ES)', () => {
  assert.equal(extractNewMessage(GMAIL_EN), 'Yes, Tuesday works for me.');
  assert.equal(extractNewMessage(GMAIL_ES), 'Sí, el martes me va bien.');
  assert.equal(extractNewMessage(OUTLOOK_EN), 'Yes, Tuesday works for me.');
  assert.equal(extractNewMessage(OUTLOOK_ES), 'Sí, el martes me va bien.');
  assert.equal(extractNewMessage('Just a fresh email\r\nwith two lines'), 'Just a fresh email\nwith two lines');
  assert.equal(extractNewMessage('> only quoted'), '');
});

test('threading: references accumulate and subject is not double-prefixed', () => {
  const refs1 = buildReferences([], undefined, 'abc@mail.x');
  assert.deepEqual(refs1, ['<abc@mail.x>']);
  const refs2 = buildReferences([...refs1, '<our1@inbound.gensmart.co>'], '<abc@mail.x> <our1@inbound.gensmart.co>', '<def@mail.x>');
  assert.deepEqual(refs2, ['<abc@mail.x>', '<our1@inbound.gensmart.co>', '<def@mail.x>']);
  assert.equal(replySubject('Demo request'), 'Re: Demo request');
  assert.equal(replySubject('RE: Demo request'), 'RE: Demo request');
  assert.equal(replySubject('  '), 'Re: (no subject)');
});

test('Svix signature: valid passes, tampered body and wrong secret fail', async () => {
  process.env['RESEND_WEBHOOK_SECRET'] = 'whsec_' + Buffer.from('test-secret-key-0123456789abcdef').toString('base64');
  const { Webhook } = await import('svix');
  const { verifyResendWebhook } = await import('./email.service');
  const body = JSON.stringify({ type: 'email.received', created_at: 'x', data: { email_id: 'e1', from: 'a@b.co', to: [], message_id: 'm', subject: 's' } });
  const id = 'msg_123';
  const ts = new Date();
  const sig = new Webhook(process.env['RESEND_WEBHOOK_SECRET']!).sign(id, ts, body);
  const headers = { 'svix-id': id, 'svix-timestamp': String(Math.floor(ts.getTime() / 1000)), 'svix-signature': sig };

  assert.equal(verifyResendWebhook(Buffer.from(body), headers).type, 'email.received');
  assert.throws(() => verifyResendWebhook(Buffer.from(body + ' '), headers));
  assert.throws(() => verifyResendWebhook(Buffer.from(body), { ...headers, 'svix-signature': 'v1,AAAA' }));
  assert.throws(() => verifyResendWebhook(Buffer.from(body), {}));
});

/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-44): búsqueda dentro de los mensajes.
 * - Siempre: escapeLike y normalizeSearch.
 * - Con INBOX_SEARCH_DB_TEST=1 (Postgres local, migración 080): el endpoint real con filas propias.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INBOX_LIMITS } from '@gensmart/shared';
import { escapeLike, normalizeSearch } from './inbox-query.service';

test('escapeLike deja %, _ y \\ como texto', () => {
  assert.equal(escapeLike('100% a_b c\\d'), '100\\% a\\_b c\\\\d');
  assert.equal(escapeLike('hola'), 'hola');
});

test('normalizeSearch: recorta y pide el mínimo', () => {
  assert.equal(normalizeSearch('  fa  ', INBOX_LIMITS.searchMinChars), 'fa');
  assert.equal(normalizeSearch(' f ', INBOX_LIMITS.searchMinChars), null);
  assert.equal(normalizeSearch(undefined, 2), null);
  assert.equal(normalizeSearch(['ab'], 2), null);
});

const dbEnabled = process.env['INBOX_SEARCH_DB_TEST'] === '1';

test('endpoint: búsqueda en contacto y mensajes', { skip: !dbEnabled }, async () => {
  const { startInboxFixture } = await import('./inbox-test-fixture');
  const fx = await startInboxFixture('isearch');
  try {
    const org = await fx.makeOrg('pro');
    const other = await fx.makeOrg('pro');
    const owner = await fx.makeUser(org, 'Owner', 'owner');
    const outsider = await fx.makeUser(other, 'Otro', 'owner');
    const agent = await fx.makeAgent(org);
    const agent2 = await fx.makeAgent(org);
    const otherAgent = await fx.makeAgent(other);

    const msg = (conv: string, role: string, content: string, minutesAgo: number) =>
      fx.query(`INSERT INTO messages (conversation_id, role, content, created_at) VALUES ($1, $2, $3, NOW() - make_interval(mins => $4))`, [
        conv,
        role,
        content,
        minutesAgo,
      ]);

    const cUser = await fx.makeConversation(org, agent);
    await msg(cUser, 'user', 'Necesito la FACTURA de marzo', 5);
    const cAgent = await fx.makeConversation(org, agent);
    await msg(cAgent, 'assistant', 'Te mando la fáctura ahora', 6);
    const cHuman = await fx.makeConversation(org, agent2);
    await msg(cHuman, 'human', 'Va la factura electrónica', 7);
    await fx.query(`UPDATE conversations SET channel = 'whatsapp' WHERE id = $1`, [cHuman]);
    // cerrada y vieja (fuera del periodo): la búsqueda la encuentra igual
    const cClosed = await fx.makeConversation(org, agent, { status: 'closed' });
    await msg(cClosed, 'user', 'una fáctura vieja', 60 * 24 * 30);
    await fx.query(`UPDATE conversations SET last_message_at = NOW() - interval '30 days' WHERE id = $1`, [cClosed]);
    // system y nota: nunca
    const cHidden = await fx.makeConversation(org, agent);
    await msg(cHidden, 'system', 'zanahoria en el resumen', 3);
    await fx.query(`INSERT INTO conversation_notes (organization_id, conversation_id, body) VALUES ($1, $2, 'zanahoria en la nota')`, [org, cHidden]);
    // literal
    const cPct = await fx.makeConversation(org, agent);
    await msg(cPct, 'user', '100% garantizado', 4);
    const cUnderscore = await fx.makeConversation(org, agent);
    await msg(cUnderscore, 'user', 'codigo a_b y ruta c:\\temp', 4);
    const cPlain = await fx.makeConversation(org, agent);
    await msg(cPlain, 'user', '1000 garantizado y axb', 4);
    // contacto
    const cContact = await fx.makeConversation(org, agent);
    const contactId = (await fx.query<{ contact_id: string }>('SELECT contact_id FROM conversations WHERE id = $1', [cContact])).rows[0]!.contact_id;
    await fx.query(`UPDATE contacts SET name = 'Ramón Pérez', email = 'ramon@ejemplo.com' WHERE id = $1`, [contactId]);
    // otra organización
    const cOther = await fx.makeConversation(other, otherAgent);
    await msg(cOther, 'user', 'factura ajena', 2);
    // el más reciente que coincide
    await msg(cUser, 'user', 'otra factura más nueva', 1);

    type Row = { id: string; searchMatch: { content: string; role: string } | null };
    const search = async (q: string, extra = '') => {
      const r = await fx.call(owner.token, 'GET', `/conversations?limit=100&search=${encodeURIComponent(q)}${extra || '&view=all'}`);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      return r.json['conversations'] as Row[];
    };
    const ids = (rows: Row[]) => new Set(rows.map((r) => r.id));

    const factura = await search('factura');
    assert.deepEqual(ids(factura), new Set([cUser, cAgent, cHuman, cClosed]), 'cliente, agente, equipo y la cerrada vieja');
    assert.equal(factura.find((r) => r.id === cUser)!.searchMatch!.content, 'otra factura más nueva', 'el más reciente');
    assert.equal(factura.find((r) => r.id === cHuman)!.searchMatch!.role, 'human');

    assert.equal((await search('zanahoria')).length, 0, 'ni system ni notas');
    assert.deepEqual(ids(await search('100%')), new Set([cPct]), '% literal');
    assert.deepEqual(ids(await search('a_b')), new Set([cUnderscore]), '_ literal');
    assert.deepEqual(ids(await search('c:\\temp')), new Set([cUnderscore]), '\\ literal');
    assert.ok(!ids(await search('axb')).has(cUnderscore));

    const byContact = await search('RAMON');
    assert.deepEqual(ids(byContact), new Set([cContact]), 'contacto sin tildes ni mayúsculas');
    assert.equal(byContact[0]!.searchMatch, null, 'solo el contacto: searchMatch null');
    assert.deepEqual(ids(await search('ramon@ejemplo')), new Set([cContact]));

    // menos de 2 caracteres = sin búsqueda (la lista normal)
    const short = await fx.call(owner.token, 'GET', '/conversations?view=all&limit=100&search=f');
    const all = await fx.call(owner.token, 'GET', '/conversations?view=all&limit=100');
    assert.equal((short.json['pagination'] as { total: number }).total, (all.json['pagination'] as { total: number }).total);

    // la vista se ignora; los filtros aplican
    assert.ok(ids(await search('factura', '&view=closed')).has(cUser));
    assert.deepEqual(ids(await search('factura', '&view=all&channels=whatsapp')), new Set([cHuman]));
    assert.deepEqual(ids(await search('factura', `&view=all&agentIds=${agent2}`)), new Set([cHuman]));

    // aislamiento
    const theirs = await fx.call(outsider.token, 'GET', '/conversations?search=factura');
    assert.deepEqual(
      (theirs.json['conversations'] as Row[]).map((r) => r.id),
      [cOther]
    );
  } finally {
    await fx.cleanup();
  }
});

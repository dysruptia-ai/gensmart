import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FILTERS, activeFilterCount, filtersQuery, listApiQuery, readFilters, rowMatches } from './inboxFormat';
import type { ConversationRow, InboxFilters } from './types';

const read = (qs: string) => readFilters(new URLSearchParams(qs));

test('filtros en la URL: ida y vuelta', () => {
  const f: InboxFilters = {
    ...EMPTY_FILTERS,
    agentIds: ['a1', 'a2'],
    channels: ['whatsapp'],
    labelIds: ['l1'],
    minScore: 7,
    order: 'unread',
    allTime: true,
  };
  const qs = filtersQuery(f);
  assert.equal(qs, '?agent=a1%2Ca2&channel=whatsapp&label=l1&score=7&range=all&order=unread');
  assert.deepEqual(read(qs.slice(1)), f);
  assert.equal(filtersQuery(EMPTY_FILTERS), '');
  assert.equal(activeFilterCount(f), 5);
});

test('las URLs viejas abren lo mismo', () => {
  const f = read('agent=a1&channel=web&view=closed&outcome=sold');
  assert.deepEqual(f.agentIds, ['a1']);
  assert.deepEqual(f.channels, ['web']);
  assert.equal(f.view, 'closed');
  assert.equal(f.outcome, 'sold');
  // nombres largos de la API también
  assert.deepEqual(read('agentIds=x,y&channels=web&labelIds=l&minScore=9').agentIds, ['x', 'y']);
  assert.equal(read('score=6').minScore, null, 'solo 5, 7 o 9');
  assert.equal(read('order=raro').order, 'needs');
});

test('vista guardada en la URL y en la API', () => {
  const f = { ...EMPTY_FILTERS, savedView: 'v1', labelIds: ['l2'], order: 'unread' as const };
  assert.equal(filtersQuery(f), '?savedView=v1&label=l2');
  const api = new URLSearchParams(listApiQuery(f, '', 1, 30));
  assert.equal(api.get('savedView'), 'v1');
  assert.equal(api.get('labelIds'), 'l2');
  assert.equal(api.get('order'), null, 'el orden es solo de Todas');
  const all = new URLSearchParams(listApiQuery({ ...EMPTY_FILTERS, channels: ['a', 'b'] }, 'fa', 1, 30));
  assert.equal(all.get('order'), 'needs');
  assert.equal(all.get('channels'), 'a,b');
  assert.equal(all.get('search'), 'fa');
});

const row = (over: Partial<ConversationRow>): ConversationRow => ({
  id: 'c',
  agentId: 'a1',
  agentName: null,
  contact: null,
  channel: 'web',
  status: 'active',
  takenOverBy: null,
  takeoverUserName: null,
  aiScore: null,
  lastMessageAt: null,
  createdAt: '',
  handedOffAt: null,
  handoffActive: false,
  needsAttention: false,
  waitingSince: null,
  lastMessage: null,
  ...over,
});

test('rowMatches con los filtros nuevos y las vistas guardadas', () => {
  const f = { ...EMPTY_FILTERS, channels: ['web', 'whatsapp'], labelIds: ['l1'], minScore: 7 as const };
  assert.equal(rowMatches(row({ labels: [{ id: 'l1', name: 'x' }], aiScore: 8 }), f, 'u'), true);
  assert.equal(rowMatches(row({ labels: [{ id: 'l1', name: 'x' }], aiScore: 6 }), f, 'u'), false, 'puntaje');
  assert.equal(rowMatches(row({ aiScore: 9 }), f, 'u'), false, 'etiqueta');
  assert.equal(rowMatches(row({ channel: 'email', labels: [{ id: 'l1', name: 'x' }], aiScore: 9 }), f, 'u'), false, 'canal');
  // vista "Solo el agente" con puntaje 7
  const saved = { state: 'agent_only' as const, minScore: 7 as const };
  const g = { ...EMPTY_FILTERS, savedView: 'v' };
  assert.equal(rowMatches(row({ aiScore: 8 }), g, 'u', saved), true);
  assert.equal(rowMatches(row({ aiScore: 8, handoffActive: true }), g, 'u', saved), false);
  assert.equal(rowMatches(row({ aiScore: 8, status: 'human_takeover', takenOverBy: 'u' }), g, 'u', saved), false);
  // cerrada en una vista "Cerradas"
  assert.equal(rowMatches(row({ status: 'closed' }), g, 'u', { state: 'closed' }), true);
  // con búsqueda solo cuentan los filtros, no la vista
  assert.equal(rowMatches(row({ status: 'closed' }), EMPTY_FILTERS, 'u', null, true), true);
});

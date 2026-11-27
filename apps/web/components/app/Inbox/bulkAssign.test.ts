import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignSkipFor, groupSkips, topSkipReason } from './bulkAssign';
import type { ConversationRow } from './types';

const row = (over: Partial<ConversationRow>): ConversationRow => ({
  id: 'c',
  agentId: 'a',
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

test('Asignar N: las mismas reglas que Transferir', () => {
  const diegos = row({ status: 'human_takeover', takenOverBy: 'diego', takeoverUserName: 'Diego R.' });
  // un miembro: solo las suyas
  assert.deepEqual(assignSkipFor(diegos, 'ana', 'me', false, 'Equipo'), { kind: 'takenBy', name: 'Diego R.' });
  assert.deepEqual(assignSkipFor(row({}), 'ana', 'me', false, 'Equipo'), { kind: 'notTaken' });
  assert.equal(assignSkipFor(row({ status: 'human_takeover', takenOverBy: 'me' }), 'ana', 'me', false, 'Equipo'), null);
  // owner/admin: todas, salvo las cerradas y las que ya tiene quien recibe
  assert.equal(assignSkipFor(diegos, 'ana', 'me', true, 'Equipo'), null);
  assert.deepEqual(assignSkipFor(diegos, 'diego', 'me', true, 'Equipo'), { kind: 'alreadyHas' });
  assert.deepEqual(assignSkipFor(row({ status: 'closed' }), 'ana', 'me', true, 'Equipo'), { kind: 'closed' });
  // un miembro no se asigna a sí mismo
  assert.deepEqual(assignSkipFor(row({ status: 'human_takeover', takenOverBy: 'me' }), 'me', 'me', false, 'Equipo'), { kind: 'alreadyHas' });

  const groups = groupSkips([{ kind: 'takenBy', name: 'Diego R.' }, { kind: 'takenBy', name: 'Diego R.' }, { kind: 'closed' }]);
  assert.deepEqual(groups.map((g) => [g.kind, g.count]), [['takenBy', 2], ['closed', 1]]);
  assert.equal(topSkipReason([{ reason: 'forbidden' }, { reason: 'not_found' }, { reason: 'forbidden' }]), 'forbidden');
  assert.equal(topSkipReason([]), null);
});

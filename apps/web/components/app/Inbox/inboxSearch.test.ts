import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightMatch, matchesQuery } from './inboxSearch';
import { changeNote, initialState, labelDelta, nextState, tallyLabels, type TriState } from './bulkLabels';

const marked = (segs: { text: string; match: boolean }[]) => segs.filter((s) => s.match).map((s) => s.text);

test('highlightMatch: sin tildes ni mayúsculas, sobre el texto original', () => {
  const segs = highlightMatch('Te mando la FÁCTURA hoy', 'factura');
  assert.deepEqual(marked(segs), ['FÁCTURA']);
  assert.equal(segs.map((s) => s.text).join(''), 'Te mando la FÁCTURA hoy');
  assert.deepEqual(marked(highlightMatch('Ramón', 'ramon')), ['Ramón']);
  // NFD en el original (o + tilde combinada)
  assert.deepEqual(marked(highlightMatch('Ramón Pérez', 'RAMON')), ['Ramón']);
});

test('highlightMatch: varias coincidencias y sin coincidencia', () => {
  assert.deepEqual(marked(highlightMatch('pago, otro pago y PAGO', 'pago')), ['pago', 'pago', 'PAGO']);
  const none = highlightMatch('hola mundo', 'zzz');
  assert.deepEqual(none, [{ text: 'hola mundo', match: false }]);
  assert.deepEqual(highlightMatch('hola', ''), [{ text: 'hola', match: false }]);
});

test('highlightMatch: fragmento de ~120 alrededor de la primera coincidencia', () => {
  const long = `${'palabra '.repeat(30)}la factura de marzo ${'cosa '.repeat(40)}`;
  const segs = highlightMatch(long, 'factura');
  const text = segs.map((s) => s.text).join('');
  assert.ok(text.startsWith('…') && text.endsWith('…'));
  assert.ok(text.length <= 124, `largo ${text.length}`);
  assert.deepEqual(marked(segs), ['factura']);
  // sin cortar palabras
  assert.ok(/^…palabra /.test(text) || /^…la /.test(text), text.slice(0, 20));
  assert.ok(/(cosa|marzo)…$/.test(text), text.slice(-20));
});

test('matchesQuery', () => {
  assert.equal(matchesQuery('Ramón Pérez', 'perez'), true);
  assert.equal(matchesQuery(null, 'x'), false);
  assert.equal(matchesQuery('abc', '  '), false);
});

test('tres estados de "Etiquetar N"', () => {
  assert.equal(initialState(0, 3), 'none');
  assert.equal(initialState(1, 3), 'some');
  assert.equal(initialState(3, 3), 'all');
  // some → all → none → some
  let s: TriState = 'some';
  s = nextState(s, 'some');
  assert.equal(s, 'all');
  s = nextState(s, 'some');
  assert.equal(s, 'none');
  s = nextState(s, 'some');
  assert.equal(s, 'some');
  // all/none alternan
  assert.equal(nextState('all', 'all'), 'none');
  assert.equal(nextState('none', 'all'), 'all');
  assert.equal(nextState('none', 'none'), 'all');

  const tally = tallyLabels([['a', 'b'], ['a'], ['a', 'a']]);
  assert.equal(tally.get('a'), 3);
  assert.equal(tally.get('b'), 1);

  const initial = new Map<string, TriState>([['a', 'all'], ['b', 'some'], ['c', 'none'], ['d', 'some']]);
  const states = new Map<string, TriState>([['a', 'none'], ['b', 'all'], ['c', 'all'], ['d', 'some']]);
  assert.deepEqual(labelDelta(states, initial), { add: ['b', 'c'], remove: ['a'] });
  assert.deepEqual(changeNote('all', 'some', 1, 3), { kind: 'add', n: 2 });
  assert.deepEqual(changeNote('none', 'some', 1, 3), { kind: 'remove', n: 1 });
  assert.equal(changeNote('some', 'some', 1, 3), null);
});

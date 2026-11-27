import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate } from './translate';

const es = { a: { more: '{count} más', more_one: '{count} etiqueta más', more_other: '{count} etiquetas más' }, plain: 'Hola {name}' };
const en = { a: { more_one: '{count} more label', more_other: '{count} more labels' }, plain: 'Hi {name}', onlyEn: 'Only' };

test('plurales con Intl.PluralRules y respaldo a key_other', () => {
  const d = { current: es, fallback: en };
  assert.equal(translate(d, 'es', 'a.more', { count: 1 }), '1 etiqueta más');
  assert.equal(translate(d, 'es', 'a.more', { count: 3 }), '3 etiquetas más');
  // "many" (1 000 000 en es) no existe: cae en _other
  assert.equal(translate(d, 'es', 'a.more', { count: 1000000 }), '1000000 etiquetas más');
  assert.equal(translate({ current: en, fallback: en }, 'en', 'a.more', { count: 1 }), '1 more label');
  assert.equal(translate({ current: en, fallback: en }, 'en', 'a.more', { count: 0 }), '0 more labels');
});

test('sin variantes: la clave de siempre; sin count: la clave base', () => {
  const d = { current: es, fallback: en };
  assert.equal(translate(d, 'es', 'plain', { name: 'Ana', count: 2 }), 'Hola Ana');
  assert.equal(translate(d, 'es', 'a.more', { count: 'x' as unknown as number }), 'x más');
  assert.equal(translate(d, 'es', 'onlyEn'), 'Only', 'respaldo a inglés');
  assert.equal(translate(d, 'es', 'nope'), 'nope');
});

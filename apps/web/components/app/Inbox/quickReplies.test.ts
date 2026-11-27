import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReplyVariables,
  applyReplyVariablesParts,
  filterQuickReplies,
  findSlashToken,
  firstName,
  insertReply,
  topReplies,
  type QuickReply,
} from './quickReplies';

const qr = (shortcut: string, body: string, useCount: number): QuickReply => ({ id: shortcut, shortcut, body, useCount, lastUsedAt: null });

test('firstName: primera palabra; nada si está vacío o parece un teléfono', () => {
  assert.equal(firstName('Laura Gómez'), 'Laura');
  assert.equal(firstName('  Sofía  '), 'Sofía');
  assert.equal(firstName(''), null);
  assert.equal(firstName(null), null);
  assert.equal(firstName('+57 300 123 4567'), null);
  assert.equal(firstName('(601) 555-12'), null);
});

test('applyReplyVariables con datos', () => {
  const vars = { contactName: 'Laura Gómez', agentName: 'Camila Martínez' };
  assert.equal(applyReplyVariables('Hola {nombre}, soy {agente}.', vars), 'Hola Laura, soy Camila.');
  assert.equal(applyReplyVariables('Hola {Nombre} y {AGENTE}', vars), 'Hola Laura y Camila', 'sin distinguir mayúsculas');
  assert.equal(applyReplyVariables('Hi {name}, {agent} here', vars), 'Hi Laura, Camila here', 'alias en inglés');
  assert.equal(applyReplyVariables('Código {otra} y {nombre}', vars), 'Código {otra} y Laura', 'desconocida queda tal cual');
});

test('applyReplyVariables sin dato: quita la variable y arregla el texto', () => {
  const none = { contactName: '+57 300 1234567', agentName: '' };
  assert.equal(applyReplyVariables('Hola {nombre}, puedes pagar con PSE.', none), 'Hola, puedes pagar con PSE.');
  assert.equal(applyReplyVariables('Gracias {nombre}.', none), 'Gracias.');
  assert.equal(applyReplyVariables('La garantía cubre 12 meses, {nombre}.', none), 'La garantía cubre 12 meses.');
  assert.equal(applyReplyVariables('{nombre}, te escribo', none), 'te escribo');
  assert.equal(applyReplyVariables('Hola {nombre} ¿cómo estás?', none), 'Hola ¿cómo estás?');
  assert.equal(applyReplyVariables('Soy {agente} y te ayudo', none), 'Soy y te ayudo');
  assert.equal(applyReplyVariables('Línea 1 {nombre}\nLínea 2', none), 'Línea 1\nLínea 2', 'conserva los saltos de línea');
  assert.equal(applyReplyVariables('Hola  doble  espacio', none), 'Hola  doble  espacio', 'sin variables no toca nada');
});

test('applyReplyVariablesParts marca el valor de {nombre}', () => {
  const parts = applyReplyVariablesParts('Hola {nombre}, ¿listo?', { contactName: 'Sofía Vargas' });
  assert.deepEqual(parts, [{ text: 'Hola ' }, { text: 'Sofía', variable: 'contact' }, { text: ', ¿listo?' }]);
  const empty = applyReplyVariablesParts('Hola {nombre}, ¿listo? {agente}', { contactName: '', agentName: 'Ana' });
  assert.deepEqual(empty.map((p) => p.text).join(''), 'Hola, ¿listo? Ana');
  assert.equal(empty.find((p) => p.variable)?.variable, 'agent');
});

test('findSlashToken: inicio, tras espacio o salto; la URL no abre el menú', () => {
  assert.deepEqual(findSlashToken('/pa', 3), { start: 0, query: 'pa' });
  assert.deepEqual(findSlashToken('hola /ga', 8), { start: 5, query: 'ga' });
  assert.deepEqual(findSlashToken('hola\n/', 6), { start: 5, query: '' });
  assert.equal(findSlashToken('https://gensmart.co', 19), null);
  assert.equal(findSlashToken('https://', 8), null);
  assert.equal(findSlashToken('a/b', 3), null);
  assert.equal(findSlashToken('/pago listo', 11), null, 'con espacio después ya no es filtro');
  assert.deepEqual(findSlashToken('/pago listo', 5), { start: 0, query: 'pago' }, 'depende del cursor');
});

test('filterQuickReplies: atajo antes que texto, por usos, sin tildes, máximo 8', () => {
  const list = [
    qr('horario', 'Atendemos de lunes a viernes', 31),
    qr('pago', 'Puedes pagar con tarjeta', 42),
    qr('pasos-pse', 'Para pagar por PSE elige tu banco', 3),
    qr('garantía', 'Cubre 12 meses', 9),
    qr('envios', 'Hacemos envíos con pago contraentrega', 50),
  ];
  const pa = filterQuickReplies(list, 'pa');
  assert.deepEqual(pa.map((m) => m.reply.shortcut), ['pago', 'pasos-pse', 'envios'], 'atajo por usos, luego texto');
  assert.deepEqual(pa[0]!.shortcutRange, [0, 2]);
  assert.equal(pa[2]!.shortcutRange, null);
  assert.deepEqual(filterQuickReplies(list, 'garantia').map((m) => m.reply.shortcut), ['garantía'], 'sin tildes');
  assert.deepEqual(filterQuickReplies(list, 'ENVIOS').map((m) => m.reply.shortcut), ['envios'], 'sin mayúsculas');
  assert.deepEqual(filterQuickReplies(list, 'lunes').map((m) => m.reply.shortcut), ['horario'], 'por texto');
  assert.deepEqual(filterQuickReplies(list, '').map((m) => m.reply.shortcut), ['envios', 'pago', 'horario', 'garantía', 'pasos-pse']);
  assert.equal(filterQuickReplies(list, 'zzz').length, 0);
  const many = Array.from({ length: 12 }, (_, i) => qr(`r${i}x`, 'x', i));
  assert.equal(filterQuickReplies(many, '').length, 8);
});

test('insertReply reemplaza la ficha y deja el cursor al final', () => {
  const text = 'Claro /pa gracias';
  const token = findSlashToken(text, 9)!;
  assert.deepEqual(insertReply(text, token, 9, 'Puedes pagar con PSE.'), { text: 'Claro Puedes pagar con PSE. gracias', caret: 27 });
});

test('topReplies: las 3 más usadas', () => {
  const list = [qr('a', '', 1), qr('b', '', 5), qr('c', '', 3), qr('d', '', 4)];
  assert.deepEqual(topReplies(list).map((r) => r.shortcut), ['b', 'd', 'c']);
});

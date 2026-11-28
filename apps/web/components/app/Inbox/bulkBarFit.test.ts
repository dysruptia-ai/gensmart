import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bulkBarLevel } from './bulkBarFit';

test('barra del lote: el texto se queda mientras quepa; Borrar y × no cuentan como texto', () => {
  const base = { countWidth: 80, textWidths: [74, 66, 72], fixedIcons: 2, iconWidth: 34, gap: 4 };
  // 80 + 212 + 68 + 5*4 = 380
  assert.equal(bulkBarLevel({ ...base, width: 380 }), 0);
  assert.equal(bulkBarLevel({ ...base, width: 379 }), 1);
  // Sin Asignar (plan Solo) cabe en menos
  assert.equal(bulkBarLevel({ ...base, textWidths: [66, 72], width: 310 }), 0);
});

test('web-45: a 1440 caben "2 selected · Assign · Close · Label · papelera · ×" solo con texto', () => {
  // La columna de la lista a 1440: clamp(300px, 26vw, 384px) = 374 px; la barra: 374 − 24 (márgenes)
  // − 2 (borde) − 12 (padding) = 336 px de ancho interior.
  const width = 336;
  // Medidas en inglés a 13,5 px con padding de 6 px a cada lado, sin el ícono de 16 + 5 de separación
  const textOnly = { countWidth: 86, textWidths: [56, 49, 49], fixedIcons: 2, iconWidth: 34, gap: 4 };
  // 86 + 154 + 68 + 5*4 = 328
  assert.equal(bulkBarLevel({ ...textOnly, width }), 0);
  // Con ícono + texto (como antes) no cabía: pasaba a todo íconos
  assert.equal(bulkBarLevel({ ...textOnly, textWidths: [77, 70, 70], width }), 1);
});

test('web-45b: con las medidas reales a 1440 (barra de 349 px) queda el texto, con 2 y con 20', () => {
  const width = 349 - 12; // padding de la barra
  const actions = [42 + 16, 35 + 16, 34 + 16]; // texto + 8 px por lado
  assert.equal(bulkBarLevel({ countWidth: 65 + 12, textWidths: actions, fixedIcons: 2, iconWidth: 34, gap: 4, width }), 0);
  assert.equal(bulkBarLevel({ countWidth: 73 + 12, textWidths: actions, fixedIcons: 2, iconWidth: 34, gap: 4, width }), 0);
});

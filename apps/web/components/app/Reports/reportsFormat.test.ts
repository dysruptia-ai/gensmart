import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare, csvCell, csvFilename, formatMinutes, formatSeconds, toCsv } from './reportsFormat';

test('formatSeconds y formatMinutes', () => {
  assert.equal(formatSeconds(8), '8 s');
  assert.equal(formatSeconds(8.4), '8 s');
  assert.equal(formatSeconds(80), '1 min 20 s');
  assert.equal(formatSeconds(120), '2 min');
  assert.equal(formatSeconds(3600 + 300), '1 h 5 min');
  assert.equal(formatMinutes(11), '11 min');
  assert.equal(formatMinutes(80), '1 h 20 min');
  assert.equal(formatMinutes(120), '2 h');
});

test('compare: subir es mejor en porcentajes; bajar es mejor en tiempos', () => {
  assert.deepEqual(compare('pct', 80, 74), { direction: 'up', better: true, amount: '6 pts' });
  assert.deepEqual(compare('pct', 60, 74.4), { direction: 'down', better: false, amount: '14 pts' });
  assert.deepEqual(compare('seconds', 8, 20), { direction: 'down', better: true, amount: '12 s' });
  assert.deepEqual(compare('seconds', 100, 20), { direction: 'up', better: false, amount: '1 min 20 s' });
  assert.deepEqual(compare('minutes', 5, 12), { direction: 'down', better: true, amount: '7 min' });
  assert.deepEqual(compare('pct', 50.2, 50), { direction: 'same', better: null, amount: '0 pts' });
  assert.equal(compare('pct', 50, null), null);
  assert.equal(compare('seconds', null, 8), null);
});

test('CSV: comillas, comas, saltos de línea y BOM', () => {
  assert.equal(csvCell('hola'), 'hola');
  assert.equal(csvCell(12.5), '12.5');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('dijo "sí"'), '"dijo ""sí"""');
  assert.equal(csvCell('línea\notra'), '"línea\notra"');
  const csv = toCsv([
    ['seccion', 'etiqueta', 'valor', 'valor_anterior'],
    ['resumen', 'Resueltas, %', 74, null],
  ]);
  assert.ok(csv.startsWith('﻿'));
  assert.equal(csv, '﻿seccion,etiqueta,valor,valor_anterior\r\nresumen,"Resueltas, %",74,\r\n');
});

test('csvFilename con la fecha local de la organización', () => {
  const d = new Date('2026-11-29T03:00:00Z'); // 28 de nov. en Bogotá
  assert.equal(csvFilename('es', '7d', d, 'America/Bogota'), 'gensmart-informes-7d-2026-11-28.csv');
  assert.equal(csvFilename('en', 'today', d, 'UTC'), 'gensmart-reports-today-2026-11-29.csv');
});

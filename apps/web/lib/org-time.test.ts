import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatOrgTime, zoneName } from './org-time';

const label = (zone: string) => (zone === 'UTC' ? '(UTC)' : `(${zone} time)`);
const at = new Date('2026-11-27T14:00:00Z'); // 9:00 en Bogotá

test('formatOrgTime: misma zona, sin sufijo', () => {
  assert.equal(formatOrgTime(at, 'America/Bogota', 'en', { browserTimeZone: 'America/Bogota', zoneLabel: label }), '9:00 AM');
  // Otra zona con la misma hora en este instante tampoco lleva sufijo
  assert.equal(formatOrgTime(at, 'America/Bogota', 'en', { browserTimeZone: 'America/Lima', zoneLabel: label }), '9:00 AM');
});

test('formatOrgTime: distinta zona, con sufijo', () => {
  assert.equal(formatOrgTime(at, 'UTC', 'en', { browserTimeZone: 'America/Bogota', zoneLabel: label }), '2:00 PM (UTC)');
  assert.equal(
    formatOrgTime(at, 'America/Bogota', 'es', { browserTimeZone: 'UTC', zoneLabel: (z) => `(hora de ${z})` }).replace(/\s/g, ' '),
    '9:00 a. m. (hora de Bogota)'
  );
  // Sin zona de la organización: la del navegador, sin sufijo
  assert.equal(formatOrgTime(at, undefined, 'en', { browserTimeZone: 'UTC', zoneLabel: label }).length > 0, true);
});

test('zoneName', () => {
  assert.equal(zoneName('America/New_York'), 'New York');
  assert.equal(zoneName('Etc/UTC'), 'UTC');
});

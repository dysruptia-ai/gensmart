import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROPOSED_HOURS,
  businessHoursError,
  businessMinutesBetween,
  isOpenAt,
  nextOpening,
  zonedTimeToInstant,
  type BusinessHours,
} from './businessHours';

const H: BusinessHours = DEFAULT_PROPOSED_HOURS;
const BOG = 'America/Bogota'; // UTC-5, sin cambio de horario
const NY = 'America/New_York';

// 2026-11-23 es lunes
test('isOpenAt: dentro y fuera del horario, en la zona de la organización', () => {
  assert.equal(isOpenAt(H, BOG, new Date('2026-11-23T13:00:00Z')), true); // lunes 08:00 Bogotá
  assert.equal(isOpenAt(H, BOG, new Date('2026-11-23T12:59:00Z')), false); // 07:59
  assert.equal(isOpenAt(H, BOG, new Date('2026-11-23T23:00:00Z')), false); // 18:00 justo: cerrado
  assert.equal(isOpenAt(H, BOG, new Date('2026-11-28T18:00:00Z')), true); // sábado 13:00
  assert.equal(isOpenAt(H, BOG, new Date('2026-11-29T15:00:00Z')), false); // domingo cerrado
  assert.equal(isOpenAt(H, 'Europe/Madrid', new Date('2026-11-23T13:00:00Z')), true); // 14:00 Madrid
  assert.equal(isOpenAt(H, 'Asia/Tokyo', new Date('2026-11-23T13:00:00Z')), false); // 22:00 Tokio
});

test('null = siempre abierto', () => {
  assert.equal(isOpenAt(null, BOG, new Date('2026-11-29T03:00:00Z')), true);
  assert.equal(nextOpening(null, BOG, new Date()), null);
  assert.equal(businessMinutesBetween(null, BOG, new Date('2026-11-23T00:00:00Z'), new Date('2026-11-23T01:30:00Z')), 90);
});

test('nextOpening: el lunes a las 8 después del domingo cerrado', () => {
  const sundayNoon = new Date('2026-11-29T17:00:00Z');
  assert.equal(nextOpening(H, BOG, sundayNoon)?.toISOString(), '2026-11-30T13:00:00.000Z');
  const saturdayLate = new Date('2026-11-28T20:00:00Z'); // 15:00, ya cerró el sábado
  assert.equal(nextOpening(H, BOG, saturdayLate)?.toISOString(), '2026-11-30T13:00:00.000Z');
  const open = new Date('2026-11-24T15:00:00Z');
  assert.equal(nextOpening(H, BOG, open)?.getTime(), open.getTime());
  assert.equal(nextOpening({ '1': null }, BOG, open), null);
});

test('businessMinutesBetween: una espera que cruza el cierre solo cuenta lo abierto', () => {
  // lunes 17:50 → martes 08:10 Bogotá = 10 + 10 minutos
  const from = new Date('2026-11-23T22:50:00Z');
  const to = new Date('2026-11-24T13:10:00Z');
  assert.equal(businessMinutesBetween(H, BOG, from, to), 20);
  // sábado 13:50 → lunes 08:05 = 10 + 5 (domingo cerrado)
  assert.equal(businessMinutesBetween(H, BOG, new Date('2026-11-28T18:50:00Z'), new Date('2026-11-30T13:05:00Z')), 15);
  // todo fuera de horario: 0
  assert.equal(businessMinutesBetween(H, BOG, new Date('2026-11-29T15:00:00Z'), new Date('2026-11-29T20:00:00Z')), 0);
  assert.equal(businessMinutesBetween(H, BOG, to, from), 0);
});

test('cambio de horario en America/New_York', () => {
  // 2026-03-08: a las 02:00 pasa a 03:00 (EST -5 → EDT -4). Domingo, así que se prueba con un horario 00-23.
  const allDay: BusinessHours = { '7': { open: '00:00', close: '23:59' }, '1': { open: '00:00', close: '23:59' } };
  const a = zonedTimeToInstant(2026, 3, 8, 60, NY); // 01:00 EST
  const b = zonedTimeToInstant(2026, 3, 8, 4 * 60, NY); // 04:00 EDT
  assert.equal(a.toISOString(), '2026-03-08T06:00:00.000Z');
  assert.equal(b.toISOString(), '2026-03-08T08:00:00.000Z');
  assert.equal(businessMinutesBetween(allDay, NY, a, b), 120); // solo dos horas reales
  // La hora que no existe (02:30) cae después del salto
  assert.equal(zonedTimeToInstant(2026, 3, 8, 150, NY).toISOString(), '2026-03-08T07:30:00.000Z');
  // Lunes 9 de marzo, 08:00 EDT = 12:00Z (antes del cambio era 13:00Z)
  assert.equal(nextOpening(H, NY, new Date('2026-03-08T20:00:00Z'))?.toISOString(), '2026-03-09T12:00:00.000Z');
  assert.equal(nextOpening(H, NY, new Date('2026-03-01T20:00:00Z'))?.toISOString(), '2026-03-02T13:00:00.000Z');
  // Noviembre: 01:30 existe dos veces; se toma la primera (EDT)
  assert.equal(zonedTimeToInstant(2026, 11, 1, 90, NY).toISOString(), '2026-11-01T05:30:00.000Z');
  // Una jornada completa de lunes en NY siempre son 600 minutos, con o sin cambio
  assert.equal(
    businessMinutesBetween(H, NY, new Date('2026-03-09T00:00:00Z'), new Date('2026-03-10T03:00:00Z')),
    600
  );
});

test('businessHoursError: formato y orden', () => {
  assert.equal(businessHoursError(null), null);
  assert.equal(businessHoursError(H), null);
  assert.equal(businessHoursError({ '1': { open: '8:00', close: '18:00' } }), 'format');
  assert.equal(businessHoursError({ '1': { open: '18:00', close: '08:00' } }), 'order');
  assert.equal(businessHoursError({ '1': { open: '10:00', close: '10:00' } }), 'order');
  assert.equal(businessHoursError({ '1': { open: '24:00', close: '25:00' } }), 'format');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatWaitMinutes, goalBarState, isOverGoal, type GoalConfig } from './inboxGoal';

const always: GoalConfig = { goalMinutes: 15, hours: null, timeZone: 'America/Bogota' };
const weekdays: GoalConfig = {
  goalMinutes: 15,
  timeZone: 'America/Bogota',
  hours: { '1': { open: '08:00', close: '18:00' }, '2': { open: '08:00', close: '18:00' }, '7': null },
};
const mondayNoon = Date.parse('2026-11-23T17:00:00Z'); // lunes 12:00 Bogotá
const ago = (min: number, from = mondayNoon) => new Date(from - min * 60_000).toISOString();

test('barra de la meta: nada, ámbar, roja y el tope de 100', () => {
  assert.deepEqual(goalBarState(null, always, mondayNoon), { kind: 'none' });
  assert.deepEqual(goalBarState(ago(9), always, mondayNoon), { kind: 'ok', waitMinutes: 9, percent: 60 });
  assert.deepEqual(goalBarState(ago(15), always, mondayNoon), { kind: 'ok', waitMinutes: 15, percent: 100 });
  assert.deepEqual(goalBarState(ago(31), always, mondayNoon), { kind: 'over', waitMinutes: 31, percent: 100 });
});

test('fuera de horario: la nota con la próxima apertura y nunca roja', () => {
  const sunday = Date.parse('2026-11-29T17:00:00Z');
  const s = goalBarState(ago(300, sunday), weekdays, sunday);
  assert.equal(s.kind, 'closed');
  assert.equal(s.kind === 'closed' && s.nextOpening?.toISOString(), '2026-11-30T13:00:00.000Z');
  assert.equal(isOverGoal(ago(300, sunday), weekdays, sunday), false);
});

test('la espera cuenta solo minutos de atención', () => {
  // lunes 08:05: el pedido llegó el domingo; solo cuentan 5 min
  const mondayOpen = Date.parse('2026-11-23T13:05:00Z');
  const s = goalBarState(new Date(Date.parse('2026-11-22T20:00:00Z')).toISOString(), weekdays, mondayOpen);
  assert.deepEqual(s, { kind: 'ok', waitMinutes: 5, percent: 33 });
  assert.equal(isOverGoal(ago(16), weekdays, mondayNoon), true);
  assert.equal(isOverGoal(ago(16), null, mondayNoon), false);
});

test('formatWaitMinutes', () => {
  assert.equal(formatWaitMinutes(31), '31 min');
  assert.equal(formatWaitMinutes(60), '1 h');
  assert.equal(formatWaitMinutes(75), '1 h 15 min');
});

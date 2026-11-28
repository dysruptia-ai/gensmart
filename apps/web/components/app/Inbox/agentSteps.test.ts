import { test } from 'node:test';
import assert from 'node:assert/strict';
import es from '../../../i18n/app/es.json';
import en from '../../../i18n/app/en.json';
import { translate } from '../../../lib/translate';
import { agentSteps, parseToolCall } from './agentSteps';
import { handoffIsCurrent, summaryLead, summaryState, variableChips } from './summaryText';

const tEs = (key: string, values?: Record<string, string | number>) =>
  translate({ current: es as Record<string, unknown>, fallback: en as Record<string, unknown> }, 'es', key, values);

test('parseToolCall: nombre y argumentos, [recovered] y JSON roto', () => {
  assert.deepEqual(parseToolCall('capture_variable({"variable_name":"ciudad","variable_value":"Cali"})'), {
    name: 'capture_variable',
    args: { variable_name: 'ciudad', variable_value: 'Cali' },
    recovered: false,
  });
  const rec = parseToolCall('book_appointment({"date":"2026-12-01"})[recovered]');
  assert.equal(rec.name, 'book_appointment');
  assert.equal(rec.recovered, true);
  assert.deepEqual(parseToolCall('check_availability({roto'), { name: 'check_availability', args: null, recovered: false });
  assert.equal(parseToolCall('sin_parentesis').name, 'sin_parentesis');
});

test('agentSteps: capturas juntas sin valores, agenda, desconocidas', () => {
  const steps = agentSteps(
    [
      'capture_variable({"variable_name":"nombre","variable_value":"Luisa Pérez"})',
      'check_availability({"date":"2026-12-02"})',
      'capture_variable({"variable_name":"ciudad","variable_value":"Medellín"})[recovered]',
      'capture_variable({"variable_name":"nombre","variable_value":"Luisa"})',
      'consultar_inventario({"sku":"A-1"})',
      'mcp_find_city({"q":"x"})',
      'request_human_handoff({"team_summary":"secreto"})',
      'dropi_cotizar_envio({})',
    ],
    tEs
  );
  assert.deepEqual(steps, [
    'Guardó: nombre, ciudad',
    'Revisó la agenda del 2026-12-02',
    'Usó consultar inventario',
    'Usó find city',
    'Pidió ayuda a una persona',
    'Cotizó el envío',
  ]);
  const joined = steps.join(' ');
  for (const secret of ['Luisa', 'Medellín', 'A-1', 'secreto']) assert.ok(!joined.includes(secret));
  assert.deepEqual(agentSteps(['check_availability(roto'], tEs), ['Revisó la agenda']);
  assert.deepEqual(agentSteps(['capture_variable(roto)'], tEs), ['Guardó datos del cliente']);
  assert.deepEqual(agentSteps(undefined, tEs), []);
  assert.deepEqual(agentSteps('x', tEs), []);
  assert.deepEqual(agentSteps(['book_appointment({})'], tEs, { formatDate: () => 'x' }), ['Agendó una cita']);
});

const base = {
  status: 'active' as const,
  handoffActive: false,
  takenOverBy: null,
  takeoverUserName: null,
  closedOutcome: null,
  contact: { funnelStage: null },
};

test('summaryLead: primera frase por estado', () => {
  assert.equal(summaryState(base), 'agent');
  assert.equal(summaryLead({ conversation: base, handoffReason: null }, tEs), 'El agente lleva la conversación.');
  assert.equal(
    summaryLead({ conversation: { ...base, handoffActive: true }, handoffReason: 'customer_asked' }, tEs),
    'El agente pidió ayuda porque el cliente quiere hablar con una persona.'
  );
  assert.equal(summaryLead({ conversation: { ...base, handoffActive: true }, handoffReason: 'other' }, tEs), 'El agente pidió ayuda.');
  assert.equal(
    summaryLead({ conversation: { ...base, status: 'human_takeover', takenOverBy: 'u', takeoverUserName: 'Ana' }, handoffReason: null }, tEs),
    'La atiende Ana.'
  );
  assert.equal(
    summaryLead(
      { conversation: { ...base, status: 'human_takeover', takenOverBy: 'u', takeoverUserName: 'Pro User' }, handoffReason: null, userId: 'u' },
      tEs
    ),
    'La tienes tú.'
  );
  assert.equal(
    summaryLead({ conversation: { ...base, status: 'human_takeover', takenOverBy: 'u', takeoverUserName: 'Ana' }, handoffReason: null, userId: 'otro' }, tEs),
    'La atiende Ana.'
  );
  assert.equal(
    summaryLead({ conversation: { ...base, handoffActive: true }, handoffReason: 'agent_paused' }, tEs),
    'El agente está pausado.'
  );
  assert.equal(
    summaryLead({ conversation: { ...base, status: 'closed', closedOutcome: 'sold' }, handoffReason: null }, tEs),
    `Cerrada como ${tEs('inbox.outcomes.sold')}.`
  );
  assert.equal(
    summaryLead({ conversation: { ...base, contact: { funnelStage: 'lead' } }, handoffReason: null }, tEs),
    `El agente lleva la conversación. Etapa: ${tEs('inbox.contact.stages.lead')}.`
  );
});

test('handoffIsCurrent y variableChips', () => {
  const h = { requestedAt: '2026-11-28T10:00:00Z' };
  assert.equal(handoffIsCurrent(h, [{ type: 'taken', createdAt: '2026-11-28T10:05:00Z' }]), true);
  assert.equal(handoffIsCurrent(h, [{ type: 'released', createdAt: '2026-11-28T10:05:00Z' }]), false);
  assert.equal(handoffIsCurrent(null, []), false);
  const long = 'x'.repeat(60);
  assert.deepEqual(variableChips({ nombre: 'Luisa', vacia: '', ciudad: long, edad: 30, extra: 'no' }), [
    'nombre: Luisa',
    `ciudad: ${'x'.repeat(39)}…`,
    'edad: 30',
  ]);
});

/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Seed templates: config placeholders, config schema validity, the "Vendedor Dropi" template and
 * the pure beta-gating rule. No DB (the gating SQL and the seed upsert are covered by
 * services/agent-templates.db.test.ts).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfigVariableSchema } from '@gensmart/shared';
import { getSeedTemplates } from './agent-templates.seed';
import { DROPI_CONFIG_KEYS } from '../../services/dropi-sales/service';
import { DEFAULT_MARGIN_PERCENT, DEFAULT_MAX_DAILY_ORDERS } from '../../services/dropi-sales/core';
import { DROPI_SALES_TOOL_NAMES } from '../../services/dropi-sales/tools';
import { isTemplateVisibleToOrg } from '../../services/agent-template-visibility';

const placeholders = (prompt: string): string[] =>
  [...prompt.matchAll(/\{\{config\.([a-z][a-z0-9_]*)\}\}/g)].map((m) => m[1]!);

const dropi = getSeedTemplates().find((t) => t.name === 'Vendedor Dropi' && t.language === 'es');

describe('seed templates', () => {
  test('every {{config.X}} of every template exists in its configVariablesSchema', () => {
    for (const t of getSeedTemplates()) {
      const keys = new Set((t.configVariablesSchema ?? []).map((s) => s.key));
      for (const key of placeholders(t.system_prompt)) {
        assert.ok(keys.has(key), `${t.name} (${t.language}): {{config.${key}}} missing from configVariablesSchema`);
      }
    }
  });

  test('every config schema entry is valid and keys are unique', () => {
    for (const t of getSeedTemplates()) {
      const schema = t.configVariablesSchema ?? [];
      assert.equal(new Set(schema.map((s) => s.key)).size, schema.length, `${t.name}: duplicated config key`);
      for (const s of schema) assert.equal(validateConfigVariableSchema(s), null, `${t.name}: ${s.key}`);
    }
  });

  test('template names are unique per language (upsert key)', () => {
    const ids = getSeedTemplates().map((t) => `${t.name}|${t.language}`);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('existing templates stay visible to every organization (no allowedOrgIds)', () => {
    for (const t of getSeedTemplates()) {
      if (t.name === 'Vendedor Dropi') continue;
      assert.equal(t.allowedOrgIds ?? null, null, t.name);
    }
  });
});

describe('Vendedor Dropi template', () => {
  test('exists, Spanish, dropshipping, same LLM as Mastershop Dropshipper, hidden beta', () => {
    assert.ok(dropi);
    const mastershop = getSeedTemplates().find((t) => t.name === 'Mastershop Dropshipper')!;
    assert.equal(dropi.category, 'dropshipping');
    assert.equal(dropi.defaultLlmProvider, mastershop.defaultLlmProvider);
    assert.equal(dropi.defaultLlmModel, mastershop.defaultLlmModel);
    assert.deepEqual(dropi.allowedOrgIds, []);
  });

  test('config keys read by the sales tools are in the schema, required, numeric, with the server defaults', () => {
    const schema = dropi!.configVariablesSchema ?? [];
    const margin = schema.find((s) => s.key === DROPI_CONFIG_KEYS.marginPercent);
    const maxOrders = schema.find((s) => s.key === DROPI_CONFIG_KEYS.maxDailyOrders);
    assert.ok(margin && maxOrders);
    assert.deepEqual([margin.type, margin.required, margin.default], ['number', true, DEFAULT_MARGIN_PERCENT]);
    assert.deepEqual([maxOrders.type, maxOrders.required, maxOrders.default], ['number', true, DEFAULT_MAX_DAILY_ORDERS]);
    assert.equal(DEFAULT_MAX_DAILY_ORDERS, 20); // N-01
    assert.deepEqual(schema.map((s) => s.key), [
      'nombre_tienda', 'nombre_asesor', 'porcentaje_margen', 'max_pedidos_diarios', 'tono_de_voz', 'politica_envios', 'politica_garantia',
    ]);
  });

  test('N-07: the prompt never promises a proactive contact and relays ofrecer_asesor', () => {
    const prompt = dropi!.system_prompt;
    assert.ok(!/le contactar[aá]|asesor revisar[aá]/i.test(prompt));
    assert.ok(prompt.includes('Si está vacío, no prometas tiempos de entrega ni contactos; di que puede consultar el estado de su pedido cuando quiera.'));
    assert.ok(prompt.includes('Si la respuesta trae ofrecer_asesor, ofrece conectarlo con una persona del equipo usando request_human_handoff si está disponible.'));
  });

  test('the prompt only names tools that exist', () => {
    const prompt = dropi!.system_prompt;
    const named = [...prompt.matchAll(/\b(dropi_[a-z_]+|send_media|request_human_handoff)\b/g)].map((m) => m[1]!);
    const known = new Set<string>([...DROPI_SALES_TOOL_NAMES, 'send_media', 'request_human_handoff']);
    for (const n of named) assert.ok(known.has(n), `unknown tool ${n}`);
    // Every sales tool except the internal category list is used by the flow.
    for (const n of DROPI_SALES_TOOL_NAMES.filter((x) => x !== 'dropi_listar_categorias')) assert.ok(named.includes(n), n);
  });

  test('variables use the CRM names of the other dropshipping templates', () => {
    assert.deepEqual(dropi!.variables.map((v) => v.name), ['nombre_cliente', 'apellido_cliente', 'telefono_cliente', 'ciudad', 'direccion_envio']);
  });
});

describe('template beta gating (pure rule)', () => {
  test('NULL → every organization; array → only those; [] → nobody; malformed → hidden', () => {
    assert.equal(isTemplateVisibleToOrg(null, 'org-1'), true);
    assert.equal(isTemplateVisibleToOrg(undefined, 'org-1'), true);
    assert.equal(isTemplateVisibleToOrg([], 'org-1'), false);
    assert.equal(isTemplateVisibleToOrg(['org-1'], 'org-1'), true);
    assert.equal(isTemplateVisibleToOrg(['org-2'], 'org-1'), false);
    assert.equal(isTemplateVisibleToOrg('org-1', 'org-1'), false);
    assert.equal(isTemplateVisibleToOrg({ 'org-1': true }, 'org-1'), false);
  });
});

/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const agents = readFileSync(join(__dirname, '../routes/agents.ts'), 'utf8');
const index = readFileSync(join(__dirname, '../index.ts'), 'utf8');

test('preview: preview-session is renewed with the same TTL as history and vars on every turn', () => {
  const hist = agents.indexOf("await redis.set(previewKey, JSON.stringify(updatedHistory), 'EX', TTL);");
  const vars = agents.indexOf("await redis.set(previewVarsKey, JSON.stringify(capturedVars), 'EX', TTL);");
  const sess = agents.lastIndexOf("await redis.set(previewSessionKey, previewSessionId, 'EX', TTL);");
  assert.ok(hist > 0 && vars > hist, 'history and vars are persisted');
  assert.ok(sess > vars, 'session is renewed right after them, in the same turn');
  assert.ok(sess - hist < 900, 'the three writes sit together');
});

test('preview: the session is only created (not renewed) once, at the top of the turn', () => {
  const creates = agents.match(/redis\.set\(previewSessionKey, previewSessionId, 'EX', TTL\)/g) ?? [];
  assert.equal(creates.length, 2, 'one on creation, one renewal per turn');
  assert.equal((agents.match(/const TTL = 30 \* 60;/g) ?? []).length >= 1, true);
});

test('webhook: known MCP sources include mastershop-mcp and venndelo-mcp, behavior otherwise unchanged', () => {
  assert.ok(/KNOWN_MCP_SOURCES = new Set\(\['mastershop-mcp', 'venndelo-mcp'\]\)/.test(index));
  assert.ok(index.includes('if (source && !KNOWN_MCP_SOURCES.has(source)) {'));
  assert.ok(index.includes('console.warn(`[mcp-webhook] Unknown source: ${source}`);'), 'still warns on unknown sources, never rejects');
});

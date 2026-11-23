import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChatMessage, ChatResponse, ToolCall } from './llm.service';
import {
  runToolLoop,
  buildHistory,
  buildCapturedValuesBlock,
  truncateToolResult,
  TOOL_RESULT_TRACE_MAX_CHARS,
  type HistoryRow,
} from './tool-loop.service';

const usage = { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
const res = (content: string, toolCalls?: ToolCall[]): ChatResponse =>
  ({ content, toolCalls, usage }) as ChatResponse;

function scripted(responses: ChatResponse[]) {
  let i = 0;
  const seen: ChatMessage[][] = [];
  return {
    seen,
    callLLM: async (msgs: ChatMessage[]) => {
      seen.push([...msgs]);
      return responses[i++]!;
    },
  };
}

test('intermediate text is delivered BEFORE tools run and not repeated in the final', async () => {
  const events: string[] = [];
  const llm = scripted([
    res('Tenemos el afilador a $20.000.', [
      { id: 'c1', name: 'search_products', arguments: { q: 'afilador' } },
      { id: 'c2', name: 'send_media', arguments: { url: 'http://x/img.jpg' } },
    ]),
    res('¿Te gustaría llevarlo?'),
  ]);
  const out = await runToolLoop({
    messages: [{ role: 'user', content: 'tienes afiladores?' }],
    callLLM: llm.callLLM,
    executeTool: async (tc) => {
      events.push(`tool:${tc.name}`);
      return 'ok';
    },
    onIntermediateText: async (t) => {
      events.push(`text:${t}`);
    },
  });
  assert.deepEqual(events, [
    'text:Tenemos el afilador a $20.000.',
    'tool:search_products',
    'tool:send_media',
  ]);
  assert.equal(out.finalResponse, '¿Te gustaría llevarlo?');
  assert.deepEqual(out.intermediateTexts, ['Tenemos el afilador a $20.000.']);
  assert.equal(out.trace.length, 1);
  assert.equal(out.trace[0]!.text, 'Tenemos el afilador a $20.000.');
  assert.equal(out.exhausted, false);
});

test('empty/whitespace text with tool calls is not delivered; tool errors become results', async () => {
  const delivered: string[] = [];
  const llm = scripted([
    res('   ', [{ id: 'c1', name: 'boom', arguments: {} }]),
    res('listo'),
  ]);
  const out = await runToolLoop({
    messages: [{ role: 'user', content: 'x' }],
    callLLM: llm.callLLM,
    executeTool: async () => {
      throw new Error('fail');
    },
    onIntermediateText: async (t) => {
      delivered.push(t);
    },
  });
  assert.deepEqual(delivered, []);
  assert.match(out.trace[0]!.calls[0]!.result, /Tool execution failed: fail/);
  assert.equal(out.finalResponse, 'listo');
});

test('trace: results truncated to ~3KB, trivial tools summarized, exhausted flag', async () => {
  const big = 'x'.repeat(10_000);
  const call = (id: string, name: string): ChatResponse =>
    res('', [{ id, name, arguments: { variable_name: 'n', variable_value: 'v' } }]);
  const llm = scripted([call('a', 'mcp_find_city'), call('b', 'capture_variable')]);
  const out = await runToolLoop({
    messages: [],
    maxIterations: 2,
    callLLM: llm.callLLM,
    executeTool: async (tc) => (tc.name === 'capture_variable' ? "Variable 'n' captured:\nv" : big),
  });
  assert.equal(out.exhausted, true);
  assert.equal(out.finalResponse, '');
  const [first, second] = out.trace;
  assert.ok(first!.calls[0]!.result.endsWith('…[truncado]'));
  assert.ok(first!.calls[0]!.result.length <= TOOL_RESULT_TRACE_MAX_CHARS + 12);
  assert.equal(second!.calls[0]!.result, "Variable 'n' captured: v"); // one line
  assert.equal(truncateToolResult('abc'), 'abc');
});

const iteration = (id: string) => ({
  calls: [{ id, name: 'mcp_find_city', arguments: { q: id }, result: `res-${id}` }],
});
const turn = (n: number, withTrace: boolean): HistoryRow[] => [
  { role: 'user', content: `u${n}` },
  {
    role: 'assistant',
    content: `a${n}`,
    metadata: withTrace ? { toolTrace: [iteration(`t${n}`)] } : {},
  },
];

test('history: only the last 2 turns with a trace are re-expanded, pairs complete and ordered', () => {
  const rows = [1, 2, 3, 4].flatMap((n) => turn(n, true));
  const h = buildHistory(rows, 50);
  const withCalls = h.filter((m) => m.toolCalls);
  assert.deepEqual(
    withCalls.map((m) => m.toolCalls![0]!.id),
    ['t3', 't4']
  );
  // every toolCalls message is immediately followed by its toolResults with the same ids
  h.forEach((m, i) => {
    if (m.toolCalls) {
      const next = h[i + 1]!;
      assert.deepEqual(
        next.toolResults!.map((r) => r.toolCallId),
        m.toolCalls.map((c) => c.id)
      );
      assert.equal(next.toolResults![0]!.content, `res-${m.toolCalls[0]!.id}`);
      assert.equal(h[i + 2]!.content, `a${m.toolCalls[0]!.id.slice(1)}`);
    }
  });
  // older turns remain plain text
  assert.equal(h[0]!.content, 'u1');
  assert.equal(h[1]!.content, 'a1');
});

test('history: without traces the output equals the legacy text-only mapping', () => {
  const rows = [1, 2, 3].flatMap((n) => turn(n, false));
  const h = buildHistory(rows, 4);
  assert.deepEqual(
    h.map((m) => [m.role, m.content]),
    [
      ['user', 'u2'],
      ['assistant', 'a2'],
      ['user', 'u3'],
      ['assistant', 'a3'],
    ]
  );
});

test('history: intermediate rows are folded into the final answer and do not count for the window', () => {
  const rows: HistoryRow[] = [
    { role: 'user', content: 'u1' },
    { role: 'assistant', content: 'texto previo', metadata: { intermediate: true } },
    { role: 'assistant', content: 'final', metadata: {} },
  ];
  const h = buildHistory(rows, 2);
  assert.equal(h.length, 2);
  assert.equal(h[1]!.content, 'texto previo\n\nfinal');
  // trace turn: the intermediate text lives in the trace, not duplicated
  const rows2: HistoryRow[] = [
    { role: 'user', content: 'u1' },
    { role: 'assistant', content: 'texto previo', metadata: { intermediate: true } },
    {
      role: 'assistant',
      content: 'final',
      metadata: { toolTrace: [{ text: 'texto previo', ...iteration('z') }] },
    },
  ];
  const h2 = buildHistory(rows2, 2);
  assert.equal(h2[1]!.content, 'texto previo');
  assert.equal(h2[1]!.toolCalls![0]!.id, 'z');
  assert.equal(h2[3]!.content, 'final');
  assert.equal(h2.filter((m) => typeof m.content === 'string' && m.content.includes('texto previo')).length, 1);
});

test('history: human / intervention rows keep their legacy prefixes', () => {
  const h = buildHistory(
    [
      { role: 'human', content: 'hola' },
      { role: 'system', content: 'resumen' },
    ],
    10
  );
  assert.equal(h[0]!.content, '[Human agent responded]: hola');
  assert.equal(h[1]!.content, '[Intervention summary]: resumen');
});

test('captured values block: only defined variables, quoted, capped; empty -> no block', () => {
  assert.equal(buildCapturedValuesBlock({}, ['a']), '');
  assert.equal(buildCapturedValuesBlock(null, ['a']), '');
  const b = buildCapturedValuesBlock(
    { nombre: 'Genner', ciudad: 'Medellín', oculto: 'x', largo: 'y'.repeat(500), vacio: '' },
    ['nombre', 'ciudad', 'largo', 'vacio']
  );
  assert.match(b, /- nombre = "Genner"/);
  assert.match(b, /- ciudad = "Medellín"/);
  assert.doesNotMatch(b, /oculto/);
  assert.doesNotMatch(b, /vacio/);
  assert.match(b, /capture_variable/);
  assert.ok(!b.includes('y'.repeat(300)));
});

test('parity: worker and preview both use the shared loop and have no private tool loop', () => {
  const root = join(__dirname, '..');
  const worker = readFileSync(join(root, 'workers/message.worker.ts'), 'utf8');
  const preview = readFileSync(join(root, 'routes/agents.ts'), 'utf8');
  for (const [name, src] of [['worker', worker], ['preview', preview]] as const) {
    assert.match(src, /runToolLoop\(/, `${name} must call runToolLoop`);
    assert.match(src, /buildHistory\(/, `${name} must use buildHistory`);
    assert.match(src, /buildCapturedValuesBlock\(/, `${name} must inject captured values`);
    assert.doesNotMatch(src, /while \(iterationCount/, `${name} has a private loop`);
    assert.doesNotMatch(src, /for \(let i = 0; i < maxIter/, `${name} has a private loop`);
  }
});

/* Standalone validation: tool calling via OpenRouter. Not part of production code.
 * Run: npx dotenv -e ../../.env -- tsx scripts/test-openrouter-tool-calling.ts  (from apps/api)
 */
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';

const MODELS = ['z-ai/glm-4.6', 'deepseek/deepseek-v3.2', 'meta-llama/llama-3.3-70b-instruct'];

// Models that passed rounds 1-2 (meta-llama/llama-3.3-70b-instruct already discarded).
const MODELS_TEST3 = ['z-ai/glm-4.6', 'deepseek/deepseek-v3.2'];

const SYSTEM_PROMPT = `You have access to a function/tool named \`capture_variable\`. When you identify a value, invoke it through the normal tool-use mechanism provided by this API.
If you need to capture multiple variables in the same turn, invoke the tool multiple times.
CRITICAL — DO NOT DO THIS:
- Never write JSON, code fences, or \`\`\`json blocks in your reply to the user.
- Never output anything that looks like { "variable_name": ..., "variable_value": ... } as plain text.
- Never describe the tool call in prose ("I am calling capture_variable with...").
The tool invocation happens silently through the API. The user must only see your natural-language reply, not the mechanics of capture.`;

const USER_MESSAGE = 'Hola, me llamo Carlos Ramírez y mi correo es carlos.ramirez@test.com';

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'capture_variable',
      description: 'Capture a conversation variable value identified from the user message.',
      parameters: {
        type: 'object',
        properties: {
          variable_name: { type: 'string', description: 'Name of the variable to capture' },
          variable_value: { type: 'string', description: 'Value captured from the conversation' },
        },
        required: ['variable_name', 'variable_value'],
      },
    },
  },
];

interface Summary {
  model: string;
  toolCallsOk: boolean;
  jsonValid: boolean;
  contentClean: boolean;
  multiTurnOk: boolean;
  latencyMs: number | null;
}

const T3_SYSTEM_PROMPT =
  'You are a customer service assistant. You have access to a `send_media` tool to send images, videos or documents to the user. Use it whenever the user asks to see a product or receive a file you have a URL for. Always include a short conversational caption. After calling the tool, continue the conversation naturally — do NOT repeat that you sent it.';
const T3_MEDIA_URL = 'https://example.com/producto-123.jpg';
const T3_USER_MESSAGE = `¿Me podés mandar una foto del producto? Es esta imagen: ${T3_MEDIA_URL}`;

const T3_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'send_media',
      description:
        'Send a media file (image, video, or document) to the user during the conversation. The media URL must be publicly accessible HTTPS. Always provide a short, conversational caption describing what the user is about to see.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['image', 'video', 'document'], description: 'Type of media to send' },
          url: { type: 'string', description: 'Public HTTPS URL of the media file' },
          caption: { type: 'string', description: 'Short conversational caption describing the media' },
        },
        required: ['type', 'url', 'caption'],
      },
    },
  },
];

interface Summary3 {
  model: string;
  toolCallCorrect: boolean;
  enumValid: boolean;
  urlCorrect: boolean;
  captionOk: boolean;
  jsonValid: boolean;
  contentClean: boolean;
}

const yn = (b: boolean): string => (b ? 'sí' : 'no');

function looksLikeLeakedMechanics(content: string): boolean {
  return /```|"variable_name"|"variable_value"|capture_variable/i.test(content) || /^\s*[{[]/.test(content);
}

async function runModel(client: OpenAI, model: string): Promise<Summary> {
  const summary: Summary = {
    model,
    toolCallsOk: false,
    jsonValid: false,
    contentClean: false,
    multiTurnOk: false,
    latencyMs: null,
  };

  console.log(`\n${'='.repeat(80)}\nMODEL: ${model}\n${'='.repeat(80)}`);

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: USER_MESSAGE },
  ];

  // ── PRUEBA 1 ──
  console.log('\n--- PRUEBA 1: tool call de un solo turno ---');
  let assistantMsg: OpenAI.Chat.Completions.ChatCompletionMessage | null = null;
  try {
    const t0 = Date.now();
    const res = await client.chat.completions.create({
      model,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
    });
    summary.latencyMs = Date.now() - t0;

    console.log('RAW RESPONSE:', JSON.stringify(res, null, 2));

    const choice = res.choices[0];
    if (!choice) throw new Error('No choices in response');
    assistantMsg = choice.message;

    const toolCalls = (assistantMsg.tool_calls ?? []).filter((tc) => tc.type === 'function');
    console.log(`finish_reason: ${String(choice.finish_reason)}`);
    console.log(`tool_calls estructurados: ${toolCalls.length} (esperado: 2)`);

    let allParse = toolCalls.length > 0;
    for (const tc of toolCalls) {
      try {
        const parsed: unknown = JSON.parse(tc.function.arguments);
        console.log(`  - ${tc.function.name} args OK:`, JSON.stringify(parsed));
      } catch (err) {
        allParse = false;
        console.log(`  - ${tc.function.name} args INVALID JSON: ${tc.function.arguments} (${(err as Error).message})`);
      }
    }

    const content = assistantMsg.content ?? '';
    const leaked = content.trim().length > 0 && looksLikeLeakedMechanics(content);
    console.log(`content: ${JSON.stringify(content)}`);
    console.log(`content filtra mecánica/JSON: ${yn(leaked)}`);

    summary.toolCallsOk = toolCalls.length === 2 && choice.finish_reason === 'tool_calls';
    summary.jsonValid = allParse;
    summary.contentClean = !leaked;
  } catch (err) {
    console.log(`PRUEBA 1 ERROR: ${(err as Error).message}`);
  }

  // ── PRUEBA 2 ──
  console.log('\n--- PRUEBA 2: continuación multi-turno con tool result ---');
  try {
    const toolCalls = (assistantMsg?.tool_calls ?? []).filter((tc) => tc.type === 'function');
    if (!assistantMsg || toolCalls.length === 0) {
      console.log('SKIP: no hubo tool_calls en la prueba 1, no hay con qué continuar.');
    } else {
      const followUp: ChatCompletionMessageParam[] = [
        ...messages,
        { role: 'assistant', content: assistantMsg.content ?? null, tool_calls: toolCalls },
        ...toolCalls.map(
          (tc): ChatCompletionMessageParam => ({
            role: 'tool',
            tool_call_id: tc.id,
            content: '{"success":true,"message":"Variable capturada"}',
          })
        ),
      ];
      const res2 = await client.chat.completions.create({ model, messages: followUp });
      console.log('RAW RESPONSE:', JSON.stringify(res2, null, 2));
      const choice2 = res2.choices[0];
      const content2 = choice2?.message.content ?? '';
      const retried = (choice2?.message.tool_calls?.length ?? 0) > 0;
      const leaked2 = looksLikeLeakedMechanics(content2);
      console.log(`finish_reason: ${String(choice2?.finish_reason)}`);
      console.log(`content: ${JSON.stringify(content2)}`);
      console.log(`reintentó tool_calls: ${yn(retried)} | content vacío: ${yn(content2.trim() === '')} | filtra mecánica: ${yn(leaked2)}`);
      summary.multiTurnOk = !retried && content2.trim().length > 0 && !leaked2;
    }
  } catch (err) {
    console.log(`PRUEBA 2 ERROR: ${(err as Error).message}`);
  }

  return summary;
}

async function runTest3(client: OpenAI, model: string): Promise<Summary3> {
  const summary: Summary3 = {
    model,
    toolCallCorrect: false,
    enumValid: false,
    urlCorrect: false,
    captionOk: false,
    jsonValid: false,
    contentClean: false,
  };

  console.log(`\n${'='.repeat(80)}\nMODEL: ${model}\n${'='.repeat(80)}`);
  console.log('\n--- PRUEBA 3: tool con enum y múltiples parámetros (send_media) ---');
  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: T3_SYSTEM_PROMPT },
        { role: 'user', content: T3_USER_MESSAGE },
      ],
      tools: T3_TOOLS,
      tool_choice: 'auto',
    });
    console.log('RAW RESPONSE:', JSON.stringify(res, null, 2));

    const choice = res.choices[0];
    if (!choice) throw new Error('No choices in response');
    const toolCalls = (choice.message.tool_calls ?? []).filter((tc) => tc.type === 'function');
    console.log(`finish_reason: ${String(choice.finish_reason)}`);
    console.log(`tool_calls estructurados: ${toolCalls.length} (esperado: 1 de send_media)`);

    const first = toolCalls[0];
    summary.toolCallCorrect = toolCalls.length === 1 && first?.function.name === 'send_media';

    if (first) {
      try {
        const args = JSON.parse(first.function.arguments) as Record<string, unknown>;
        summary.jsonValid = true;
        console.log(`  arguments parseados: ${JSON.stringify(args)}`);
        summary.enumValid = typeof args['type'] === 'string' && ['image', 'video', 'document'].includes(args['type']);
        summary.urlCorrect = args['url'] === T3_MEDIA_URL;
        summary.captionOk = typeof args['caption'] === 'string' && args['caption'].trim().length > 0;
        console.log(`  type exacto del enum: ${yn(summary.enumValid)} (valor: ${JSON.stringify(args['type'])})`);
        console.log(`  url idéntica a la del usuario: ${yn(summary.urlCorrect)} (valor: ${JSON.stringify(args['url'])})`);
        console.log(`  caption no vacío: ${yn(summary.captionOk)} (valor: ${JSON.stringify(args['caption'])})`);
      } catch (err) {
        console.log(`  arguments INVALID JSON: ${first.function.arguments} (${(err as Error).message})`);
      }
    }

    const content = choice.message.content ?? '';
    const leaked =
      content.trim().length > 0 &&
      (/```|"caption"|"url"|send_media/i.test(content) || /^\s*[{[]/.test(content));
    summary.contentClean = !leaked;
    console.log(`content: ${JSON.stringify(content)}`);
    console.log(`content filtra mecánica/JSON: ${yn(leaked)}`);
  } catch (err) {
    console.log(`PRUEBA 3 ERROR: ${(err as Error).message}`);
  }
  return summary;
}

async function main(): Promise<void> {
  const apiKey = process.env['OPENROUTER_API_KEY'];
  if (!apiKey) {
    console.error('Falta OPENROUTER_API_KEY en el entorno / .env');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' });

  const summaries: Summary[] = [];
  for (const model of MODELS) {
    summaries.push(await runModel(client, model));
  }

  const summaries3: Summary3[] = [];
  for (const model of MODELS_TEST3) {
    summaries3.push(await runTest3(client, model));
  }

  console.log(`\n${'='.repeat(80)}\nRESUMEN\n${'='.repeat(80)}`);
  console.log('MODELO | tool_calls_ok | json_valido | content_limpio | multiturno_ok | latencia_ms');
  for (const s of summaries) {
    console.log(
      `${s.model} | ${yn(s.toolCallsOk)} | ${yn(s.jsonValid)} | ${yn(s.contentClean)} | ${yn(s.multiTurnOk)} | ${s.latencyMs ?? 'n/a'}`
    );
  }

  console.log('\nPRUEBA 3 (send_media)');
  console.log('MODELO | tool_call_correcto | enum_valido | url_correcta | content_limpio');
  for (const s of summaries3) {
    console.log(
      `${s.model} | ${yn(s.toolCallCorrect)} | ${yn(s.enumValid)} | ${yn(s.urlCorrect)} | ${yn(s.contentClean)}`
    );
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

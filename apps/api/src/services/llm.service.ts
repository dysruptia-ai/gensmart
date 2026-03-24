import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export const LLM_MODELS = {
  openai: {
    'gpt-4o': { name: 'GPT-4o', plans: ['pro', 'enterprise'] },
    'gpt-4o-mini': { name: 'GPT-4o Mini', plans: ['free', 'starter', 'pro', 'enterprise'] },
  },
  anthropic: {
    'claude-sonnet-4-20250514': { name: 'Claude Sonnet', plans: ['pro', 'enterprise'] },
    'claude-haiku-4-5-20251001': { name: 'Claude Haiku', plans: ['starter', 'pro', 'enterprise'] },
  },
} as const;

// ── Vision / Multimodal types ─────────────────────────────────────────────────

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image';
  mimeType: string;  // 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  data: string;       // base64-encoded image data (NO data: URI prefix)
}

export type ContentPart = TextPart | ImagePart;

/** Models that support image/vision input */
const VISION_MODELS = new Set([
  'gpt-4o',
  'claude-sonnet-4-20250514',
]);

export function supportsVision(provider: string, model: string): boolean {
  void provider;
  return VISION_MODELS.has(model);
}

/** Extract plain text from string or ContentPart[] */
export function getTextContent(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
  // For tool call responses (assistant message that invoked tools)
  toolCalls?: ToolCall[];
  // For tool result messages
  toolResults?: Array<{
    toolCallId: string;
    content: string;
  }>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatParams {
  provider: 'openai' | 'anthropic';
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  system?: string;
  byoApiKey?: string; // BYO key overrides system key (Enterprise)
}

export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

function getOpenAIClient(byoKey?: string): OpenAI {
  return new OpenAI({ apiKey: byoKey ?? process.env['OPENAI_API_KEY'] });
}

function getAnthropicClient(byoKey?: string): Anthropic {
  return new Anthropic({ apiKey: byoKey ?? process.env['ANTHROPIC_API_KEY'] });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const statusCode = (err as { status?: number })?.status;
      if (statusCode && [429, 500, 503].includes(statusCode) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function chat(params: ChatParams): Promise<ChatResponse> {
  if (params.provider === 'anthropic') {
    return chatAnthropic(params);
  }
  return chatOpenAI(params);
}

async function chatOpenAI(params: ChatParams): Promise<ChatResponse> {
  const client = getOpenAIClient(params.byoApiKey);

  const messages: OpenAI.ChatCompletionMessageParam[] = [];

  if (params.system) {
    messages.push({ role: 'system', content: params.system });
  }

  for (const m of params.messages) {
    if (m.role === 'system') {
      const sysText = typeof m.content === 'string' ? m.content : getTextContent(m.content);
      messages.push({ role: 'system', content: sysText });
    } else if (m.toolCalls && m.toolCalls.length > 0) {
      // Assistant message with tool calls
      const assistText = typeof m.content === 'string' ? m.content : getTextContent(m.content);
      messages.push({
        role: 'assistant',
        content: assistText || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      });
    } else if (m.toolResults && m.toolResults.length > 0) {
      // Tool result messages — OpenAI expects one message per tool call
      for (const tr of m.toolResults) {
        messages.push({
          role: 'tool',
          tool_call_id: tr.toolCallId,
          content: tr.content,
        } as OpenAI.ChatCompletionToolMessageParam);
      }
    } else if (m.role === 'user' && Array.isArray(m.content)) {
      // Multimodal user message (text + images)
      const parts: OpenAI.ChatCompletionContentPart[] = [];
      for (const part of m.content) {
        if (part.type === 'text') {
          parts.push({ type: 'text', text: part.text });
        } else if (part.type === 'image') {
          parts.push({
            type: 'image_url',
            image_url: {
              url: `data:${part.mimeType};base64,${part.data}`,
              detail: 'auto',
            },
          });
        }
      }
      messages.push({ role: 'user', content: parts });
    } else {
      // Plain text message
      const textContent = typeof m.content === 'string' ? m.content : getTextContent(m.content);
      messages.push({ role: m.role as 'user' | 'assistant', content: textContent });
    }
  }

  const tools: OpenAI.ChatCompletionTool[] | undefined = params.tools?.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  return withRetry(async () => {
    const response = await client.chat.completions.create({
      model: params.model,
      messages,
      tools: tools && tools.length > 0 ? tools : undefined,
      tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 1024,
    });

    const choice = response.choices[0];
    if (!choice) throw new Error('No response from OpenAI');

    type FnToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
    const toolCalls: ToolCall[] | undefined = (choice.message.tool_calls as FnToolCall[] | undefined)
      ?.filter((tc) => tc.type === 'function')
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      }));

    return {
      content: choice.message.content ?? '',
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      finishReason: choice.finish_reason ?? 'stop',
    };
  });
}

async function chatAnthropic(params: ChatParams): Promise<ChatResponse> {
  const client = getAnthropicClient(params.byoApiKey);

  const rawMessages: Anthropic.MessageParam[] = [];

  for (const m of params.messages) {
    if (m.role === 'system') continue; // System is passed separately

    if (m.toolCalls && m.toolCalls.length > 0) {
      // Assistant message with tool calls
      const content: Anthropic.ContentBlockParam[] = [];
      const assistText = typeof m.content === 'string' ? m.content : getTextContent(m.content);
      if (assistText) {
        content.push({ type: 'text', text: assistText });
      }
      for (const tc of m.toolCalls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        });
      }
      rawMessages.push({ role: 'assistant', content });
    } else if (m.toolResults && m.toolResults.length > 0) {
      // Tool results — Anthropic expects role: 'user' with tool_result content blocks
      const content: Anthropic.ToolResultBlockParam[] = m.toolResults.map((tr) => ({
        type: 'tool_result' as const,
        tool_use_id: tr.toolCallId,
        content: tr.content,
      }));
      rawMessages.push({ role: 'user', content });
    } else if (m.role === 'user' && Array.isArray(m.content)) {
      // Multimodal user message (text + images)
      const parts: Anthropic.ContentBlockParam[] = [];
      for (const part of m.content) {
        if (part.type === 'text') {
          parts.push({ type: 'text', text: part.text });
        } else if (part.type === 'image') {
          parts.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: part.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: part.data,
            },
          });
        }
      }
      rawMessages.push({ role: 'user', content: parts });
    } else {
      // Plain text message
      const textContent = typeof m.content === 'string' ? m.content : getTextContent(m.content);
      rawMessages.push({
        role: m.role as 'user' | 'assistant',
        content: textContent,
      });
    }
  }

  // Ensure strict alternation for Anthropic (merge consecutive same-role messages)
  const messages: Anthropic.MessageParam[] = [];
  for (const msg of rawMessages) {
    if (messages.length > 0 && messages[messages.length - 1].role === msg.role) {
      const prev = messages[messages.length - 1];
      const prevContent = Array.isArray(prev.content) ? prev.content : [{ type: 'text' as const, text: prev.content }];
      const newContent = Array.isArray(msg.content) ? msg.content : [{ type: 'text' as const, text: msg.content }];
      prev.content = [...prevContent, ...newContent];
    } else {
      messages.push({ ...msg });
    }
  }

  const tools: Anthropic.Tool[] | undefined = params.tools?.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool['input_schema'],
  }));

  return withRetry(async () => {
    const response = await client.messages.create({
      model: params.model,
      system: params.system,
      messages,
      tools: tools && tools.length > 0 ? tools : undefined,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 1024,
    });

    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason ?? 'end_turn',
    };
  });
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const client = getOpenAIClient();
    const response = await client.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    return response.data[0]?.embedding ?? [];
  } catch (err) {
    console.error('[llm] generateEmbedding failed:', err);
    return [];
  }
}

export async function generatePrompt(
  description: string,
  language = 'en'
): Promise<{
  systemPrompt: string;
  suggestedVariables: unknown[];
  suggestedTools: string[];
}> {
  const targetLanguage = language === 'es' ? 'Spanish' : 'English';
  const metaPrompt = `You are an expert AI agent designer. Based on the user's description, generate a professional system prompt and metadata for a conversational AI agent.

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "system_prompt": "The complete system prompt for the agent",
  "suggested_variables": [
    {"name": "variable_name", "type": "string", "required": true, "description": "What this captures"},
    {"name": "choice_field", "type": "enum", "required": false, "description": "Choice", "options": ["opt1", "opt2"]}
  ],
  "suggested_tools": ["capture_variable"]
}

Rules:
- system_prompt must be professional, detailed, and written in ${targetLanguage}
- Variable names must use snake_case
- Tool types allowed: capture_variable, scheduling, rag, custom_function
- Only include tools that genuinely suit this agent's use case`;

  const response = await chat({
    provider: 'openai',
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: `Create an AI agent for: ${description}` }],
    system: metaPrompt,
    temperature: 0.7,
    maxTokens: 2000,
  });

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]) as {
      system_prompt: string;
      suggested_variables: unknown[];
      suggested_tools: string[];
    };

    return {
      systemPrompt: parsed.system_prompt ?? response.content,
      suggestedVariables: Array.isArray(parsed.suggested_variables) ? parsed.suggested_variables : [],
      suggestedTools: Array.isArray(parsed.suggested_tools) ? parsed.suggested_tools : [],
    };
  } catch {
    return { systemPrompt: response.content, suggestedVariables: [], suggestedTools: [] };
  }
}

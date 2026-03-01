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

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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

  const messages: OpenAI.ChatCompletionMessageParam[] = params.system
    ? [{ role: 'system', content: params.system }, ...params.messages]
    : [...params.messages];

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

  // Anthropic requires messages to alternate user/assistant
  const messages: Anthropic.MessageParam[] = params.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

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

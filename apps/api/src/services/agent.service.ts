import { query, getClient } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { PLAN_LIMITS } from '@gensmart/shared';

type PlanKey = keyof typeof PLAN_LIMITS;

interface AgentRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  avatar_initials: string | null;
  system_prompt: string;
  llm_provider: string;
  llm_model: string;
  temperature: string;
  max_tokens: number;
  context_window_messages: number;
  status: string;
  channels: string[];
  message_buffer_seconds: number;
  variables: unknown[];
  web_config: Record<string, unknown>;
  whatsapp_config: Record<string, unknown>;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface VersionRow {
  id: string;
  agent_id: string;
  version: number;
  system_prompt: string;
  llm_provider: string;
  llm_model: string;
  temperature: string;
  max_tokens: number;
  context_window_messages: number;
  variables: unknown[];
  tools: unknown[];
  published_by: string | null;
  published_at: string;
  publisher_name: string | null;
}

interface ToolRow {
  id: string;
  agent_id: string;
  type: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  system_prompt: string;
  variables: unknown[];
  tools: unknown[];
  language: string;
}

function makeInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatAgent(row: AgentRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    avatarUrl: row.avatar_url,
    avatarInitials: row.avatar_initials ?? makeInitials(row.name),
    systemPrompt: row.system_prompt,
    llmProvider: row.llm_provider,
    llmModel: row.llm_model,
    temperature: parseFloat(row.temperature),
    maxTokens: row.max_tokens,
    contextWindowMessages: row.context_window_messages,
    status: row.status,
    channels: row.channels ?? [],
    messageBufferSeconds: row.message_buffer_seconds,
    variables: row.variables ?? [],
    webConfig: row.web_config,
    whatsappConfig: row.whatsapp_config,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAgents(
  orgId: string,
  filters?: {
    search?: string;
    status?: string;
    channel?: string;
    page?: number;
    limit?: number;
  }
) {
  const page = filters?.page ?? 1;
  const limit = Math.min(filters?.limit ?? 20, 100);
  const offset = (page - 1) * limit;
  const params: unknown[] = [orgId];
  const conditions: string[] = ['a.organization_id = $1'];

  if (filters?.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`(a.name ILIKE $${params.length} OR a.description ILIKE $${params.length})`);
  }
  if (filters?.status) {
    params.push(filters.status);
    conditions.push(`a.status = $${params.length}`);
  }
  if (filters?.channel) {
    params.push(JSON.stringify([filters.channel]));
    conditions.push(`a.channels @> $${params.length}::jsonb`);
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM agents a WHERE ${whereClause}`,
    params
  );

  params.push(limit, offset);
  const result = await query<AgentRow>(
    `SELECT * FROM agents a WHERE ${whereClause}
     ORDER BY a.updated_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    agents: result.rows.map(formatAgent),
    total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    page,
    limit,
  };
}

export async function getAgentById(orgId: string, agentId: string) {
  const result = await query<AgentRow>(
    'SELECT * FROM agents WHERE id = $1 AND organization_id = $2',
    [agentId, orgId]
  );
  const agent = result.rows[0];
  if (!agent) throw new AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');

  const toolsResult = await query<ToolRow>(
    'SELECT * FROM agent_tools WHERE agent_id = $1 ORDER BY created_at ASC',
    [agentId]
  );

  return { ...formatAgent(agent), tools: toolsResult.rows };
}

export async function createAgent(
  orgId: string,
  plan: string,
  data: {
    name: string;
    description?: string;
    systemPrompt: string;
    llmProvider: string;
    llmModel: string;
    temperature?: number;
    maxTokens?: number;
    contextWindowMessages?: number;
    channels?: string[];
    messageBufferSeconds?: number;
    variables?: unknown[];
  }
) {
  const planLimits = PLAN_LIMITS[plan as PlanKey];
  if (planLimits) {
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM agents WHERE organization_id = $1',
      [orgId]
    );
    const currentCount = parseInt(countResult.rows[0]?.count ?? '0', 10);
    const agentLimit = planLimits.agents;
    if (agentLimit !== Infinity && currentCount >= agentLimit) {
      throw new AppError(
        403,
        `Your plan allows a maximum of ${agentLimit} agent(s). Upgrade to create more.`,
        'PLAN_LIMIT_REACHED'
      );
    }
  }

  const initials = makeInitials(data.name);
  const result = await query<AgentRow>(
    `INSERT INTO agents (
      organization_id, name, description, avatar_initials, system_prompt,
      llm_provider, llm_model, temperature, max_tokens, context_window_messages,
      status, channels, message_buffer_seconds, variables, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,$12,$13,NOW(),NOW())
    RETURNING *`,
    [
      orgId,
      data.name,
      data.description ?? null,
      initials,
      data.systemPrompt,
      data.llmProvider,
      data.llmModel,
      data.temperature ?? 0.7,
      data.maxTokens ?? 1024,
      data.contextWindowMessages ?? 15,
      JSON.stringify(data.channels ?? []),
      data.messageBufferSeconds ?? 5,
      JSON.stringify(data.variables ?? []),
    ]
  );
  return formatAgent(result.rows[0]!);
}

export async function updateAgent(
  orgId: string,
  agentId: string,
  data: Record<string, unknown>
) {
  const existing = await query<AgentRow>(
    'SELECT * FROM agents WHERE id = $1 AND organization_id = $2',
    [agentId, orgId]
  );
  if (!existing.rows[0]) throw new AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');

  const fieldMap: Record<string, string> = {
    name: 'name',
    description: 'description',
    avatarUrl: 'avatar_url',
    systemPrompt: 'system_prompt',
    llmProvider: 'llm_provider',
    llmModel: 'llm_model',
    temperature: 'temperature',
    maxTokens: 'max_tokens',
    contextWindowMessages: 'context_window_messages',
    channels: 'channels',
    messageBufferSeconds: 'message_buffer_seconds',
    variables: 'variables',
    webConfig: 'web_config',
    whatsappConfig: 'whatsapp_config',
    status: 'status',
  };

  const jsonFields = new Set(['channels', 'variables', 'webConfig', 'whatsappConfig']);
  const setClauses: string[] = [];
  const params: unknown[] = [];

  for (const [jsKey, sqlCol] of Object.entries(fieldMap)) {
    if (jsKey in data) {
      params.push(jsonFields.has(jsKey) ? JSON.stringify(data[jsKey]) : data[jsKey]);
      setClauses.push(`${sqlCol} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) return formatAgent(existing.rows[0]!);

  params.push(agentId, orgId);
  const result = await query<AgentRow>(
    `UPDATE agents SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length - 1} AND organization_id = $${params.length}
     RETURNING *`,
    params
  );
  return formatAgent(result.rows[0]!);
}

export async function deleteAgent(orgId: string, agentId: string) {
  const existing = await query<{ id: string }>(
    'SELECT id FROM agents WHERE id = $1 AND organization_id = $2',
    [agentId, orgId]
  );
  if (!existing.rows[0]) throw new AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');

  const activeConvs = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM conversations
     WHERE agent_id = $1 AND status IN ('active', 'human_takeover')`,
    [agentId]
  );
  if (parseInt(activeConvs.rows[0]?.count ?? '0', 10) > 0) {
    throw new AppError(
      409,
      'Cannot delete agent with active conversations',
      'AGENT_HAS_ACTIVE_CONVERSATIONS'
    );
  }

  await query('DELETE FROM agents WHERE id = $1 AND organization_id = $2', [agentId, orgId]);
}

export async function publishAgent(orgId: string, agentId: string, userId: string) {
  const agentResult = await query<AgentRow>(
    'SELECT * FROM agents WHERE id = $1 AND organization_id = $2',
    [agentId, orgId]
  );
  const agent = agentResult.rows[0];
  if (!agent) throw new AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');

  const versionResult = await query<{ max_version: number | null }>(
    'SELECT MAX(version) as max_version FROM agent_versions WHERE agent_id = $1',
    [agentId]
  );
  const nextVersion = (versionResult.rows[0]?.max_version ?? 0) + 1;

  const toolsResult = await query<ToolRow>(
    'SELECT * FROM agent_tools WHERE agent_id = $1',
    [agentId]
  );

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO agent_versions (
        agent_id, version, system_prompt, llm_provider, llm_model,
        temperature, max_tokens, context_window_messages, variables, tools,
        published_by, published_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
      [
        agentId,
        nextVersion,
        agent.system_prompt,
        agent.llm_provider,
        agent.llm_model,
        agent.temperature,
        agent.max_tokens,
        agent.context_window_messages,
        JSON.stringify(agent.variables ?? []),
        JSON.stringify(toolsResult.rows),
        userId,
      ]
    );

    const updated = await client.query<AgentRow>(
      `UPDATE agents SET status = 'active', published_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [agentId]
    );

    await client.query('COMMIT');
    return { agent: formatAgent(updated.rows[0]!), version: nextVersion };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getVersions(orgId: string, agentId: string) {
  await verifyAgentOwnership(orgId, agentId);

  const result = await query<VersionRow>(
    `SELECT av.*, u.name as publisher_name
     FROM agent_versions av
     LEFT JOIN users u ON av.published_by = u.id
     WHERE av.agent_id = $1
     ORDER BY av.version DESC`,
    [agentId]
  );
  return result.rows;
}

export async function rollbackAgent(orgId: string, agentId: string, versionId: string) {
  await verifyAgentOwnership(orgId, agentId);

  const versionResult = await query<VersionRow>(
    'SELECT * FROM agent_versions WHERE id = $1 AND agent_id = $2',
    [versionId, agentId]
  );
  const version = versionResult.rows[0];
  if (!version) throw new AppError(404, 'Version not found', 'VERSION_NOT_FOUND');

  const result = await query<AgentRow>(
    `UPDATE agents SET
      system_prompt = $1, llm_provider = $2, llm_model = $3,
      temperature = $4, max_tokens = $5, context_window_messages = $6,
      variables = $7, updated_at = NOW()
     WHERE id = $8 AND organization_id = $9
     RETURNING *`,
    [
      version.system_prompt,
      version.llm_provider,
      version.llm_model,
      version.temperature,
      version.max_tokens,
      version.context_window_messages,
      JSON.stringify(version.variables ?? []),
      agentId,
      orgId,
    ]
  );
  return formatAgent(result.rows[0]!);
}

export async function getTemplates() {
  const result = await query<TemplateRow>(
    'SELECT * FROM agent_templates WHERE is_active = true ORDER BY category, name',
    []
  );
  return result.rows;
}

export async function createFromTemplate(orgId: string, plan: string, templateId: string) {
  const templateResult = await query<TemplateRow>(
    'SELECT * FROM agent_templates WHERE id = $1 AND is_active = true',
    [templateId]
  );
  const template = templateResult.rows[0];
  if (!template) throw new AppError(404, 'Template not found', 'TEMPLATE_NOT_FOUND');

  return createAgent(orgId, plan, {
    name: template.name,
    description: template.description ?? undefined,
    systemPrompt: template.system_prompt,
    llmProvider: 'openai',
    llmModel: 'gpt-4o-mini',
    variables: template.variables as unknown[],
  });
}

// ── Agent Tools ──────────────────────────────────────────────────────────────

export async function getTools(orgId: string, agentId: string) {
  await verifyAgentOwnership(orgId, agentId);
  const result = await query<ToolRow>(
    'SELECT * FROM agent_tools WHERE agent_id = $1 ORDER BY created_at ASC',
    [agentId]
  );
  return result.rows;
}

export async function createTool(
  orgId: string,
  agentId: string,
  data: { type: string; name: string; description?: string; config: Record<string, unknown> }
) {
  await verifyAgentOwnership(orgId, agentId);
  const result = await query<ToolRow>(
    `INSERT INTO agent_tools (agent_id, type, name, description, config, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING *`,
    [agentId, data.type, data.name, data.description ?? null, JSON.stringify(data.config)]
  );
  return result.rows[0]!;
}

export async function updateTool(
  orgId: string,
  agentId: string,
  toolId: string,
  data: {
    name?: string;
    description?: string;
    config?: Record<string, unknown>;
    isEnabled?: boolean;
  }
) {
  await verifyAgentOwnership(orgId, agentId);

  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) {
    params.push(data.name);
    setClauses.push(`name = $${params.length}`);
  }
  if (data.description !== undefined) {
    params.push(data.description);
    setClauses.push(`description = $${params.length}`);
  }
  if (data.config !== undefined) {
    params.push(JSON.stringify(data.config));
    setClauses.push(`config = $${params.length}`);
  }
  if (data.isEnabled !== undefined) {
    params.push(data.isEnabled);
    setClauses.push(`is_enabled = $${params.length}`);
  }

  if (setClauses.length === 0) {
    const existing = await query<ToolRow>('SELECT * FROM agent_tools WHERE id = $1', [toolId]);
    return existing.rows[0];
  }

  params.push(toolId, agentId);
  const result = await query<ToolRow>(
    `UPDATE agent_tools SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length - 1} AND agent_id = $${params.length}
     RETURNING *`,
    params
  );
  return result.rows[0]!;
}

export async function deleteTool(orgId: string, agentId: string, toolId: string) {
  await verifyAgentOwnership(orgId, agentId);
  await query('DELETE FROM agent_tools WHERE id = $1 AND agent_id = $2', [toolId, agentId]);
}

export async function duplicateAgent(orgId: string, agentId: string, plan: string) {
  const source = await getAgentById(orgId, agentId);

  const newAgent = await createAgent(orgId, plan, {
    name: `Copy of ${source.name}`,
    description: source.description ?? undefined,
    systemPrompt: source.systemPrompt,
    llmProvider: source.llmProvider,
    llmModel: source.llmModel,
    temperature: source.temperature,
    maxTokens: source.maxTokens,
    contextWindowMessages: source.contextWindowMessages,
    channels: source.channels as string[],
    messageBufferSeconds: source.messageBufferSeconds,
    variables: source.variables as unknown[],
  });

  // Copy tools from source agent
  const toolsSource = source.tools as ToolRow[];
  for (const tool of toolsSource) {
    await query(
      `INSERT INTO agent_tools (agent_id, type, name, description, config, is_enabled, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
      [newAgent.id, tool.type, tool.name, tool.description, JSON.stringify(tool.config), tool.is_enabled]
    );
  }

  return newAgent;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function verifyAgentOwnership(orgId: string, agentId: string) {
  const result = await query<{ id: string }>(
    'SELECT id FROM agents WHERE id = $1 AND organization_id = $2',
    [agentId, orgId]
  );
  if (!result.rows[0]) throw new AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');
}

// ── Plan enforcement for tools ────────────────────────────────────────────────

export async function countToolsByType(agentId: string, type: string): Promise<number> {
  const result = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM agent_tools WHERE agent_id = $1 AND type = $2',
    [agentId, type]
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

// ── Knowledge Files ───────────────────────────────────────────────────────────

interface KnowledgeFileRow {
  id: string;
  agent_id: string;
  filename: string;
  file_type: string;
  source_url: string | null;
  file_path: string | null;
  file_size: number | null;
  status: string;
  error_message: string | null;
  chunk_count: number;
  last_processed_at: string | null;
  created_at: string;
  updated_at: string;
}

function formatKnowledgeFile(row: KnowledgeFileRow) {
  return {
    id: row.id,
    agentId: row.agent_id,
    filename: row.filename,
    fileType: row.file_type,
    sourceUrl: row.source_url,
    fileSize: row.file_size,
    status: row.status,
    errorMessage: row.error_message,
    chunkCount: row.chunk_count,
    lastProcessedAt: row.last_processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getKnowledgeFiles(orgId: string, agentId: string) {
  await verifyAgentOwnership(orgId, agentId);
  const result = await query<KnowledgeFileRow>(
    'SELECT * FROM knowledge_files WHERE agent_id = $1 ORDER BY created_at DESC',
    [agentId]
  );
  return result.rows.map(formatKnowledgeFile);
}

export async function createKnowledgeFile(
  orgId: string,
  agentId: string,
  data: { filename: string; fileType: string; filePath?: string; fileSize?: number }
) {
  await verifyAgentOwnership(orgId, agentId);
  const result = await query<KnowledgeFileRow>(
    `INSERT INTO knowledge_files (agent_id, filename, file_type, file_path, file_size, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'processing',NOW(),NOW()) RETURNING *`,
    [agentId, data.filename, data.fileType, data.filePath ?? null, data.fileSize ?? null]
  );
  return formatKnowledgeFile(result.rows[0]!);
}

export async function createKnowledgeFileFromUrl(orgId: string, agentId: string, url: string) {
  await verifyAgentOwnership(orgId, agentId);
  // Extract filename from URL
  const urlObj = new URL(url);
  const filename = urlObj.pathname.split('/').pop() ?? 'web-page';
  const result = await query<KnowledgeFileRow>(
    `INSERT INTO knowledge_files (agent_id, filename, file_type, source_url, status, created_at, updated_at)
     VALUES ($1,$2,'web',$3,'processing',NOW(),NOW()) RETURNING *`,
    [agentId, filename || url, url]
  );
  return formatKnowledgeFile(result.rows[0]!);
}

export async function reprocessKnowledgeFile(orgId: string, agentId: string, fileId: string) {
  await verifyAgentOwnership(orgId, agentId);
  const result = await query<KnowledgeFileRow>(
    `UPDATE knowledge_files SET status = 'processing', error_message = NULL, updated_at = NOW()
     WHERE id = $1 AND agent_id = $2 RETURNING *`,
    [fileId, agentId]
  );
  if (!result.rows[0]) throw new AppError(404, 'Knowledge file not found', 'FILE_NOT_FOUND');
  return formatKnowledgeFile(result.rows[0]);
}

export async function deleteKnowledgeFile(orgId: string, agentId: string, fileId: string) {
  await verifyAgentOwnership(orgId, agentId);
  await query('DELETE FROM knowledge_files WHERE id = $1 AND agent_id = $2', [fileId, agentId]);
}

// ── Preview agent ─────────────────────────────────────────────────────────────

export async function previewAgent(
  orgId: string,
  agentId: string,
  message: string,
  history: { role: string; content: string }[],
  draftSystemPrompt?: string
) {
  const agentResult = await query<AgentRow>(
    'SELECT * FROM agents WHERE id = $1 AND organization_id = $2',
    [agentId, orgId]
  );
  const agent = agentResult.rows[0];
  if (!agent) throw new AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');

  const { chat } = await import('./llm.service');

  const systemPrompt = draftSystemPrompt ?? agent.system_prompt;
  const messages = [
    ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user' as const, content: message },
  ];

  const response = await chat({
    provider: agent.llm_provider as 'openai' | 'anthropic',
    model: agent.llm_model,
    system: systemPrompt,
    messages,
    temperature: parseFloat(agent.temperature),
    maxTokens: Math.min(agent.max_tokens, 512), // limit preview to 512 tokens
  });

  return { message: response.content };
}

// ── Test tool ─────────────────────────────────────────────────────────────────

export async function testTool(
  orgId: string,
  agentId: string,
  toolId: string,
  params: Record<string, unknown>
) {
  await verifyAgentOwnership(orgId, agentId);
  const toolResult = await query<ToolRow>(
    'SELECT * FROM agent_tools WHERE id = $1 AND agent_id = $2',
    [toolId, agentId]
  );
  const tool = toolResult.rows[0];
  if (!tool) throw new AppError(404, 'Tool not found', 'TOOL_NOT_FOUND');
  if (tool.type !== 'custom_function') {
    throw new AppError(400, 'Only custom functions can be tested', 'INVALID_TOOL_TYPE');
  }

  const cfg = tool.config as Record<string, unknown>;
  const endpointUrl = cfg['endpointUrl'] as string;
  const httpMethod = (cfg['httpMethod'] as string) ?? 'POST';
  const headers = (cfg['headers'] as Record<string, string>) ?? {};
  const auth = cfg['auth'] as { type?: string; token?: string; headerName?: string; apiKey?: string; queryParam?: string } | undefined;
  const bodyTemplate = cfg['bodyTemplate'] as Record<string, unknown> | undefined;
  const timeoutMs = (cfg['timeoutMs'] as number) ?? 10000;

  if (!endpointUrl) throw new AppError(400, 'Tool has no endpoint URL configured', 'MISSING_CONFIG');

  // Build headers
  const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...headers };
  if (auth?.type === 'bearer' && auth.token) {
    requestHeaders['Authorization'] = `Bearer ${auth.token}`;
  } else if (auth?.type === 'api_key_header' && auth.headerName && auth.apiKey) {
    requestHeaders[auth.headerName] = auth.apiKey;
  }

  // Build URL (add query params for API key query type)
  let url = endpointUrl;
  if (auth?.type === 'api_key_query' && auth.queryParam && auth.apiKey) {
    const u = new URL(url);
    u.searchParams.set(auth.queryParam, auth.apiKey);
    url = u.toString();
  }

  // Build body: substitute params into body template or use params directly
  let body: unknown = params;
  if (bodyTemplate) {
    const bodyStr = JSON.stringify(bodyTemplate).replace(
      /\{\{(\w+)\}\}/g,
      (_: string, key: string) => String(params[key] ?? '')
    );
    try {
      body = JSON.parse(bodyStr);
    } catch {
      body = params;
    }
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: httpMethod,
      headers: requestHeaders,
      body: httpMethod !== 'GET' ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - startTime;
    let responseData: unknown;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      responseData = await res.json();
    } else {
      responseData = await res.text();
    }

    return { status: res.status, latencyMs, data: responseData };
  } catch (err: unknown) {
    clearTimeout(timeout);
    const e = err as { name?: string; message?: string };
    if (e.name === 'AbortError') {
      throw new AppError(408, `Request timed out after ${timeoutMs}ms`, 'TIMEOUT');
    }
    throw new AppError(502, e.message ?? 'Request failed', 'REQUEST_FAILED');
  }
}

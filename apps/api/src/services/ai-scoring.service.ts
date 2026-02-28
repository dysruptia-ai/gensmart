import { query } from '../config/database';
import { chat } from './llm.service';

export interface ScoringResult {
  summary: string;
  score: number;
  service: string;
  variables: Record<string, string>;
}

export async function scoreConversation(
  conversationId: string,
  orgId: string
): Promise<ScoringResult> {
  // Fetch conversation
  const convResult = await query<{
    id: string;
    agent_id: string;
    contact_id: string | null;
  }>(
    'SELECT id, agent_id, contact_id FROM conversations WHERE id = $1 AND organization_id = $2',
    [conversationId, orgId]
  );
  const conv = convResult.rows[0];
  if (!conv) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  // Fetch messages
  const messagesResult = await query<{ role: string; content: string }>(
    `SELECT role, content FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC
     LIMIT 50`,
    [conversationId]
  );
  const messages = messagesResult.rows;

  if (messages.length < 2) {
    throw new Error('Not enough messages to score');
  }

  // Fetch agent info
  const agentResult = await query<{ name: string; variables: unknown }>(
    'SELECT name, variables FROM agents WHERE id = $1',
    [conv.agent_id]
  );
  const agent = agentResult.rows[0];

  // Fetch existing contact
  let existingContact: Record<string, unknown> = {};
  if (conv.contact_id) {
    const contactResult = await query<Record<string, unknown>>(
      'SELECT name, phone, email, funnel_stage, ai_score, ai_service, custom_variables FROM contacts WHERE id = $1',
      [conv.contact_id]
    );
    existingContact = contactResult.rows[0] ?? {};
  }

  const agentName = agent?.name ?? 'Unknown Agent';
  const agentVariables = Array.isArray(agent?.variables) ? agent.variables : [];

  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const scoringPrompt = `You are an AI lead scoring analyst. Analyze the following conversation and extract structured data.

AGENT: ${agentName}
AGENT VARIABLES: ${JSON.stringify(agentVariables)}

CONVERSATION:
${conversationText}

EXISTING CONTACT DATA:
${JSON.stringify(existingContact)}

Analyze the conversation and respond ONLY with valid JSON (no markdown, no extra text):
{
  "summary": "Brief 2-3 sentence summary of the conversation and lead quality",
  "score": <number 0-10, where 0=spam/irrelevant, 5=interested, 10=ready to buy>,
  "service": "The main service or product the lead is interested in, or 'unknown'",
  "variables": { "variable_name": "extracted_value" }
}

Scoring criteria:
- 0-2: Spam, irrelevant, or just testing
- 3-4: Minimal interest, asked basic questions
- 5-6: Genuine interest, provided some contact info
- 7-8: Strong interest, asked about pricing/availability, provided full contact info
- 9-10: Ready to purchase/commit, requested appointment or next steps`;

  const response = await chat({
    provider: 'openai',
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: scoringPrompt }],
    temperature: 0.3,
    maxTokens: 500,
  });

  let parsed: ScoringResult;
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const raw = JSON.parse(jsonMatch[0]) as {
      summary?: string;
      score?: number;
      service?: string;
      variables?: Record<string, string>;
    };
    parsed = {
      summary: raw.summary ?? '',
      score: typeof raw.score === 'number'
        ? Math.min(10, Math.max(0, Math.round(raw.score)))
        : 5,
      service: raw.service ?? 'unknown',
      variables: raw.variables ?? {},
    };
  } catch {
    parsed = { summary: 'Analysis failed', score: 5, service: 'unknown', variables: {} };
  }

  // Update contact with scoring results
  if (conv.contact_id) {
    const contactFunnelStage = (existingContact['funnel_stage'] as string) ?? 'lead';

    let newStage: string | null = null;
    if (parsed.score >= 4 && parsed.score <= 6 && contactFunnelStage === 'lead') {
      newStage = 'opportunity';
    } else if (parsed.score >= 7 && ['lead', 'opportunity'].includes(contactFunnelStage)) {
      newStage = 'customer';
    }

    const setClauses: string[] = [
      'ai_summary = $1',
      'ai_score = $2',
      'ai_service = $3',
      'updated_at = NOW()',
    ];
    const updateParams: unknown[] = [parsed.summary, parsed.score, parsed.service];
    let paramIdx = 4;

    if (newStage) {
      setClauses.push(`funnel_stage = $${paramIdx++}`, 'funnel_updated_at = NOW()');
      updateParams.push(newStage);
    }

    updateParams.push(conv.contact_id, orgId);

    await query(
      `UPDATE contacts SET ${setClauses.join(', ')}
       WHERE id = $${paramIdx++} AND organization_id = $${paramIdx}`,
      updateParams
    );

    // Sync additional extracted variables into custom_variables
    if (Object.keys(parsed.variables).length > 0) {
      await query(
        `UPDATE contacts
         SET custom_variables = custom_variables || $1::jsonb, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(parsed.variables), conv.contact_id]
      );
    }
  }

  // Update conversation with ai_score and ai_summary
  await query(
    'UPDATE conversations SET ai_score = $1, ai_summary = $2, updated_at = NOW() WHERE id = $3',
    [parsed.score, parsed.summary, conversationId]
  );

  return parsed;
}

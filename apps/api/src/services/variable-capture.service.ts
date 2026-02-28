import { query } from '../config/database';
import { ToolDefinition } from './llm.service';

export interface AgentVariable {
  name: string;
  type: 'string' | 'number' | 'email' | 'phone' | 'enum';
  required?: boolean;
  description?: string;
  options?: string[];
}

/** Build variable capture instructions to append to the system prompt */
export function buildVariableCaptureInstructions(variables: AgentVariable[]): string {
  if (!variables.length) return '';

  const variableLines = variables.map((v) => {
    let line = `- ${v.name} (${v.type}${v.required ? ', REQUIRED' : ', OPTIONAL'})`;
    if (v.description) line += `: ${v.description}`;
    if (v.type === 'enum' && v.options?.length) {
      line += ` — options: ${v.options.join(' | ')}`;
    }
    return line;
  });

  return [
    '---',
    'VARIABLE CAPTURE INSTRUCTIONS:',
    'During the conversation, naturally capture the following variables from the user.',
    'Do not ask for all variables at once — extract them organically as the conversation flows.',
    'When you identify a variable value, call the capture_variable tool.',
    '',
    'Variables to capture:',
    ...variableLines,
    '',
    'Tool: capture_variable',
    'Parameters: { "variable_name": "string", "variable_value": "string" }',
    'Call this tool each time you identify a variable value. You can capture multiple variables across different messages.',
  ].join('\n');
}

/** Tool definition to register with the LLM */
export const captureVariableToolDef: ToolDefinition = {
  name: 'capture_variable',
  description:
    'Capture a conversation variable value identified from the user message. Call this whenever you detect a value for a variable to capture.',
  parameters: {
    type: 'object',
    properties: {
      variable_name: {
        type: 'string',
        description: 'Name of the variable to capture',
      },
      variable_value: {
        type: 'string',
        description: 'Value captured from the conversation',
      },
    },
    required: ['variable_name', 'variable_value'],
  },
};

interface CaptureResult {
  success: boolean;
  message: string;
}

/** Handle a capture_variable tool call from the LLM */
export async function handleCaptureVariable(
  conversationId: string,
  variableName: string,
  variableValue: string,
  agentVariables: AgentVariable[],
  io?: import('socket.io').Server
): Promise<CaptureResult> {
  // Validate variable name exists in agent config
  const varDef = agentVariables.find(
    (v) => v.name.toLowerCase() === variableName.toLowerCase()
  );
  if (!varDef) {
    return {
      success: false,
      message: `Variable '${variableName}' is not defined for this agent.`,
    };
  }

  // Validate enum values
  if (
    varDef.type === 'enum' &&
    varDef.options?.length &&
    !varDef.options.some((o) => o.toLowerCase() === variableValue.toLowerCase())
  ) {
    return {
      success: false,
      message: `Invalid value '${variableValue}' for enum variable '${variableName}'. Allowed: ${varDef.options.join(', ')}`,
    };
  }

  // Fetch conversation to get captured_variables and contact_id
  const convResult = await query<{
    id: string;
    agent_id: string;
    organization_id: string;
    contact_id: string | null;
    channel: string;
    channel_metadata: Record<string, unknown>;
    captured_variables: Record<string, unknown>;
  }>(
    'SELECT id, agent_id, organization_id, contact_id, channel, channel_metadata, captured_variables FROM conversations WHERE id = $1',
    [conversationId]
  );

  const conv = convResult.rows[0];
  if (!conv) {
    return { success: false, message: 'Conversation not found.' };
  }

  // Update captured_variables
  const updatedVars = { ...(conv.captured_variables ?? {}), [varDef.name]: variableValue };

  await query(
    `UPDATE conversations
     SET captured_variables = $1, updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(updatedVars), conversationId]
  );

  // Sync to contact
  await syncVariableToContact(
    conv.organization_id,
    conv.agent_id,
    conv.contact_id,
    conv.channel,
    conv.channel_metadata,
    varDef.name,
    variableValue,
    conversationId
  );

  // Emit WebSocket update
  if (io) {
    io.to(`org:${conv.organization_id}`).emit('variables:update', {
      conversationId,
      contactId: conv.contact_id,
      variables: updatedVars,
    });
  }

  return {
    success: true,
    message: `Variable '${varDef.name}' captured successfully: ${variableValue}`,
  };
}

async function syncVariableToContact(
  orgId: string,
  agentId: string,
  contactId: string | null,
  channel: string,
  channelMetadata: Record<string, unknown>,
  varName: string,
  varValue: string,
  conversationId: string
): Promise<void> {
  const nameLower = varName.toLowerCase();

  // Map well-known variable names to contact fields
  const isName = [
    'name', 'nombre', 'full_name', 'fullname', 'user_name', 'username',
    'first_name', 'customer_name', 'nombre_completo', 'client_name',
    'contact_name', 'persona', 'nombre_cliente',
  ].includes(nameLower);

  const isEmail = [
    'email', 'correo', 'email_address', 'user_email', 'customer_email',
    'correo_electronico', 'mail', 'e_mail', 'contact_email', 'client_email',
  ].includes(nameLower);

  const isPhone = [
    'phone', 'telefono', 'whatsapp', 'mobile', 'phone_number', 'user_phone',
    'celular', 'numero', 'customer_phone', 'tel', 'cell', 'numero_telefono',
    'contact_phone', 'client_phone', 'movil',
  ].includes(nameLower);

  if (!contactId) {
    // Auto-create contact
    const phone = channel === 'whatsapp'
      ? (channelMetadata['phone'] as string | undefined) ?? (isPhone ? varValue : null)
      : isPhone ? varValue : null;

    const result = await query<{ id: string }>(
      `INSERT INTO contacts (organization_id, agent_id, name, phone, email, source_channel, funnel_stage, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'lead', NOW(), NOW())
       RETURNING id`,
      [
        orgId,
        agentId,
        isName ? varValue : null,
        phone,
        isEmail ? varValue : null,
        channel,
      ]
    );
    const newContactId = result.rows[0]?.id;
    if (newContactId) {
      await query(
        'UPDATE conversations SET contact_id = $1 WHERE id = $2',
        [newContactId, conversationId]
      );
    }
    return;
  }

  // Update existing contact
  if (isName) {
    await query('UPDATE contacts SET name = $1, updated_at = NOW() WHERE id = $2', [varValue, contactId]);
  } else if (isEmail) {
    await query('UPDATE contacts SET email = $1, updated_at = NOW() WHERE id = $2', [varValue, contactId]);
  } else if (isPhone) {
    await query('UPDATE contacts SET phone = $1, updated_at = NOW() WHERE id = $2', [varValue, contactId]);
  } else {
    // Merge into custom_variables JSONB
    await query(
      `UPDATE contacts
       SET custom_variables = custom_variables || $1::jsonb, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify({ [varName]: varValue }), contactId]
    );
  }
}

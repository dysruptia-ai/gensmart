/**
 * Consistency checks for queue job payloads. No imports on purpose: testable on its own.
 */
export interface ConversationOwnership {
  agent_id: string;
  organization_id: string;
}

/** True only when the conversation exists and belongs to the agent and organization of the job.
 *  UUIDs are compared case-insensitively: SQL does, and a job may carry the id as it came in a URL. */
export function conversationMatchesJob(
  conv: ConversationOwnership | null | undefined,
  agentId: string,
  organizationId: string
): boolean {
  return (
    !!conv &&
    conv.agent_id.toLowerCase() === agentId.toLowerCase() &&
    conv.organization_id.toLowerCase() === organizationId.toLowerCase()
  );
}

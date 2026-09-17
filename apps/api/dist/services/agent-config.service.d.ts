import { type ConfigVariableSchema, type ConfigVariableValues } from '@gensmart/shared';
export interface AgentConfigContext {
    schema: ConfigVariableSchema[];
    values: ConfigVariableValues;
    templateId: string | null;
}
/**
 * Load the effective config schema (template ⨁ overrides) + values for an
 * agent. Returns empty schema/values if the agent doesn't exist (caller is
 * expected to have already validated existence; this is best-effort).
 */
export declare function loadAgentConfigContext(agentId: string): Promise<AgentConfigContext>;
/**
 * Apply config variable substitution to a raw system prompt for a given agent.
 * Worker and preview route both call this so they cannot drift.
 */
export declare function renderSystemPromptWithConfig(agentId: string, rawSystemPrompt: string): Promise<string>;
/**
 * Return the effective schema + values for an agent, ready to pass into
 * injectConfigVariablesDeep. Mirrors renderSystemPromptWithConfig but exposes
 * the raw context so callers can substitute into arbitrary config objects
 * (e.g. Custom Function tool configs with {{config.*}} placeholders).
 */
export declare function loadAgentConfigForDeepInject(agentId: string): Promise<{
    schema: ConfigVariableSchema[];
    values: ConfigVariableValues;
}>;
export interface CTWAReferral {
    source_url?: string;
    source_type?: string;
    source_id?: string;
    headline?: string;
    body?: string;
    media_type?: string;
    image_url?: string;
    video_url?: string;
    thumbnail_url?: string;
}
/**
 * Builds the "ad context" system prompt block for a Click-to-WhatsApp Ad
 * referral, or returns null when there's nothing worth injecting (no
 * referral, or a referral with neither headline nor body — Meta sometimes
 * sends a bare source_id with no human-readable content). Worker and
 * preview route both call this so they cannot drift.
 */
export declare function buildAdReferralContext(referral: CTWAReferral | undefined, referredProduct: unknown): string | null;
//# sourceMappingURL=agent-config.service.d.ts.map
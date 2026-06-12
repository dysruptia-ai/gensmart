export declare const LLM_MODELS: {
    readonly openai: {
        readonly 'gpt-4o': {
            readonly name: "GPT-4o";
            readonly plans: readonly ["pro", "enterprise"];
        };
        readonly 'gpt-4o-mini': {
            readonly name: "GPT-4o Mini";
            readonly plans: readonly ["free", "starter", "pro", "enterprise"];
        };
    };
    readonly anthropic: {
        readonly 'claude-sonnet-4-20250514': {
            readonly name: "Claude Sonnet";
            readonly plans: readonly ["pro", "enterprise"];
        };
        readonly 'claude-haiku-4-5-20251001': {
            readonly name: "Claude Haiku";
            readonly plans: readonly ["starter", "pro", "enterprise"];
        };
    };
};
export interface TextPart {
    type: 'text';
    text: string;
}
export interface ImagePart {
    type: 'image';
    mimeType: string;
    data: string;
}
export type ContentPart = TextPart | ImagePart;
export declare function supportsVision(provider: string, model: string): boolean;
/** Extract plain text from string or ContentPart[] */
export declare function getTextContent(content: string | ContentPart[]): string;
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | ContentPart[];
    toolCalls?: ToolCall[];
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
    byoApiKey?: string;
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
export declare function chat(params: ChatParams): Promise<ChatResponse>;
export declare function generateEmbedding(text: string): Promise<number[]>;
export declare function generatePrompt(description: string, language?: string): Promise<{
    systemPrompt: string;
    suggestedVariables: unknown[];
    suggestedTools: string[];
}>;
//# sourceMappingURL=llm.service.d.ts.map
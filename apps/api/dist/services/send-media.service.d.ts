import { ToolDefinition } from './llm.service';
export declare const MEDIA_RATE_LIMIT: {
    readonly perConversation: {
        readonly maxSends: 5;
        readonly windowSeconds: 600;
    };
    readonly perAgent: {
        readonly maxSends: 20;
        readonly windowSeconds: 3600;
    };
};
/** Tool definition — what the LLM sees */
export declare const sendMediaToolDef: ToolDefinition;
export interface SendMediaContext {
    conversationId: string;
    agentId: string;
    organizationId: string;
    channel: 'whatsapp' | 'web';
    phoneNumberId?: string;
    accessToken?: string;
    contactPhone?: string;
}
export interface SendMediaResult {
    success: boolean;
    message: string;
}
export declare function handleSendMedia(args: {
    type?: string;
    url?: string;
    caption?: string;
}, context: SendMediaContext): Promise<SendMediaResult>;
//# sourceMappingURL=send-media.service.d.ts.map
import { type ToolDefinition } from './llm.service';
export declare const EMAIL_NOTIF_RATE_LIMIT: {
    readonly perConversation: {
        readonly maxSends: 3;
        readonly windowSeconds: 600;
    };
    readonly perTool: {
        readonly maxSends: 50;
        readonly windowSeconds: 3600;
    };
};
export interface EmailNotificationToolConfig {
    recipientEmail: string;
    ccEmails?: string[];
    subject: string;
    bodyTemplate: string;
    parameters: Array<{
        name: string;
        type: 'string' | 'number' | 'boolean';
        required: boolean;
        description: string;
    }>;
    fromName?: string;
    replyTo?: string;
}
export declare function buildEmailNotificationToolDef(toolName: string, toolDescription: string, config: EmailNotificationToolConfig): ToolDefinition;
export interface SendEmailNotificationContext {
    conversationId: string;
    agentId: string;
    organizationId: string;
    toolId: string;
    toolName: string;
    config: EmailNotificationToolConfig;
}
export interface SendEmailNotificationResult {
    success: boolean;
    message: string;
}
export declare function handleSendEmailNotification(args: Record<string, unknown>, context: SendEmailNotificationContext): Promise<SendEmailNotificationResult>;
//# sourceMappingURL=send-email-notification.service.d.ts.map
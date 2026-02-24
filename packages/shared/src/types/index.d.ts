export type Plan = 'free' | 'starter' | 'pro' | 'enterprise';
export type Role = 'owner' | 'admin' | 'member';
export type AgentStatus = 'draft' | 'active' | 'paused';
export type ConversationStatus = 'active' | 'human_takeover' | 'closed';
export type FunnelStage = 'lead' | 'opportunity' | 'customer';
export type Channel = 'whatsapp' | 'web';
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool' | 'human';
export interface Organization {
    id: string;
    name: string;
    slug: string;
    plan: Plan;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    settings: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
export interface User {
    id: string;
    organizationId: string;
    email: string;
    name: string;
    role: Role;
    totpEnabled: boolean;
    avatarUrl?: string;
    language: string;
    lastLoginAt?: Date;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface Agent {
    id: string;
    organizationId: string;
    name: string;
    description?: string;
    avatarUrl?: string;
    avatarInitials?: string;
    systemPrompt: string;
    llmProvider: string;
    llmModel: string;
    temperature: number;
    maxTokens: number;
    contextWindowMessages: number;
    status: AgentStatus;
    channels: Channel[];
    messageBufferSeconds: number;
    variables: AgentVariable[];
    webConfig: WebConfig;
    whatsappConfig: WhatsappConfig;
    publishedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface AgentVariable {
    name: string;
    type: 'string' | 'enum' | 'number' | 'boolean';
    required: boolean;
    description: string;
    options?: string[];
}
export interface WebConfig {
    primaryColor: string;
    avatarUrl?: string;
    welcomeMessage: string;
    position: 'bottom-right' | 'bottom-left';
    bubbleText: string;
}
export interface WhatsappConfig {
    phoneNumberId?: string;
    wabaId?: string;
    accessTokenEncrypted?: string;
    verifyToken?: string;
    connected: boolean;
}
export interface Conversation {
    id: string;
    agentId: string;
    organizationId: string;
    contactId?: string;
    channel: Channel;
    status: ConversationStatus;
    takenOverBy?: string;
    takenOverAt?: Date;
    channelMetadata: Record<string, unknown>;
    aiSummary?: string;
    aiScore?: number;
    capturedVariables: Record<string, unknown>;
    lastMessageAt?: Date;
    messageCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface Message {
    id: string;
    conversationId: string;
    role: MessageRole;
    content: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
}
export interface Contact {
    id: string;
    organizationId: string;
    agentId?: string;
    name?: string;
    phone?: string;
    email?: string;
    avatarUrl?: string;
    aiSummary?: string;
    aiScore?: number;
    aiService?: string;
    funnelStage: FunnelStage;
    funnelUpdatedAt?: Date;
    customVariables: Record<string, unknown>;
    sourceChannel?: Channel;
    tags: string[];
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Calendar {
    id: string;
    agentId: string;
    organizationId: string;
    name: string;
    timezone: string;
    availableDays: number[];
    availableHours: {
        start: string;
        end: string;
    };
    slotDuration: number;
    bufferMinutes: number;
    maxAdvanceDays: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface Appointment {
    id: string;
    calendarId: string;
    contactId?: string;
    conversationId?: string;
    organizationId: string;
    title?: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    status: string;
    reminderSent: boolean;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=index.d.ts.map
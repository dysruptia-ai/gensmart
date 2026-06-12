export declare const PLAN_LIMITS: {
    readonly free: {
        readonly agents: 1;
        readonly messagesPerMonth: 50;
        readonly contacts: 25;
        readonly channels: readonly ["web"];
        readonly knowledgeFiles: 1;
        readonly customFunctions: 0;
        readonly mcpServers: 0;
        readonly subAccounts: 0;
        readonly humanTakeover: false;
        readonly voiceMessages: false;
        readonly imageVision: false;
        readonly allowedModels: readonly ["gpt-4o-mini"];
        readonly contextWindowMessages: 10;
        readonly maxTokensPerResponse: 512;
        readonly byoApiKey: false;
        readonly emailNotificationTools: 0;
    };
    readonly starter: {
        readonly agents: 3;
        readonly messagesPerMonth: 1000;
        readonly contacts: 500;
        readonly channels: readonly ["web", "whatsapp"];
        readonly knowledgeFiles: 5;
        readonly customFunctions: 2;
        readonly mcpServers: 0;
        readonly subAccounts: 0;
        readonly humanTakeover: true;
        readonly voiceMessages: true;
        readonly imageVision: false;
        readonly allowedModels: readonly ["gpt-4o-mini", "claude-haiku-4-5-20251001"];
        readonly contextWindowMessages: 15;
        readonly maxTokensPerResponse: 1024;
        readonly byoApiKey: false;
        readonly emailNotificationTools: 2;
    };
    readonly pro: {
        readonly agents: 10;
        readonly messagesPerMonth: 5000;
        readonly contacts: 2000;
        readonly channels: readonly ["web", "whatsapp"];
        readonly knowledgeFiles: 20;
        readonly customFunctions: 10;
        readonly mcpServers: 3;
        readonly subAccounts: 5;
        readonly humanTakeover: true;
        readonly voiceMessages: true;
        readonly imageVision: true;
        readonly allowedModels: readonly ["gpt-4o-mini", "gpt-4o", "claude-haiku-4-5-20251001", "claude-sonnet-4-20250514"];
        readonly contextWindowMessages: 25;
        readonly maxTokensPerResponse: 2048;
        readonly byoApiKey: false;
        readonly emailNotificationTools: 10;
    };
    readonly enterprise: {
        readonly agents: number;
        readonly messagesPerMonth: 25000;
        readonly contacts: number;
        readonly channels: readonly ["web", "whatsapp"];
        readonly knowledgeFiles: number;
        readonly customFunctions: number;
        readonly mcpServers: number;
        readonly subAccounts: number;
        readonly humanTakeover: true;
        readonly voiceMessages: true;
        readonly imageVision: true;
        readonly allowedModels: readonly ["gpt-4o-mini", "gpt-4o", "claude-haiku-4-5-20251001", "claude-sonnet-4-20250514"];
        readonly contextWindowMessages: 50;
        readonly maxTokensPerResponse: 4096;
        readonly byoApiKey: true;
        readonly emailNotificationTools: number;
    };
};
export declare const PRICING: {
    readonly starter: {
        readonly monthly: 29;
        readonly quarterly: 78.3;
        readonly yearly: 278.4;
        readonly quarterlyDiscount: 0.1;
        readonly yearlyDiscount: 0.2;
    };
    readonly pro: {
        readonly monthly: 79;
        readonly quarterly: 213.3;
        readonly yearly: 758.4;
        readonly quarterlyDiscount: 0.1;
        readonly yearlyDiscount: 0.2;
    };
    readonly enterprise: {
        readonly monthly: 199;
        readonly quarterly: 537.3;
        readonly yearly: 1910.4;
        readonly quarterlyDiscount: 0.1;
        readonly yearlyDiscount: 0.2;
    };
};
export declare const MESSAGE_ADDONS: readonly [{
    readonly messages: 500;
    readonly price: 10;
}, {
    readonly messages: 2000;
    readonly price: 30;
}, {
    readonly messages: 5000;
    readonly price: 60;
}];
//# sourceMappingURL=index.d.ts.map
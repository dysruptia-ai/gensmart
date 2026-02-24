"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGE_ADDONS = exports.PRICING = exports.PLAN_LIMITS = void 0;
exports.PLAN_LIMITS = {
    free: {
        agents: 1,
        messagesPerMonth: 50,
        contacts: 25,
        channels: ['web'],
        knowledgeFiles: 1,
        customFunctions: 0,
        mcpServers: 0,
        subAccounts: 0,
        humanTakeover: false,
        allowedModels: ['gpt-4o-mini'],
        contextWindowMessages: 10,
        maxTokensPerResponse: 512,
        byoApiKey: false,
    },
    starter: {
        agents: 3,
        messagesPerMonth: 1000,
        contacts: 500,
        channels: ['web', 'whatsapp'],
        knowledgeFiles: 5,
        customFunctions: 2,
        mcpServers: 0,
        subAccounts: 0,
        humanTakeover: true,
        allowedModels: ['gpt-4o-mini', 'claude-haiku'],
        contextWindowMessages: 15,
        maxTokensPerResponse: 1024,
        byoApiKey: false,
    },
    pro: {
        agents: 10,
        messagesPerMonth: 5000,
        contacts: 2000,
        channels: ['web', 'whatsapp'],
        knowledgeFiles: 20,
        customFunctions: 10,
        mcpServers: 3,
        subAccounts: 5,
        humanTakeover: true,
        allowedModels: ['gpt-4o-mini', 'gpt-4o', 'claude-haiku', 'claude-sonnet'],
        contextWindowMessages: 25,
        maxTokensPerResponse: 2048,
        byoApiKey: false,
    },
    enterprise: {
        agents: Infinity,
        messagesPerMonth: 25000,
        contacts: Infinity,
        channels: ['web', 'whatsapp'],
        knowledgeFiles: Infinity,
        customFunctions: Infinity,
        mcpServers: Infinity,
        subAccounts: Infinity,
        humanTakeover: true,
        allowedModels: ['gpt-4o-mini', 'gpt-4o', 'claude-haiku', 'claude-sonnet'],
        contextWindowMessages: 50,
        maxTokensPerResponse: 4096,
        byoApiKey: true,
    },
};
exports.PRICING = {
    starter: {
        monthly: 29,
        quarterly: 78.30, // 10% off
        yearly: 278.40, // 20% off
        quarterlyDiscount: 0.10,
        yearlyDiscount: 0.20,
    },
    pro: {
        monthly: 79,
        quarterly: 213.30,
        yearly: 758.40,
        quarterlyDiscount: 0.10,
        yearlyDiscount: 0.20,
    },
    enterprise: {
        monthly: 199,
        quarterly: 537.30,
        yearly: 1910.40,
        quarterlyDiscount: 0.10,
        yearlyDiscount: 0.20,
    },
};
exports.MESSAGE_ADDONS = [
    { messages: 500, price: 10 },
    { messages: 2000, price: 30 },
    { messages: 5000, price: 60 },
];
//# sourceMappingURL=index.js.map
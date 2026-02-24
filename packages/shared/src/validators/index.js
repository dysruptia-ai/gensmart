"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.variableSchema = exports.contactUpdateSchema = exports.agentUpdateSchema = exports.agentCreateSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
const passwordSchema = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: zod_1.z.string().email('Invalid email address'),
    password: passwordSchema,
    organizationName: zod_1.z.string().min(2, 'Organization name must be at least 2 characters').max(255),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.agentCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255),
    description: zod_1.z.string().max(1000).optional(),
    systemPrompt: zod_1.z.string().min(1, 'System prompt is required'),
    llmProvider: zod_1.z.enum(['openai', 'anthropic']),
    llmModel: zod_1.z.string().min(1),
    temperature: zod_1.z.number().min(0).max(2).default(0.7),
    maxTokens: zod_1.z.number().int().min(1).max(8192).default(1024),
    contextWindowMessages: zod_1.z.number().int().min(1).max(100).default(15),
    channels: zod_1.z.array(zod_1.z.enum(['web', 'whatsapp'])).default([]),
    messageBufferSeconds: zod_1.z.number().int().min(0).max(30).default(5),
});
exports.agentUpdateSchema = exports.agentCreateSchema.partial();
exports.contactUpdateSchema = zod_1.z.object({
    name: zod_1.z.string().max(255).optional(),
    phone: zod_1.z.string().max(50).optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    notes: zod_1.z.string().optional(),
    funnelStage: zod_1.z.enum(['lead', 'opportunity', 'customer']).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    customVariables: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.variableSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(50).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Variable name must be a valid identifier'),
    type: zod_1.z.enum(['string', 'enum', 'number', 'boolean']),
    required: zod_1.z.boolean().default(false),
    description: zod_1.z.string().max(255),
    options: zod_1.z.array(zod_1.z.string()).optional(),
});
//# sourceMappingURL=index.js.map
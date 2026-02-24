import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    organizationName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    password: string;
    organizationName: string;
}, {
    name: string;
    email: string;
    password: string;
    organizationName: string;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const agentCreateSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    systemPrompt: z.ZodString;
    llmProvider: z.ZodEnum<["openai", "anthropic"]>;
    llmModel: z.ZodString;
    temperature: z.ZodDefault<z.ZodNumber>;
    maxTokens: z.ZodDefault<z.ZodNumber>;
    contextWindowMessages: z.ZodDefault<z.ZodNumber>;
    channels: z.ZodDefault<z.ZodArray<z.ZodEnum<["web", "whatsapp"]>, "many">>;
    messageBufferSeconds: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    systemPrompt: string;
    llmProvider: "openai" | "anthropic";
    llmModel: string;
    temperature: number;
    maxTokens: number;
    contextWindowMessages: number;
    channels: ("whatsapp" | "web")[];
    messageBufferSeconds: number;
    description?: string | undefined;
}, {
    name: string;
    systemPrompt: string;
    llmProvider: "openai" | "anthropic";
    llmModel: string;
    description?: string | undefined;
    temperature?: number | undefined;
    maxTokens?: number | undefined;
    contextWindowMessages?: number | undefined;
    channels?: ("whatsapp" | "web")[] | undefined;
    messageBufferSeconds?: number | undefined;
}>;
export declare const agentUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    systemPrompt: z.ZodOptional<z.ZodString>;
    llmProvider: z.ZodOptional<z.ZodEnum<["openai", "anthropic"]>>;
    llmModel: z.ZodOptional<z.ZodString>;
    temperature: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    maxTokens: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    contextWindowMessages: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    channels: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodEnum<["web", "whatsapp"]>, "many">>>;
    messageBufferSeconds: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    systemPrompt?: string | undefined;
    llmProvider?: "openai" | "anthropic" | undefined;
    llmModel?: string | undefined;
    temperature?: number | undefined;
    maxTokens?: number | undefined;
    contextWindowMessages?: number | undefined;
    channels?: ("whatsapp" | "web")[] | undefined;
    messageBufferSeconds?: number | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    systemPrompt?: string | undefined;
    llmProvider?: "openai" | "anthropic" | undefined;
    llmModel?: string | undefined;
    temperature?: number | undefined;
    maxTokens?: number | undefined;
    contextWindowMessages?: number | undefined;
    channels?: ("whatsapp" | "web")[] | undefined;
    messageBufferSeconds?: number | undefined;
}>;
export declare const contactUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    notes: z.ZodOptional<z.ZodString>;
    funnelStage: z.ZodOptional<z.ZodEnum<["lead", "opportunity", "customer"]>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    customVariables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    notes?: string | undefined;
    funnelStage?: "lead" | "opportunity" | "customer" | undefined;
    tags?: string[] | undefined;
    customVariables?: Record<string, unknown> | undefined;
}, {
    name?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    notes?: string | undefined;
    funnelStage?: "lead" | "opportunity" | "customer" | undefined;
    tags?: string[] | undefined;
    customVariables?: Record<string, unknown> | undefined;
}>;
export declare const variableSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["string", "enum", "number", "boolean"]>;
    required: z.ZodDefault<z.ZodBoolean>;
    description: z.ZodString;
    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "string" | "number" | "boolean" | "enum";
    description: string;
    required: boolean;
    options?: string[] | undefined;
}, {
    name: string;
    type: "string" | "number" | "boolean" | "enum";
    description: string;
    options?: string[] | undefined;
    required?: boolean | undefined;
}>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AgentCreateInput = z.infer<typeof agentCreateSchema>;
export type AgentUpdateInput = z.infer<typeof agentUpdateSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
export type VariableInput = z.infer<typeof variableSchema>;
//# sourceMappingURL=index.d.ts.map
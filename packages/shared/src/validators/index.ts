import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters').max(255),
  promoCode: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const variableSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Variable name must be a valid identifier'),
  type: z.enum(['string', 'enum', 'number', 'boolean']),
  required: z.boolean().default(false),
  description: z.string().max(255),
  options: z.array(z.string()).optional(),
  mapsTo: z.enum(['name', 'email', 'phone', 'none']).optional(),
});

export const agentCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).optional(),
  systemPrompt: z.string().min(1, 'System prompt is required'),
  llmProvider: z.enum(['openai', 'anthropic']),
  llmModel: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(8192).default(1024),
  contextWindowMessages: z.number().int().min(1).max(100).default(15),
  channels: z.array(z.enum(['web', 'whatsapp'])).default([]),
  messageBufferSeconds: z.number().int().min(0).max(30).default(5),
  variables: z.array(variableSchema).optional(),
  webConfig: z.record(z.unknown()).optional(),
});

const handoffContactSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length >= 10 && v.length <= 15, 'Phone must have between 10 and 15 digits'),
  calendarIds: z
    .array(z.string().uuid())
    .max(5)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate calendars')
    .default([]),
});

export const handoffConfigUpdateSchema = z
  .object({
    enabled: z.boolean(),
    buttonText: z.string().min(1).max(20),
    cooldownMinutes: z.number().int().min(1).max(1440),
    labelTtlHours: z.number().int().min(1).max(720),
    contacts: z
      .array(handoffContactSchema)
      .max(5)
      .refine((cs) => new Set(cs.map((c) => c.phone)).size === cs.length, 'Duplicate phone numbers'),
  })
  .partial();

export const agentUpdateSchema = agentCreateSchema.partial().extend({
  handoffConfig: handoffConfigUpdateSchema.optional(),
});

export const contactUpdateSchema = z.object({
  name: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional(),
  funnelStage: z.enum(['lead', 'opportunity', 'customer']).optional(),
  tags: z.array(z.string()).optional(),
  customVariables: z.record(z.unknown()).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AgentCreateInput = z.infer<typeof agentCreateSchema>;
export type AgentUpdateInput = z.infer<typeof agentUpdateSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
export type VariableInput = z.infer<typeof variableSchema>;
export type HandoffConfigUpdateInput = z.infer<typeof handoffConfigUpdateSchema>;

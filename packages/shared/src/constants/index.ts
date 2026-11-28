/**
 * Version of the Terms of Service the user accepts when registering (stored in users.terms_version).
 * It is the `lastUpdated` date of the Terms (apps/web/content/legal/*): update it whenever the Terms change.
 */
export const TERMS_VERSION = '2026-11-25';

export const PLAN_LIMITS = {
  solo: {
    agents: 1,
    messagesPerMonth: 200,
    contacts: 150,
    channels: ['web', 'whatsapp', 'email', 'telegram', 'facebook', 'instagram'] as const,
    knowledgeFiles: 1,
    customFunctions: 0,
    mcpServers: 0,
    subAccounts: 0,
    humanTakeover: false,
    voiceMessages: false,
    imageVision: false,
    allowedModels: ['gpt-4o-mini', 'z-ai/glm-4.6', 'deepseek/deepseek-v3.2'],
    contextWindowMessages: 10,
    maxTokensPerResponse: 512,
    byoApiKey: false,
    emailNotificationTools: 0,
  },
  starter: {
    agents: 3,
    messagesPerMonth: 1000,
    contacts: 500,
    channels: ['web', 'whatsapp', 'email', 'telegram', 'facebook', 'instagram'] as const,
    knowledgeFiles: 5,
    customFunctions: 2,
    mcpServers: 0,
    subAccounts: 0,
    humanTakeover: true,
    voiceMessages: true,
    imageVision: false,
    allowedModels: ['gpt-4o-mini', 'claude-haiku-4-5-20251001', 'z-ai/glm-4.6', 'deepseek/deepseek-v3.2'],
    contextWindowMessages: 15,
    maxTokensPerResponse: 1024,
    byoApiKey: false,
    emailNotificationTools: 2,
  },
  pro: {
    agents: 10,
    messagesPerMonth: 5000,
    contacts: 2000,
    channels: ['web', 'whatsapp', 'email', 'telegram', 'facebook', 'instagram'] as const,
    knowledgeFiles: 20,
    customFunctions: 10,
    mcpServers: 3,
    subAccounts: 5,
    humanTakeover: true,
    voiceMessages: true,
    imageVision: true,
    allowedModels: ['gpt-4o-mini', 'gpt-4o', 'claude-haiku-4-5-20251001', 'claude-sonnet-5', 'z-ai/glm-4.6', 'deepseek/deepseek-v3.2'],
    contextWindowMessages: 25,
    maxTokensPerResponse: 2048,
    byoApiKey: false,
    emailNotificationTools: 10,
  },
  enterprise: {
    agents: Infinity,
    messagesPerMonth: 25000,
    contacts: Infinity,
    channels: ['web', 'whatsapp', 'email', 'telegram', 'facebook', 'instagram'] as const,
    knowledgeFiles: Infinity,
    customFunctions: Infinity,
    mcpServers: Infinity,
    subAccounts: Infinity,
    humanTakeover: true,
    voiceMessages: true,
    imageVision: true,
    allowedModels: ['gpt-4o-mini', 'gpt-4o', 'claude-haiku-4-5-20251001', 'claude-sonnet-5', 'z-ai/glm-4.6', 'deepseek/deepseek-v3.2'],
    contextWindowMessages: 50,
    maxTokensPerResponse: 4096,
    byoApiKey: true,
    emailNotificationTools: Infinity,
  },
} as const;

/** Single source for the per-plan channel gate (API middleware + message worker). Unknown plans fall back to solo. */
export function isChannelAllowedOnPlan(plan: string, channel: string): boolean {
  const key = (Object.prototype.hasOwnProperty.call(PLAN_LIMITS, plan) ? plan : 'solo') as keyof typeof PLAN_LIMITS;
  return (PLAN_LIMITS[key].channels as readonly string[]).includes(channel);
}

export function getMinimumPlanForChannel(channel: string): string | null {
  const planOrder: Array<keyof typeof PLAN_LIMITS> = ['solo', 'starter', 'pro', 'enterprise'];
  for (const plan of planOrder) {
    if ((PLAN_LIMITS[plan].channels as readonly string[]).includes(channel)) {
      return plan;
    }
  }
  return null;
}

const TOOL_TYPE_LIMIT_FIELD = {
  custom_function: 'customFunctions',
  mcp: 'mcpServers',
  email_notification: 'emailNotificationTools',
} as const;

export function getMinimumPlanForTool(toolType: keyof typeof TOOL_TYPE_LIMIT_FIELD): string | null {
  const planOrder: Array<keyof typeof PLAN_LIMITS> = ['solo', 'starter', 'pro', 'enterprise'];
  const field = TOOL_TYPE_LIMIT_FIELD[toolType];
  for (const plan of planOrder) {
    const limit = (PLAN_LIMITS[plan] as Record<string, number | boolean | readonly string[]>)[field] as number;
    if (limit > 0) {
      return plan;
    }
  }
  return null;
}

export const PRICING = {
  solo: {
    monthly: 20,
    quarterly: 54.00,   // 10% off
    yearly: 192.00,     // 20% off
    quarterlyDiscount: 0.10,
    yearlyDiscount: 0.20,
  },
  starter: {
    monthly: 29,
    quarterly: 78.30,   // 10% off
    yearly: 278.40,     // 20% off
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
} as const;

/**
 * Condiciones del programa de socios (sitio público, `/partners`). El módulo de socios
 * (registro, panel, comisiones) debe usar estos mismos valores cuando se construya.
 */
export const PARTNER_PROGRAM = {
  /** Porcentaje de cada factura pagada por el cliente referido. */
  commissionPercent: 25,
  /** Facturas del cliente que generan comisión, empezando por la primera. */
  commissionInvoices: 12,
  /** Bono único por cliente, en USD. */
  bonusUsd: 20,
  /** Número de factura (a precio completo) con la que se gana el bono. */
  bonusOnInvoice: 2,
} as const;

export const MESSAGE_ADDONS = [
  { messages: 500, price: 10 },
  { messages: 2000, price: 30 },
  { messages: 5000, price: 60 },
] as const;

/** Porcentaje del límite mensual de mensajes en el que se avisa al usuario (usage.service y página de precios). */
export const USAGE_WARNING_PERCENT = 80;

/** Bandeja (web-43): topes de notas, respuestas rápidas y etiquetas. Los usan la API y la web. */
export const INBOX_LIMITS = {
  noteMaxChars: 2000,
  notesPerConversationShown: 500,
  quickRepliesPerOrg: 200,
  quickReplyMaxChars: 1000,
  labelsPerOrg: 100,
  labelsPerConversation: 20,
  labelNameMaxChars: 30,
  // web-44: vistas guardadas, acciones en lote y búsqueda
  savedViewsPerUser: 20,
  savedViewNameMax: 40,
  bulkMax: 100,
  searchMinChars: 2,
} as const;

/** Bandeja (web-46): resumen y respuestas sugeridas con IA. Un solo lugar para cambiar el modelo. */
export const INBOX_AI = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  /** Mensajes del plan que gasta cada generación (un resumen, o un juego de sugeridas). */
  messagesPerGeneration: 1,
  suggestionsCount: 3,
  suggestionMaxChars: 300,
  summaryMaxChars: 400,
  /** Últimos mensajes de la conversación que se le pasan al modelo. */
  transcriptMessages: 20,
  /** Recorte del prompt del agente que se le pasa a las sugeridas. */
  agentPromptMaxChars: 4000,
} as const;

/** Por qué pidió ayuda el agente (web-46). `agent_paused` lo pone el sistema. */
export const HANDOFF_REASONS = ['customer_asked', 'could_not_solve', 'out_of_scope', 'agent_paused', 'other'] as const;
export type HandoffReason = (typeof HANDOFF_REASONS)[number];

/** Atajo de respuesta rápida sin la "/": minúsculas (con tildes), números, "_" y "-". De 2 a 30. */
export const QUICK_REPLY_SHORTCUT_RE = /^[\p{Ll}\p{N}][\p{Ll}\p{N}_-]{1,29}$/u;

/**
 * Paying during the GenSmart trial: Stripe requires subscription_data.trial_end to be at least 48 h
 * in the future. With fewer hours left than this (one hour of margin), Checkout charges right away.
 */
export const TRIAL_DEFERRED_CHARGE_MIN_HOURS = 49;

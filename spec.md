# GenSmart — Especificación Técnica Completa (MVP) v2.0

> **Versión:** 2.0 (Final)  
> **Fecha:** 2026-02-24  
> **Autor:** Spec generada para ejecución con Claude Code  
> **Idioma base del producto:** Inglés (con soporte español)

---

## 1. Visión del Producto

GenSmart es una plataforma SaaS que permite a empresas, freelancers y agencias de automatización crear, desplegar y gestionar agentes de IA conversacionales en WhatsApp y Web, sin necesidad de herramientas complejas como N8N. Incluye CRM integrado con AI scoring, funnel de ventas, calendario de agendamiento, sistema de variables inteligentes y analíticas — todo en una sola plataforma.

**Propuesta de valor:** Reducir el tiempo de despliegue de un agente AI de semanas (con N8N) a minutos, democratizando el acceso a agentes AI para captura de leads.

---

## 2. Arquitectura General

```
AWS LIGHTSAIL (Instancia Única — Escalar verticalmente, nunca separar)

┌──────────────┐  ┌──────────────┐  ┌────────────────────┐
│  Next.js 16  │  │ Express.js 5 │  │  Workers (BullMQ)  │
│  (Frontend   │  │   (API)      │  │  - Message Worker   │
│  + Landing   │  │  Port 4000   │  │  - RAG Worker       │
│  + Widget)   │  │              │  │  - Scoring Worker   │
│  Port 3000   │  │              │  │  - Scraping Worker  │
└──────┬───────┘  └──────┬───────┘  └─────────┬──────────┘
       │                 │                     │
┌──────┴─────────────────┴─────────────────────┴──────────┐
│                    PostgreSQL 16 + pgvector               │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│                 Redis (BullMQ + Cache + Counters)          │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│              Nginx (Reverse Proxy + SSL)                   │
└──────────────────────────────────────────────────────────┘

Servicios Externos:
├── Meta Cloud API (WhatsApp Business) + Embedded Signup
├── OpenAI API (GPT-4o / GPT-4o-mini / text-embedding-ada-002)
├── Anthropic API (Claude Sonnet / Claude Haiku)
├── Stripe (Billing + Customer Portal)
└── SMTP (Emails transaccionales)
```

**Política de escalamiento:** Siempre instancia única. Cuando se necesite más potencia, migrar a una instancia más robusta de Lightsail (8GB, 16GB, etc.) para eliminar latencia de red entre servicios.

---

## 3. Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Frontend | Next.js 16+ (App Router) | SSR, RSC, routing moderno, landing page SEO |
| Backend API | Express.js 5 | API REST, webhooks WhatsApp, WebSocket |
| Base de datos | PostgreSQL 16 + pgvector | Multi-tenant, embeddings vectoriales, concurrencia |
| Cache/Colas | Redis + BullMQ | Colas de mensajes, buffer, cache, contadores de uso |
| CSS | CSS Modules (sin librerías) | Lightweight, scoped, sin dependencias |
| Iconos | lucide-react | Sin emojis, iconos consistentes |
| Pagos | Stripe | Suscripciones, webhooks, portal de cliente |
| WhatsApp | Meta Cloud API + Embedded Signup | Integración directa + onboarding simplificado |
| LLMs | OpenAI + Anthropic | Multi-provider, modelo por plan |
| Auth | Custom (JWT + TOTP) desde cero | Control total, sin NextAuth |
| Infra | AWS Lightsail (instancia única) | Costo predecible, escalar verticalmente |
| App Móvil | React Native (Expo) | Nativa iOS/Android, solo agentes Web |
| Emails | Nodemailer + SMTP | Transaccionales y notificaciones |
| Blog | Markdown files en el repo | Simple, rápido, SEO friendly |

---

## 4. Paleta de Colores y Tipografía

### Colores

| Token | Hex | Uso |
|-------|-----|-----|
| --color-primary | #25D366 | Verde WhatsApp — CTAs principales, estados activos |
| --color-primary-dark | #128C7E | Verde oscuro — hover, bordes activos |
| --color-primary-light | #DCF8C6 | Verde claro — backgrounds de mensajes propios |
| --color-bg-main | #FAF8F5 | Beige claro — fondo principal del dashboard |
| --color-bg-card | #FFFFFF | Blanco — tarjetas, modales, inputs |
| --color-bg-sidebar | #F5F0EB | Beige medio — sidebar, áreas secundarias |
| --color-text-primary | #1A1A1A | Texto principal |
| --color-text-secondary | #6B7280 | Texto secundario, placeholders |
| --color-border | #E5E0DB | Bordes, divisores |
| --color-danger | #EF4444 | Errores, eliminar |
| --color-warning | #F59E0B | Alertas |
| --color-success | #10B981 | Éxito, confirmaciones |
| --color-info | #3B82F6 | Información, links |

### Tipografía — Google Font: Inter

```
--font-xs: 0.75rem;    /* 12px */
--font-sm: 0.875rem;   /* 14px */
--font-base: 1rem;     /* 16px */
--font-lg: 1.125rem;   /* 18px */
--font-xl: 1.25rem;    /* 20px */
--font-2xl: 1.5rem;    /* 24px */
--font-3xl: 1.875rem;  /* 30px */
--font-4xl: 2.25rem;   /* 36px - landing hero */
--font-5xl: 3rem;      /* 48px - landing hero large */
```

---

## 5. Landing Page (Pública)

### Rutas Públicas

```
/                    -> Landing page principal
/pricing             -> Página de planes detallada
/blog                -> Lista de posts
/blog/[slug]         -> Post individual
/login               -> Login
/register            -> Registro
/forgot-password     -> Recuperar contraseña
/reset-password/[token]
/docs/whatsapp-setup -> Documentación WhatsApp (fallback)
```

### Secciones de la Landing Page (/)

1. **Hero Section** — Headline orientado al beneficio ("Create & Deploy AI Agents in Minutes, Not Weeks"), subheadline, CTA "Start Free", CTA "See Demo", visual del dashboard
2. **Social Proof Bar** — Logos de clientes, métricas de uso
3. **Problem/Solution** — Dolor (manual, lento, caro) vs solución GenSmart
4. **Features Grid** — AI Agents, WhatsApp & Web, Smart CRM, Sales Funnel, Calendar, Knowledge Base, Human Takeover, Custom Functions & MCP. Cada uno con icono lucide-react, título, descripción de 1 línea
5. **How It Works** — 4 pasos: Create, Configure, Deploy, Track
6. **Channels Section** — WhatsApp y Web Widget con screenshots
7. **CRM & Funnel Preview** — Screenshots del CRM y kanban
8. **Pricing Section** — 4 planes, toggle Monthly/Quarterly/Yearly, CTA por plan
9. **Testimonials** — Cards con foto, nombre, empresa, quote
10. **Blog Preview** — Últimos 3 posts
11. **FAQ** — Accordion 8-10 preguntas
12. **Final CTA** — "Ready to Deploy Your First AI Agent?" + "Start Free"
13. **Footer** — Links, legal, social, language selector, copyright

### SEO

- Meta tags dinámicos (title, description, og:image)
- JSON-LD structured data
- Sitemap.xml auto-generado
- robots.txt, canonical URLs, Open Graph + Twitter Cards
- Semantic HTML, alt text, Core Web Vitals optimizados

### Blog

- Posts en markdown: /content/blog/slug.md
- Frontmatter: title, description, date, author, tags, cover_image
- SSG en build time, paginación, tags

---

## 6. Sistema de Autenticación (Custom, sin NextAuth)

### JWT Strategy

```
Access Token:
  - Almacenamiento: Memory (variable JS) en frontend — NUNCA localStorage
  - Duración: 15 minutos
  - Payload: { userId, orgId, role, email }
  - Header: Authorization: Bearer <token>

Refresh Token:
  - Almacenamiento: httpOnly, secure, sameSite=strict cookie
  - Duración: 7 días
  - Almacenado en BD (refresh_tokens) para invalidación
  - Rotación: cada uso genera nuevo refresh token
  - Detección de reuso: token ya usado -> invalidar TODOS los tokens del user
```

### Flujo de autenticación

```
REGISTRO:
POST /api/auth/register -> Validate (Zod) -> bcrypt hash -> create org + user -> Stripe customer -> JWT tokens -> email bienvenida

LOGIN:
POST /api/auth/login -> validate email+password -> if 2FA -> { requires_2fa, temp_token } -> else -> JWT tokens

LOGIN CON 2FA:
POST /api/auth/2fa/verify -> validate temp_token + TOTP code -> JWT tokens

REFRESH:
POST /api/auth/refresh -> validate httpOnly cookie -> rotate refresh token -> new access token

LOGOUT:
POST /api/auth/logout -> invalidate refresh token -> clear cookie
```

### 2FA (TOTP)

Setup: speakeasy genera secret, QR code, usuario escanea, verifica, 10 backup codes hasheados
Login con 2FA: login retorna { requires_2fa, temp_token }, verify con temp_token + code TOTP o backup code

### Tablas Auth

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  replaced_by UUID REFERENCES refresh_tokens(id),
  user_agent TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

CREATE TABLE backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(255) NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Frontend Auth (Custom)

1. AuthContext (React Context): access token en memoria, user/isAuthenticated/login/logout/register, auto-refresh timer
2. api.ts: interceptor Authorization, 401 -> refresh -> retry -> fail -> /login
3. Next.js middleware: verifica cookie para /dashboard/*
4. ProtectedRoute wrapper

---

## 7. Modelo de Datos (PostgreSQL 16 + pgvector)

### 7.1 Multi-tenancy

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'free',
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  subscription_status VARCHAR(50) DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  settings JSONB DEFAULT '{"timezone":"UTC","language":"en","notifications":{"email_new_lead":true,"email_high_score_lead":true,"email_plan_limit":true}}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  totp_secret_encrypted VARCHAR(500),
  totp_enabled BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  language VARCHAR(10) DEFAULT 'en',
  last_login_at TIMESTAMPTZ,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sub_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  child_organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  label VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_organization_id, child_organization_id)
);
```

### 7.2 Agentes AI

```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  avatar_initials VARCHAR(5),
  system_prompt TEXT NOT NULL,
  llm_provider VARCHAR(50) NOT NULL,
  llm_model VARCHAR(100) NOT NULL,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1024,
  context_window_messages INTEGER DEFAULT 15,
  status VARCHAR(50) DEFAULT 'draft',
  channels JSONB DEFAULT '[]',
  message_buffer_seconds INTEGER DEFAULT 5,
  variables JSONB DEFAULT '[]',
  web_config JSONB DEFAULT '{"primary_color":"#25D366","avatar_url":null,"welcome_message":"Hello! How can I help you?","position":"bottom-right","bubble_text":"Chat with us"}',
  whatsapp_config JSONB DEFAULT '{"phone_number_id":null,"waba_id":null,"access_token_encrypted":null,"verify_token":null,"connected":false}',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Variables format example:
-- [{"name":"nombre","type":"string","required":true,"description":"Full name"},
--  {"name":"servicio","type":"enum","required":true,"options":["seo","ads","social"],"description":"Service interest"}]

CREATE TABLE agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  system_prompt TEXT NOT NULL,
  llm_provider VARCHAR(50) NOT NULL,
  llm_model VARCHAR(100) NOT NULL,
  temperature DECIMAL(3,2),
  max_tokens INTEGER,
  context_window_messages INTEGER,
  variables JSONB,
  tools JSONB,
  published_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, version)
);

CREATE TABLE agent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  system_prompt TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  tools JSONB DEFAULT '[]',
  language VARCHAR(10) DEFAULT 'en',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.3 Herramientas del Agente

```sql
CREATE TABLE agent_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Config por tipo:

**SCHEDULING:**
```json
{"calendar_id":"uuid","tool_functions":[{"name":"check_availability","description":"Check available time slots","parameters":{"date":{"type":"string","description":"Date YYYY-MM-DD"}}},{"name":"book_appointment","description":"Book appointment","parameters":{"date":{"type":"string"},"time":{"type":"string"},"name":{"type":"string"},"email":{"type":"string"}}}]}
```

**CUSTOM FUNCTION (ej: consultar cedula):**
```json
{"function_name":"consultar_cedula","description":"Consulta info del cliente por cedula","parameters":{"type":"object","properties":{"cedula":{"type":"string","description":"Numero de cedula"}},"required":["cedula"]},"endpoint_url":"https://api-del-cliente.com/consultar","method":"POST","headers":{"Content-Type":"application/json"},"auth":{"type":"bearer","token_encrypted":"encrypted_value"},"body_template":{"documento":"{{cedula}}"},"response_mapping":{"path":"data.cliente","format":"Nombre: {{nombre}}, Email: {{email}}"},"timeout_ms":10000}
```

Flujo Custom Function:
1. Usuario configura funcion en dashboard (endpoint, params, auth, body template)
2. Agente recibe mensaje ("Mi cedula es 1234567890")
3. LLM llama tool consultar_cedula({ cedula: "1234567890" })
4. Backend: reemplaza variables en body_template, HTTP request al endpoint, aplica response_mapping, retorna al LLM como tool_result
5. LLM formula respuesta natural con la info obtenida

**MCP:**
```json
{"server_url":"https://mcp.example.com/sse","transport":"sse","name":"my-mcp","selected_tools":["tool1","tool2"]}
```

**RAG:** No es tool_call visible. Backend busca chunks antes de enviar al LLM e inyecta como contexto.

**WEB SCRAPING:** Se indexa como RAG. Contenido scrapeado -> chunks -> embeddings.

### 7.4 Sistema de Variables (Captura Inteligente)

```
FLUJO COMPLETO:

1. CONFIGURACION: Usuario define variables en el editor del agente

2. INYECCION EN SYSTEM PROMPT: GenSmart agrega automaticamente al final del prompt:
   "During the conversation, capture these variables naturally:
    - nombre (string, REQUIRED): Full name
    - servicio (enum: seo/ads, REQUIRED): Service interest
    When captured, call tool capture_variable({ variable_name, variable_value })"

3. HERRAMIENTA INTERNA capture_variable:
   - Registrada como tool para el LLM pero invisible al usuario final
   - Backend intercepta el tool_call
   - Almacena en conversations.captured_variables (JSONB)

4. SINCRONIZACION CON CRM:
   - Campos base (name, phone, email) -> columnas del contacto
   - Variables custom -> contacts.custom_variables (JSONB)
   - Actualizacion inmediata al capturar

5. VISUALIZACION:
   - Chat view: sidebar con variables capturadas en real-time
   - CRM: columnas dinamicas
   - Funnel: variables en cards del kanban
```

### 7.5 Knowledge Base / RAG

```sql
CREATE TABLE knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  source_url TEXT,
  file_path TEXT,
  file_size INTEGER,
  status VARCHAR(50) DEFAULT 'processing',
  error_message TEXT,
  chunk_count INTEGER DEFAULT 0,
  last_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES knowledge_files(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chunks_agent ON knowledge_chunks(agent_id);
```

### 7.6 Conversaciones y Mensajes

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  channel VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  taken_over_by UUID REFERENCES users(id),
  taken_over_at TIMESTAMPTZ,
  channel_metadata JSONB DEFAULT '{}',
  ai_summary TEXT,
  ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 10),
  captured_variables JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_conversations_agent ON conversations(agent_id, last_message_at DESC);
CREATE INDEX idx_conversations_org ON conversations(organization_id);
```

### 7.7 CRM (Contactos)

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  avatar_url TEXT,
  ai_summary TEXT,
  ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 10),
  ai_service VARCHAR(255),
  funnel_stage VARCHAR(50) DEFAULT 'lead',
  funnel_updated_at TIMESTAMPTZ,
  custom_variables JSONB DEFAULT '{}',
  source_channel VARCHAR(50),
  tags JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contacts_org ON contacts(organization_id);
CREATE INDEX idx_contacts_funnel ON contacts(organization_id, funnel_stage);
CREATE INDEX idx_contacts_score ON contacts(organization_id, ai_score DESC);
CREATE INDEX idx_contacts_custom_vars ON contacts USING GIN(custom_variables);
```

### 7.8 Calendario y Citas

```sql
CREATE TABLE calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  timezone VARCHAR(100) DEFAULT 'UTC',
  available_days INTEGER[] DEFAULT '{1,2,3,4,5}',
  available_hours JSONB DEFAULT '{"start":"09:00","end":"17:00"}',
  slot_duration INTEGER DEFAULT 30,
  buffer_minutes INTEGER DEFAULT 15,
  max_advance_days INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID REFERENCES calendars(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  conversation_id UUID REFERENCES conversations(id),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255),
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) DEFAULT 'scheduled',
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_appointments_calendar ON appointments(calendar_id, start_time);
CREATE INDEX idx_appointments_org ON appointments(organization_id, start_time);
```

### 7.9 Billing, Usage, Notifications, GDPR

```sql
CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_event_id VARCHAR(255) UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  amount INTEGER,
  currency VARCHAR(10) DEFAULT 'usd',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  metric VARCHAR(100) NOT NULL,
  value INTEGER NOT NULL,
  period DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_usage_org_period ON usage_logs(organization_id, period);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);

CREATE TABLE data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending',
  file_path TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. API Endpoints (Express.js 5)

### Auth (Custom)
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/verify-email
POST   /api/auth/2fa/setup
POST   /api/auth/2fa/enable
POST   /api/auth/2fa/disable
POST   /api/auth/2fa/verify
```

### Organization & Sub-accounts
```
GET|PUT  /api/organization
GET      /api/organization/members
POST     /api/organization/members/invite
PUT      /api/organization/members/:id/role
DELETE   /api/organization/members/:id
GET|POST|PUT|DELETE /api/sub-accounts
POST     /api/sub-accounts/:id/switch
```

### Agents
```
GET|POST      /api/agents
GET|PUT|DELETE /api/agents/:id
POST    /api/agents/:id/publish
GET     /api/agents/:id/versions
POST    /api/agents/:id/rollback/:vId
POST    /api/agents/:id/avatar
GET     /api/agents/templates
POST    /api/agents/from-template/:tId
POST    /api/agents/generate-prompt
GET|POST|PUT|DELETE /api/agents/:id/tools
POST    /api/agents/:id/tools/:tId/test
POST    /api/agents/:id/preview
GET     /api/agents/:id/snippet
POST    /api/agents/:id/knowledge
POST    /api/agents/:id/knowledge/web
GET     /api/agents/:id/knowledge
DELETE  /api/agents/:id/knowledge/:fId
POST    /api/agents/:id/knowledge/:fId/reprocess
```

### Conversations
```
GET     /api/conversations
GET     /api/conversations/:id
POST    /api/conversations/:id/takeover
POST    /api/conversations/:id/release
POST    /api/conversations/:id/message
PUT     /api/conversations/:id/close
```

### CRM (Contacts)
```
GET     /api/contacts
GET     /api/contacts/:id
PUT     /api/contacts/:id
PUT     /api/contacts/:id/stage
DELETE  /api/contacts/:id
GET     /api/contacts/:id/conversations
GET     /api/contacts/:id/timeline
POST    /api/contacts/export
```

### Funnel
```
GET     /api/funnel
GET     /api/funnel/stats
PUT     /api/funnel/move
```

### Calendar
```
GET|POST|PUT|DELETE /api/calendars
GET|PUT|DELETE /api/appointments
GET     /api/appointments/available-slots
```

### Billing
```
POST    /api/billing/create-checkout
POST    /api/billing/create-portal
GET     /api/billing/subscription
GET     /api/billing/invoices
GET     /api/billing/usage
POST    /api/billing/webhook
```

### WhatsApp
```
GET     /api/whatsapp/webhook          (Meta verification)
POST    /api/whatsapp/webhook          (receive messages)
POST    /api/whatsapp/connect
POST    /api/whatsapp/embedded-signup
GET     /api/whatsapp/status/:agentId
```

### Widget Web (Publico, CORS abierto)
```
GET     /api/widget/:agentId/config
POST    /api/widget/:agentId/session
POST    /api/widget/:agentId/message
GET     /api/widget/:agentId/messages
```

### Notifications
```
GET     /api/notifications
PUT     /api/notifications/:id/read
PUT     /api/notifications/read-all
GET     /api/notifications/unread-count
```

### Dashboard Analytics
```
GET     /api/dashboard/stats
GET     /api/dashboard/leads-chart
GET     /api/dashboard/top-agents
GET     /api/dashboard/funnel-overview
```

### GDPR / Account
```
POST    /api/account/export-data
GET     /api/account/export-data/:id
POST    /api/account/delete
POST    /api/account/delete/cancel
POST    /api/account/delete/confirm
```

### Mobile (Solo agentes Web)
```
POST    /api/mobile/auth/qr-generate
POST    /api/mobile/auth/qr-verify
POST    /api/mobile/auth/login
GET     /api/mobile/agents
GET     /api/mobile/conversations/:agentId
GET     /api/mobile/conversations/:id/messages
POST    /api/mobile/conversations/:id/takeover
POST    /api/mobile/conversations/:id/release
POST    /api/mobile/conversations/:id/message
GET     /api/mobile/notifications
```

---

## 9. Features Detallados

### 9.1 Message Buffer (Agregacion de Mensajes)
Agrupa mensajes rapidos antes de enviar al LLM. Redis list + BullMQ delayed job. Configurable por agente (default 5s). Cuando timer expira: concatena mensajes, carga contexto (prompt + variable instructions + RAG + history within context window limit), llama LLM, guarda respuesta, envia al canal, incrementa contador de uso.

### 9.2 Human Takeover
Humano toma control -> conversation.status='human_takeover' -> message worker pausa -> humano escribe -> release -> agente retoma con summary de la intervencion como contexto.

### 9.3 AI Prompt Generator
Usuario describe agente en lenguaje natural -> LLM genera system prompt + variables sugeridas + herramientas sugeridas -> usuario edita y aplica.

### 9.4 Preview/Sandbox
Chat de prueba en el editor. Usa prompt draft (no publicado). Incluye herramientas. No afecta contadores. Muestra metadata (tokens, tools, latencia). Boton Reset para limpiar. Boton Publish cuando satisfecho.

### 9.5 WhatsApp Onboarding
Opcion 1 (recomendada): Embedded Signup - Facebook Login SDK abre modal, usuario autoriza, Meta retorna credenciales, GenSmart guarda automaticamente.
Opcion 2 (fallback): Guia paso a paso con screenshots y documentacion detallada en /docs/whatsapp-setup.

### 9.6 Avatar de Agentes
Upload PNG/JPG (max 2MB, resize 200x200). Fallback: iniciales con color basado en hash del nombre. Se usa en: lista de agentes, widget, conversaciones, CRM.

### 9.7 Notificaciones
In-app (bell icon): Lead score >= 8, takeover needed, plan al 80%/100%.
Email: Lead score >= 8, plan al 90%, plan cancelado, invitacion aceptada.
Implementacion: tabla notifications, WebSocket para real-time badge, email via Nodemailer.

### 9.8 Dashboard Home (Analytics)
KPIs: Leads (day/week/month con % cambio), Active Conversations, Avg Lead Score, Messages Used/Limit (progress bar).
Charts: Leads Over Time (7d/30d/90d line chart), Funnel Overview (horizontal bar con % conversion).
Tables: Top Agents by Conversations, Recent High-Score Leads.

---

## 10. Monetizacion y Planes

| Feature | Free (forever) | Starter ($29/mo) | Pro ($79/mo) | Enterprise ($199/mo) |
|---------|---------------|-------------------|--------------|---------------------|
| Agentes | 1 | 3 | 10 | Ilimitados |
| Mensajes/mes | 50 | 1,000 | 5,000 | 25,000 |
| Contactos | 25 | 500 | 2,000 | Ilimitados |
| Canales | Web only | Web + WhatsApp | Web + WhatsApp | Web + WhatsApp |
| Knowledge base | 1 archivo | 5 archivos | 20 archivos | Ilimitados |
| Custom functions | No | 2 | 10 | Ilimitados |
| MCP servers | No | No | 3 | Ilimitados |
| Sub-cuentas | No | No | 5 | Ilimitados |
| Human takeover | No | Si | Si | Si |
| Modelos LLM | GPT-4o-mini | GPT-4o-mini + Haiku | Todos | Todos |
| Context window | 10 msgs | 15 msgs | 25 msgs | 50 msgs |
| Max tokens/resp | 512 | 1,024 | 2,048 | 4,096 |
| BYO API Key | No | No | No | Si (sin limite msgs) |
| Soporte | Community | Email | Priority | Dedicado |
| Descuento trimestral | - | 10% | 10% | 10% |
| Descuento anual | - | 20% | 20% | 20% |

### Estrategia de Control de Costos de Tokens

1. **Mensajes/mes** (limite principal visible al usuario): Contador en Redis usage:{org_id}:{YYYY-MM}:messages. 80% -> notificacion. 100% -> agente pausa. Reset dia 1.
2. **Modelo LLM por plan**: Free/Starter usa modelos baratos (~$0.00026/msg). Pro/Enterprise modelos capaces.
3. **Context window**: Solo ultimos N mensajes al LLM. Reduce tokens de input dramaticamente.
4. **Max tokens/respuesta**: Tope por plan, configurable dentro del limite.
5. **BYO Key (Enterprise)**: Usuario usa su API key -> sin limite de mensajes -> GenSmart cobra solo plataforma.
6. **Add-on mensajes extra**: 500 msgs $10, 2000 msgs $30, 5000 msgs $60 (one-time, no acumulable).

---

## 11. GDPR y Data Management

- Exportar datos: Worker genera ZIP (org data, contactos CSV, conversaciones JSON, agentes JSON). Link descarga expira 7 dias.
- Eliminar cuenta: 30 dias gracia, eliminacion permanente. Cancelar Stripe inmediato. Opcion confirmar eliminacion inmediata.
- Eliminar contacto: Hard delete del contacto y conversaciones asociadas.

---

## 12. Seguridad

Custom JWT (access memory + refresh httpOnly cookie), 2FA TOTP + backup codes, bcrypt 12 rounds, refresh token rotation con deteccion de reuso, rate limiting por IP y org, Zod validation, queries parametrizados, CSP headers, CORS configurado, AES-256 para secrets, PostgreSQL RLS, webhook signature verification (Meta + Stripe), widget rate limiting (30 msgs/sesion, CAPTCHA invisible, bloqueo por IP).

---

## 13. Infraestructura AWS Lightsail

Instancia unica siempre. Plan inicial $40/mes (4GB RAM, 2 vCPUs). Ubuntu 22.04, Nginx, PM2, PostgreSQL 16 + pgvector, Redis 7, Node.js 20 LTS.

DNS: gensmart.ai (landing), app.gensmart.ai (dashboard), api.gensmart.ai (API).

Procesos PM2: next-app, express-api, worker-messages, worker-rag, worker-scoring, worker-scraping.

Backups: pg_dump diario (cron), Lightsail snapshot semanal, retencion 30 dias.

Escalar vertical: $40 -> $80 (8GB) -> $160 (16GB) cuando necesario.

---

## 14. i18n

Ingles (default) + Espanol. Archivos JSON (/i18n/en.json, /i18n/es.json). Hook useTranslation(). Cambio en settings. Landing detecta idioma browser. Fechas/numeros por locale.

---

## 15. App Movil (React Native Expo — Solo Agentes Web)

EXCLUSIVAMENTE para conversaciones de agentes Web (NO WhatsApp).

Funcionalidades:
1. Login: QR scan desde dashboard o email+password
2. Lista de agentes Web (solo canal web activo)
3. Conversaciones por agente con filtros
4. Chat view + human takeover desde movil
5. Settings: logout, idioma

---

## 16. Estructura del Proyecto

```
gensmart/
├── apps/
│   ├── web/                          # Next.js 16
│   │   ├── app/
│   │   │   ├── (public)/            # Landing, pricing, blog
│   │   │   ├── (auth)/             # Login, register, forgot/reset password
│   │   │   ├── (dashboard)/        # Dashboard protegido
│   │   │   │   ├── agents/
│   │   │   │   ├── conversations/
│   │   │   │   ├── contacts/
│   │   │   │   ├── funnel/
│   │   │   │   ├── calendar/
│   │   │   │   ├── billing/
│   │   │   │   ├── settings/       # general, team, sub-accounts, security, data(GDPR)
│   │   │   │   └── page.tsx        # Dashboard home (analytics)
│   │   │   └── widget/[agentId]/   # Widget mini-app (iframe)
│   │   ├── components/
│   │   │   ├── ui/                 # Button, Input, Modal, Card, Badge, Table, Dropdown,
│   │   │   │                       # Toast, Tabs, Avatar, Spinner, EmptyState, SearchInput,
│   │   │   │                       # ProgressBar, Toggle, Tooltip, Skeleton, ColorPicker
│   │   │   ├── layout/            # Sidebar, Header (NotificationBell), PublicNavbar, Footer
│   │   │   ├── landing/           # Hero, Features, HowItWorks, Pricing, Testimonials, FAQ
│   │   │   ├── agents/            # AgentCard, AgentEditor, PromptEditor, VariablesEditor,
│   │   │   │                       # ToolConfigurator, CustomFunctionBuilder, PreviewChat,
│   │   │   │                       # ChannelConfig, WidgetCustomizer, PromptGenerator, AvatarUploader
│   │   │   ├── conversations/     # ConversationList, ChatView, TakeoverBanner, VariablesSidebar
│   │   │   ├── crm/              # ContactList, ContactDetail, ScoreBadge, Timeline
│   │   │   ├── funnel/           # KanbanBoard, FunnelStats
│   │   │   ├── calendar/         # CalendarView
│   │   │   ├── billing/          # PlanCard, UsageBar, InvoiceTable
│   │   │   ├── notifications/    # NotificationBell, NotificationList
│   │   │   └── dashboard/        # StatsCards, LeadsChart, FunnelOverview, TopAgents
│   │   ├── contexts/             # AuthContext, OrgContext, NotificationContext
│   │   ├── hooks/                # useAuth, useAgent, useConversations, useContacts,
│   │   │                          # useWebSocket, useNotifications, useTranslation
│   │   ├── lib/                  # api.ts, constants, utils, plan-limits
│   │   ├── i18n/                 # en.json, es.json
│   │   ├── content/blog/         # Markdown blog posts
│   │   └── public/               # widget.js, images, favicon, robots.txt, sitemap.xml
│   │
│   ├── api/                      # Express.js 5
│   │   └── src/
│   │       ├── config/           # database, redis, stripe, encryption, env
│   │       ├── middleware/       # auth(custom JWT), orgContext, planLimits, rateLimiter, errorHandler, validate
│   │       ├── routes/           # auth, agents, conversations, contacts, funnel, calendar,
│   │       │                      # billing, whatsapp, widget, mobile, knowledge, organization,
│   │       │                      # notifications, dashboard, account(GDPR)
│   │       ├── services/         # auth, agent, llm, conversation, message-buffer, variable-capture,
│   │       │                      # whatsapp, rag, embedding, scraping, ai-scoring, calendar,
│   │       │                      # stripe, email, notification, usage, mcp-client,
│   │       │                      # custom-function, data-export
│   │       ├── workers/          # message, rag, scraping, scoring, export(GDPR)
│   │       ├── db/               # migrations, seeds, queries
│   │       └── types/
│   │
│   └── mobile/                   # React Native (Expo) — SOLO agentes Web
│       ├── app/                  # login, agents, conversations, chat/[id], qr-scanner, settings
│       ├── components/
│       ├── hooks/
│       └── lib/
│
├── packages/shared/              # types, constants (plan-limits), validators (Zod)
├── infra/                        # docker-compose.yml, nginx/gensmart.conf, scripts/(setup,deploy,backup)
├── .env.example
├── package.json                  # Monorepo (npm workspaces)
├── turbo.json
└── README.md
```

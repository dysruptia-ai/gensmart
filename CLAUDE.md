# GenSmart — Reglas del Proyecto

## Documentación
- Lee `spec.md` para la especificación técnica completa
- Lee `dev-plan.md` para el plan de desarrollo en 12 fases
- Estos son la fuente de verdad. Siempre referirse a ellos.

## Stack
- Monorepo: npm workspaces + Turborepo
- Frontend: Next.js 16 (App Router) — puerto 3000
- Backend: Express.js 5 — puerto 4000
- Base de datos: PostgreSQL 16 + pgvector
- Cache/Colas: Redis + BullMQ
- Shared: packages/shared (tipos, constantes, validadores Zod)
- Auth: Custom JWT desde cero (NO NextAuth, NO Passport)
- Mobile: React Native (Expo) — solo agentes Web

## Reglas de Código
- TypeScript estricto en todo — nunca `any`
- CSS Modules para TODOS los estilos (NUNCA Tailwind, styled-components, ni inline styles excepto valores dinámicos mínimos)
- lucide-react para TODOS los iconos (NUNCA emojis, NUNCA otros icon packs)
- Tipografía: Inter (Google Fonts)
- Zod para validación en frontend y backend
- Queries SQL parametrizadas (nunca string concatenation)
- Interfaces/types para todos los props y responses

## Paleta de Colores (usar variables CSS)
- --color-primary: #25D366 (Verde WhatsApp — CTAs, estados activos)
- --color-primary-dark: #128C7E (hover, bordes activos)
- --color-primary-light: #DCF8C6 (backgrounds mensajes)
- --color-bg-main: #FAF8F5 (fondo principal dashboard)
- --color-bg-card: #FFFFFF (tarjetas, modales, inputs)
- --color-bg-sidebar: #F5F0EB (sidebar, áreas secundarias)
- --color-text-primary: #1A1A1A
- --color-text-secondary: #6B7280
- --color-border: #E5E0DB
- --color-danger: #EF4444
- --color-warning: #F59E0B
- --color-success: #10B981
- --color-info: #3B82F6

## Estructura del Monorepo
```
gensmart/
├── apps/web/          # Next.js 16 (frontend + landing + widget)
├── apps/api/          # Express.js 5 (API + workers)
├── apps/mobile/       # React Native Expo (post-MVP)
├── packages/shared/   # Tipos, constantes (PLAN_LIMITS), validadores Zod
├── infra/             # docker-compose, nginx, scripts
├── spec.md            # Especificación técnica
├── dev-plan.md        # Plan de desarrollo
└── CLAUDE.md          # Este archivo
```

## Convenciones
- Componentes React: PascalCase, un componente por archivo
- CSS Modules: ComponentName.module.css junto al componente
- API routes: kebab-case (/api/agent-tools)
- DB migrations: ###_description.sql (node-pg-migrate)
- Idiomas: en (default) + es — archivos en /i18n/
- Variables de entorno: UPPER_SNAKE_CASE
- Git commits: conventional commits (feat:, fix:, refactor:, chore:)

## Auth (Custom JWT)
- Access token: en memoria JS (NUNCA localStorage)
- Refresh token: httpOnly secure cookie con rotación
- 2FA: TOTP con speakeasy + backup codes
- Middleware: auth.ts verifica JWT → orgContext.ts inyecta org → planLimits.ts verifica límites

## Base de Datos
- Multi-tenant: organization_id en todas las tablas relevantes
- UUIDs como primary keys (gen_random_uuid())
- TIMESTAMPTZ para fechas (nunca TIMESTAMP)
- JSONB para datos flexibles (variables, config, settings)
- Índices según spec.md sección 7

## Testing
- Verificar que cada tarea funciona antes de avanzar
- Git commit al final de cada sub-fase
- Si algo falla, arreglar antes de continuar

## Qué NO hacer
- NO usar NextAuth, Passport, ni auth de terceros
- NO usar Tailwind, styled-components, ni CSS-in-JS
- NO usar emojis como iconos
- NO usar localStorage para tokens
- NO crear archivos vacíos sin propósito
- NO dejar errores para después
- NO instalar dependencias innecesarias

# GenSmart — Checkpoint Post-Fase 2

> **Fecha:** 2026-02-24
> **Estado:** FASE 0 ✓ + FASE 1 ✓ + FASE 2 ✓ + BUGFIXES ✓ — Pruebas E2E en curso
> **Próxima fase:** Fase 3 — Agentes AI Core
> **Pruebas E2E:** En progreso (Fase 1 parcial + Fase 2 pendiente)

---

## Fase 2 — Completada ✓

### Commits realizados:
```
3e6847c  feat: Phase 2.3 - Blog system with markdown, SSG, 3 posts, blog preview on landing
468e53f  feat: Phase 2.2 - Pricing page with plan comparison, toggle, feature table, add-ons
56c10f3  feat: Phase 2.1 - Landing page with all 13 sections, PublicNavbar, Footer, SEO
[fix]    fix: resolve login redirect loop + migrate middleware to proxy (Next.js 16)
[fix]    fix: auth cookie path for proxy access + registration UX toast
[fix]    fix: landing visual fixes (logo size, pricing keys, HowItWorks z-index, placeholder pages)
```

### Sub-fase 2.1 — Landing Page ✓
- **PublicNavbar**: sticky + backdrop blur on scroll, mobile hamburger slide-in, Logo + nav links + auth CTAs
- **Footer**: 4 columns (Product/Company/Legal/Connect), dark bg, language selector, copyright
- **(public)/layout.tsx**: wraps pricing & blog with Navbar+Footer
- **Landing page** at `app/page.tsx` with all 13 sections:
  - HeroSection — headline, 2 CTAs, CSS dashboard mockup (agents + live chat preview)
  - SocialProofBar — infinite scroll animation with 6 logo placeholders
  - ProblemSolution — "Old Way" vs "GenSmart Way" side-by-side cards
  - FeaturesGrid — 2×4 grid, hover elevation, lucide icons
  - HowItWorks — 4-step flow with connecting line, numbered icons
  - ChannelsSection — WhatsApp CSS mockup (green bubbles) + Web Widget CSS mockup
  - CRMPreview — CSS table with score badges + 3-column kanban
  - PricingSection — monthly/yearly toggle, 4 plan cards, Pro highlighted
  - TestimonialsSection — 3 blockquote cards with Avatar component
  - BlogPreview — 3 post cards linked to real blog posts
  - FAQ — 10-question accordion, single-open, smooth height animation
  - FinalCTA — green background, white CTA button
- **useScrollReveal** hook — Intersection Observer, no dependencies
- **ScrollReveal** wrapper — fade-up animation, configurable delay
- **sitemap.ts** — Next.js sitemap generation (static + blog routes)
- **robots.txt** — allows /, disallows /dashboard, /api
- **SEO**: metadata export + JSON-LD (Organization + SoftwareApplication), OpenGraph, Twitter cards

### Sub-fase 2.2 — Pricing Page ✓
- Monthly / Quarterly (10% off) / Yearly (20% off) toggle
- 4 plan cards with Pro "Most Popular" highlight
- Full feature comparison table grouped by Core / Channels / AI / CRM & Advanced
- Add-ons section (500/$10, 2k/$30, 5k/$60)
- 4-question FAQ accordion

### Sub-fase 2.3 — Blog ✓
- `lib/blog.ts`: getAllPosts(), getPostBySlug(), getAllSlugs() using gray-matter + marked
- 3 real blog posts (markdown) in `content/blog/`
- `/blog` — grid list with tags, dates, cover gradients
- `/blog/[slug]` — SSG with generateStaticParams, full prose CSS for markdown rendering
- Dynamic generateMetadata with OG + Twitter + canonical + JSON-LD BlogPosting

---

## Bugfixes Aplicados Post-Fase 2 ✓

### BF-001: Login redirect loop infinito (CRÍTICO)
- **Causa**: AuthProvider en root layout hacía `api.post('/api/auth/refresh')` en TODAS las páginas. Al fallar en páginas públicas, `api.ts` redirigía a `/login` → loop infinito.
- **Fix**: En `apps/web/lib/api.ts`, el redirect a /login ahora solo ocurre si `window.location.pathname.startsWith('/dashboard')`. Páginas públicas fallan silenciosamente.

### BF-002: Migración middleware.ts → proxy.ts (Next.js 16)
- **Causa**: Next.js 16 deprecó `middleware` en favor de `proxy`. Warning en cada request.
- **Fix**: Renombrado `apps/web/middleware.ts` → `apps/web/proxy.ts`. Export cambiado de `function middleware()` a `function proxy()`. Misma lógica de auth check para /dashboard/*.

### BF-003: Cookie refresh_token con path incorrecto (CRÍTICO)
- **Causa**: `setRefreshCookie()` usaba `path: '/api/auth'`. El proxy.ts en Next.js (localhost:3000) buscaba `req.cookies.get('refresh_token')` pero la cookie nunca llegaba al proxy porque el path la restringía a /api/auth/*.
- **Fix**: Cambiado `path: '/'` y `sameSite: 'lax'` en `apps/api/src/routes/auth.ts`. También actualizado `clearCookie` en logout. Cookie sigue siendo httpOnly + secure (en prod).

### BF-004: Registro no redirige a /dashboard
- **Causa**: Consecuencia de BF-003 (cookie no visible para proxy). Además faltaba feedback UX.
- **Fix**: Resuelto automáticamente por BF-003. Agregado toast "Account created successfully!" en register/page.tsx.

### BF-005: Logo pequeño en PublicNavbar
- **Fix**: Aumentado tamaño del Logo en PublicNavbar.

### BF-006: Key prop faltante en PricingPage
- **Fix**: Agregado key único a todos los .map() en pricing page.

### BF-007: HowItWorks badges detrás de cards
- **Fix**: Agregado z-index a step badges para que aparezcan por encima de las cards.

### BF-008: Páginas placeholder para links del Footer
- **Fix**: Creadas páginas placeholder para Legal (privacy-policy, terms-of-service, cookie-policy), About y Contact con mensaje "Coming soon".

---

## Resultados E2E Parciales (en progreso)

### Fase 1 — Registro ✓
| Test | Estado |
|------|--------|
| Página carga sin errores | ✅ |
| Campos: name, email, password | ✅ |
| Validación email inválido | ✅ |
| Validación password corta | ✅ |
| Registro exitoso → redirige a /dashboard | ✅ (post-fix BF-003/004) |
| Email duplicado → error | ✅ |
| Logo visible | ✅ |
| Link a /login | ✅ |

### Fase 1 — Login ✓
| Test | Estado |
|------|--------|
| Página carga sin errores | ✅ |
| Credenciales incorrectas → error | ✅ |
| Credenciales correctas → redirige a /dashboard | ✅ (post-fix BF-003) |
| Logo visible | ✅ |
| Link a /register | ✅ |
| Link a /forgot-password | ✅ |

### Fase 1 — Restantes (pendiente de verificar)
- Sesión/Tokens (F5 refresh, localStorage check, cookie check)
- Logout
- Forgot/Reset Password
- Dashboard Layout
- Settings (General, Team, Sub-accounts, Security/2FA)

### Fase 2 — Pendiente de verificar completo
- Landing Page secciones e interactividad
- Pricing Page toggle y cálculos
- Blog pages
- SEO (meta tags, sitemap, robots.txt)
- Mobile responsive

---

## Resumen Acumulado del Proyecto

### Fase 0 ✓
- Monorepo npm workspaces + Turborepo
- Next.js 16 App Router + Express 5
- PostgreSQL 16 + pgvector (23 tablas, 47 índices, 6 seeds)
- 18 componentes UI con CSS Modules
- Design system verificado en /design-system

### Fase 1 ✓
- Auth custom completo (JWT + 2FA TOTP + refresh rotation + reuse detection)
- Access token en memoria, refresh token en httpOnly cookie (path: /)
- AuthContext con auto-refresh y restauración silenciosa
- Dashboard layout (sidebar + header + auth guard)
- Organization CRUD + members + sub-accounts
- Settings pages (general, team, sub-accounts, security)
- RLS en 8 tablas
- Logo component (Handjet Bold 700, bicolor)

### Fase 2 ✓
- Landing page con 13 secciones (CSS Modules, lucide-react, scroll reveal)
- Pricing page con toggle Monthly/Quarterly/Yearly + descuentos + feature comparison
- Blog con markdown SSG (3 posts, gray-matter + marked)
- SEO completo (metadata, JSON-LD, sitemap.ts, robots.txt, OG, Twitter cards)
- PublicNavbar (sticky + blur + mobile hamburger) + Footer (4 columns + dark bg)
- Placeholder pages (Legal, About, Contact)

### Bugfixes ✓
- proxy.ts migración (Next.js 16)
- Cookie path fix (/ en vez de /api/auth)
- Login/Register redirect fix
- Landing visual fixes (logo, z-index, keys)

---

## Arquitectura Auth Actual (Post-fixes)

```
REGISTRO → bcrypt hash → create org + user → JWT tokens → cookie path=/ → redirect /dashboard + toast
LOGIN → validate → if 2FA → temp_token → verify TOTP → JWT tokens → cookie path=/
        → if no 2FA → JWT tokens → cookie path=/ → redirect /dashboard
REFRESH → validate cookie (path=/) → check reuse → rotate token → new access token
LOGOUT → invalidate refresh token → clear cookie (path=/) → redirect /login

Access Token: memoria JS (15min) | Refresh Token: httpOnly cookie path=/ sameSite=lax (7d)
Proxy (proxy.ts): verifica cookie refresh_token para /dashboard/* rutas
Páginas públicas: auth falla silenciosamente, no redirige
```

---

## Archivos Clave Modificados/Creados en Fase 2

```
apps/web/
  proxy.ts (antes middleware.ts)
  app/page.tsx (landing con 13 secciones)
  app/(public)/layout.tsx (PublicNavbar + Footer wrapper)
  app/(public)/pricing/page.tsx
  app/(public)/blog/page.tsx
  app/(public)/blog/[slug]/page.tsx
  app/(public)/legal/[slug]/page.tsx (placeholder)
  app/(public)/about/page.tsx (placeholder)
  app/(public)/contact/page.tsx (placeholder)
  app/sitemap.ts
  public/robots.txt
  lib/blog.ts
  content/blog/how-to-deploy-whatsapp-ai-agent.md
  content/blog/ai-lead-scoring-explained.md
  content/blog/n8n-vs-gensmart-comparison.md
  components/layout/PublicNavbar/
  components/layout/Footer/
  components/landing/HeroSection, SocialProofBar, ProblemSolution, FeaturesGrid,
    HowItWorks, ChannelsSection, CRMPreview, PricingSection, TestimonialsSection,
    BlogPreview, FAQ, FinalCTA, ScrollReveal
  hooks/useScrollReveal.ts

apps/api/src/
  routes/auth.ts (cookie path fix)
```

---

## Decisiones Tomadas en Fase 2

1. **Landing fuera de (public) group**: `app/page.tsx` renderiza landing directamente con PublicNavbar+Footer inline (no dentro del layout público). Las demás páginas públicas (/pricing, /blog) sí usan el (public) layout.
2. **proxy.ts**: Migrado desde middleware.ts por deprecación en Next.js 16. Misma funcionalidad.
3. **Cookie path=/**: Necesario para que proxy.ts pueda leer la cookie. Seguridad mantenida con httpOnly + secure(prod) + sameSite=lax.
4. **sameSite=lax**: Cambiado de 'strict' a 'lax' para compatibilidad cross-origin en desarrollo.
5. **Placeholder pages**: Legal, About, Contact creadas como "Coming soon" para evitar links rotos en Footer.
6. **Blog SSG**: Usa gray-matter para frontmatter + marked para rendering markdown.

---

## Próxima Fase: FASE 3 — Agentes AI Core (Día 9-13)

### 3.1 CRUD de Agentes
- Backend: CRUD completo, versionado al publicar, rollback, plantillas
- Frontend: /agents grid, /agents/new wizard, /agents/[id] editor con tabs

### 3.2 Variables Editor
- Add/remove/reorder variables, tipos string/enum, preview de inyección

### 3.3 AI Prompt Generator
- Modal → textarea → "Generate with AI" → preview prompt + variables sugeridas

### 3.4 Herramientas del Agente
- CRUD tools, configurator por tipo (scheduling, RAG, custom, MCP)

### 3.5 LLM Service (Multi-provider)
- OpenAI + Anthropic adapters, unified tool calling, token tracking

### Prompt para nueva conversación:
```
Soy Genner, continuamos con GenSmart. Lee spec.md, dev-plan.md y el checkpoint adjunto.
Las Fases 0, 1 y 2 están completas (con bugfixes aplicados).
Pruebas E2E están en progreso — reportaré resultados pendientes.
Necesito el prompt para que Claude Code ejecute la Fase 3 completa (Agentes AI Core).
```
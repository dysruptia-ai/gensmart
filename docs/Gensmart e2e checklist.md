# GenSmart — Checklist de Pruebas E2E (Fase 1 + Fase 2)

> **Tester:** Genner (desarrollador humano)  
> **Fecha:** 2026-02-24  
> **Pre-requisitos:** `npm run dev` corriendo (Next.js en :3000, Express en :4000, PostgreSQL + Redis activos)  
> **Instrucciones:** Marca `[x]` cuando pase, `[!]` si falla. Anota bugs en la columna de notas.

---

## FASE 1 — Auth + Multi-tenancy + Settings

### 1.1 Registro (/register)

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 1 | Página /register carga sin errores en consola | [x ] | |
| 2 | Formulario muestra campos: name, email, password | [ x] | |
| 3 | Submit con email inválido → muestra error de validación | [ ] | |
| 4 | Submit con password corta (<8 chars) → muestra error | [ ] | |
| 5 | Submit con datos válidos → registro exitoso → redirige a /dashboard | [ ] | |
| 6 | Registrar mismo email de nuevo → muestra error "already exists" | [ ] | |
| 7 | Logo GenSmart visible en la página | [ ] | |
| 8 | Link "Already have an account? Log in" → navega a /login | [ ] | |

**Credenciales de prueba (guardar):**
- Name: Genner Puello
- Email: gennerp@yopmail.com
- Password: Gpt2026_*

### 1.2 Login (/login)

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 9 | Página /login carga sin errores | [ ] | |
| 10 | Login con credenciales incorrectas → muestra error | [ ] | |
| 11 | Login con credenciales correctas → redirige a /dashboard | [ ] | |
| 12 | Logo GenSmart visible | [ ] | |
| 13 | Link "Don't have an account? Sign up" → navega a /register | [ ] | |
| 14 | Link "Forgot password?" → navega a /forgot-password | [ ] | |

### 1.3 Sesión y Tokens

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 15 | Estando en /dashboard, F5 (refresh) → sesión se mantiene | [] | NO se mentiene me devuelve al /login|
| 16 | DevTools > Application > Local Storage → NO hay access token | [ ] | |
| 17 | DevTools > Application > Cookies → existe cookie refresh_token (httpOnly) | [ ] | |
| 18 | Abrir pestaña incógnito → ir a /dashboard → redirige a /login | [ ] | |

### 1.4 Logout

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 19 | Click en avatar/dropdown en header → opción Logout visible | [ ] | |
| 20 | Click Logout → redirige a /login | [ ] | |
| 21 | Tras logout, navegar manualmente a /dashboard → redirige a /login | [ ] | |
| 22 | Cookie refresh_token ya no existe en DevTools | [ ] | |

### 1.5 Forgot / Reset Password

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 23 | /forgot-password → formulario carga con campo email | [ ] | |
| 24 | Submit con email → no crashea (OK si SMTP no configurado) | [ ] | |
| 25 | /reset-password/fake-token → página carga (formulario visible) | [ ] | |

### 1.6 Dashboard Layout

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 26 | Sidebar visible con iconos lucide-react | [ ] | |
| 27 | Sidebar links: Agents, Conversations, Contacts, Funnel, Calendar, Billing, Settings | [ ] | |
| 28 | Header muestra avatar/nombre del usuario | [ ] | |
| 29 | Header dropdown: opciones visibles (Settings, Logout) | [ ] | |
| 30 | Logo GenSmart en sidebar | [ ] | |
| 31 | Sidebar responsive: se colapsa en viewport < 768px | [ ] | |

### 1.7 Settings — General (/dashboard/settings)

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 32 | Página settings carga con sidebar de navegación (General, Team, Sub-accounts, Security, Data) | [ ] | |
| 33 | General: muestra org name actual | [ ] | |
| 34 | Editar org name → Save → recargar → muestra nuevo nombre | [ ] | |
| 35 | Timezone selector visible y funcional | [ ] | |
| 36 | Language selector visible | [ ] | |

### 1.8 Settings — Team (/dashboard/settings/team)

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 37 | Lista miembros muestra al usuario actual con su rol | [ ] | |
| 38 | Botón "Invite Member" abre modal | [ ] | |
| 39 | Modal invite: campo email + role selector | [ ] | |
| 40 | Submit invite → no crashea (OK si no envía email real) | [ ] | |

### 1.9 Settings — Sub-accounts (/dashboard/settings/sub-accounts)

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 41 | Página carga (puede estar vacía si plan Free no permite sub-accounts) | [ ] | |
| 42 | Si hay botón "Create": click → formulario aparece | [ ] | |
| 43 | Si plan Free bloquea → muestra mensaje de upgrade | [ ] | |

### 1.10 Settings — Security / 2FA (/dashboard/settings/security)

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 44 | Página muestra estado 2FA: "Disabled" | [ ] | |
| 45 | Click "Enable 2FA" → muestra QR code | [ ] | |
| 46 | Escanear QR con Google Authenticator / Authy | [ ] | |
| 47 | Ingresar código TOTP → 2FA se habilita → muestra backup codes | [ ] | |
| 48 | Copiar/anotar al menos 1 backup code | [ ] | |
| 49 | Logout → Login → ahora pide código TOTP | [ ] | |
| 50 | Ingresar código TOTP correcto → accede al dashboard | [ ] | |
| 51 | Logout → Login → usar backup code en vez de TOTP → accede | [ ] | |
| 52 | Settings > Security → Disable 2FA → confirmar password → estado vuelve a "Disabled" | [ ] | |
| 53 | Logout → Login → ya NO pide TOTP → accede directo | [ ] | |

**Backup code usado:** _______________

### 1.11 Consola y Visual

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 54 | Console (F12): sin errores JS en ninguna página de Fase 1 | [ ] | |
| 55 | Solo iconos lucide-react, CERO emojis en UI | [ ] | |
| 56 | Solo CSS Modules (no hay clases Tailwind, no inline styles sueltos) | [ ] | |
| 57 | Colores respetan la paleta: verde #25D366, beige #FAF8F5, etc. | [ ] | |

---

## FASE 2 — Landing Page + Pricing + Blog

### 2.1 Layout Público

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 58 | Navegar a / (root) → carga landing page | [ ] | |
| 59 | PublicNavbar visible: Logo + links (Features, Pricing, Blog) + "Log In" + "Start Free" | [ ] | |
| 60 | Navbar sticky: al hacer scroll, navbar se queda fija arriba | [ ] | |
| 61 | Navbar blur: al scroll, tiene backdrop blur sutil | [ ] | |
| 62 | "Log In" → navega a /login | [ ] | |
| 63 | "Start Free" → navega a /register | [ ] | |
| 64 | Footer visible al final: 4 columnas, Logo, language selector, copyright 2026 | [ ] | |
| 65 | Footer links no están rotos (no 404) | [ ] | |
| 66 | Mobile (375px): hamburger menu aparece, slide-in panel funciona | [ ] | |

### 2.2 Landing — Secciones (verificar que cada sección existe y se ve bien)

| # | Sección | Existe | Se ve bien | Notas |
|---|---------|--------|------------|-------|
| 67 | HeroSection — headline, 2 CTAs, mockup dashboard CSS | [ ] | [ ] | |
| 68 | SocialProofBar — "Trusted by..." + logos con scroll infinito | [ ] | [ ] | |
| 69 | ProblemSolution — "Old Way" vs "GenSmart Way" | [ ] | [ ] | |
| 70 | FeaturesGrid — 8 features con iconos lucide | [ ] | [ ] | |
| 71 | HowItWorks — 4 pasos con línea conectora | [ ] | [ ] | |
| 72 | ChannelsSection — WhatsApp mockup + Web Widget mockup | [ ] | [ ] | |
| 73 | CRMPreview — tabla CRM + mini kanban | [ ] | [ ] | |
| 74 | PricingSection — 4 plans + toggle | [ ] | [ ] | |
| 75 | TestimonialsSection — 3 testimonial cards | [ ] | [ ] | |
| 76 | BlogPreview — 3 post cards | [ ] | [ ] | |
| 77 | FAQ — accordion 8-10 preguntas | [ ] | [ ] | |
| 78 | FinalCTA — fondo verde, botón blanco | [ ] | [ ] | |

### 2.3 Landing — Interactividad

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 79 | Scroll reveal: secciones hacen fade-up al aparecer en viewport | [ ] | |
| 80 | Feature cards: hover eleva con sombra | [ ] | |
| 81 | FAQ accordion: click abre/cierra, solo una abierta a la vez | [ ] | |
| 82 | Pricing toggle: Monthly ↔ Yearly cambia precios | [ ] | |
| 83 | Hero CTA "Start Free" → /register | [ ] | |
| 84 | Hero CTA "See How It Works" → scroll suave a HowItWorks | [ ] | |
| 85 | Final CTA "Start Free" → /register | [ ] | |
| 86 | Navbar links "Features" / "Pricing" hacen scroll o navegan correctamente | [ ] | |

### 2.4 Landing — Mockups CSS

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 87 | Hero mockup dashboard: son cards CSS (no imagen placeholder genérica) | [ ] | |
| 88 | Channels WhatsApp: burbujas verdes/blancas estilizadas con CSS | [ ] | |
| 89 | Channels Web Widget: bubble + panel de chat en CSS | [ ] | |
| 90 | CRM table: tabla estilizada con score badges de colores | [ ] | |
| 91 | CRM kanban: 3 columnas con cards ficticias | [ ] | |

### 2.5 Landing — Mobile Responsive

Redimensionar viewport a **375px de ancho** (o usar DevTools device mode):

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 92 | Navbar: hamburger visible, logo visible, no overflow | [ ] | |
| 93 | Hero: texto y CTA stack vertical, mockup debajo o hidden | [ ] | |
| 94 | Features grid: 1 columna | [ ] | |
| 95 | HowItWorks: pasos verticales | [ ] | |
| 96 | Channels: cards stack vertical | [ ] | |
| 97 | Pricing cards: stack vertical, scroll si necesario | [ ] | |
| 98 | FAQ: funciona correctamente en mobile | [ ] | |
| 99 | Footer: columnas stack vertical | [ ] | |
| 100 | No hay overflow horizontal en ninguna sección | [ ] | |

### 2.6 Pricing Page (/pricing)

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 101 | Página /pricing carga sin errores | [ ] | |
| 102 | Header: "Simple, Transparent Pricing" | [ ] | |
| 103 | Toggle: Monthly / Quarterly / Yearly visible | [ ] | |
| 104 | Monthly seleccionado: Free=$0, Starter=$29, Pro=$79, Enterprise=$199 | [ ] | |
| 105 | Quarterly seleccionado: precios con 10% descuento (Starter≈$26.10/mo) | [ ] | |
| 106 | Yearly seleccionado: precios con 20% descuento (Starter≈$23.20/mo) | [ ] | |
| 107 | Plan Pro resaltado como "Most Popular" con borde verde | [ ] | |
| 108 | Feature comparison table visible debajo de cards | [ ] | |
| 109 | Table: datos coinciden con spec §10 (agentes, mensajes, contactos, etc.) | [ ] | |
| 110 | Add-ons section: 500/$10, 2000/$30, 5000/$60 | [ ] | |
| 111 | FAQ pricing: 3-4 preguntas con accordion | [ ] | |
| 112 | CTA Free → /register | [ ] | |
| 113 | CTA Starter → /register?plan=starter | [ ] | |
| 114 | CTA Pro → /register?plan=pro | [ ] | |
| 115 | CTA Enterprise → mailto:sales@gensmart.ai (o similar) | [ ] | |
| 116 | Mobile (375px): cards stack, table scrolleable | [ ] | |

### 2.7 Blog (/blog)

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 117 | /blog carga sin errores | [ ] | |
| 118 | Header: "GenSmart Blog" o similar | [ ] | |
| 119 | 3 post cards visibles en grid | [ ] | |
| 120 | Cada card: título, descripción, fecha, tags como badges | [ ] | |
| 121 | Click en post 1 → /blog/how-to-deploy-whatsapp-ai-agent (o similar slug) | [ ] | |
| 122 | Post page: título h1, fecha, author, tags | [ ] | |
| 123 | Contenido markdown renderiza: headings, párrafos, listas | [ ] | |
| 124 | Estilos de prosa legibles (max-width, line-height, spacing) | [ ] | |
| 125 | "← Back to Blog" → regresa a /blog | [ ] | |
| 126 | Click en post 2 → carga correctamente | [ ] | |
| 127 | Click en post 3 → carga correctamente | [ ] | |
| 128 | Mobile (375px): blog list y post se ven bien | [ ] | |

### 2.8 BlogPreview en Landing

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 129 | Sección BlogPreview en / muestra los 3 posts reales (no placeholder) | [ ] | |
| 130 | Títulos coinciden con los posts de /blog | [ ] | |
| 131 | "View all posts →" navega a /blog | [ ] | |

### 2.9 SEO

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 132 | / → View Source → tiene `<title>` con "GenSmart" | [ ] | |
| 133 | / → tiene meta description | [ ] | |
| 134 | / → tiene og:title, og:description, og:image | [ ] | |
| 135 | / → tiene twitter:card meta tags | [ ] | |
| 136 | / → tiene JSON-LD script (Organization o SoftwareApplication) | [ ] | |
| 137 | /pricing → tiene su propio `<title>` y meta description | [ ] | |
| 138 | /blog/[slug] → title dinámico con nombre del post | [ ] | |
| 139 | /sitemap.xml → genera URLs (/, /pricing, /blog, /blog/slug-*) | [ ] | |
| 140 | /robots.txt → accesible, contiene Disallow /dashboard y /api | [ ] | |
| 141 | HTML semántico: `<main>`, `<section>`, `<nav>`, `<footer>` (inspeccionar) | [ ] | |

### 2.10 Calidad General Fase 2

| # | Test | Resultado | Notas |
|---|------|-----------|-------|
| 142 | Console (F12): sin errores en /, /pricing, /blog, /blog/[slug] | [ ] | |
| 143 | Sin emojis en toda la UI — solo iconos lucide-react | [ ] | |
| 144 | Solo CSS Modules (inspeccionar clases: deben ser hashed como `_xyz123`) | [ ] | |
| 145 | Colores de la paleta (verde #25D366, beige #FAF8F5, texto #1A1A1A) | [ ] | |
| 146 | Font Inter cargando correctamente (inspeccionar computed styles) | [ ] | |
| 147 | Navegación entre landing ↔ dashboard funciona (/ → /login → /dashboard → logo → /) | [ ] | |

---

## Resumen de Resultados

| Área | Total Tests | Pasaron | Fallaron | % |
|------|-------------|---------|----------|---|
| Fase 1 — Registro | 8 | | | |
| Fase 1 — Login | 6 | | | |
| Fase 1 — Sesión/Tokens | 4 | | | |
| Fase 1 — Logout | 4 | | | |
| Fase 1 — Forgot/Reset | 3 | | | |
| Fase 1 — Dashboard Layout | 6 | | | |
| Fase 1 — Settings General | 5 | | | |
| Fase 1 — Settings Team | 4 | | | |
| Fase 1 — Settings Sub-accounts | 3 | | | |
| Fase 1 — Settings Security/2FA | 10 | | | |
| Fase 1 — Consola/Visual | 4 | | | |
| Fase 2 — Layout Público | 9 | | | |
| Fase 2 — Secciones Landing | 12 | | | |
| Fase 2 — Interactividad | 8 | | | |
| Fase 2 — Mockups CSS | 5 | | | |
| Fase 2 — Mobile Responsive | 9 | | | |
| Fase 2 — Pricing | 16 | | | |
| Fase 2 — Blog | 12 | | | |
| Fase 2 — BlogPreview | 3 | | | |
| Fase 2 — SEO | 10 | | | |
| Fase 2 — Calidad General | 6 | | | |
| **TOTAL** | **147** | | | |

---

## Registro de Bugs

| # Bug | Test # | Descripción | Severidad (Alta/Media/Baja) | Screenshot |
|-------|--------|-------------|----------------------------|------------|
| B001 | | | | |
| B002 | | | | |
| B003 | | | | |
| B004 | | | | |
| B005 | | | | |
| B006 | | | | |
| B007 | | | | |
| B008 | | | | |
| B009 | | | | |
| B010 | | | | |

---

## Notas del Tester

_Espacio libre para observaciones generales, ideas de mejora, o cosas que no encajan en el checklist:_

```




```
---
id: cookies
slug: politica-de-cookies
title: Política de cookies
description: Qué cookies usan GenSmart y su widget web, para qué sirve cada una, qué no usamos y cómo puede administrar las cookies desde su navegador.
lastUpdated: "2026-03-21"
---

# Política de cookies

**Fecha de entrada en vigor:** 21 de marzo de 2026

**Última actualización:** 21 de marzo de 2026

Esta Política de cookies explica cómo Dysruptia LLC ("nosotros", "nos", "nuestro") usa las cookies en GenSmart (www.gensmart.co).

## ¿Qué son las cookies?

Las cookies son pequeños archivos de texto que su navegador web almacena en su dispositivo. Se usan ampliamente para que los sitios web funcionen de manera eficiente y para proporcionar información a los operadores del sitio.

## Cookies que usamos

GenSmart usa **solo cookies esenciales**, necesarias para que la plataforma funcione. No usamos cookies analíticas, publicitarias ni de seguimiento de terceros.

| Cookie | Finalidad | Tipo | Duración |
|--------|-----------|------|----------|
| `refresh_token` | Autenticación: mantiene su sesión iniciada | HttpOnly, Secure, SameSite=Strict | 7 días |

### Detalles

- **refresh_token:** esta cookie se establece cuando usted inicia sesión en GenSmart. Se usa para mantener su sesión autenticada y para emitir nuevos tokens de acceso. Esta cookie es:
  - **HttpOnly:** JavaScript no puede acceder a ella, lo que protege contra ataques XSS.
  - **Secure:** solo se transmite por conexiones HTTPS.
  - **SameSite=Strict:** no se envía con solicitudes entre sitios, lo que protege contra ataques CSRF.
  - Se rota automáticamente en cada uso para mayor seguridad.

## Lo que NO usamos

- Ninguna cookie analítica (Google Analytics, Mixpanel, etc.)
- Ninguna cookie publicitaria ni de retargeting
- Ninguna cookie de seguimiento de redes sociales
- Ninguna cookie de terceros de ningún tipo

## Widget web

El widget web de GenSmart (insertado en los sitios web de sus clientes) usa **localStorage** (no cookies) para mantener las sesiones de chat:
- `gs_widget_session_{agentId}`: almacena el ID de sesión de la conversación
- `gs_widget_msgs_{agentId}`: guarda en caché los mensajes recientes para que carguen más rápido

Estos datos se almacenan en el navegador del usuario final y no se transmiten a ningún tercero.

## Administración de las cookies

Usted puede administrar o eliminar las cookies desde la configuración de su navegador:
- **Chrome:** Configuración > Privacidad y seguridad > Cookies
- **Firefox:** Ajustes > Privacidad & Seguridad > Cookies
- **Safari:** Preferencias > Privacidad > Cookies
- **Edge:** Configuración > Privacidad > Cookies

Nota: si elimina la cookie `refresh_token`, se cerrará su sesión en GenSmart.

## Cambios a esta política

Podemos actualizar esta Política de cookies si incorporamos nuevas cookies o cambiamos la forma en que usamos las existentes. Los cambios se indicarán en esta página con una fecha de "Última actualización" nueva.

## Contáctenos

Si tiene preguntas sobre nuestro uso de las cookies:

- **Correo electrónico:** privacy@gensmart.co
- **Empresa:** Dysruptia LLC
- **Sitio web:** [www.gensmart.co](https://www.gensmart.co)

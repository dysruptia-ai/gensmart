---
id: cookies
slug: politica-de-cookies
title: Política de cookies
description: "La única cookie de GenSmart, lo que guardamos en el almacenamiento local de su navegador, el contenido externo que usa las suyas y cómo administrarlas."
lastUpdated: "2026-11-25"
---

# Política de cookies

**Fecha de entrada en vigor:** 25 de noviembre de 2026

**Última actualización:** 25 de noviembre de 2026

Esta Política de cookies explica cómo Dysruptia LLC ("nosotros", "nos", "nuestro") usa las cookies y tecnologías similares, como el almacenamiento local de su navegador, en GenSmart (www.gensmart.co).

## ¿Qué son las cookies?

Las cookies son pequeños archivos de texto que su navegador web guarda en su dispositivo. Se usan ampliamente para que los sitios web funcionen de manera eficiente y para dar información a quienes los operan. El almacenamiento local es una tecnología similar: guarda pequeños datos en su navegador, pero, a diferencia de las cookies, esos datos no se envían al servidor con cada solicitud.

## Cookies que usamos

GenSmart usa **una sola cookie esencial**, necesaria para que la plataforma funcione. No usamos cookies de analítica, publicidad ni seguimiento.

| Cookie | Finalidad | Tipo | Duración |
|--------|-----------|------|----------|
| `refresh_token` | Autenticación: mantiene su sesión iniciada | HttpOnly, Secure, SameSite=None, compartida con los subdominios de gensmart.co | 7 días |

### Detalles

- **refresh_token:** esta cookie se crea cuando usted inicia sesión en GenSmart. Sirve para mantener su sesión autenticada y emitir nuevos tokens de acceso. Esta cookie es:
  - **HttpOnly:** JavaScript no puede acceder a ella, lo que protege contra ataques XSS.
  - **Secure:** solo se transmite por conexiones HTTPS.
  - **Compartida solo con los subdominios de gensmart.co:** para que la aplicación y nuestra API, que funcionan en subdominios distintos, mantengan su sesión. No se envía a ningún otro sitio.
  - Se rota automáticamente en cada uso, como seguridad adicional.

## Almacenamiento local en nuestro sitio

Nuestro sitio público guarda estas preferencias en el almacenamiento local de su navegador. Se quedan en su dispositivo y no las usamos para hacerle seguimiento:

| Clave | Finalidad |
|-------|-----------|
| `gs_language` | Recuerda el idioma que eligió |
| `gs_lang_hint_dismissed` | Recuerda que cerró la sugerencia de cambiar de idioma |
| `gs-docs-theme` | Recuerda el tema claro u oscuro que eligió en las guías de ayuda |
| `gs-academy-progress` y `gs-academy-{courseId}` | Guardan su avance en los cursos de GenSmart Academy |

## Widget web

El widget web de GenSmart (insertado en los sitios web de sus clientes) usa **localStorage** (no cookies) para mantener las sesiones de chat:
- `gs_widget_session_{agentId}`: guarda el ID de la sesión de la conversación.
- `gs_widget_msgs_{agentId}`: guarda en caché los mensajes recientes para que carguen más rápido.

Estos datos se guardan en el navegador del usuario final y no se transmiten a ningún tercero.

## Contenido de terceros

Algunas funciones cargan contenido de terceros, que pueden usar sus propias cookies o tecnologías similares según sus propias políticas:
- **Cloudflare Turnstile:** protege nuestros formularios contra el spam. Procesa datos técnicos de su navegador para distinguir a las personas de los bots. Consulte la [política de privacidad de Cloudflare](https://www.cloudflare.com/privacypolicy/).
- **Videos de YouTube:** algunas guías de ayuda incluyen videos. El reproductor se carga en el modo de privacidad mejorada de YouTube y solo después de que usted hace clic en reproducir; hasta entonces, no se carga nada de YouTube. Consulte la [política de privacidad de Google](https://policies.google.com/privacy).

## Lo que NO usamos

- Ninguna cookie de analítica (Google Analytics, Mixpanel, etc.)
- Ninguna cookie de publicidad o de retargeting
- Ninguna cookie de seguimiento de redes sociales
- Ninguna cookie de terceros, salvo las que pueda crear el contenido de terceros una vez que usted decide cargarlo (consulte la sección anterior)

## Cómo administrar las cookies y el almacenamiento local

Usted puede administrar o eliminar las cookies y el almacenamiento local desde la configuración de su navegador:
- **Chrome:** Configuración > Privacidad y seguridad > Cookies
- **Firefox:** Ajustes > Privacidad y seguridad > Cookies
- **Safari:** Preferencias > Privacidad > Cookies
- **Edge:** Configuración > Privacidad > Cookies

Nota: si elimina la cookie `refresh_token`, se cerrará su sesión en GenSmart. Si elimina el almacenamiento local, se restablecen sus preferencias y su avance en los cursos.

## Cambios en esta política

Podemos actualizar esta Política de cookies si incorporamos cookies nuevas o cambiamos el uso de las existentes. Los cambios se indicarán en esta página con una nueva fecha de "Última actualización".

## Idioma

Esta Política de cookies está redactada en inglés. Podemos ofrecer traducciones para su comodidad. Si hay algún conflicto o inconsistencia entre la versión en inglés y una traducción, prevalece la versión en inglés.

## Contacto

Si tiene preguntas sobre nuestro uso de las cookies:

- **Correo electrónico:** privacy@gensmart.co
- **Empresa:** Dysruptia LLC
- **Sitio web:** [www.gensmart.co](https://www.gensmart.co)

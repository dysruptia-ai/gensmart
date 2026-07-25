---
title: "Cómo Crear tu Agente de Ventas para Mastershop en GenSmart — Guía Paso a Paso"
description: "Aprende a conectar tu tienda de dropshipping en Mastershop con un agente de IA por WhatsApp usando la template Mastershop Dropshipper de GenSmart. Configuración completa en menos de 30 minutos."
date: "2026-07-25"
author: "GenSmart Team"
tags: ["documentacion", "mastershop", "dropshipping", "whatsapp", "tutorial", "agentes-ia"]
cover_image: "/blog/cover-placeholder.svg"
language: "es"
---

Si vendes por dropshipping conectado a Mastershop, ya sabes lo que cuesta responder cada mensaje de WhatsApp a mano — preguntas de precio, tallas, tiempos de envío, y el ir y venir hasta cerrar la venta. GenSmart resuelve esto con un agente de IA entrenado específicamente para vender productos de tu catálogo de Mastershop por WhatsApp, las 24 horas.

Esta guía te lleva paso a paso desde crear el agente hasta tenerlo respondiendo mensajes reales.

## Antes de empezar

Necesitas:

- Una cuenta activa en GenSmart (plan Pro o superior, ya que el agente usa herramientas MCP)
- Una cuenta de dropshipper en Mastershop con tu API Key de integración a mano (la encuentras en tu panel de Mastershop, en **Settings → API Access**)
- Un número de WhatsApp Business disponible para conectar (puede ser uno nuevo o uno que ya uses)

## Paso 1 — Crear el agente desde la plantilla

Dentro de tu dashboard de GenSmart:

1. Ve a **Agents** en el menú lateral
2. Haz clic en **"+ New Agent"**
3. En la pantalla "Choose a Template", busca la tarjeta **"Mastershop Dropshipper"**
4. Haz clic sobre ella

GenSmart crea automáticamente un agente nuevo (en estado **Draft**) con el prompt de ventas ya escrito — saludo, manejo de objeciones, flujo de carrito y creación de pedidos, todo listo. Solo necesitas configurar los datos de tu tienda.

## Paso 2 — Configurar tu tienda

Ve a la pestaña **Configuration** del agente. Vas a ver 6 campos:

| Campo | Qué poner |
|---|---|
| **Store name** | El nombre de tu tienda (aparece en el saludo del agente) |
| **Star product ID** | El ID numérico del producto principal en Mastershop — normalmente el que promocionas en tus anuncios |
| **Star product name** | El nombre de ese producto, tal como quieres que lo mencione el agente |
| **Additional shipping policy** | *(Opcional)* Detalles extra de envío si tienes políticas propias además de las estándar de Mastershop (contraentrega, 2-5 días hábiles) |
| **Warranty / return policy** | *(Opcional)* Si tienes una política de garantía o cambios formal. Si la dejas vacía, el agente será honesto y no inventará una — mejor eso que prometer algo que no puedas cumplir |
| **Voice tone** | Elige entre **Friendly**, **Professional** o **Expert**, según cómo quieras que suene tu marca |

Guarda los cambios con el botón **Save** antes de continuar.

## Paso 3 — Conectar tu catálogo de Mastershop

El agente necesita acceso a tu catálogo real para mostrar productos, precios y stock actualizados — no hay nada hardcodeado.

1. Ve a la pestaña **Tools**
2. Haz clic en **"+ Add Tool"**
3. En **Tool Type**, elige **MCP Server**
4. GenSmart detecta automáticamente el proveedor y te muestra la tarjeta **"Detected: Mastershop Dropshipping"** — haz clic sobre ella para confirmarla
5. El campo **Server URL** ya viene completado automáticamente y el **Transport** queda en **Streamable HTTP** — no hace falta tocarlos
6. Pega tu clave en el campo **"Your Mastershop API Key"**. Si no la tienes a mano, haz clic en **"How to get this key →"**: la encuentras en tu panel de Mastershop, en **Settings → API Access**
7. *(Opcional)* Si necesitas configurar seguridad adicional del webhook, despliega **"Advanced: webhook security"**
8. Haz clic en **"Test Connection"** para confirmar que tu clave funciona antes de guardar
9. En **"Available Tools"**, deja las 8 herramientas seleccionadas (vienen todas marcadas por defecto): búsqueda de productos, detalle de producto, carrito (agregar, ver, actualizar, vaciar), y creación/estado de pedidos
10. Haz clic en **"Save Changes"**

## Paso 4 — Probar antes de publicar

Antes de exponer el agente a clientes reales, usa el botón **Preview** en la parte superior del editor. Esto abre un chat de prueba que usa el prompt tal como quedó guardado, sin afectar tu contador de mensajes ni crear conversaciones reales.

Prueba al menos:

- Un saludo inicial ("hola")
- Preguntar por tu producto estrella
- Simular una objeción común ("está muy caro")
- Confirmar que las imágenes de producto se muestran correctamente

Si algo no se ve bien, puedes ajustar los campos de configuración o el tono de voz y volver a probar sin publicar.

## Paso 5 — Publicar y conectar WhatsApp

Cuando estés conforme:

1. Haz clic en **Publish** — esto activa el agente para recibir tráfico real
2. Ve a la pestaña **Channels**
3. Activa el switch de **WhatsApp**
4. Elige **Connect with Facebook** (recomendado, toma menos de 2 minutos) o sigue la guía de configuración manual (**Manual Setup**) si prefieres usar un número que ya tienes configurado en Meta Business

Una vez conectado, cualquier mensaje que llegue a ese número lo va a responder tu agente automáticamente.

## Consejos para los primeros días

**Revisa tus márgenes antes de activar productos.** El precio que le muestra el agente al cliente es siempre el **precio sugerido** de Mastershop — nunca el precio de proveedor. Pero recuerda que el costo de envío se descuenta de tu margen, no se le suma al cliente. Antes de promocionar un producto agresivamente, verifica en tu panel de Mastershop que el margen entre precio proveedor y precio sugerido sea saludable frente al costo típico de envío en tu zona de mayor demanda.

**Monitorea las primeras conversaciones reales.** El dashboard de **Conversations** te muestra cada chat en tiempo real. Puedes intervenir con la función de takeover humano en cualquier momento si el agente se traba con algo puntual.

**Ajusta el prompt si hace falta.** Aunque la plantilla viene lista para vender bien desde el día uno, cada tienda es distinta. Si notas que el agente no maneja bien alguna objeción específica de tu producto, puedes editar el prompt directamente desde la pestaña **Prompt** del editor.

**El agente nunca inventa lo que no sabe.** Si no configuraste una política de garantía, el agente le dirá al cliente honestamente que no tiene esa información confirmada, en vez de improvisar una. Esto protege tu reputación — mejor una respuesta honesta que una promesa que no puedas cumplir después.

## Próximos pasos

Con tu agente activo, considera:

- Revisar periódicamente qué productos de tu catálogo tienen mejor margen antes de promocionarlos en anuncios
- Usar el CRM integrado de GenSmart para hacer seguimiento a los leads que no cerraron la primera vez
- Explorar el historial de conversaciones para identificar preguntas frecuentes y enriquecer las políticas configuradas

¿Tienes dudas sobre la configuración? Escríbenos directamente desde el chat de la plataforma.

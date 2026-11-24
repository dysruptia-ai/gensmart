---
id: "conecta-tu-cuenta-de-dropi-a-un-agente-de-gensmart"
title: "Conecta tu cuenta de Dropi a un agente de GenSmart: catálogo, envío contra entrega y pedidos en la conversación"
description: "Si vendes con Dropi en Colombia, un agente de GenSmart puede mostrar productos del catálogo, cotizar el envío contra entrega, crear el pedido en tu cuenta y contarle al cliente cómo va. La integración está en beta."
seoTitle: "Conecta Dropi a un agente de GenSmart: catálogo y pedidos"
seoDescription: "Conecta Dropi a un agente de GenSmart: muestra el catálogo, cotiza el envío contra entrega, crea el pedido y le cuenta al cliente cómo va. En beta."
date: "2026-11-19"
updated: "2026-11-19"
category: "novedades"
sub: "novedades"
read: 7
cover: "/site/img/blog/es/conecta-tu-cuenta-de-dropi-a-un-agente-de-gensmart.webp"
language: "es"
---

Un agente de GenSmart ya puede trabajar con tu cuenta de dropshipper de Dropi Colombia. Atiende por WhatsApp o por el widget de tu sitio: busca en el catálogo de Dropi, muestra solo productos con stock, calcula tu precio de venta con tu margen, cotiza el envío para la ciudad del cliente, crea el pedido en tu cuenta de Dropi y responde cuando el cliente pregunta cómo va. La integración está en beta y toma de 20 a 30 minutos.

:::nota
Por ahora funciona solo en Colombia, en pesos colombianos, y el agente vende únicamente contra entrega: no hay enlaces de pago ni transferencias. Los pedidos que crea son pedidos reales en tu cuenta de Dropi, incluso los de prueba.
:::

## ¿Qué puede hacer el agente con tu cuenta de Dropi?

- <strong>Mostrar productos.</strong> Busca en todo el catálogo de Dropi y muestra hasta 5 por búsqueda, solo con stock. El cliente nunca ve costos de proveedor ni tus márgenes.
- <strong>Cotizar el envío contra entrega.</strong> Lo cotiza en tiempo real con Dropi para la ciudad del cliente y elige la transportadora más barata con cobertura.
- <strong>Crear el pedido.</strong> Pide nombre, dirección con barrio y celular, muestra un resumen y solo crea el pedido cuando el cliente lo confirma de forma explícita.
- <strong>Contar cómo va el pedido.</strong> Responde con el estado, el producto, el total y la transportadora. En WhatsApp encuentra el pedido por el número del cliente, sin pedir datos.

## ¿Cómo se calcula el precio que ve el cliente?

El precio del producto es el precio sugerido de Dropi más tu margen, redondeado hacia arriba a la centena. Con un sugerido de $17.900 y un margen del 20 %, el precio queda en $21.500. El envío se cobra aparte y el total que paga el cliente es precio más envío. A ese total se le restan el envío, la comisión de Dropi y el costo del proveedor, y el agente nunca crea un pedido que te deje sin ganancia. El precio, la transportadora y el método de pago los fija el sistema, no la IA, así que el agente no puede dar descuentos ni cambiar precios.

## ¿Cómo conecto mi cuenta de Dropi?

1. En GenSmart, crea el agente desde la plantilla «Vendedor Dropi». Ya trae el prompt de ventas y las reglas de seguridad.
2. En la configuración del agente, completa el nombre de tu tienda, el margen (20 % por defecto), el máximo de pedidos diarios (20 por defecto) y el tono de voz. Si tienes políticas de envíos y de garantía, escríbelas: si las dejas vacías, el agente no promete tiempos ni inventa garantías.
3. En Herramientas, agrega un servidor MCP de Dropi y pulsa «Conectar mi cuenta de Dropi». No llenes ningún dato: se abre la página de Dropi, eliges Colombia, inicias sesión, escribes tu código de verificación en dos pasos y pulsas «Autorizar».
4. Vuelves a GenSmart y la herramienta aparece como conectada a tu cuenta de Dropi.

Ten a mano el código de verificación de la cuenta de Dropi. Si la cuenta es de otra persona, tendrá que dártelo en ese momento. Y usa un agente por cuenta de Dropi: Dropi permite una sola sesión de conexión por cuenta, así que si la conectas en otro agente o en otra herramienta, la conexión anterior deja de funcionar. Si ves «Reconectar», repite el inicio de sesión.

## ¿Cómo pruebo que funciona antes de publicarlo?

Haz la prueba completa en la vista previa. Recuerda que crea pedidos reales en tu cuenta de Dropi. Estos son los mensajes y lo que debe pasar:

1. Pregunta qué tiene para el hogar. Debe mostrar hasta 5 productos con precio.
2. Busca un producto que vendas. Debe mostrar opciones con el precio ya calculado con tu margen.
3. Pregunta cuánto vale el envío a Bogotá. Debe dar el envío y el total contra entrega, y preguntar el departamento si la ciudad existe en varios.
4. Pide la foto y luego di que lo quieres. Debe enviar la imagen y pedir nombre, dirección con barrio y celular de 10 dígitos. Usa datos de prueba.
5. Revisa el resumen y pide cambiar la cantidad a 2. No debe crear el pedido: recotiza y muestra un resumen nuevo.
6. Confirma. Debe crear el pedido y dar el número. Luego pregunta cómo va: debe responder sin pedirte datos.

Al terminar, entra a Mis Pedidos en Dropi, busca el número, revisa que coincidan producto, cantidad, precio y transportadora, y cancélalo desde ahí. Para repetir la prueba, reinicia la vista previa y usa otro número de celular: el agente permite como máximo 2 pedidos por celular. Durante los primeros días conviene revisar en Mis Pedidos cada pedido que cree el agente antes de que salga a la transportadora.

## ¿Qué protecciones trae contra pedidos falsos o errores?

- <strong>Confirmación explícita.</strong> Respuestas como «ok pero…» o «déjame pensarlo» no cuentan como confirmación.
- <strong>Topes.</strong> Máximo 2 pedidos por conversación, 2 por celular, 3 por red en la web y tu máximo diario.
- <strong>Verificación en la web.</strong> Antes de crear un pedido en el widget, se comprueba que quien compra es una persona. Casi siempre es invisible para el cliente.
- <strong>Privacidad.</strong> El agente nunca muestra pedidos de otras personas. En la web, para consultar un pedido hay que dar el número de pedido y el celular, y deben coincidir.
- <strong>Pedidos en verificación.</strong> Si hay un problema de conexión justo al crear un pedido, el agente no lo reintenta: avisa que está en verificación para evitar duplicados. Revisa en Dropi si se creó.

## ¿Puede pasar la conversación a una persona de mi equipo?

Sí. En Ajustes, activa la derivación a humano y agrega un contacto de soporte con su número de WhatsApp con código de país. Usa un número distinto al del agente, o el enlace volverá a abrir la conversación con el agente. Si el cliente pide hablar con una persona, o algo no se puede resolver, como alcanzar el tope de pedidos, el agente le pasa un botón para escribir a tu equipo. Está disponible desde el plan Starter.

## ¿Qué hago si algo no funciona?

- <strong>No puede consultar el catálogo.</strong> En Herramientas, revisa que Dropi siga conectado. Si dice «Reconectar», vuelve a conectar con tu código de verificación.
- <strong>No encuentra la ciudad.</strong> Pide al cliente el municipio y el departamento. Las veredas y los barrios van en la dirección.
- <strong>Sin cobertura.</strong> Ninguna transportadora de Dropi cubre ese destino contra entrega, y el agente se lo dice al cliente.
- <strong>«No puedo registrar más pedidos por este medio».</strong> Se alcanzó un tope. Si son clientes reales, sube el máximo de pedidos diarios en la configuración.
- <strong>No llega una foto.</strong> Algunos productos de Dropi tienen imágenes en formatos que WhatsApp no acepta. El agente sigue con la venta.

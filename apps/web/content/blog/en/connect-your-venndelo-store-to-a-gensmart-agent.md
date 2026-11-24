---
id: "conecta-tu-tienda-venndelo-a-un-agente-de-gensmart"
title: "Connect your Venndelo store to a GenSmart agent: catalog with photos, cart, shipping and order inside the conversation"
description: "A GenSmart agent can now serve your Venndelo store customers: it shows the catalog with photos, builds the cart, quotes shipping, creates the cash-on-delivery order and updates them on its status. You connect your store in three steps, with a code you copy from Venndelo and paste into GenSmart, no coding needed."
date: "2026-11-19"
updated: "2026-11-19"
category: "novedades"
sub: "novedades"
read: 6
cover: "/site/img/blog/en/connect-your-venndelo-store-to-a-gensmart-agent.webp"
language: "en"
---

If you sell with Venndelo, your GenSmart agent can now connect to your store. Once connected, it serves customers through the web widget or WhatsApp: it searches products, shows the detail with a photo, adds to the cart with its variants, quotes shipping to the customer's city, creates the order and later updates them in the same conversation on how it is going.

## What can the agent do with your store?

- <strong>Search products and show them with a photo.</strong> It answers with your real catalog and sends the product image.
- <strong>Build the cart.</strong> It adds products with their variants, such as size or color, and asks whether the customer wants anything else.
- <strong>Quote shipping.</strong> It looks up the destination city, asks for the department when several share the name and gives the total with shipping.
- <strong>Create the order.</strong> It summarizes the order, asks for confirmation and gives the order number, the same one you see in Venndelo. Payment is cash on delivery.
- <strong>Check the order status.</strong> The customer asks how it is going and the agent answers.

What it cannot do: delete or edit products, move your wallet balance or change your store settings. The agent talks to anyone, so it only has access to sales functions.

## How do I connect my store?

1. In GenSmart, create the agent from the «Venndelo Dropshipper» template. Fill in your store name, what you sell and the tone of voice. Do not publish it yet.
2. In the Venndelo panel, go to Integrations, find the GenSmart card and press «Connect». Copy the full connection token that appears.
3. In your agent, open Tools, choose Venndelo Dropshipping and paste the token in its only field. Press «Test connection»: GenSmart runs a test search in your catalog. If it works, save.

:::nota
The token gives access to your store, so treat it like a password: do not share it by email, in messages or in screenshots, and paste it only into GenSmart. If you think someone else saw it, use «Rotate» on the GenSmart card in Venndelo: the old one stops working and you get a new one.
:::

## How do I test it before going live?

Open the agent's preview and talk as a customer would. These five messages check the whole connection:

1. Ask what products it has. It should greet with your store name and show a short list with prices.
2. Ask for one of the products. It should show the detail and send the photo.
3. Ask it to add it to the cart. It should confirm product and price, and ask about the variant if there is one.
4. Reply that that is all. It should ask for the delivery city.
5. Type your city. It should identify it and give you the total with shipping.

If you also test order creation, keep in mind that orders created from the preview are real orders in your store. Write in the note that it is a test and cancel it in Venndelo as soon as you finish so it does not ship.

## How does the customer find out how the order is going?

When the order moves forward in Venndelo (in preparation, label generated, ready for pickup or cancelled), the agent tells the customer in the same widget or WhatsApp conversation where they bought. GenSmart checks for changes every few minutes, so the notice may take a little while. Preview orders do not get notices, on purpose, so a test never writes to a real customer.

## What do I do if something does not work?

- <strong>Test connection fails.</strong> Almost always the token is incomplete, has spaces or was already rotated. Copy it again from Venndelo.
- <strong>It worked and stopped.</strong> Someone rotated or disconnected GenSmart in Venndelo. Generate a new token, paste it, test the connection, save and publish again.
- <strong>It says there are no products.</strong> Check that they are published and in stock in Venndelo.
- <strong>The photo does not show.</strong> Check that the product has a public image in Venndelo.
- <strong>It cannot find the city.</strong> Answer with the department when the agent asks.

After any change to the tool, publish the agent again; otherwise the widget keeps the previous setup. And if you need help, write to us with your store name and the approximate time of the error. Never send us your token.

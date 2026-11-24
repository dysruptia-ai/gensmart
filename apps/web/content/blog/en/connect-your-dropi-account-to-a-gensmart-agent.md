---
id: "conecta-tu-cuenta-de-dropi-a-un-agente-de-gensmart"
title: "Connect your Dropi account to a GenSmart agent: catalog, cash-on-delivery shipping and orders inside the conversation"
description: "If you sell with Dropi in Colombia, a GenSmart agent can show catalog products, quote cash-on-delivery shipping, create the order in your account and tell the customer how it is going. The integration is in beta."
seoTitle: "Connect Dropi to a GenSmart agent: catalog and orders"
seoDescription: "Connect Dropi to a GenSmart agent: it shows catalog products, quotes cash-on-delivery shipping, creates the order and updates the customer. In beta."
date: "2026-11-19"
updated: "2026-11-19"
category: "novedades"
sub: "novedades"
read: 7
cover: "/site/img/blog/en/connect-your-dropi-account-to-a-gensmart-agent.webp"
language: "en"
---

A GenSmart agent can now work with your Dropi Colombia dropshipper account. It serves customers on WhatsApp or the widget on your site: it searches the Dropi catalog, shows only products in stock, calculates your selling price with your margin, quotes shipping for the customer's city, creates the order in your Dropi account and answers when the customer asks how it is going. The integration is in beta and takes 20 to 30 minutes.

:::nota
For now it works only in Colombia, in Colombian pesos, and the agent sells cash on delivery only: no payment links or transfers. The orders it creates are real orders in your Dropi account, even test ones.
:::

## What can the agent do with your Dropi account?

- <strong>Show products.</strong> It searches the whole Dropi catalog and shows up to 5 per search, only in stock. The customer never sees supplier costs or your margins.
- <strong>Quote cash-on-delivery shipping.</strong> It quotes in real time with Dropi for the customer's city and picks the cheapest carrier with coverage.
- <strong>Create the order.</strong> It asks for name, address with neighborhood and phone, shows a summary and only creates the order when the customer explicitly confirms.
- <strong>Tell how the order is going.</strong> It answers with status, product, total and carrier. On WhatsApp it finds the order by the customer's number, without asking for details.

## How is the price the customer sees calculated?

The product price is Dropi's suggested price plus your margin, rounded up to the nearest hundred. With a suggested price of $17,900 and a 20% margin, the price becomes $21,500. Shipping is charged separately and the total the customer pays is price plus shipping. From that total, shipping, Dropi's commission and the supplier cost are subtracted, and the agent never creates an order that leaves you without profit. Price, carrier and payment method are set by the system, not the AI, so the agent cannot give discounts or change prices.

## How do I connect my Dropi account?

1. In GenSmart, create the agent from the «Vendedor Dropi» template. It already includes the sales prompt and the safety rules.
2. In the agent's settings, fill in your store name, the margin (20% by default), the daily order limit (20 by default) and the tone of voice. If you have shipping and warranty policies, write them in: if you leave them empty, the agent does not promise delivery times or invent warranties.
3. In Tools, add a Dropi MCP server and press «Connect my Dropi account». Do not fill in any field: the Dropi page opens, you choose Colombia, sign in, enter your two-step verification code and press «Authorize».
4. You return to GenSmart and the tool shows as connected to your Dropi account.

Keep your Dropi account's verification code at hand. If the account belongs to someone else, they will have to give it to you at that moment. And use one agent per Dropi account: Dropi allows a single connection session per account, so if you connect it to another agent or another tool, the previous connection stops working. If you see «Reconnect», repeat the sign-in.

## How do I test it before going live?

Run the full test in the preview. Remember that it creates real orders in your Dropi account. These are the messages and what should happen:

1. Ask what it has for the home. It should show up to 5 products with prices.
2. Search for a product you sell. It should show options with the price already calculated with your margin.
3. Ask how much shipping to Bogotá costs. It should give the shipping and the cash-on-delivery total, and ask for the department if the city exists in several.
4. Ask for the photo and then say you want it. It should send the image and ask for name, address with neighborhood and a 10-digit phone. Use test data.
5. Review the summary and ask to change the quantity to 2. It should not create the order: it requotes and shows a new summary.
6. Confirm. It should create the order and give the number. Then ask how it is going: it should answer without asking for details.

When you finish, go to My Orders in Dropi, find the number, check that product, quantity, price and carrier match, and cancel it from there. To repeat the test, restart the preview and use another phone number: the agent allows at most 2 orders per phone. During the first days it is worth reviewing in My Orders every order the agent creates before it goes to the carrier.

## What protections does it include against fake orders or mistakes?

- <strong>Explicit confirmation.</strong> Replies like «ok but…» or «let me think about it» do not count as confirmation.
- <strong>Limits.</strong> At most 2 orders per conversation, 2 per phone, 3 per network on the web and your daily limit.
- <strong>Web verification.</strong> Before creating an order in the widget, it checks that the buyer is a person. It is almost always invisible to the customer.
- <strong>Privacy.</strong> The agent never shows other people's orders. On the web, checking an order requires the order number and the phone, and they must match.
- <strong>Orders under verification.</strong> If there is a connection problem right when creating an order, the agent does not retry: it says the order is under verification to avoid duplicates. Check in Dropi whether it was created.

## Can it hand the conversation to someone on my team?

Yes. In Settings, turn on human handover and add a support contact with their WhatsApp number including country code. Use a number different from the agent's, or the link will open the conversation with the agent again. If the customer asks to talk to a person, or something cannot be resolved, such as reaching the order limit, the agent gives them a button to write to your team. It is available from the Starter plan.

## What do I do if something does not work?

- <strong>It cannot check the catalog.</strong> In Tools, check that Dropi is still connected. If it says «Reconnect», connect again with your verification code.
- <strong>It cannot find the city.</strong> Ask the customer for the municipality and department. Rural areas and neighborhoods go in the address.
- <strong>No coverage.</strong> No Dropi carrier covers that destination cash on delivery, and the agent tells the customer.
- <strong>«I cannot register more orders through this channel».</strong> A limit was reached. If they are real customers, raise the daily order limit in settings.
- <strong>A photo does not arrive.</strong> Some Dropi products have images in formats WhatsApp does not accept. The agent continues with the sale.

---
id: "como-escribir-la-base-de-conocimiento-de-tu-agente"
title: "How to write your agent's knowledge base so it answers with facts, not detours"
description: "An agent's quality depends more on what it knows than on how it is configured. A practical guide to writing what it needs to know."
seoTitle: "How to write your AI agent's knowledge base | GenSmart"
date: "2026-05-22"
updated: "2026-11-19"
category: "agentes"
sub: "agentes"
read: 7
cover: "/site/img/blog/en/how-to-write-your-agents-knowledge-base.webp"
language: "en"
---

When an agent answers badly, the cause is almost never the model. It is usually that the information it had was incomplete, was written for humans who already know the business, or contradicted another part.

## Start with the real questions

Do not write what you think you should tell. Write what your customers ask. Open your WhatsApp, your email and your Instagram messages and note the twenty questions that repeat the most. That list is the skeleton of your base.

## One answer, one concrete fact

The agent repeats what it reads. If your text says "we ship to several cities", it will say that, and the customer will ask which ones. Write the list, the lead time and the cost, or the rule to calculate it.

- Write figures, lead times, hours and conditions the way you would say them on the phone
- Define the business's own terms the first time they appear
- Separate by topic: shipping, payments, returns, hours, each in its own block
- If something changes by season, state from when to when it applies

## Also tell it what it does not know

An agent with no limits fills the gaps with guesses. Add a short section with what it must not answer and what to do in that case: "Do not give diagnoses. If the customer describes a symptom, offer to book with the doctor". That limit protects your brand more than any well-written answer.

## Avoid contradictions

If in one place you say shipping is free above a certain amount and in another that it is always charged, the agent will pick one at random. Check that each fact lives in a single place and that, if it changes, it is fixed there.

## Test it with hard questions

1. Ask the twenty questions on your list and compare each answer with the one you would give
2. Make up three questions that are not in the base and confirm the agent acknowledges it
3. Ask the same thing in different ways, with typos and slang
4. Fix the base, not the prompt, when the answer fails for lack of information

:::nota
Review the base once a month. What changes in your business (prices, hours, promotions) must change here too, or the agent will keep saying the old thing.
:::

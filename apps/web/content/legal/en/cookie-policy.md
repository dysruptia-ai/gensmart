---
id: cookies
slug: cookie-policy
title: Cookie Policy
description: "The one cookie GenSmart uses, what we keep in your browser's local storage, which third-party content can set its own, and how to manage them."
lastUpdated: "2026-11-25"
---

# Cookie Policy

**Effective Date:** November 25, 2026

**Last Updated:** November 25, 2026

This Cookie Policy explains how Dysruptia LLC ("we", "us", "our") uses cookies and similar technologies, such as your browser's local storage, on GenSmart (www.gensmart.co).

## What Are Cookies?

Cookies are small text files stored on your device by your web browser. They are widely used to make websites work efficiently and to provide information to the site operators. Local storage is a similar technology: it saves small pieces of data in your browser, but unlike cookies, that data is not sent to the server with each request.

## Cookies We Use

GenSmart uses **only one essential cookie**, required for the platform to function. We do not use analytics, advertising, or tracking cookies.

| Cookie | Purpose | Type | Duration |
|--------|---------|------|----------|
| `refresh_token` | Authentication — maintains your login session | HttpOnly, Secure, SameSite=None, shared with gensmart.co subdomains | 7 days |

### Details

- **refresh_token:** This cookie is set when you log in to GenSmart. It is used to maintain your authenticated session and to issue new access tokens. This cookie is:
  - **HttpOnly:** Cannot be accessed by JavaScript, protecting against XSS attacks.
  - **Secure:** Only transmitted over HTTPS connections.
  - **Shared only with gensmart.co subdomains:** So that the app and our API, which run on different subdomains, can keep your session. It is not sent to any other site.
  - Automatically rotated on each use for additional security.

## Local Storage on Our Website

Our public website saves these preferences in your browser's local storage. They stay on your device, and we do not use them to track you:

| Key | Purpose |
|-----|---------|
| `gs_language` | Remembers the language you chose |
| `gs_lang_hint_dismissed` | Remembers that you closed the suggestion to switch languages |
| `gs-docs-theme` | Remembers the light or dark theme you chose in the help guides |
| `gs-academy-progress` and `gs-academy-{courseId}` | Save your progress in GenSmart Academy courses |

## Web Widget

The GenSmart web widget (embedded on your customers' websites) uses **localStorage** (not cookies) to maintain chat sessions:
- `gs_widget_session_{agentId}` — stores the conversation session ID
- `gs_widget_msgs_{agentId}` — caches recent messages for faster loading

These are stored in the end-user's browser and are not transmitted to any third party.

## Third-Party Content

Some features load content from third parties, which may use their own cookies or similar technologies under their own policies:
- **Cloudflare Turnstile:** Protects our forms against spam. It processes technical data from your browser to tell people from bots. See [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).
- **YouTube videos:** Some help guides include videos. The player loads in YouTube's privacy-enhanced mode and only after you click play; until then, nothing is loaded from YouTube. See [Google's privacy policy](https://policies.google.com/privacy).

## What We Do NOT Use

- No analytics cookies (Google Analytics, Mixpanel, etc.)
- No advertising or retargeting cookies
- No social media tracking cookies
- No third-party cookies, except those that third-party content may set once you choose to load it (see above)

## Managing Cookies and Local Storage

You can manage or delete cookies and local storage through your browser settings:
- **Chrome:** Settings > Privacy and Security > Cookies
- **Firefox:** Settings > Privacy & Security > Cookies
- **Safari:** Preferences > Privacy > Cookies
- **Edge:** Settings > Privacy > Cookies

Note: Deleting the `refresh_token` cookie will log you out of GenSmart. Deleting local storage resets your preferences and your course progress.

## Changes to This Policy

We may update this Cookie Policy if we introduce new cookies or change how we use existing ones. Changes will be noted on this page with an updated "Last Updated" date.

## Language

This Cookie Policy is written in English. We may provide translations for your convenience. If there is any conflict or inconsistency between the English version and a translation, the English version prevails.

## Contact Us

If you have questions about our use of cookies:

- **Email:** privacy@gensmart.co
- **Company:** Dysruptia LLC
- **Website:** [www.gensmart.co](https://www.gensmart.co)

---
title: Cookie Policy
description: How we use cookies and similar tracking technologies.
lastUpdated: "2026-03-21"
---

# Cookie Policy

**Effective Date:** March 21, 2026
**Last Updated:** March 21, 2026

This Cookie Policy explains how Dysruptia LLC ("we", "us", "our") uses cookies on GenSmart (www.gensmart.co).

## What Are Cookies?

Cookies are small text files stored on your device by your web browser. They are widely used to make websites work efficiently and to provide information to the site operators.

## Cookies We Use

GenSmart uses **only essential cookies** required for the platform to function. We do not use analytics, advertising, or third-party tracking cookies.

| Cookie | Purpose | Type | Duration |
|--------|---------|------|----------|
| `refresh_token` | Authentication — maintains your login session | HttpOnly, Secure, SameSite=Strict | 7 days |

### Details

- **refresh_token:** This cookie is set when you log in to GenSmart. It is used to maintain your authenticated session and to issue new access tokens. This cookie is:
  - **HttpOnly:** Cannot be accessed by JavaScript, protecting against XSS attacks.
  - **Secure:** Only transmitted over HTTPS connections.
  - **SameSite=Strict:** Not sent with cross-site requests, protecting against CSRF attacks.
  - Automatically rotated on each use for additional security.

## What We Do NOT Use

- No analytics cookies (Google Analytics, Mixpanel, etc.)
- No advertising or retargeting cookies
- No social media tracking cookies
- No third-party cookies of any kind

## Web Widget

The GenSmart web widget (embedded on your customers' websites) uses **localStorage** (not cookies) to maintain chat sessions:
- `gs_widget_session_{agentId}` — stores the conversation session ID
- `gs_widget_msgs_{agentId}` — caches recent messages for faster loading

These are stored in the end-user's browser and are not transmitted to any third party.

## Managing Cookies

You can manage or delete cookies through your browser settings:
- **Chrome:** Settings > Privacy and Security > Cookies
- **Firefox:** Settings > Privacy & Security > Cookies
- **Safari:** Preferences > Privacy > Cookies
- **Edge:** Settings > Privacy > Cookies

Note: Deleting the `refresh_token` cookie will log you out of GenSmart.

## Changes to This Policy

We may update this Cookie Policy if we introduce new cookies or change how we use existing ones. Changes will be noted on this page with an updated "Last Updated" date.

## Contact Us

If you have questions about our use of cookies:

- **Email:** privacy@gensmart.co
- **Company:** Dysruptia LLC
- **Website:** [www.gensmart.co](https://www.gensmart.co)

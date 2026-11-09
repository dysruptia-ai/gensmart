'use client';

import Script from 'next/script';

const AGENT_ID = process.env['NEXT_PUBLIC_SITE_WIDGET_AGENT_ID'];
const SRC = process.env['NEXT_PUBLIC_SITE_WIDGET_SRC'] || '/widget.js';
const API_URL = process.env['NEXT_PUBLIC_SITE_WIDGET_API_URL'];

/**
 * Widget real de GenSmart (public/widget.js) para el agente del sitio.
 * Equivale a: <script src=".../widget.js" data-agent-id="..."></script>
 * Sin NEXT_PUBLIC_SITE_WIDGET_AGENT_ID no renderiza nada.
 * widget.js lee document.currentScript: next/script crea el <script> con createElement,
 * así que currentScript apunta a esa etiqueta y sus atributos data-*.
 */
export default function SiteChatWidget() {
  if (!AGENT_ID) return null;
  const apiProps = API_URL ? { 'data-api-url': API_URL } : {};
  return (
    <Script
      id="gensmart-site-widget"
      src={SRC}
      strategy="lazyOnload"
      data-agent-id={AGENT_ID}
      {...apiProps}
    />
  );
}

import { Metadata } from 'next';
import { MessageSquare, ArrowRight, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'WhatsApp Setup Guide — GenSmart',
  description: 'Learn how to connect your WhatsApp Business account to GenSmart and start deploying AI agents.',
};

const STEPS = [
  'Create or open an agent in your GenSmart dashboard',
  "Go to the Channels tab in the agent editor",
  "Click \"Connect WhatsApp\" — you'll be guided through Facebook's Embedded Signup",
  'Grant the necessary permissions and link your WhatsApp Business account',
  'Your agent will be live on WhatsApp within minutes',
];

export default function WhatsAppSetupPage() {
  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '4rem 1.5rem', fontFamily: 'var(--font-family)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <MessageSquare size={32} color="var(--color-primary)" aria-hidden="true" />
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          WhatsApp Setup Guide
        </h1>
      </div>

      <p style={{ fontSize: '1.125rem', color: 'var(--color-text-secondary)', marginBottom: '2.5rem', lineHeight: 1.6 }}>
        Detailed setup documentation is coming soon. In the meantime, use our{' '}
        <strong>Embedded Signup</strong> feature for quick WhatsApp connection — it walks you
        through the process in just a few clicks.
      </p>

      <div style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '2rem',
        marginBottom: '2rem',
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '1.25rem' }}>
          Quick Start with Embedded Signup
        </h2>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {STEPS.map((step, i) => (
            <li key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <CheckCircle size={20} color="var(--color-success)" style={{ flexShrink: 0, marginTop: '0.125rem' }} aria-hidden="true" />
              <span style={{ color: 'var(--color-text-primary)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                <strong>Step {i + 1}:</strong> {step}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div style={{
        background: 'var(--color-primary-light)',
        border: '1px solid var(--color-primary)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '2rem',
      }}>
        <p style={{ margin: 0, color: 'var(--color-primary-dark)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
          <strong>Prerequisites:</strong> You need a Meta Business Account and a verified phone number
          not currently associated with another WhatsApp account. Visit{' '}
          <a
            href="https://business.facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-primary-dark)', fontWeight: 600 }}
          >
            business.facebook.com
          </a>{' '}
          to set up your Meta Business Account if you don&apos;t have one.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link
          href="/register"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--color-primary)',
            color: '#fff',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: '0.9375rem',
          }}
        >
          Get Started Free <ArrowRight size={16} />
        </Link>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'transparent',
            color: 'var(--color-text-primary)',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: '0.9375rem',
            border: '1px solid var(--color-border)',
          }}
        >
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}

import { Metadata } from 'next';
import Link from 'next/link';
import { MessageSquare, CheckCircle, ExternalLink, ArrowRight, Info } from 'lucide-react';
import styles from './whatsapp-setup.module.css';

export const metadata: Metadata = {
  title: 'WhatsApp Setup Guide — GenSmart',
  description: 'Step-by-step guide to connect your WhatsApp Business account to GenSmart and deploy AI agents on WhatsApp.',
};

const STEPS = [
  {
    title: 'Create a Meta Developer App',
    desc: 'Go to the Meta for Developers portal and create a new App. Choose "Business" as the app type.',
    link: { href: 'https://developers.facebook.com/apps', label: 'developers.facebook.com' },
    info: 'You need a Meta Business Account linked to your developer account. If you don\'t have one, create it first at business.facebook.com.',
  },
  {
    title: 'Add the WhatsApp Product',
    desc: 'From your app dashboard, click "Add Product" → select WhatsApp → click "Set Up". This creates a WhatsApp Business Account (WABA) sandbox for testing.',
    info: null,
  },
  {
    title: 'Get your Phone Number ID and WABA ID',
    desc: 'In the WhatsApp → Getting Started section, find the "Phone number ID" and "WhatsApp Business Account ID". Copy both — you\'ll need them in GenSmart.',
    info: 'The test number provided by Meta is free to use in sandbox mode. To go live, add and verify your own business phone number.',
  },
  {
    title: 'Generate a Permanent Access Token',
    desc: 'Go to Meta Business Manager → Settings → System Users. Create a system user with Admin role, assign your app, then click "Generate Token" with scopes: whatsapp_business_messaging and whatsapp_business_management.',
    link: { href: 'https://business.facebook.com/settings/system-users', label: 'Business Manager System Users' },
    info: 'Temporary tokens expire after 24h. Always use a System User token for production deployments.',
  },
  {
    title: 'Connect in GenSmart',
    desc: 'Open your agent in the GenSmart dashboard → Channels tab → WhatsApp section → Manual Setup. Enter your Phone Number ID, WABA ID, and Permanent Access Token, then click Connect.',
    info: null,
  },
  {
    title: 'Configure the Webhook in Meta',
    desc: 'After connecting, GenSmart shows you a Webhook URL and Verify Token. Go to your Meta app → WhatsApp → Configuration → Webhook. Click "Edit" and paste both values. Subscribe to the "messages" field.',
    info: 'In development you can use ngrok to expose your local server: run "ngrok http 4000" and use the https URL as your webhook base.',
  },
];

export default function WhatsAppSetupPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <MessageSquare size={32} color="var(--color-primary)" aria-hidden="true" />
        <h1 className={styles.title}>WhatsApp Setup Guide</h1>
      </div>

      <p className={styles.subtitle}>
        Follow these steps to connect your WhatsApp Business account to GenSmart and start
        deploying AI agents that respond to your customers on WhatsApp.
      </p>

      {/* Prerequisites */}
      <div className={styles.prereqBanner}>
        <Info size={18} color="var(--color-primary-dark)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <p>
          <strong>Prerequisites:</strong> A{' '}
          <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer">
            Meta Business Account
          </a>{' '}
          and a phone number not currently registered with WhatsApp. GenSmart requires a{' '}
          <strong>Starter plan or higher</strong> to use WhatsApp.
        </p>
      </div>

      {/* Step-by-step */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Manual Setup — Step by Step</h2>
        <ol className={styles.stepList}>
          {STEPS.map((step, i) => (
            <li key={i} className={styles.step}>
              <span className={styles.stepNum}>{i + 1}</span>
              <div className={styles.stepContent}>
                <div className={styles.stepTitle}>{step.title}</div>
                <p className={styles.stepDesc}>
                  {step.desc}
                  {step.link && (
                    <>
                      {' '}
                      <a href={step.link.href} target="_blank" rel="noopener noreferrer">
                        {step.link.label} <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    </>
                  )}
                </p>
                {step.info && (
                  <div className={styles.infoBox}>
                    {step.info}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Embedded Signup alternative */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Quick Setup with Facebook Login</h2>
        <ol className={styles.stepList}>
          {[
            'Open your agent in the GenSmart dashboard and go to the Channels tab.',
            'In the WhatsApp section, click "Connect with Facebook".',
            'Log in with your Facebook account and grant the required permissions.',
            'GenSmart will automatically retrieve your Phone Number ID and WABA ID.',
            'Copy the Webhook URL and Verify Token shown, and configure them in your Meta app.',
          ].map((step, i) => (
            <li key={i} className={styles.step}>
              <span className={styles.stepNum}>
                <CheckCircle size={14} aria-hidden="true" />
              </span>
              <div className={styles.stepContent}>
                <p className={styles.stepDesc} style={{ margin: 0 }}>{step}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.ctaRow}>
        <Link href="/register" className={styles.ctaPrimary}>
          Get Started Free <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link href="/dashboard" className={styles.ctaSecondary}>
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

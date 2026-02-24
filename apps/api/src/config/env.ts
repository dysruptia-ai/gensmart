import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const env = {
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  PORT: parseInt(optionalEnv('PORT', '4000'), 10),
  DATABASE_URL: optionalEnv('DATABASE_URL', 'postgresql://gensmart:gensmart@localhost:5432/gensmart'),
  REDIS_URL: optionalEnv('REDIS_URL', 'redis://localhost:6379'),
  JWT_ACCESS_SECRET: optionalEnv('JWT_ACCESS_SECRET', 'dev-access-secret-change-in-production'),
  JWT_REFRESH_SECRET: optionalEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production'),
  ENCRYPTION_KEY: optionalEnv('ENCRYPTION_KEY', '0'.repeat(64)),
  FRONTEND_URL: optionalEnv('FRONTEND_URL', 'http://localhost:3000'),
  API_URL: optionalEnv('API_URL', 'http://localhost:4000'),
  OPENAI_API_KEY: process.env['OPENAI_API_KEY'] ?? '',
  ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'] ?? '',
  STRIPE_SECRET_KEY: process.env['STRIPE_SECRET_KEY'] ?? '',
  STRIPE_WEBHOOK_SECRET: process.env['STRIPE_WEBHOOK_SECRET'] ?? '',
  META_APP_SECRET: process.env['META_APP_SECRET'] ?? '',
  META_VERIFY_TOKEN: process.env['META_VERIFY_TOKEN'] ?? '',
  SMTP_HOST: process.env['SMTP_HOST'] ?? '',
  SMTP_PORT: parseInt(optionalEnv('SMTP_PORT', '587'), 10),
  SMTP_USER: process.env['SMTP_USER'] ?? '',
  SMTP_PASS: process.env['SMTP_PASS'] ?? '',
  SMTP_FROM: optionalEnv('SMTP_FROM', 'noreply@gensmart.ai'),
};

// Keep requireEnv available for future use
export { requireEnv };

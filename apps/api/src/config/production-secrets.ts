/**
 * Startup guard for the JWT signing secrets. No imports on purpose: it must be testable without
 * loading the rest of the configuration. Error messages name the variable, never its value.
 */

export const DEV_JWT_ACCESS_SECRET = 'dev-access-secret-change-in-production';
export const DEV_JWT_REFRESH_SECRET = 'dev-refresh-secret-change-in-production';
export const DEV_JWT_TEMP_SECRET = 'dev-temp-secret-change-in-production';

/** Placeholder shipped in .env.example: public, so it is as unusable as the code defaults. */
const EXAMPLE_PLACEHOLDER = 'change-me-random-64-chars-minimum-for-security';

const MIN_SECRET_LENGTH = 32;

const JWT_SECRETS: ReadonlyArray<{ name: string; devDefault: string }> = [
  { name: 'JWT_ACCESS_SECRET', devDefault: DEV_JWT_ACCESS_SECRET },
  { name: 'JWT_REFRESH_SECRET', devDefault: DEV_JWT_REFRESH_SECRET },
  { name: 'JWT_TEMP_SECRET', devDefault: DEV_JWT_TEMP_SECRET },
];

export function assertProductionSecrets(source: Record<string, string | undefined>): void {
  if (source['NODE_ENV'] !== 'production') return;

  for (const { name, devDefault } of JWT_SECRETS) {
    const value = source[name];
    if (!value) {
      throw new Error(`${name} must be set when NODE_ENV=production`);
    }
    if (value === devDefault || value === EXAMPLE_PLACEHOLDER) {
      throw new Error(`${name} must not be a default or placeholder value when NODE_ENV=production`);
    }
    if (value.length < MIN_SECRET_LENGTH) {
      throw new Error(`${name} must be at least ${MIN_SECRET_LENGTH} characters when NODE_ENV=production`);
    }
  }
}

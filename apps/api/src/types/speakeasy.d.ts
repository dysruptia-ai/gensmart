declare module 'speakeasy' {
  interface GeneratedSecret {
    ascii: string;
    hex: string;
    base32: string;
    otpauth_url?: string;
  }

  interface GenerateSecretOptions {
    name?: string;
    issuer?: string;
    length?: number;
  }

  interface TotpVerifyOptions {
    secret: string;
    token: string;
    encoding?: 'base32' | 'ascii' | 'hex';
    window?: number;
  }

  function generateSecret(options?: GenerateSecretOptions): GeneratedSecret;

  const totp: {
    verify(options: TotpVerifyOptions): boolean;
  };
}

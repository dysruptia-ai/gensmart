import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // El sitio público y la plataforma no comparten diccionarios (web-34).
  {
    files: ["components/site/**", "app/(site)/**", "app/global-not-found.tsx", "lib/site-*.ts", "hooks/useSiteTranslation.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@/i18n/app/*", "**/i18n/app/*"], message: "El sitio usa i18n/site/* (useSiteTranslation o siteT)." },
          { group: ["@/hooks/useTranslation", "**/hooks/useTranslation"], message: "El sitio usa useSiteTranslation." },
        ],
      }],
    },
  },
  {
    files: ["app/(platform)/**", "components/**", "contexts/**", "hooks/**", "lib/**"],
    ignores: ["components/site/**", "lib/site-*.ts", "hooks/useSiteTranslation.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@/i18n/site/*", "**/i18n/site/*", "@/lib/site-i18n", "@/hooks/useSiteTranslation"], message: "La plataforma usa i18n/app/* con useTranslation." },
        ],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Material de diseño (solo referencia)
    "design/**",
    "../../design/**",
  ]),
]);

export default eslintConfig;

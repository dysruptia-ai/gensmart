/**
 * Componentes base de la plataforma nueva (diseño 2026, tokens de `app/(platform)/gs-tokens.css`).
 * Solo funcionan dentro de un contenedor `.gsApp`. `components/ui/` sigue para el dashboard viejo.
 */
export { default as AppButton, appButtonClass } from './AppButton/AppButton';
export type { AppButtonProps } from './AppButton/AppButton';
export { default as AppButtonLink } from './AppButton/AppButtonLink';
export { default as TextButton } from './TextButton/TextButton';
export { default as TextField } from './TextField/TextField';
export type { TextFieldProps } from './TextField/TextField';
export { default as PasswordField } from './PasswordField/PasswordField';
export { default as Checkbox } from './Checkbox/Checkbox';
export { default as CodeInput } from './CodeInput/CodeInput';
export { default as Notice } from './Notice/Notice';
export type { NoticeKind } from './Notice/Notice';
export { default as AppLogo } from './AppLogo/AppLogo';
export { default as ThemeToggle } from './ThemeToggle/ThemeToggle';
export { default as LanguageSwitch } from './LanguageSwitch/LanguageSwitch';
export { default as PasswordRules, passwordChecks, passwordIsValid } from './PasswordRules/PasswordRules';
export { default as AppTurnstile } from './AppTurnstile/AppTurnstile';

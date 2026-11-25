import React from 'react';
import styles from './PasswordRules.module.css';

/** Reglas de contraseña de la API (`passwordSchema` de @gensmart/shared). */
export function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };
}

export function passwordIsValid(password: string): boolean {
  const c = passwordChecks(password);
  return c.length && c.upper && c.number;
}

export interface PasswordRulesProps {
  id: string;
  password: string;
  label: string;
  rules: { length: string; upper: string; number: string };
  /** Texto para lectores de pantalla: "cumplido" / "pendiente". */
  metLabel: string;
  unmetLabel: string;
}

/** Lista de reglas que se marcan a medida que se cumplen. */
export default function PasswordRules({ id, password, label, rules, metLabel, unmetLabel }: PasswordRulesProps) {
  const checks = passwordChecks(password);
  const items: Array<[keyof typeof checks, string]> = [
    ['length', rules.length],
    ['upper', rules.upper],
    ['number', rules.number],
  ];
  return (
    <ul className={styles.rules} id={id} aria-label={label}>
      {items.map(([key, text]) => (
        <li key={key} className={checks[key] ? styles.ok : undefined}>
          {text}
          <span className="gsSr">: {checks[key] ? metLabel : unmetLabel}</span>
        </li>
      ))}
    </ul>
  );
}

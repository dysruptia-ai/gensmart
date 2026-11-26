import { query } from '../config/database';
import { toEmailLang, type EmailLang } from '../emails';

/**
 * Idioma del dueño de una organización (`users.language`), para los correos que no van a un usuario
 * concreto: cita nueva, cita confirmada sin idioma del cliente y el contenedor del correo del agente.
 * Sin dueño o sin idioma: `en`.
 */
export async function getOrgOwnerLanguage(organizationId: string): Promise<EmailLang> {
  try {
    const result = await query<{ language: string | null }>(
      `SELECT u.language
       FROM users u
       JOIN user_organizations uo ON uo.user_id = u.id
       WHERE uo.organization_id = $1 AND uo.role = 'owner'
       ORDER BY uo.created_at ASC
       LIMIT 1`,
      [organizationId]
    );
    return toEmailLang(result.rows[0]?.language);
  } catch (err) {
    console.warn('[email] Could not read the owner language:', err instanceof Error ? err.message : 'unknown');
    return 'en';
  }
}

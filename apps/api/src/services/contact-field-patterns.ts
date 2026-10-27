/**
 * Variable names that map onto the built-in contact columns. Pure module (no DB/env) so that both the
 * variable-capture service and the pure email-parsing helpers can share the lists.
 */
export const NAME_FIELD_PATTERNS: readonly string[] = [
  'name', 'nombre', 'full_name', 'fullname', 'user_name', 'username',
  'first_name', 'customer_name', 'nombre_completo', 'client_name',
  'contact_name', 'persona', 'nombre_cliente',
];

export const EMAIL_FIELD_PATTERNS: readonly string[] = [
  'email', 'correo', 'email_address', 'user_email', 'customer_email',
  'correo_electronico', 'mail', 'e_mail', 'contact_email', 'client_email',
];

export const PHONE_FIELD_PATTERNS: readonly string[] = [
  'phone', 'telefono', 'whatsapp', 'mobile', 'phone_number', 'user_phone',
  'celular', 'numero', 'customer_phone', 'tel', 'cell', 'numero_telefono',
  'contact_phone', 'client_phone', 'movil',
];

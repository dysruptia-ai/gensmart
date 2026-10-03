/** Pure helper (no imports): does the phone number belong to the WABA's phone number list? */
export function phoneBelongsToWaba(phoneIds: readonly string[], phoneNumberId: string): boolean {
  const wanted = String(phoneNumberId).trim();
  if (!wanted) return false;
  return phoneIds.some((id) => String(id).trim() === wanted);
}

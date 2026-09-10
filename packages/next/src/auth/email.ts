/** Normalize email for uniqueness checks (lowercase, trimmed). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

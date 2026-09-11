import { AuthNinjaError } from "@auth-ninja/core";

/** Map auth API errors to user-visible messages (generic where required). */
export function formatAuthError(error: unknown): string {
  if (error instanceof AuthNinjaError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

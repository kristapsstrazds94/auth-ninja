import type { AuthNinjaConfig } from "@auth-ninja/core";

export type AuthNinjaNextOptions = Partial<AuthNinjaConfig> & {
  secret: string;
  baseUrl: string;
};

/** Placeholder — full Next.js integration in task 3.1 */
export function createAuthNinjaConfig(options: AuthNinjaNextOptions): AuthNinjaNextOptions {
  return options;
}

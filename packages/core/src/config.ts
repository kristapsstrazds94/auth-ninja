import { z } from "zod";

export const authNinjaConfigSchema = z.object({
  secret: z.string().min(32, "AUTH_NINJA_SECRET must be at least 32 characters"),
  baseUrl: z.string().url(),
  sessionIdleMinutes: z.number().int().positive().default(15),
  sessionAbsoluteHours: z.number().int().positive().default(8),
  lockoutMaxAttempts: z.number().int().positive().default(5),
  lockoutWindowMinutes: z.number().int().positive().default(15),
  lockoutDurationMinutes: z.number().int().positive().default(30),
  require2fa: z.boolean().default(false),
  passkeysEnabled: z.boolean().default(true),
  ipAuditEnabled: z.boolean().default(true),
  csrfEnabled: z.boolean().default(true),
  apiRateLimitPerMinute: z.number().int().positive().default(100),
});

export type AuthNinjaConfig = z.infer<typeof authNinjaConfigSchema>;

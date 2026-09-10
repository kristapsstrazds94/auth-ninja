import { z } from "zod";

export const authNinjaConfigSchema = z.object({
  secret: z.string().min(32, "AUTH_NINJA_SECRET must be at least 32 characters"),
  baseUrl: z.string().url("AUTH_NINJA_BASE_URL must be a valid URL"),
  databaseUrl: z
    .string()
    .min(1, "AUTH_NINJA_DATABASE_URL is required"),
  sessionIdleMinutes: z.number().int().positive().default(15),
  sessionAbsoluteHours: z.number().int().positive().default(8),
  lockoutMaxAttempts: z.number().int().positive().default(5),
  lockoutWindowMinutes: z.number().int().positive().default(15),
  lockoutDurationMinutes: z.number().int().positive().default(30),
  require2fa: z.boolean().default(false),
  twoFaIssuer: z.string().min(1).default("AuthNinja"),
  passkeysEnabled: z.boolean().default(true),
  passkeyRpId: z.string().min(1).default("localhost"),
  ipAuditEnabled: z.boolean().default(true),
  ipAllowlist: z.array(z.string().min(1)).optional(),
  csrfEnabled: z.boolean().default(true),
  apiRateLimitPerMinute: z.number().int().positive().default(100),
  redisUrl: z.string().url().optional(),
});

export type AuthNinjaConfig = z.infer<typeof authNinjaConfigSchema>;

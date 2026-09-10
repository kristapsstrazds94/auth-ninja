import { z } from "zod";

/** Matches OpenAPI `RegisterRequest`. */
export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

/** Matches OpenAPI `LoginRequest`. */
export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Matches OpenAPI `TotpCodeRequest`. */
export const totpCodeRequestSchema = z.object({
  code: z.string().regex(/^[0-9]{6}$/),
});

/** Matches OpenAPI `TotpVerifyRequest`. */
export const totpVerifyRequestSchema = z.object({
  loginToken: z.string().min(1),
  code: z.string().regex(/^[0-9]{6}$/),
});

/** Matches OpenAPI `PasswordConfirmRequest`. */
export const passwordConfirmRequestSchema = z.object({
  password: z.string().min(1).max(128),
});

/** Matches OpenAPI `Disable2faRequest`. */
export const disable2faRequestSchema = z
  .object({
    password: z.string().min(1).max(128),
    code: z.string().regex(/^[0-9]{6}$/).optional(),
    backupCode: z.string().min(8).max(32).optional(),
  })
  .refine((data) => data.code !== undefined || data.backupCode !== undefined, {
    message: "Either code or backupCode is required",
  });

/** Matches OpenAPI `PasskeyLoginBeginRequest`. */
export const passkeyLoginBeginRequestSchema = z.object({
  email: z.string().email().optional(),
});

/** Matches OpenAPI WebAuthn finish request bodies (`response` field). */
export const webAuthnFinishRequestSchema = z.object({
  response: z.record(z.unknown()),
});

export type TotpCodeRequest = z.infer<typeof totpCodeRequestSchema>;
export type TotpVerifyRequest = z.infer<typeof totpVerifyRequestSchema>;
export type PasswordConfirmRequest = z.infer<typeof passwordConfirmRequestSchema>;
export type Disable2faRequest = z.infer<typeof disable2faRequestSchema>;
export type PasskeyLoginBeginRequest = z.infer<typeof passkeyLoginBeginRequestSchema>;
export type WebAuthnFinishRequest = z.infer<typeof webAuthnFinishRequestSchema>;

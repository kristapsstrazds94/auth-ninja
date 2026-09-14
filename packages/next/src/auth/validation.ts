import { isPasswordStrongEnough } from "@auth-ninja/core";
import { z } from "zod";

const passwordFieldSchema = z.string().min(8).max(128);

function passwordStrengthRefine(minScore: number) {
  return (data: { password: string }, ctx: z.RefinementCtx) => {
    if (!isPasswordStrongEnough(data.password, minScore)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password does not meet strength requirements.",
        path: ["password"],
      });
    }
  };
}

/** Matches OpenAPI `RegisterRequest` with zxcvbn strength check. */
export function registerRequestSchema(minScore = 2) {
  return z
    .object({
      email: z.string().email(),
      password: passwordFieldSchema,
    })
    .superRefine(passwordStrengthRefine(minScore));
}

/** Default register schema (min zxcvbn score 2). */
export const defaultRegisterRequestSchema = registerRequestSchema();

/** Matches OpenAPI `LoginRequest`. */
export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export type RegisterRequest = z.infer<ReturnType<typeof registerRequestSchema>>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Matches OpenAPI `PasswordResetRequest`. */
export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

/** Matches OpenAPI `PasswordResetConfirmRequest`. */
export function passwordResetConfirmRequestSchema(minScore = 2) {
  return z
    .object({
      token: z.string().min(32),
      password: passwordFieldSchema,
    })
    .superRefine(passwordStrengthRefine(minScore));
}

export const defaultPasswordResetConfirmRequestSchema = passwordResetConfirmRequestSchema();

export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmRequest = z.infer<
  ReturnType<typeof passwordResetConfirmRequestSchema>
>;

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

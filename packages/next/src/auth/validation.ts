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

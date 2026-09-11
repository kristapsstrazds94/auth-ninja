import { randomBytes } from "node:crypto";
import { isWeakSecret } from "./env-loader.js";

const SECRET_BYTE_LENGTH = 32;
const MAX_GENERATION_ATTEMPTS = 10;

/** Generate a cryptographically strong value for `AUTH_NINJA_SECRET`. */
export function generateAuthNinjaSecret(): string {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const secret = randomBytes(SECRET_BYTE_LENGTH).toString("base64url");
    if (!isWeakSecret(secret)) {
      return secret;
    }
  }

  throw new Error("Failed to generate a strong AUTH_NINJA_SECRET");
}

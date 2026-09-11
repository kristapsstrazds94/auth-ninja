import { generateAuthNinjaSecret } from "@auth-ninja/core";

export type KeysGenerateResult = {
  secret: string;
  line: string;
};

/** Generate and print a secure `AUTH_NINJA_SECRET` for `.env` files. */
export function runKeysGenerate(): KeysGenerateResult {
  const secret = generateAuthNinjaSecret();
  const line = `AUTH_NINJA_SECRET=${secret}`;
  console.log(line);
  console.log("Add to your .env file — do not commit this value.");
  return { secret, line };
}

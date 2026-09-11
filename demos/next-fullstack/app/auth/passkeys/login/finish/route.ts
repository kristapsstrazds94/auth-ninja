import { createPasskeyLoginFinishHandler } from "@auth-ninja/next";
import { getAuthNinja } from "../../../../../lib/auth-ninja.js";

export async function POST(request: Request) {
  const auth = await getAuthNinja();
  return createPasskeyLoginFinishHandler(auth)(request);
}

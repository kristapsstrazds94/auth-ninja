import { createPasskeyRegisterBeginHandler } from "@auth-ninja/next";
import { getAuthNinja } from "../../../../../lib/auth-ninja";

export async function POST(request: Request) {
  const auth = await getAuthNinja();
  return createPasskeyRegisterBeginHandler(auth)(request);
}

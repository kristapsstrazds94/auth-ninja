import { createPasskeyListHandler } from "@auth-ninja/next";
import { getAuthNinja } from "../../../lib/auth-ninja.js";

export async function GET(request: Request) {
  const auth = await getAuthNinja();
  return createPasskeyListHandler(auth)(request);
}

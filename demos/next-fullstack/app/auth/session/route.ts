import { createSessionHandler } from "@auth-ninja/next";
import { getAuthNinja } from "../../../lib/auth-ninja";

export async function GET(request: Request) {
  const auth = await getAuthNinja();
  return createSessionHandler(auth)(request);
}

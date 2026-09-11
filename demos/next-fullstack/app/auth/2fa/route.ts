import { createTwoFaDisableHandler } from "@auth-ninja/next";
import { getAuthNinja } from "../../../lib/auth-ninja.js";

export async function DELETE(request: Request) {
  const auth = await getAuthNinja();
  return createTwoFaDisableHandler(auth)(request);
}

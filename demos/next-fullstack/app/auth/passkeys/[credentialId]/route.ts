import { createPasskeyDeleteHandler } from "@auth-ninja/next";
import { getAuthNinja } from "../../../../lib/auth-ninja";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ credentialId: string }> },
) {
  const auth = await getAuthNinja();
  const params = await context.params;
  return createPasskeyDeleteHandler(auth)(request, { params });
}

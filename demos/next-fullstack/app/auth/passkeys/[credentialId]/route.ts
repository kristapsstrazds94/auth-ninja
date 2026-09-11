import { createPasskeyDeleteHandler } from "@auth-ninja/next";
import { withAuthGuardDynamic } from "@/lib/with-auth-guard";

export const DELETE = withAuthGuardDynamic(async (request, auth, { params }) => {
  const resolved = await params;
  return createPasskeyDeleteHandler(auth)(request, { params: resolved });
});

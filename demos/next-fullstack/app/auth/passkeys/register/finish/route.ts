import { createPasskeyRegisterFinishHandler } from "@auth-ninja/next";
import { withAuthGuard } from "@/lib/with-auth-guard";

export const POST = withAuthGuard((request, auth) =>
  createPasskeyRegisterFinishHandler(auth)(request),
);

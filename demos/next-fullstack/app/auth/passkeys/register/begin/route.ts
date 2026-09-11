import { createPasskeyRegisterBeginHandler } from "@auth-ninja/next";
import { withAuthGuard } from "@/lib/with-auth-guard";

export const POST = withAuthGuard((request, auth) =>
  createPasskeyRegisterBeginHandler(auth)(request),
);

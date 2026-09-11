import { createTwoFaEnrollHandler } from "@auth-ninja/next";
import { withAuthGuard } from "@/lib/with-auth-guard";

export const POST = withAuthGuard((request, auth) => createTwoFaEnrollHandler(auth)(request));

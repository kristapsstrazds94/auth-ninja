import { createLoginHandler } from "@auth-ninja/next";
import { withAuthGuard } from "@/lib/with-auth-guard";

export const POST = withAuthGuard((request, auth) => createLoginHandler(auth)(request));

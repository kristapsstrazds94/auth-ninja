import { createSessionHandler } from "@auth-ninja/next";
import { withAuthGuard } from "@/lib/with-auth-guard";

export const GET = withAuthGuard((request, auth) => createSessionHandler(auth)(request));

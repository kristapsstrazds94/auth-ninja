import { createCsrfHandler } from "@auth-ninja/next";
import { withAuthGuard } from "@/lib/with-auth-guard";

export const GET = withAuthGuard((request, auth) => createCsrfHandler(auth)(request));

import { createPasskeyListHandler } from "@auth-ninja/next";
import { withAuthGuard } from "@/lib/with-auth-guard";

export const GET = withAuthGuard((request, auth) => createPasskeyListHandler(auth)(request));

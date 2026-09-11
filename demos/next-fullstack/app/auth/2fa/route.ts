import { createTwoFaDisableHandler } from "@auth-ninja/next";
import { withAuthGuard } from "@/lib/with-auth-guard";

export const DELETE = withAuthGuard((request, auth) =>
  createTwoFaDisableHandler(auth)(request),
);

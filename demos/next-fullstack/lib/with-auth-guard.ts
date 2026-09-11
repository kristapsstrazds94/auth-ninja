import {
  createAuthApiGuard,
  type AuthNinjaContext,
} from "@auth-ninja/next";
import { getAuthNinja } from "./auth-ninja";

type StaticRouteHandler = (
  request: Request,
  auth: AuthNinjaContext,
) => Promise<Response> | Response;

type DynamicRouteHandler = (
  request: Request,
  auth: AuthNinjaContext,
  context: { params: Promise<{ credentialId: string }> },
) => Promise<Response> | Response;

/** Run rate limit, CSRF, and IP audit before an auth route handler (Node.js routes). */
export function withAuthGuard(handler: StaticRouteHandler) {
  return async (request: Request) => {
    const auth = await getAuthNinja();
    const guard = createAuthApiGuard(auth);
    const blocked = await guard(request);
    if (blocked) {
      return blocked;
    }
    return handler(request, auth);
  };
}

export function withAuthGuardDynamic(handler: DynamicRouteHandler) {
  return async (
    request: Request,
    context: { params: Promise<{ credentialId: string }> },
  ) => {
    const auth = await getAuthNinja();
    const guard = createAuthApiGuard(auth);
    const blocked = await guard(request);
    if (blocked) {
      return blocked;
    }
    return handler(request, auth, context);
  };
}

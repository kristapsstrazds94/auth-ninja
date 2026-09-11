import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAuthMiddleware } from "@auth-ninja/next";
import { getAuthNinja } from "./lib/auth-ninja";

export async function middleware(request: NextRequest) {
  const auth = await getAuthNinja();
  const guard = createAuthMiddleware(auth);
  const blocked = await guard(request);
  if (blocked) {
    return blocked;
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/auth/:path*",
};

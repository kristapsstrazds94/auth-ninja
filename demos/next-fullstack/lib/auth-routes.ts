const AUTH_LAYOUT_PATHS = ["/login", "/register", "/2fa/verify"] as const;

export function isAuthLayoutPath(pathname: string): boolean {
  return AUTH_LAYOUT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

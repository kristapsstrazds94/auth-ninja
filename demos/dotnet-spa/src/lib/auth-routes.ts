const CENTERED_AUTH_PATHS = ["/login", "/register", "/2fa/verify"] as const;

/** Paths that hide the top navigation bar */
const HIDE_NAV_PATHS = ["/2fa/verify"] as const;

function matchesPath(pathname: string, paths: readonly string[]): boolean {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isCenteredAuthPath(pathname: string): boolean {
  return matchesPath(pathname, CENTERED_AUTH_PATHS);
}

export function isAuthLayoutPath(pathname: string): boolean {
  return matchesPath(pathname, HIDE_NAV_PATHS);
}

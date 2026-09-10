import { CSRF_PROTECTED_METHODS } from "@auth-ninja/protocol";
import { DEFAULT_AUTH_PATH_PREFIX } from "./constants.js";

function normalizePrefix(prefix: string): string {
  if (!prefix.startsWith("/")) {
    return `/${prefix}`;
  }
  return prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
}

/** True when the pathname is under the configured auth API prefix. */
export function isAuthApiPath(pathname: string, prefix = DEFAULT_AUTH_PATH_PREFIX): boolean {
  const normalized = normalizePrefix(prefix);
  return pathname === normalized || pathname.startsWith(`${normalized}/`);
}

function matchRoutePath(pathname: string, pattern: string): boolean {
  const pathSegments = pathname.split("/").filter(Boolean);
  const patternSegments = pattern.split("/").filter(Boolean);

  if (pathSegments.length !== patternSegments.length) {
    return false;
  }

  return patternSegments.every((segment, index) => {
    if (segment.startsWith("{") && segment.endsWith("}")) {
      return true;
    }
    return segment === pathSegments[index];
  });
}

function protocolPathToPrefixPath(protocolPath: string, prefix: string): string {
  const normalized = normalizePrefix(prefix);
  const suffix = protocolPath.replace(/^\/auth/, "") || "";
  return `${normalized}${suffix}`;
}

/** True when the request matches a CSRF-protected auth endpoint. */
export function requiresCsrfProtection(
  method: string,
  pathname: string,
  prefix = DEFAULT_AUTH_PATH_PREFIX,
): boolean {
  const upperMethod = method.toUpperCase();

  for (const endpoint of CSRF_PROTECTED_METHODS) {
    const spaceIndex = endpoint.indexOf(" ");
    const endpointMethod = endpoint.slice(0, spaceIndex);
    const endpointPath = endpoint.slice(spaceIndex + 1);

    if (upperMethod !== endpointMethod) {
      continue;
    }

    const fullPath = protocolPathToPrefixPath(endpointPath, prefix);
    if (matchRoutePath(pathname, fullPath)) {
      return true;
    }
  }

  return false;
}

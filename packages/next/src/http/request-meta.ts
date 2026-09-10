export type RequestMeta = {
  ipAddress: string;
  userAgent?: string;
};

/** Extract client IP and user agent from a Request-like object. */
export function getRequestMeta(request: Request): RequestMeta {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "127.0.0.1";

  const userAgent = request.headers.get("user-agent") ?? undefined;

  return { ipAddress, userAgent };
}

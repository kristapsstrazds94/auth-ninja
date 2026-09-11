import type { NextConfig } from "next";

/** Native / Node-only deps — must stay external when auth packages are bundled. */
const NATIVE_SERVER_EXTERNALS = [
  "@node-rs/argon2",
  "postgres",
  "drizzle-orm",
] as const;

function isNativeServerExternal(request: string): boolean {
  return (
    NATIVE_SERVER_EXTERNALS.some(
      (pkg) => request === pkg || request.startsWith(`${pkg}/`),
    ) || request.startsWith("@node-rs/")
  );
}

const nextConfig: NextConfig = {
  transpilePackages: ["@auth-ninja/react"],
  serverExternalPackages: [...NATIVE_SERVER_EXTERNALS],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals)
          ? config.externals
          : [config.externals].filter(Boolean)),
        ({ request }: { request?: string }, callback: (err?: Error | null, result?: string) => void) => {
          if (request && isNativeServerExternal(request)) {
            callback(undefined, `commonjs ${request}`);
            return;
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;

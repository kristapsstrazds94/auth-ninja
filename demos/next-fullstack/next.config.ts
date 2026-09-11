import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@auth-ninja/react"],
  serverExternalPackages: ["@auth-ninja/core", "@auth-ninja/next", "@node-rs/argon2", "postgres"],
};

export default nextConfig;

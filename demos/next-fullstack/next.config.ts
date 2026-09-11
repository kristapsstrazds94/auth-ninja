import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@auth-ninja/core", "@auth-ninja/react"],
};

export default nextConfig;

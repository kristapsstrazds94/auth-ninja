"use client";

import { AuthProvider } from "@auth-ninja/react";
import { readDemoAuthClientConfig } from "@/lib/auth-config";

export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthProvider {...readDemoAuthClientConfig()}>{children}</AuthProvider>;
}

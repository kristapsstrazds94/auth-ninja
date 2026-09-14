"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@auth-ninja/react";
import { readDemoAuthClientConfig } from "@/lib/auth-config";
import { isCenteredAuthPath } from "@/lib/auth-routes";

export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sessionCheckOnMount = !isCenteredAuthPath(pathname);

  return (
    <AuthProvider
      {...readDemoAuthClientConfig()}
      sessionCheckOnMount={sessionCheckOnMount}
    >
      {children}
    </AuthProvider>
  );
}

import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AuthProvider, readViteAuthClientConfig } from "@auth-ninja/react";
import { isCenteredAuthPath } from "../lib/auth-routes";

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const sessionCheckOnMount = !isCenteredAuthPath(pathname);

  return (
    <AuthProvider
      {...readViteAuthClientConfig(import.meta.env)}
      sessionCheckOnMount={sessionCheckOnMount}
    >
      {children}
    </AuthProvider>
  );
}

import type { ReactNode } from "react";
import { useAuth } from "./use-auth.js";

export type RequireAuthProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequireAuth({ children, fallback = null }: RequireAuthProps) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <>{fallback}</>;
  return <>{children}</>;
}

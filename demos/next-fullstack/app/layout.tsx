import type { Metadata } from "next";
import { DemoAuthProvider } from "@/components/demo-auth-provider";
import { DemoShell } from "@/components/demo-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auth-Ninja Demo",
  description: "Full-stack reference app for secure authentication with Auth-Ninja",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Auth card hero logo — LCP on /login, /register, etc. */}
        <link rel="preload" as="image" href="/logo.png" fetchPriority="high" />
      </head>
      <body>
        <DemoAuthProvider>
          <DemoShell>{children}</DemoShell>
        </DemoAuthProvider>
      </body>
    </html>
  );
}

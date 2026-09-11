import type { Metadata } from "next";
import { DemoAuthProvider } from "@/components/demo-auth-provider";
import { DemoNav } from "@/components/demo-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auth-Ninja Next demo",
  description: "Throwaway full-stack demo for manual auth testing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DemoAuthProvider>
          <DemoNav />
          <main>{children}</main>
        </DemoAuthProvider>
      </body>
    </html>
  );
}

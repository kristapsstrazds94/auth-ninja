import { Suspense } from "react";
import { TwoFaVerifyPage } from "@/components/two-fa-verify-page";

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <TwoFaVerifyPage />
    </Suspense>
  );
}

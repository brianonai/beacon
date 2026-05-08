import { Suspense } from "react";
import { ScanClient } from "./ScanClient";

function ScanFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-ash">Loading scan…</p>
    </main>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<ScanFallback />}>
      <ScanClient />
    </Suspense>
  );
}

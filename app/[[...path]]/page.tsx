import { Suspense } from "react";
import Storefront from "@/components/storefront";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading ODAD Mart…</p>}>
      <Storefront />
    </Suspense>
  );
}

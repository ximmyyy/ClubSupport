"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loading } from "@/components/club-gate";

/** Entry point for "Open de demo": remembers the choice and opens the app on local demo data. */
export default function DemoPage() {
  const router = useRouter();
  useEffect(() => {
    try {
      window.localStorage.setItem("clubsupport:mode", "demo");
    } catch {
      /* ignore */
    }
    router.replace("/app");
  }, [router]);
  return <Loading />;
}

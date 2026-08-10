"use client";
import { useEffect, useRef, useState } from "react";

export function useWakeLock() {
  const [enabled, setEnabled] = useState(false);
  const lockRef = useRef<any>(null);

  useEffect(() => {
    async function apply() {
      try {
        if (enabled && "wakeLock" in navigator) {
          lockRef.current = await (navigator as any).wakeLock.request("screen");
        } else {
          await lockRef.current?.release?.();
          lockRef.current = null;
        }
      } catch {
        /* unsupported or denied — no-op */
      }
    }
    apply();
    const onVis = () => {
      if (enabled && document.visibilityState === "visible") apply();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lockRef.current?.release?.();
    };
  }, [enabled]);

  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
  return { enabled, setEnabled, supported };
}

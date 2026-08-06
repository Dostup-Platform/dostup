import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Detects when a PWA/browser tab returns from background (iOS freezes JS).
 * On resume: invalidates all React Query caches so data is fresh.
 * Also detects long JS pauses (>5s) which indicate the app was frozen.
 */
export const useAppResume = () => {
  const queryClient = useQueryClient();
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    // 1. visibilitychange — fires when user switches back to the app
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("[useAppResume] App resumed, invalidating queries");
        queryClient.invalidateQueries();
      }
    };

    // 2. Freeze detection — if setInterval fires after >5s gap, app was frozen
    const intervalId = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;

      if (elapsed > 5000) {
        console.log(`[useAppResume] Freeze detected (${Math.round(elapsed / 1000)}s gap), invalidating queries`);
        queryClient.invalidateQueries();
      }
    }, 2000);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [queryClient]);
};

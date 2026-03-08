import { useEffect, useRef, useState } from "react";
import {
  getWorkbookIdentityInput,
  resolveWorkbookIdentity,
} from "../lib/api";

const RECHECK_INTERVAL_MS = 5000;

export interface WorkbookIdentityState {
  workbookId: string | null;
  workbookResolveError: string | null;
  isResolvingWorkbook: boolean;
}

export function useWorkbookIdentity(enabled: boolean): WorkbookIdentityState {
  const [workbookId, setWorkbookId] = useState<string | null>(null);
  const [workbookResolveError, setWorkbookResolveError] = useState<string | null>(null);
  const [isResolvingWorkbook, setIsResolvingWorkbook] = useState(false);
  const lastResolvedRef = useRef<string | null>(null);
  const workbookIdRef = useRef<string | null>(null);
  const resolvingRef = useRef(false);

  useEffect(() => {
    workbookIdRef.current = workbookId;
  }, [workbookId]);

  useEffect(() => {
    if (!enabled) {
      setWorkbookId(null);
      setWorkbookResolveError(null);
      setIsResolvingWorkbook(false);
      lastResolvedRef.current = null;
      workbookIdRef.current = null;
      return;
    }

    let cancelled = false;

    async function resolveCurrentWorkbook(force: boolean = false) {
      if (resolvingRef.current) return;
      resolvingRef.current = true;
      if (!cancelled) setIsResolvingWorkbook(true);

      try {
        const input = await getWorkbookIdentityInput();
        const fingerprint = JSON.stringify(input);

        if (!force && lastResolvedRef.current === fingerprint && workbookIdRef.current) {
          if (!cancelled) setWorkbookResolveError(null);
          return;
        }

        const resolved = await resolveWorkbookIdentity(input);
        if (!cancelled) {
          lastResolvedRef.current = fingerprint;
          workbookIdRef.current = resolved.workbookId;
          setWorkbookId(resolved.workbookId);
          setWorkbookResolveError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setWorkbookResolveError(
            error instanceof Error ? error.message : "Failed to resolve workbook identity"
          );
        }
      } finally {
        resolvingRef.current = false;
        if (!cancelled) setIsResolvingWorkbook(false);
      }
    }

    void resolveCurrentWorkbook(true);

    const handleFocus = () => {
      void resolveCurrentWorkbook();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void resolveCurrentWorkbook();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const interval = window.setInterval(() => {
      void resolveCurrentWorkbook();
    }, RECHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(interval);
      resolvingRef.current = false;
    };
  }, [enabled]);

  return { workbookId, workbookResolveError, isResolvingWorkbook };
}

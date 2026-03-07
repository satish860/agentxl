/**
 * Hook: server status + reconnect + auth polling.
 *
 * Handles:
 * - Initial status fetch with retry on failure
 * - Reconnect polling when server goes down mid-session
 * - Auth polling when waiting for `agentxl login`
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { getConfigStatus, type ConfigStatus } from "../lib/api";

const RETRY_INTERVAL = 2000;

export interface AgentStatusState {
  status: ConfigStatus | null;
  connectionError: string | null;
  serverDown: boolean;
  /** Call when a network failure during chat indicates server is down. */
  markServerDown: () => void;
}

export function useAgentStatus(): AgentStatusState {
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [serverDown, setServerDown] = useState(false);
  const reconnectRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -------------------------------------------------------------------------
  // Core status check
  // -------------------------------------------------------------------------

  const checkStatus = useCallback(async (): Promise<boolean> => {
    try {
      const s = await getConfigStatus();
      setStatus(s);
      setConnectionError(null);
      setServerDown(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Initial load + retry
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    async function poll() {
      const ok = await checkStatus();
      if (!cancelled && !ok) {
        setConnectionError("Cannot connect to AgentXL server");
        retryTimer = setTimeout(poll, RETRY_INTERVAL);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [checkStatus]);

  // -------------------------------------------------------------------------
  // Auth polling (when unauthenticated, user may run `agentxl login`)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!status || status.authenticated) return;

    const interval = setInterval(async () => {
      const s = await getConfigStatus().catch(() => null);
      if (s?.authenticated) setStatus(s);
    }, RETRY_INTERVAL);

    return () => clearInterval(interval);
  }, [status]);

  // -------------------------------------------------------------------------
  // Reconnect after server failure mid-chat
  // -------------------------------------------------------------------------

  const markServerDown = useCallback(() => {
    setServerDown(true);

    if (reconnectRef.current) return; // already reconnecting
    reconnectRef.current = setInterval(async () => {
      const ok = await checkStatus();
      if (ok) {
        clearInterval(reconnectRef.current!);
        reconnectRef.current = null;
        setServerDown(false);
      }
    }, RETRY_INTERVAL);
  }, [checkStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectRef.current) clearInterval(reconnectRef.current);
    };
  }, []);

  return { status, connectionError, serverDown, markServerDown };
}

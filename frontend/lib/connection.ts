"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ADMIN_TOKEN_EVENT, CONNECTION_FAILURE_EVENT, getAdminToken, getBackendHealth, resolveApiBase, type HealthInfo } from "@/lib/api-client";

type ConnectionState = { checking: boolean; health: HealthInfo | null; error: string | null; apiBase: string | null; checkedAt: string | null };
const initialState: ConnectionState = { checking: false, health: null, error: null, apiBase: null, checkedAt: null };
let state = initialState;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: ConnectionState) { state = next; listeners.forEach((listener) => listener()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

export function refreshConnection(): Promise<void> {
  if (inFlight) return inFlight;
  publish({ ...state, checking: true, error: null });
  inFlight = (async () => {
    let apiBase: string | null = null;
    try {
      apiBase = resolveApiBase();
      const health = await getBackendHealth();
      publish({ checking: false, health, error: null, apiBase, checkedAt: new Date().toISOString() });
    } catch (error) {
      publish({ checking: false, health: null, error: error instanceof Error ? error.message : "后端不可达，请重试连接。", apiBase, checkedAt: new Date().toISOString() });
    }
  })().finally(() => { inFlight = null; });
  return inFlight;
}

export function useConnectionStatus() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => initialState);
  useEffect(() => {
    if (!state.checkedAt) void refreshConnection();
    const onFocus = () => { void refreshConnection(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener(CONNECTION_FAILURE_EVENT, onFocus);
    return () => { window.removeEventListener("focus", onFocus); window.removeEventListener(CONNECTION_FAILURE_EVENT, onFocus); };
  }, []);
  return { ...snapshot, refresh: refreshConnection };
}

export function useAdminAccess() {
  const [hasToken, setHasToken] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const update = () => { setHasToken(Boolean(getAdminToken())); setRevision((value) => value + 1); };
    update();
    window.addEventListener(ADMIN_TOKEN_EVENT, update);
    return () => window.removeEventListener(ADMIN_TOKEN_EVENT, update);
  }, []);
  return { hasToken, revision };
}

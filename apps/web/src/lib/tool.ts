// apps/web/src/lib/tool.ts
"use client";

import { useEffect, useState, useCallback } from "react";

const KEY = "vtp_tool_enabled";

/**
 * React hook per il toggle "Tool" nella top bar.
 * Salva/storicizza lo stato in localStorage.
 */
export function useTool() {
  const [enabled, setEnabledState] = useState<boolean>(true);

  // carica da localStorage al mount
  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s !== null) {
        setEnabledState(s === "1" || s === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  // setter con persistenza
  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  return { enabled, setEnabled };
}

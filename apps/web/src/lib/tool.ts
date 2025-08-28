// /Users/marconava/Desktop/vtp/apps/web/src/lib/tool.ts
import { useEffect, useState } from "react";

const KEY = "vtp_tool_enabled";

export function useToolEnabled() {
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v !== null) setEnabled(v === "1");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, enabled ? "1" : "0");
    } catch {}
  }, [enabled]);

  return { enabled, setEnabled, KEY };
}

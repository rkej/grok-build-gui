import { useEffect, useRef, useState } from "react";
import { formatRunningLabel } from "./string-utils";

export function useRunningLabel(running: boolean): string {
  const startedAtRef = useRef<number | null>(null);
  const [label, setLabel] = useState(() => formatRunningLabel(null));

  useEffect(() => {
    if (running) {
      if (startedAtRef.current == null) startedAtRef.current = Date.now();
    } else {
      startedAtRef.current = null;
    }
    setLabel(formatRunningLabel(startedAtRef.current));
    if (!running) return undefined;
    const interval = window.setInterval(() => setLabel(formatRunningLabel(startedAtRef.current)), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  return label;
}

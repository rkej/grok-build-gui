import { useEffect, useState } from "react";

export function useRunningLabel(running: boolean): string {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!running) {
      setStartedAt(null);
      setElapsedSeconds(0);
      return;
    }

    const start = Date.now();
    setStartedAt(start);
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1_000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [running]);

  if (!running || startedAt === null || elapsedSeconds < 1) return "Working…";
  if (elapsedSeconds < 60) return `Working for ${elapsedSeconds}s`;
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `Working for ${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

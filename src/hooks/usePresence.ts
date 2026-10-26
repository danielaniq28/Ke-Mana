"use client";

import { useEffect, useState } from "react";

export function usePresence(open: boolean, durationMs = 360) {
  const [present, setPresent] = useState(open);
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open) {
      setPresent(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = window.setTimeout(() => setPresent(false), durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs]);

  return { present, shown };
}

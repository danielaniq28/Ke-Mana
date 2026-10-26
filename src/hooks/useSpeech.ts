"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { getSpeechService } from "@/lib/speech/speech-service";

export function useSpeech(locale: Locale) {
  const service = getSpeechService();
  const [muted, setMuted] = useState(() => service.isMuted());
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(service.isSupported());
    setMuted(service.isMuted());
  }, [service]);

  const prime = useCallback(() => {
    service.prime(locale);
  }, [service, locale]);

  const speak = useCallback(
    (text: string) => {
      service.speak(text, locale);
    },
    [service, locale],
  );

  const cancel = useCallback(() => {
    service.cancel();
  }, [service]);

  const toggleMute = useCallback(() => {
    const next = service.toggleMuted();
    setMuted(next);
    return next;
  }, [service]);

  const setMute = useCallback(
    (value: boolean) => {
      service.setMuted(value);
      setMuted(value);
    },
    [service],
  );

  return { supported, muted, prime, speak, cancel, toggleMute, setMute };
}

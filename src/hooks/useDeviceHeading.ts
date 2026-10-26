"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isValidHeading, normalizeHeading } from "@/lib/heading";

type OrientationPerm = "unknown" | "granted" | "denied" | "unsupported";

type DeviceOrientationCtor = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function getDeviceOrientationEvent(): DeviceOrientationCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const ctor = (window as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent;
  return typeof ctor === "function" ? (ctor as DeviceOrientationCtor) : undefined;
}

function screenAngle(): number {
  if (typeof window === "undefined") return 0;
  const so = window.screen?.orientation?.angle;
  if (typeof so === "number" && Number.isFinite(so)) return so;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === "number" && Number.isFinite(legacy) ? legacy : 0;
}

function headingFromEvent(e: DeviceOrientationEvent): number | undefined {
  const webkit = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
  if (isValidHeading(webkit.webkitCompassHeading)) {
    return normalizeHeading(webkit.webkitCompassHeading);
  }
  if (!isValidHeading(e.alpha)) return undefined;
  return normalizeHeading(360 - e.alpha - screenAngle());
}

export function useDeviceHeading() {
  const [heading, setHeading] = useState<number | undefined>();
  const [permission, setPermission] = useState<OrientationPerm>("unknown");
  const listeningRef = useRef(false);
  const handlerRef = useRef<((e: Event) => void) | null>(null);

  const stopListening = useCallback(() => {
    if (typeof window === "undefined" || !handlerRef.current) return;
    window.removeEventListener("deviceorientationabsolute", handlerRef.current, true);
    window.removeEventListener("deviceorientation", handlerRef.current, true);
    listeningRef.current = false;
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined" || listeningRef.current) return;
    if (!getDeviceOrientationEvent()) {
      setPermission("unsupported");
      return;
    }
    let gotAbsolute = false;
    const onOrient = (e: Event) => {
      if (e.type === "deviceorientationabsolute") gotAbsolute = true;
      else if (gotAbsolute) return;
      const h = headingFromEvent(e as DeviceOrientationEvent);
      if (h != null) setHeading(h);
    };
    handlerRef.current = onOrient;
    listeningRef.current = true;
    window.addEventListener("deviceorientationabsolute", onOrient, true);
    window.addEventListener("deviceorientation", onOrient, true);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const DOE = getDeviceOrientationEvent();
    if (!DOE) {
      setPermission("unsupported");
      return false;
    }
    try {
      if (typeof DOE.requestPermission === "function") {
        const result = await DOE.requestPermission();
        if (result !== "granted") {
          setPermission("denied");
          return false;
        }
      }
      setPermission("granted");
      startListening();
      return true;
    } catch {
      setPermission("denied");
      return false;
    }
  }, [startListening]);

  useEffect(() => {
    const DOE = getDeviceOrientationEvent();
    if (!DOE) {
      setPermission("unsupported");
      return;
    }
    if (typeof DOE.requestPermission !== "function") {
      setPermission("granted");
      startListening();
    }
    return () => stopListening();
  }, [startListening, stopListening]);

  return { heading, permission, requestPermission };
}

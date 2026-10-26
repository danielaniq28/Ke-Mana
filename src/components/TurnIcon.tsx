import type { TurnKind } from "@/lib/navigation/types";

export function TurnIcon({ kind, className = "" }: { kind: TurnKind; className?: string }) {
  return (
    <svg className={className} width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
      {kind === "left" && (
        <path d="M28 28V16a4 4 0 0 0-4-4H10" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      )}
      {kind === "left" && (
        <path d="M16 6 8 12l8 6" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === "right" && (
        <path d="M8 28V16a4 4 0 0 1 4-4h14" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      )}
      {kind === "right" && (
        <path d="M20 6l8 6-8 6" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === "slight-left" && (
        <path d="M22 30V14L10 6" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === "slight-right" && (
        <path d="M14 30V14l12-8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === "uturn" && (
        <path d="M12 30V14a6 6 0 0 1 12 0v6M24 14l4 4-4 4" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === "exit" && (
        <path d="M10 30V10h10l8 8-8 8H14" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === "arrive" && (
        <path d="M18 6v24M18 6l8 8M18 6l-8 8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {(kind === "continue" || !kind) && (
        <path d="M18 30V8m0 0 8 8M18 8l-8 8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

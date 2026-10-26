"use client";

import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "./LocaleProvider";
import { usePresence } from "@/hooks/usePresence";

type Props = {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  showOsm: boolean;
  onToggleOsm: (v: boolean) => void;
  signedIn: boolean;
  userName?: string | null;
  userImage?: string | null;
  onPlanDrive: () => void;
  onInbox: () => void;
  sleepOn: boolean;
  onToggleSleep: () => void;
};

export function WazeMenu({
  locale,
  open,
  onClose,
  showOsm,
  onToggleOsm,
  signedIn,
  userName,
  userImage,
  onPlanDrive,
  onInbox,
  sleepOn,
  onToggleSleep,
}: Props) {
  const { toggleLocale } = useLocale();
  const { present, shown } = usePresence(open);
  if (!present) return null;

  const displayName = signedIn ? userName?.trim() || t(locale, "account") : t(locale, "guest");
  const initial = (displayName[0] || "K").toUpperCase();

  return (
    <div className={`km-overlay km-overlay-full ${shown ? "is-open" : ""}`} role="dialog" aria-modal="true" aria-label={t(locale, "menu")}>
      <div className="km-menu">
        <header className="km-menu-top">
          <div className="km-menu-user">
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} alt="" className="km-menu-avatar-img" />
            ) : (
              <span className="km-menu-avatar">{initial}</span>
            )}
            <div>
              <p className="km-menu-name">{displayName}</p>
              <Link href={signedIn ? "/account" : "/login"} className="km-view-profile" onClick={onClose}>
                {t(locale, "viewProfile")}
              </Link>
            </div>
          </div>
          <button type="button" className="waze-circle-btn ghost" onClick={onClose} aria-label={t(locale, "close")}>
            ✕
          </button>
        </header>

        <nav className="km-menu-list">
          <button type="button" className="km-menu-row" onClick={onPlanDrive}>
            <span className="km-menu-glyph">⌖</span>
            {t(locale, "planDrive")}
          </button>
          <button type="button" className="km-menu-row" onClick={onInbox}>
            <span className="km-menu-glyph">💬</span>
            {t(locale, "inbox")}
          </button>
          <Link href={signedIn ? "/account" : "/login"} className="km-menu-row" onClick={onClose}>
            <span className="km-menu-glyph">⚙</span>
            {t(locale, "settings")}
          </Link>
          <a className="km-menu-row" href="mailto:hello@kemana.app">
            <span className="km-menu-glyph">?</span>
            {t(locale, "helpFeedback")}
          </a>
          <button type="button" className="km-menu-row" onClick={onToggleSleep}>
            <span className="km-menu-glyph">⏻</span>
            {t(locale, "sleepMode")}
            <span className={`waze-switch-track ${sleepOn ? "is-on" : ""}`} />
          </button>
        </nav>

        <div className="km-menu-settings">
          <button
            type="button"
            role="switch"
            aria-checked={showOsm}
            className="km-menu-row"
            onClick={() => onToggleOsm(!showOsm)}
          >
            <span className="flex-1 text-left">{t(locale, "osmLayer")}</span>
            <span className={`waze-switch-track ${showOsm ? "is-on" : ""}`} />
          </button>
          <button type="button" className="km-menu-row" onClick={toggleLocale}>
            <span className="flex-1 text-left">{t(locale, "language")}</span>
            <span className="waze-lang-chip">{locale === "ms" ? "BM" : "EN"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

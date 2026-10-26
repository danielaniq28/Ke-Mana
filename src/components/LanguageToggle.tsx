"use client";

import { t } from "@/lib/i18n";
import { useLocale } from "./LocaleProvider";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, toggleLocale } = useLocale();

  return (
    <button
      type="button"
      onClick={toggleLocale}
      className={`text-xs font-semibold ${className}`}
      aria-label={t(locale, "language")}
    >
      {locale === "ms" ? "EN" : "BM"}
    </button>
  );
}

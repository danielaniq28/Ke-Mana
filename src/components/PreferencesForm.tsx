"use client";

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import type { UserPreferences } from "@/lib/types";

type Props = {
  locale: Locale;
  value: UserPreferences;
  onSave: (prefs: UserPreferences) => Promise<void>;
};

export function PreferencesForm({ locale, value, onSave }: Props) {
  const [prefs, setPrefs] = useState(value);
  const [saving, setSaving] = useState(false);

  const toggle = (key: keyof UserPreferences) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(prefs);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-3 font-semibold">{t(locale, "preferences")}</h3>
      <div className="flex flex-col gap-3 text-sm">
        <label className="flex items-center justify-between gap-3">
          <span>{t(locale, "avoidFreeway")}</span>
          <input
            type="checkbox"
            checked={prefs.avoidFreeway}
            onChange={() => toggle("avoidFreeway")}
            className="h-5 w-5"
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>{t(locale, "avoidTolls")}</span>
          <input
            type="checkbox"
            checked={prefs.avoidTolls}
            onChange={() => toggle("avoidTolls")}
            className="h-5 w-5"
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>{t(locale, "avoidFerries")}</span>
          <input
            type="checkbox"
            checked={prefs.avoidFerries}
            onChange={() => toggle("avoidFerries")}
            className="h-5 w-5"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-4 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-emerald-950 disabled:opacity-50"
      >
        {saving ? t(locale, "loading") : t(locale, "savePreferences")}
      </button>
    </div>
  );
}

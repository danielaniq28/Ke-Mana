"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SavedPlace } from "@/lib/types";
import { t, type Locale } from "@/lib/i18n";

type SearchResult = { place_id: number; display_name: string; lat: string; lon: string };

type Props = {
  locale: Locale;
  label: string;
  value?: SavedPlace;
  onSave: (place: SavedPlace | null) => Promise<void>;
};

export function PlaceField({ locale, label, value, onSave }: Props) {
  const [query, setQuery] = useState(value?.address ?? value?.label ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value?.address ?? value?.label ?? "");
  }, [value]);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = (await res.json()) as { results: SearchResult[] };
    setResults(data.results);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const pick = async (r: SearchResult) => {
    setSaving(true);
    try {
      const place: SavedPlace = {
        label,
        lat: Number(r.lat),
        lng: Number(r.lon),
        address: r.display_name,
      };
      await onSave(place);
      setQuery(r.display_name);
      setResults([]);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    try {
      await onSave(null);
      setQuery("");
      setResults([]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{label}</h3>
        {value && (
          <button
            type="button"
            onClick={clear}
            disabled={saving}
            className="text-xs text-red-300 hover:underline"
          >
            {t(locale, "cancel")}
          </button>
        )}
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t(locale, "searchPlaceholder")}
        className="w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-sm outline-none ring-emerald-400/40 focus:ring-2"
      />
      {results.length > 0 && (
        <ul className="mt-2 max-h-40 overflow-auto rounded-xl border border-white/10 bg-[#111827] text-sm">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-white/10"
                onClick={() => pick(r)}
                disabled={saving}
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-500">
        {value ? t(locale, "saved") : t(locale, "notSet")}
      </p>
    </div>
  );
}

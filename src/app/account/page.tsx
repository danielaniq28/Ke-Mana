"use client";

import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { PlaceField } from "@/components/PlaceField";
import { PreferencesForm } from "@/components/PreferencesForm";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import type { SavedPlace, UserPreferences, UserProfile } from "@/lib/types";

export default function AccountPage() {
  const { data: session } = useSession();
  const { locale } = useLocale();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/user/profile");
    if (res.ok) {
      const data = (await res.json()) as { profile: UserProfile };
      setProfile(data.profile);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savePlace = async (key: "home" | "work", place: SavedPlace | null) => {
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: place }),
    });
    if (res.ok) {
      const data = (await res.json()) as { profile: UserProfile };
      setProfile(data.profile);
    }
  };

  const savePreferences = async (preferences: UserPreferences) => {
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences }),
    });
    if (res.ok) {
      const data = (await res.json()) as { profile: UserProfile };
      setProfile(data.profile);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0b1220] text-slate-100">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href="/" className="text-sm text-sky-300 hover:underline">
          ← {t(locale, "backToMap")}
        </Link>
        <LanguageToggle />
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 pb-16">
        <h1 className="text-2xl font-bold">{t(locale, "account")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t(locale, "savedPlaces")}</p>

        {session?.user && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111827] p-4">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt=""
                width={48}
                height={48}
                className="rounded-full"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{session.user.name}</p>
              <p className="truncate text-sm text-slate-400">{session.user.email}</p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-slate-400">{t(locale, "loading")}</p>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            <PlaceField
              locale={locale}
              label={t(locale, "home")}
              value={profile?.home}
              onSave={(p) => savePlace("home", p)}
            />
            <PlaceField
              locale={locale}
              label={t(locale, "work")}
              value={profile?.work}
              onSave={(p) => savePlace("work", p)}
            />
            {profile?.preferences && (
              <PreferencesForm
                locale={locale}
                value={profile.preferences}
                onSave={savePreferences}
              />
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-8 w-full rounded-2xl border border-white/15 py-3 text-sm font-medium text-slate-200 hover:bg-white/5"
        >
          {t(locale, "signOut")}
        </button>
      </main>
    </div>
  );
}

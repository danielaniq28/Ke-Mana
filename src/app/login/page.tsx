"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

type Mode = "signin" | "register";

export default function LoginPage() {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitCredentials = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error === "email_taken" ? t(locale, "emailTaken") : t(locale, "registerError"));
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError(t(locale, "authError"));
        return;
      }
      window.location.href = callbackUrl;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#0b1220] text-slate-100">
      <header className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href="/" className="text-sm text-sky-300 hover:underline">
          ← {t(locale, "backToMap")}
        </Link>
        <LanguageToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111827] p-8 shadow-2xl">
          <p className="text-3xl font-bold text-emerald-400">{t(locale, "appName")}</p>
          <h1 className="mt-4 text-2xl font-semibold">
            {mode === "signin" ? t(locale, "signInTitle") : t(locale, "registerTitle")}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {mode === "signin" ? t(locale, "signInSubtitle") : t(locale, "registerSubtitle")}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {mode === "register" && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t(locale, "name")}
                className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2.5 text-sm outline-none ring-emerald-400/40 focus:ring-2"
              />
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t(locale, "email")}
              autoComplete="email"
              className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2.5 text-sm outline-none ring-emerald-400/40 focus:ring-2"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t(locale, "password")}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2.5 text-sm outline-none ring-emerald-400/40 focus:ring-2"
            />
            {error && <p className="text-sm text-red-300">{error}</p>}
            <button
              type="button"
              disabled={loading || !email || !password}
              onClick={submitCredentials}
              className="rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-emerald-950 disabled:opacity-40"
            >
              {loading
                ? t(locale, "loading")
                : mode === "signin"
                  ? t(locale, "signIn")
                  : t(locale, "register")}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "register" : "signin");
              setError(null);
            }}
            className="mt-4 w-full text-center text-sm text-sky-300 hover:underline"
          >
            {mode === "signin" ? t(locale, "noAccount") : t(locale, "haveAccount")}
          </button>
        </div>
      </main>
    </div>
  );
}

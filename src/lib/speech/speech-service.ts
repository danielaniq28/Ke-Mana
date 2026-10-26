import type { Locale } from "../i18n";

const MUTE_KEY = "ke-mana-voice-muted";

function speechLang(locale: Locale): string {
  return locale === "ms" ? "ms-MY" : "en-MY";
}

function pickVoice(locale: Locale): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const lang = speechLang(locale);
  const prefix = locale === "ms" ? "ms" : "en";
  return (
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.startsWith(prefix)) ??
    voices[0] ??
    null
  );
}

export class SpeechService {
  private lastPhrase = "";
  private primed = false;
  constructor() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.addEventListener("voiceschanged", () => undefined);
    }
  }

  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  isMuted(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(MUTE_KEY) === "1";
  }

  setMuted(muted: boolean): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    if (muted) this.cancel();
  }

  toggleMuted(): boolean {
    const next = !this.isMuted();
    this.setMuted(next);
    return next;
  }

  prime(locale: Locale): void {
    if (!this.isSupported() || this.primed) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0.01;
    u.lang = speechLang(locale);
    const voice = pickVoice(locale);
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
    window.speechSynthesis.cancel();
    this.primed = true;
  }

  cancel(): void {
    if (!this.isSupported()) return;
    window.speechSynthesis.cancel();
    this.lastPhrase = "";
  }

  speak(text: string, locale: Locale): void {
    if (!this.isSupported() || this.isMuted() || !text.trim()) return;
    if (text === this.lastPhrase) return;
    this.lastPhrase = text;

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechLang(locale);
    const voice = pickVoice(locale);
    if (voice) u.voice = voice;
    u.rate = 1;
    u.onend = () => {
      if (this.lastPhrase === text) this.lastPhrase = "";
    };
    window.speechSynthesis.speak(u);
  }
}

let singleton: SpeechService | null = null;

export function getSpeechService(): SpeechService {
  if (!singleton) singleton = new SpeechService();
  return singleton;
}

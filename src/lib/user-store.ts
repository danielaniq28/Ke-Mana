import bcrypt from "bcryptjs";
import type { Locale } from "./i18n";
import type { SavedPlace, UserPreferences, UserProfile } from "./types";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

const globalStore = globalThis as typeof globalThis & {
  __keManaUsers?: Map<string, StoredUser>;
  __keManaUsersByEmail?: Map<string, string>;
  __keManaProfiles?: Map<string, UserProfile>;
};

function users(): Map<string, StoredUser> {
  if (!globalStore.__keManaUsers) globalStore.__keManaUsers = new Map();
  return globalStore.__keManaUsers;
}

function usersByEmail(): Map<string, string> {
  if (!globalStore.__keManaUsersByEmail) globalStore.__keManaUsersByEmail = new Map();
  return globalStore.__keManaUsersByEmail;
}

function profiles(): Map<string, UserProfile> {
  if (!globalStore.__keManaProfiles) globalStore.__keManaProfiles = new Map();
  return globalStore.__keManaProfiles;
}

const defaultPreferences = (): UserPreferences => ({
  avoidFreeway: false,
  avoidTolls: false,
  avoidFerries: false,
});

export function getProfile(userId: string): UserProfile {
  const existing = profiles().get(userId);
  if (existing) return existing;
  const profile: UserProfile = { userId, preferences: defaultPreferences() };
  profiles().set(userId, profile);
  return profile;
}

export function updateProfile(
  userId: string,
  patch: {
    home?: SavedPlace | null;
    work?: SavedPlace | null;
    locale?: Locale;
    preferences?: Partial<UserPreferences>;
  },
): UserProfile {
  const current = getProfile(userId);
  const next: UserProfile = {
    userId,
    home: patch.home === null ? undefined : patch.home ?? current.home,
    work: patch.work === null ? undefined : patch.work ?? current.work,
    locale: patch.locale ?? current.locale,
    preferences: {
      ...current.preferences,
      ...patch.preferences,
    },
  };
  profiles().set(userId, next);
  return next;
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { ok: false, error: "invalid_email" };
  if (input.password.length < 8) return { ok: false, error: "weak_password" };
  if (usersByEmail().has(email)) return { ok: false, error: "email_taken" };

  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user: StoredUser = {
    id,
    email,
    name: input.name.trim() || email.split("@")[0]!,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users().set(id, user);
  usersByEmail().set(email, id);
  getProfile(id);
  return { ok: true, userId: id };
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<StoredUser | null> {
  const normalized = email.trim().toLowerCase();
  const id = usersByEmail().get(normalized);
  if (!id) return null;
  const user = users().get(id);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.passwordHash);
  return match ? user : null;
}

export function findUserById(id: string): StoredUser | undefined {
  return users().get(id);
}

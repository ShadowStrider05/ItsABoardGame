import type { AppSession } from "./types";

const key = "itsaboardgame.local.session";

export function saveLocalSession(state: AppSession): void {
  localStorage.setItem(key, JSON.stringify(state));
}

export function loadLocalSession(): AppSession | null {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AppSession;
  } catch {
    return null;
  }
}

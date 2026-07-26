import type { BoardState } from "./types";

const key = "itsaboardgame.local.session";

export function saveLocalSession(state: BoardState): void {
  localStorage.setItem(key, JSON.stringify(state));
}

export function loadLocalSession(): BoardState | null {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as BoardState;
  } catch {
    return null;
  }
}

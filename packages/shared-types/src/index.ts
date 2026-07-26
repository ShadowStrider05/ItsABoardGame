export type SessionMode = "local" | "friends";

export type GameSessionSummary = {
  sessionId: string;
  mode: SessionMode;
  createdAt: string;
  updatedAt: string;
};

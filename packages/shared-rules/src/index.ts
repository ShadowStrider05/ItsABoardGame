export type MoveProposal = {
  sessionId: string;
  playerId: string;
  position: number;
};

export function isMovePositionValid(position: number): boolean {
  return Number.isInteger(position) && position >= 0 && position <= 8;
}

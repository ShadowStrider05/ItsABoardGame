export type Player = "A" | "B";

export type BoardState = {
  cells: Array<Player | null>;
  currentTurn: Player;
  winner: Player | null;
  moveCount: number;
};

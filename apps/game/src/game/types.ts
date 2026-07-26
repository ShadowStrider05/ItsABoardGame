export type GameMode = "pass_and_play" | "ranked" | "friends";

export type MatchPhase = "choose_action" | "roll" | "assign" | "complete";

export type TurnAction = "buy" | "curse";

export type MatchSettings = {
  mode: GameMode;
  mapId: "place_of_disper";
  playerCount: number;
  lapCount: number;
  startingPoints: number;
};

export type PieceState = {
  id: string;
  ownerId: string;
  tile: number;
  lap: number;
  removed: boolean;
  skipNextMove: boolean;
};

export type PlayerState = {
  id: string;
  name: string;
  points: number;
  spinnerTier: 1 | 2 | 3;
  placementBonusOwned: boolean;
  generalBonusOwned: boolean;
  safeCharges: number;
  blockerCharges: number;
  x2BankUnlocked: boolean;
  x2BankCooldown: number;
  x2GainUnlocked: boolean;
  x3GainUnlocked: boolean;
  pendingGainMultiplier: 1 | 2 | 3;
  movementIncomePieceId: string | null;
  campingIncomePieceId: string | null;
  visitedTiles: number[];
  pendingExtraSpins: number;
  turnsTaken: number;
  pieces: PieceState[];
};

export type TurnState = {
  action: TurnAction | null;
  spinnerValues: number[];
  usedSpinnerIndexes: number[];
  targetPlayerId: string | null;
  targetPieceId: string | null;
  secondaryTargetPieceId: string | null;
  ownPieceId: string | null;
};

export type TileEffect = {
  points?: number;
  jump?: number;
  despair?: boolean;
};

export type MatchEvent = {
  id: string;
  message: string;
};

export type MatchState = {
  settings: MatchSettings;
  phase: MatchPhase;
  currentPlayerIndex: number;
  players: PlayerState[];
  turn: TurnState;
  winnerPlayerId: string | null;
  lapPlacementTracker: Record<number, number>;
  events: MatchEvent[];
};

export type BuyItemId =
  | "spinner_t2"
  | "spinner_t3"
  | "extra_spin"
  | "extra_piece"
  | "placement_bonus"
  | "general_bonus"
  | "x2_bank_unlock"
  | "x2_bank_activate"
  | "x2_gain_unlock"
  | "x2_gain_activate"
  | "x3_gain_unlock"
  | "x3_gain_activate"
  | "movement_income"
  | "camping_income"
  | "safe"
  | "blocker";

export type CurseId = "tax" | "base_loss" | "perk_destruction" | "complete_elimination";

export type AccountProfile = {
  id: string;
  displayName: string;
  provider: "firebase" | "local";
};

export type AppSession = {
  profile: AccountProfile;
  draftSettings: MatchSettings;
  activeMatch: MatchState | null;
};

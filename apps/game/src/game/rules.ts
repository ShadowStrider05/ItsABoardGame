import type {
  BuyItemId,
  CurseId,
  MatchEvent,
  MatchSettings,
  MatchState,
  PieceState,
  PlayerState,
  TurnAction
} from "./types";
import { getTileEffect, TRACK_END_INDEX } from "./boardConfig";

const PLAYER_COLORS = ["Crimson", "Azure", "Amber", "Jade", "Ivory", "Violet"];

type StepMoveResult = {
  piece: PieceState;
  wonMatch: boolean;
};

export function createInitialMatch(settings: MatchSettings): MatchState {
  const players: PlayerState[] = Array.from({ length: settings.playerCount }, (_, index) => {
    const playerId = `P${index + 1}`;
    return {
      id: playerId,
      name: `${PLAYER_COLORS[index] ?? "Player"} ${index + 1}`,
      points: settings.startingPoints,
      spinnerTier: 1,
      placementBonusOwned: false,
      generalBonusOwned: false,
      safeCharges: 0,
      blockerCharges: 0,
      x2BankUnlocked: false,
      x2BankCooldown: 0,
      x2GainUnlocked: false,
      x3GainUnlocked: false,
      pendingGainMultiplier: 1,
      movementIncomePieceId: null,
      campingIncomePieceId: null,
      visitedTiles: [0],
      pendingExtraSpins: 0,
      turnsTaken: 0,
      pieces: [
        {
          id: `${playerId}-1`,
          ownerId: playerId,
          tile: 0,
          lap: 1,
          removed: false,
          skipNextMove: false
        }
      ]
    };
  });

  return {
    settings,
    phase: "choose_action",
    currentPlayerIndex: 0,
    players,
    turn: {
      action: null,
      spinnerValues: [],
      usedSpinnerIndexes: [],
      targetPlayerId: null,
      targetPieceId: null,
      secondaryTargetPieceId: null,
      ownPieceId: null
    },
    winnerPlayerId: null,
    lapPlacementTracker: {},
    events: [createEvent("Match created. Choose buy or curse, then roll and move.")]
  };
}

export function chooseTurnAction(state: MatchState, action: TurnAction): MatchState {
  if (state.winnerPlayerId || state.phase !== "choose_action") {
    return state;
  }

  const players = clonePlayers(state.players);
  const activePlayer = players[state.currentPlayerIndex];
  activePlayer.turnsTaken += 1;
  if (activePlayer.x2BankCooldown > 0) {
    activePlayer.x2BankCooldown -= 1;
  }

  const defaultTargetPlayer = players.find((player) => player.id !== activePlayer.id)?.id ?? null;
  const defaultTargetPiece =
    defaultTargetPlayer
      ? players
          .find((player) => player.id === defaultTargetPlayer)
          ?.pieces.find((piece) => !piece.removed)?.id ?? null
      : null;

  const defaultOwnPiece = activePlayer.pieces.find((piece) => !piece.removed)?.id ?? null;

  return {
    ...state,
    players,
    turn: {
      action,
      spinnerValues: [],
      usedSpinnerIndexes: [],
      targetPlayerId: defaultTargetPlayer,
      targetPieceId: defaultTargetPiece,
      secondaryTargetPieceId: defaultTargetPiece,
      ownPieceId: defaultOwnPiece
    },
    events: [createEvent(`Action selected: ${action.toUpperCase()}.`), ...state.events].slice(0, 18)
  };
}

export function proceedToRoll(state: MatchState): MatchState {
  if (state.winnerPlayerId || state.phase !== "choose_action") {
    return state;
  }

  if (!state.turn.action) {
    return state;
  }

  return {
    ...state,
    phase: "roll"
  };
}

export function setTurnTargets(
  state: MatchState,
  update: {
    targetPlayerId?: string | null;
    targetPieceId?: string | null;
    secondaryTargetPieceId?: string | null;
    ownPieceId?: string | null;
  }
): MatchState {
  if (state.phase !== "choose_action") {
    return state;
  }

  return {
    ...state,
    turn: {
      ...state.turn,
      targetPlayerId: update.targetPlayerId ?? state.turn.targetPlayerId,
      targetPieceId: update.targetPieceId ?? state.turn.targetPieceId,
      secondaryTargetPieceId: update.secondaryTargetPieceId ?? state.turn.secondaryTargetPieceId,
      ownPieceId: update.ownPieceId ?? state.turn.ownPieceId
    }
  };
}

export function buyItem(state: MatchState, item: BuyItemId): MatchState {
  if (state.phase !== "choose_action" || state.turn.action !== "buy" || state.winnerPlayerId) {
    return state;
  }

  const players = clonePlayers(state.players);
  const buyer = players[state.currentPlayerIndex];
  const ownPieceId = state.turn.ownPieceId;

  const fail = (message: string): MatchState => ({
    ...state,
    players,
    events: [createEvent(message), ...state.events].slice(0, 18)
  });

  const spend = (cost: number): boolean => {
    if (buyer.points < 0 || buyer.points < cost) {
      return false;
    }

    buyer.points -= cost;
    return true;
  };

  switch (item) {
    case "spinner_t2": {
      if (buyer.spinnerTier !== 1 || !spend(30)) {
        return fail("Unable to buy Tier 2 spinner.");
      }

      buyer.spinnerTier = 2;
      break;
    }
    case "spinner_t3": {
      if (buyer.spinnerTier !== 2 || !spend(60)) {
        return fail("Unable to buy Tier 3 spinner.");
      }

      buyer.spinnerTier = 3;
      break;
    }
    case "extra_spin": {
      if (!spend(15)) {
        return fail("Not enough points for Extra Spin.");
      }

      buyer.pendingExtraSpins += 1;
      break;
    }
    case "extra_piece": {
      if (buyer.pieces.filter((piece) => !piece.removed).length >= 8 || !spend(15)) {
        return fail("Unable to buy Extra Piece.");
      }

      buyer.pieces.push({
        id: `${buyer.id}-${buyer.pieces.length + 1}`,
        ownerId: buyer.id,
        tile: 0,
        lap: 1,
        removed: false,
        skipNextMove: false
      });
      break;
    }
    case "placement_bonus": {
      if (buyer.placementBonusOwned || !spend(30)) {
        return fail("Unable to buy Placement Bonus.");
      }

      buyer.placementBonusOwned = true;
      break;
    }
    case "general_bonus": {
      if (buyer.generalBonusOwned || !spend(30)) {
        return fail("Unable to buy General Bonus.");
      }

      buyer.generalBonusOwned = true;
      break;
    }
    case "safe": {
      if (!spend(1000)) {
        return fail("Not enough points for Safe.");
      }

      buyer.safeCharges += 1;
      break;
    }
    case "blocker": {
      if (!spend(150)) {
        return fail("Not enough points for Blocker.");
      }

      buyer.blockerCharges += 1;
      break;
    }
    case "x2_bank_unlock": {
      if (buyer.x2BankUnlocked || !spend(215)) {
        return fail("Unable to unlock x2 Bank multiplier.");
      }

      buyer.x2BankUnlocked = true;
      break;
    }
    case "x2_bank_activate": {
      if (!buyer.x2BankUnlocked || buyer.x2BankCooldown > 0) {
        return fail("x2 Bank multiplier is not ready.");
      }

      buyer.points *= 2;
      buyer.x2BankCooldown = 5;
      break;
    }
    case "x2_gain_unlock": {
      if (buyer.x2GainUnlocked || !spend(60)) {
        return fail("Unable to unlock x2 Gain multiplier.");
      }

      buyer.x2GainUnlocked = true;
      break;
    }
    case "x2_gain_activate": {
      if (!buyer.x2GainUnlocked || !spend(5)) {
        return fail("Unable to activate x2 Gain.");
      }

      buyer.pendingGainMultiplier = 2;
      break;
    }
    case "x3_gain_unlock": {
      if (buyer.x3GainUnlocked || !spend(60)) {
        return fail("Unable to unlock x3 Gain multiplier.");
      }

      buyer.x3GainUnlocked = true;
      break;
    }
    case "x3_gain_activate": {
      if (!buyer.x3GainUnlocked || !spend(20)) {
        return fail("Unable to activate x3 Gain.");
      }

      buyer.pendingGainMultiplier = 3;
      break;
    }
    case "movement_income": {
      if (!spend(250)) {
        return fail("Not enough points for Movement Income.");
      }

      const piece = buyer.pieces.find((entry) => entry.id === ownPieceId && !entry.removed);
      if (!piece) {
        return fail("Select one of your active pieces to bind Movement Income.");
      }

      buyer.movementIncomePieceId = piece.id;
      break;
    }
    case "camping_income": {
      if (!spend(215)) {
        return fail("Not enough points for Camping Income.");
      }

      const piece = buyer.pieces.find((entry) => entry.id === ownPieceId && !entry.removed);
      if (!piece) {
        return fail("Select one of your active pieces to bind Camping Income.");
      }

      buyer.campingIncomePieceId = piece.id;
      break;
    }
    default:
      return state;
  }

  return {
    ...state,
    players,
    events: [createEvent(`${buyer.name} used BUY: ${item}.`), ...state.events].slice(0, 18)
  };
}

export function castCurse(state: MatchState, curse: CurseId): MatchState {
  if (state.phase !== "choose_action" || state.turn.action !== "curse" || state.winnerPlayerId) {
    return state;
  }

  const players = clonePlayers(state.players);
  const caster = players[state.currentPlayerIndex];
  const target = players.find((player) => player.id === state.turn.targetPlayerId);

  if (!target || target.id === caster.id) {
    return withEvent(state, players, "Select a valid curse target.");
  }

  const applyCost = (cost: number): boolean => {
    if (caster.points < cost) {
      return false;
    }

    caster.points -= cost;
    return true;
  };

  const blockedBySafe = (): boolean => {
    if (target.safeCharges <= 0) {
      return false;
    }

    target.safeCharges -= 1;
    return true;
  };

  switch (curse) {
    case "tax": {
      if (!applyCost(50)) {
        return withEvent(state, players, "Not enough points to cast Tax.");
      }

      if (blockedBySafe()) {
        return withEvent(state, players, `${target.name} consumed Safe and blocked Tax.`);
      }

      target.points -= 20;
      caster.points += 20;
      return withEvent(state, players, `${caster.name} cast Tax on ${target.name}.`);
    }
    case "base_loss": {
      if (!applyCost(200)) {
        return withEvent(state, players, "Not enough points to cast Base Loss.");
      }

      if (blockedBySafe()) {
        return withEvent(state, players, `${target.name} consumed Safe and blocked Base Loss.`);
      }

      const targetPiece = target.pieces.find((piece) => piece.id === state.turn.targetPieceId && !piece.removed);
      if (!targetPiece) {
        return withEvent(state, players, "Select a valid target piece for Base Loss.");
      }

      targetPiece.tile = Math.max(0, targetPiece.tile - 2);

      const ownPiece = caster.pieces.find((piece) => piece.id === state.turn.ownPieceId && !piece.removed);
      if (ownPiece) {
        applyLandingEffects(state, caster, ownPiece, true, []);
      }

      return withEvent(state, players, `${caster.name} cast Base Loss on ${targetPiece.id}.`);
    }
    case "perk_destruction": {
      if (!applyCost(700)) {
        return withEvent(state, players, "Not enough points to cast Perk Destruction.");
      }

      if (blockedBySafe()) {
        return withEvent(state, players, `${target.name} consumed Safe and blocked Perk Destruction.`);
      }

      const removed = removeOnePerk(target);
      if (!removed) {
        caster.points += 700;
        return withEvent(state, players, "Perk Destruction failed because target has no perks.");
      }

      return withEvent(state, players, `${caster.name} destroyed one perk from ${target.name}.`);
    }
    case "complete_elimination": {
      if (!applyCost(2550)) {
        return withEvent(state, players, "Not enough points to cast Complete Elimination.");
      }

      if (blockedBySafe()) {
        return withEvent(state, players, `${target.name} consumed Safe and blocked Complete Elimination.`);
      }

      const activePieces = target.pieces.filter((piece) => !piece.removed);
      const selected = activePieces.find((piece) => piece.id === state.turn.targetPieceId) ?? activePieces[0];
      const secondary =
        activePieces.find((piece) => piece.id === state.turn.secondaryTargetPieceId && piece.id !== selected?.id) ??
        activePieces.find((piece) => piece.id !== selected?.id) ??
        selected;

      if (!selected || !secondary) {
        return withEvent(state, players, "No valid piece targets for Complete Elimination.");
      }

      if (activePieces.length > 1) {
        selected.removed = true;
      }

      secondary.tile = 0;

      const stealAmount = Math.abs(target.points);
      target.points -= stealAmount;
      caster.points += stealAmount;

      return withEvent(state, players, `${caster.name} cast Complete Elimination on ${target.name}.`);
    }
    default:
      return state;
  }
}

export function rollSpinners(state: MatchState): MatchState {
  if (state.winnerPlayerId || state.phase !== "roll") {
    return state;
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  const spinnerCount = currentPlayer.spinnerTier + currentPlayer.pendingExtraSpins;
  const spinnerValues = Array.from({ length: spinnerCount }, () => randomInt(1, 6));
  const players = clonePlayers(state.players);
  players[state.currentPlayerIndex].pendingExtraSpins = 0;

  return {
    ...state,
    players,
    phase: "assign",
    turn: {
      ...state.turn,
      spinnerValues,
      usedSpinnerIndexes: []
    },
    events: [createEvent(`${currentPlayer.name} rolled ${spinnerValues.join(", ")}.`), ...state.events].slice(0, 18)
  };
}

export function applySpinnerToPiece(state: MatchState, spinnerIndex: number, pieceId: string): MatchState {
  if (state.winnerPlayerId || state.phase !== "assign") {
    return state;
  }

  if (state.turn.usedSpinnerIndexes.includes(spinnerIndex)) {
    return state;
  }

  const spinnerValue = state.turn.spinnerValues[spinnerIndex];
  if (!spinnerValue) {
    return state;
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  const piece = currentPlayer.pieces.find((entry) => entry.id === pieceId && !entry.removed);
  if (!piece || piece.skipNextMove) {
    return state;
  }

  if (!isSpinnerUseLegalForPiece(piece, spinnerValue, state.settings.lapCount)) {
    return state;
  }

  const players = clonePlayers(state.players);
  const activePlayer = players[state.currentPlayerIndex];
  const mutablePiece = activePlayer.pieces.find((entry) => entry.id === pieceId)!;
  const events: MatchEvent[] = [];

  const moveResult = movePieceWithEffects(state, activePlayer, mutablePiece, spinnerValue, events, true);
  const nextState: MatchState = {
    ...state,
    players,
    winnerPlayerId: moveResult.wonMatch ? activePlayer.id : state.winnerPlayerId,
    turn: {
      ...state.turn,
      usedSpinnerIndexes: [...state.turn.usedSpinnerIndexes, spinnerIndex]
    },
    events: [...events, ...state.events].slice(0, 18)
  };

  if (nextState.winnerPlayerId) {
    return {
      ...nextState,
      phase: "complete",
      events: [createEvent(`${activePlayer.name} wins the match.`), ...nextState.events].slice(0, 18)
    };
  }

  return maybeAdvanceTurn(nextState);
}

export function skipSpinnerWithPenalty(state: MatchState, spinnerIndex: number): MatchState {
  if (state.winnerPlayerId || state.phase !== "assign") {
    return state;
  }

  if (state.turn.usedSpinnerIndexes.includes(spinnerIndex)) {
    return state;
  }

  const spinnerValue = state.turn.spinnerValues[spinnerIndex];
  if (!spinnerValue) {
    return state;
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  const legalPieceIds = getLegalPieceIdsForSpinner(state, spinnerIndex);
  const players = clonePlayers(state.players);
  const activePlayer = players[state.currentPlayerIndex];

  if (legalPieceIds.length > 0) {
    activePlayer.points -= 50;
  }

  const nextState: MatchState = {
    ...state,
    players,
    turn: {
      ...state.turn,
      usedSpinnerIndexes: [...state.turn.usedSpinnerIndexes, spinnerIndex]
    },
    events: [
      createEvent(
        legalPieceIds.length > 0
          ? `${currentPlayer.name} skipped spinner ${spinnerValue} and paid -50p.`
          : `${currentPlayer.name} had no legal target for spinner ${spinnerValue}.`
      ),
      ...state.events
    ].slice(0, 18)
  };

  return maybeAdvanceTurn(nextState);
}

export function getLegalPieceIdsForSpinner(state: MatchState, spinnerIndex: number): string[] {
  if (state.phase !== "assign") {
    return [];
  }

  const spinnerValue = state.turn.spinnerValues[spinnerIndex];
  if (!spinnerValue) {
    return [];
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  return currentPlayer.pieces
    .filter((piece) => !piece.removed && !piece.skipNextMove)
    .filter((piece) => isSpinnerUseLegalForPiece(piece, spinnerValue, state.settings.lapCount))
    .map((piece) => piece.id);
}

export function getCurrentPlayer(state: MatchState): PlayerState {
  return state.players[state.currentPlayerIndex];
}

function maybeAdvanceTurn(state: MatchState): MatchState {
  if (state.turn.usedSpinnerIndexes.length < state.turn.spinnerValues.length) {
    return state;
  }

  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const nextPlayers = clonePlayers(state.players);
  const nextPlayer = nextPlayers[nextPlayerIndex];

  const hasMovablePiece = nextPlayer.pieces.some((piece) => !piece.removed && !piece.skipNextMove);
  if (!hasMovablePiece) {
    nextPlayer.pieces = nextPlayer.pieces.map((piece) =>
      piece.skipNextMove ? { ...piece, skipNextMove: false } : piece
    );

    return {
      ...state,
      players: nextPlayers,
      currentPlayerIndex: nextPlayerIndex,
      phase: "choose_action",
      turn: {
        action: null,
        spinnerValues: [],
        usedSpinnerIndexes: [],
        targetPlayerId: null,
        targetPieceId: null,
        secondaryTargetPieceId: null,
        ownPieceId: null
      },
      events: [createEvent(`${nextPlayer.name} has no movable pieces this turn.`), ...state.events].slice(0, 18)
    };
  }

  return {
    ...state,
    players: nextPlayers,
    currentPlayerIndex: nextPlayerIndex,
    phase: "choose_action",
    turn: {
      action: null,
      spinnerValues: [],
      usedSpinnerIndexes: [],
      targetPlayerId: null,
      targetPieceId: null,
      secondaryTargetPieceId: null,
      ownPieceId: null
    }
  };
}

function movePieceWithEffects(
  state: MatchState,
  player: PlayerState,
  piece: PieceState,
  spinnerValue: number,
  events: MatchEvent[],
  countMovementIncome: boolean
): StepMoveResult {
  if (piece.skipNextMove) {
    piece.skipNextMove = false;
    events.push(createEvent(`${player.name}'s piece ${piece.id} skipped movement due to despair.`));
    return { piece, wonMatch: false };
  }

  const initialMove = applyRelativeMove(state, player, piece, spinnerValue, events, countMovementIncome);
  if (initialMove.wonMatch) {
    return initialMove;
  }

  let safety = 0;
  while (safety < 20) {
    safety += 1;
    const effect = getTileEffect(piece.tile);
    if (!effect) {
      break;
    }

    if (effect.points) {
      gainPoints(player, effect.points, false);
      events.push(createEvent(`${player.name} gained tile reward +${effect.points}p.`));
    }

    if (effect.despair) {
      piece.skipNextMove = true;
      events.push(createEvent(`${piece.id} is marked by Place of Despair.`));
    }

    if (!effect.jump) {
      break;
    }

    const jumpMove = applyRelativeMove(state, player, piece, effect.jump, events, false);
    if (jumpMove.wonMatch) {
      return jumpMove;
    }

    if (jumpMove.piece.tile === piece.tile) {
      break;
    }
  }

  applyCampingIncome(player, piece, events);

  return { piece, wonMatch: false };
}

function applyRelativeMove(
  state: MatchState,
  player: PlayerState,
  piece: PieceState,
  delta: number,
  events: MatchEvent[],
  countMovementIncome: boolean
): StepMoveResult {
  if (delta === 0) {
    return { piece, wonMatch: false };
  }

  if (delta < 0) {
    const before = piece.tile;
    piece.tile = Math.max(0, piece.tile + delta);
    events.push(createEvent(`${piece.id} moved backward ${Math.abs(delta)}.`));
    applyVisited(player, piece.tile);
    if (countMovementIncome && player.movementIncomePieceId === piece.id) {
      const movedDistance = Math.abs(piece.tile - before);
      gainPoints(player, movedDistance * 2, false);
      events.push(createEvent(`${player.name} gained movement income +${movedDistance * 2}p.`));
    }
    return { piece, wonMatch: false };
  }

  const projected = piece.tile + delta;
  const onFinalLap = piece.lap === state.settings.lapCount;
  if (onFinalLap && projected > TRACK_END_INDEX) {
    events.push(createEvent(`${piece.id} could not move because final lap requires exact finish.`));
    return { piece, wonMatch: false };
  }

  if (onFinalLap && projected === TRACK_END_INDEX) {
    piece.tile = TRACK_END_INDEX;
    events.push(createEvent(`${piece.id} reached final finish.`));
    return { piece, wonMatch: true };
  }

  if (projected <= TRACK_END_INDEX) {
    const before = piece.tile;
    piece.tile = projected;
    events.push(createEvent(`${piece.id} moved forward ${delta}.`));
    applyVisited(player, piece.tile);
    if (countMovementIncome && player.movementIncomePieceId === piece.id) {
      const movedDistance = Math.abs(piece.tile - before);
      gainPoints(player, movedDistance * 2, false);
      events.push(createEvent(`${player.name} gained movement income +${movedDistance * 2}p.`));
    }
    return { piece, wonMatch: false };
  }

  const overflow = projected - TRACK_END_INDEX;
  const lap = piece.lap;
  piece.lap += 1;
  piece.tile = overflow;
  applyVisited(player, piece.tile);

  gainPoints(player, 5, false);
  events.push(createEvent(`${piece.id} crossed finish and gained +5p.`));

  const placementCount = state.lapPlacementTracker[lap] ?? 0;
  state.lapPlacementTracker[lap] = placementCount + 1;
  const payout = placementCount === 0 ? 15 : placementCount === 1 ? 10 : placementCount === 2 ? 5 : 0;

  if (payout > 0) {
    gainPoints(player, payout, true);
    events.push(createEvent(`${piece.id} earned lap placement payout +${payout}p.`));
  }

  if (countMovementIncome && player.movementIncomePieceId === piece.id) {
    gainPoints(player, delta * 2, false);
    events.push(createEvent(`${player.name} gained movement income +${delta * 2}p.`));
  }

  return { piece, wonMatch: false };
}

function isSpinnerUseLegalForPiece(piece: PieceState, spinnerValue: number, lapCount: number): boolean {
  if (piece.removed || piece.skipNextMove) {
    return false;
  }

  if (piece.lap !== lapCount) {
    return true;
  }

  return piece.tile + spinnerValue <= TRACK_END_INDEX;
}

function clonePlayers(players: PlayerState[]): PlayerState[] {
  return players.map((player) => ({
    ...player,
    visitedTiles: [...player.visitedTiles],
    pieces: player.pieces.map((piece) => ({ ...piece }))
  }));
}

function gainPoints(player: PlayerState, amount: number, isPlacement: boolean): void {
  let next = amount;

  if (player.generalBonusOwned) {
    next += 5;
  }

  if (isPlacement && player.placementBonusOwned) {
    next += 3;
  }

  if (player.pendingGainMultiplier === 2) {
    next *= 2;
    player.pendingGainMultiplier = 1;
  } else if (player.pendingGainMultiplier === 3) {
    next *= 3;
    player.pendingGainMultiplier = 1;
  }

  player.points += next;
}

function applyVisited(player: PlayerState, tile: number): void {
  if (!player.visitedTiles.includes(tile)) {
    player.visitedTiles.push(tile);
  }
}

function applyCampingIncome(player: PlayerState, piece: PieceState, events: MatchEvent[]): void {
  if (!player.campingIncomePieceId || player.campingIncomePieceId !== piece.id) {
    applyVisited(player, piece.tile);
    return;
  }

  const alreadyVisited = player.visitedTiles.includes(piece.tile);
  if (alreadyVisited) {
    gainPoints(player, 10, false);
    events.push(createEvent(`${player.name} gained camping income +10p.`));
  }

  applyVisited(player, piece.tile);
}

function removeOnePerk(player: PlayerState): boolean {
  if (player.safeCharges > 0) {
    player.safeCharges -= 1;
    return true;
  }

  if (player.blockerCharges > 0) {
    player.blockerCharges -= 1;
    return true;
  }

  if (player.generalBonusOwned) {
    player.generalBonusOwned = false;
    return true;
  }

  if (player.placementBonusOwned) {
    player.placementBonusOwned = false;
    return true;
  }

  if (player.x3GainUnlocked) {
    player.x3GainUnlocked = false;
    return true;
  }

  if (player.x2GainUnlocked) {
    player.x2GainUnlocked = false;
    return true;
  }

  if (player.x2BankUnlocked) {
    player.x2BankUnlocked = false;
    player.x2BankCooldown = 0;
    return true;
  }

  if (player.movementIncomePieceId) {
    player.movementIncomePieceId = null;
    return true;
  }

  if (player.campingIncomePieceId) {
    player.campingIncomePieceId = null;
    return true;
  }

  return false;
}

function applyLandingEffects(
  state: MatchState,
  player: PlayerState,
  piece: PieceState,
  countMovementIncome: boolean,
  events: MatchEvent[]
): void {
  movePieceWithEffects(state, player, piece, 0, events, countMovementIncome);
}

function withEvent(state: MatchState, players: PlayerState[], message: string): MatchState {
  return {
    ...state,
    players,
    events: [createEvent(message), ...state.events].slice(0, 18)
  };
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createEvent(message: string): MatchEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    message
  };
}

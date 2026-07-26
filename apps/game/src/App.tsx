import { useMemo, useState } from "react";
import { bootstrapProfile, loadCachedProfile } from "./game/account";
import { loadLocalSession, saveLocalSession } from "./game/localSession";
import {
  applySpinnerToPiece,
  buyItem,
  castCurse,
  chooseTurnAction,
  createInitialMatch,
  getCurrentPlayer,
  getLegalPieceIdsForSpinner,
  proceedToRoll,
  rollSpinners,
  setTurnTargets,
  skipSpinnerWithPenalty
} from "./game/rules";
import type { AppSession, BuyItemId, CurseId, MatchSettings, MatchState, TurnAction } from "./game/types";

type Screen = "auth" | "modes" | "setup" | "match";

const defaultSettings: MatchSettings = {
  mode: "pass_and_play",
  mapId: "place_of_disper",
  lapCount: 10,
  playerCount: 2,
  startingPoints: 0
};

const modeMetadata = [
  { id: "pass_and_play", label: "Pass and Play", enabled: true, description: "Local hot-seat multiplayer." },
  { id: "ranked", label: "Online Multiplayer Ranked", enabled: false, description: "Unavailable in this build." },
  { id: "friends", label: "Play With Friends", enabled: false, description: "Unavailable in this build." }
] as const;

const buyActions: Array<{ id: BuyItemId; label: string }> = [
  { id: "spinner_t2", label: "Buy Tier 2 Spinner (30p)" },
  { id: "spinner_t3", label: "Buy Tier 3 Spinner (60p)" },
  { id: "extra_piece", label: "Buy Extra Piece (15p)" },
  { id: "extra_spin", label: "Buy Extra Spin (15p)" },
  { id: "placement_bonus", label: "Buy Placement Bonus (30p)" },
  { id: "general_bonus", label: "Buy General Bonus (30p)" },
  { id: "safe", label: "Buy Safe Charge (1000p)" },
  { id: "blocker", label: "Buy Blocker Charge (150p)" },
  { id: "x2_bank_unlock", label: "Unlock x2 Bank (215p)" },
  { id: "x2_bank_activate", label: "Activate x2 Bank (cooldown 5 turns)" },
  { id: "x2_gain_unlock", label: "Unlock x2 Gain (60p)" },
  { id: "x2_gain_activate", label: "Activate x2 Gain (5p)" },
  { id: "x3_gain_unlock", label: "Unlock x3 Gain (60p)" },
  { id: "x3_gain_activate", label: "Activate x3 Gain (20p)" },
  { id: "movement_income", label: "Bind Movement Income (250p)" },
  { id: "camping_income", label: "Bind Camping Income (215p)" }
];

const curseActions: Array<{ id: CurseId; label: string }> = [
  { id: "tax", label: "Tax (50p)" },
  { id: "base_loss", label: "Base Loss (200p)" },
  { id: "perk_destruction", label: "Perk Destruction (700p)" },
  { id: "complete_elimination", label: "Complete Elimination (2550p)" }
];

function App(): JSX.Element {
  const cached = useMemo(() => loadLocalSession(), []);
  const [screen, setScreen] = useState<Screen>(() => {
    if (!cached?.profile) {
      return "auth";
    }

    if (cached.activeMatch) {
      return "match";
    }

    return "modes";
  });
  const [displayName, setDisplayName] = useState(cached?.profile.displayName ?? "");
  const [session, setSession] = useState<AppSession | null>(cached);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  const match: MatchState | null = session?.activeMatch ?? null;

  function persist(next: AppSession): void {
    setSession(next);
    saveLocalSession(next);
  }

  async function onContinue(): Promise<void> {
    const trimmed = displayName.trim();
    if (!trimmed) {
      return;
    }

    setIsBootstrapping(true);
    try {
      const profile = await bootstrapProfile(trimmed);
      const next: AppSession = {
        profile,
        draftSettings: session?.draftSettings ?? defaultSettings,
        activeMatch: null
      };

      persist(next);
      setScreen("modes");
    } finally {
      setIsBootstrapping(false);
    }
  }

  function updateDraft(update: Partial<MatchSettings>): void {
    if (!session) {
      return;
    }

    persist({
      ...session,
      draftSettings: {
        ...session.draftSettings,
        ...update
      }
    });
  }

  function startMatch(): void {
    if (!session) {
      return;
    }

    const state = createInitialMatch(session.draftSettings);
    persist({
      ...session,
      activeMatch: state
    });
    setScreen("match");
  }

  function updateMatch(nextMatch: MatchState): void {
    if (!session) {
      return;
    }

    persist({
      ...session,
      activeMatch: nextMatch
    });
  }

  function leaveMatch(): void {
    if (!session) {
      return;
    }

    persist({
      ...session,
      activeMatch: null
    });
    setScreen("modes");
  }

  const currentPlayer = match ? getCurrentPlayer(match) : null;
  const currentSpinnerIndex =
    match?.turn.spinnerValues.findIndex((_, index) => !match.turn.usedSpinnerIndexes.includes(index)) ?? -1;
  const legalPieceIds =
    match && currentSpinnerIndex >= 0 ? getLegalPieceIdsForSpinner(match, currentSpinnerIndex) : [];
  const hasLegalAssignments = legalPieceIds.length > 0;
  const targetPlayer =
    match && match.turn.targetPlayerId
      ? match.players.find((player) => player.id === match.turn.targetPlayerId) ?? null
      : null;

  if (screen === "auth") {
    const cachedProfile = loadCachedProfile();

    return (
      <main className="app-shell">
        <header className="hero">
          <h1>ItsABoardGame Launcher Link</h1>
          <p className="subtitle">Sign in to store account defaults and future cloud progression.</p>
        </header>

        <section className="panel">
          <label htmlFor="display-name">Display Name</label>
          <input
            id="display-name"
            className="text-input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Enter player name"
            maxLength={24}
          />
          <button className="primary" type="button" onClick={() => void onContinue()} disabled={isBootstrapping}>
            {isBootstrapping ? "Connecting..." : "Continue"}
          </button>

          {cachedProfile ? (
            <button
              className="secondary"
              type="button"
              onClick={() => {
                const next: AppSession = {
                  profile: cachedProfile,
                  draftSettings: session?.draftSettings ?? defaultSettings,
                  activeMatch: session?.activeMatch ?? null
                };
                persist(next);
                setScreen(next.activeMatch ? "match" : "modes");
              }}
            >
              Use cached profile: {cachedProfile.displayName}
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  if (screen === "modes" && session) {
    return (
      <main className="app-shell">
        <header className="hero">
          <h1>Choose Mode</h1>
          <p className="subtitle">Online modes are visible now and will be enabled in a future release.</p>
        </header>

        <section className="panel list">
          {modeMetadata.map((mode) => (
            <button
              key={mode.id}
              className="mode-btn"
              type="button"
              disabled={!mode.enabled}
              onClick={() => {
                if (!mode.enabled) {
                  return;
                }

                updateDraft({ mode: mode.id });
                setScreen("setup");
              }}
            >
              <strong>{mode.label}</strong>
              <span>{mode.description}</span>
            </button>
          ))}
        </section>
      </main>
    );
  }

  if (screen === "setup" && session) {
    const settings = session.draftSettings;

    return (
      <main className="app-shell">
        <header className="hero">
          <h1>Pre-Match Setup</h1>
          <p className="subtitle">Configure settings before starting Pass and Play.</p>
        </header>

        <section className="panel form-grid">
          <label htmlFor="map">Map</label>
          <select id="map" value={settings.mapId} onChange={() => updateDraft({ mapId: "place_of_disper" })}>
            <option value="place_of_disper">Place of Disper</option>
          </select>

          <label htmlFor="players">Players (2-6)</label>
          <input
            id="players"
            type="number"
            min={2}
            max={6}
            value={settings.playerCount}
            onChange={(event) =>
              updateDraft({
                playerCount: clampInt(Number(event.target.value), 2, 6)
              })
            }
          />

          <label htmlFor="laps">Laps (1-30)</label>
          <input
            id="laps"
            type="number"
            min={1}
            max={30}
            value={settings.lapCount}
            onChange={(event) =>
              updateDraft({
                lapCount: clampInt(Number(event.target.value), 1, 30)
              })
            }
          />

          <label htmlFor="points">Starting Points</label>
          <input
            id="points"
            type="number"
            value={settings.startingPoints}
            onChange={(event) =>
              updateDraft({
                startingPoints: Number.isFinite(Number(event.target.value)) ? Number(event.target.value) : 0
              })
            }
          />

          <div className="inline-actions">
            <button className="secondary" type="button" onClick={() => setScreen("modes")}>Back</button>
            <button className="primary" type="button" onClick={startMatch}>Start Match</button>
          </div>
        </section>
      </main>
    );
  }

  if (!match || !currentPlayer) {
    return <main className="app-shell" />;
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <h1>Place of Disper</h1>
        <p className="subtitle">{match.winnerPlayerId ? "Match complete" : `${currentPlayer.name}'s turn`}</p>
      </header>

      <section className="panel">
        <p>
          Mode: Pass and Play | Laps: {match.settings.lapCount} | Players: {match.settings.playerCount}
        </p>
        <p>
          Phase: <strong>{match.phase}</strong>
        </p>

        <div className="inline-actions wrap">
          {match.phase === "choose_action" ? (
            <>
              <button className="primary" type="button" onClick={() => updateMatch(chooseTurnAction(match, "buy"))}>
                Choose Buy
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => updateMatch(chooseTurnAction(match, "curse"))}
              >
                Choose Curse
              </button>

              {match.turn.action ? (
                <button className="primary" type="button" onClick={() => updateMatch(proceedToRoll(match))}>
                  Continue To Roll
                </button>
              ) : null}
            </>
          ) : null}

          {match.phase === "roll" ? (
            <button className="primary" type="button" onClick={() => updateMatch(rollSpinners(match))}>
              Roll Spinners
            </button>
          ) : null}
        </div>

        {match.phase === "choose_action" && match.turn.action === "buy" ? (
          <div className="assign-area">
            <p>Buy phase. You can make multiple purchases before rolling.</p>

            <label htmlFor="own-piece">Bind Piece (for Movement/Camping Income)</label>
            <select
              id="own-piece"
              value={match.turn.ownPieceId ?? ""}
              onChange={(event) => updateMatch(setTurnTargets(match, { ownPieceId: event.target.value || null }))}
            >
              {currentPlayer.pieces
                .filter((piece) => !piece.removed)
                .map((piece) => (
                  <option key={piece.id} value={piece.id}>
                    {piece.id}
                  </option>
                ))}
            </select>

            <div className="action-grid">
              {buyActions.map((entry) => (
                <button
                  key={entry.id}
                  className="piece-btn"
                  type="button"
                  onClick={() => updateMatch(buyItem(match, entry.id))}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {match.phase === "choose_action" && match.turn.action === "curse" ? (
          <div className="assign-area">
            <p>Curse phase. You can cast multiple curses before rolling.</p>

            <label htmlFor="target-player">Target Player</label>
            <select
              id="target-player"
              value={match.turn.targetPlayerId ?? ""}
              onChange={(event) => {
                const nextTargetPlayerId = event.target.value || null;
                const nextTargetPlayer = match.players.find((player) => player.id === nextTargetPlayerId) ?? null;
                const nextPiece = nextTargetPlayer?.pieces.find((piece) => !piece.removed)?.id ?? null;

                updateMatch(
                  setTurnTargets(match, {
                    targetPlayerId: nextTargetPlayerId,
                    targetPieceId: nextPiece,
                    secondaryTargetPieceId: nextPiece
                  })
                );
              }}
            >
              {match.players
                .filter((player) => player.id !== currentPlayer.id)
                .map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
            </select>

            {targetPlayer ? (
              <>
                <label htmlFor="target-piece">Primary Target Piece</label>
                <select
                  id="target-piece"
                  value={match.turn.targetPieceId ?? ""}
                  onChange={(event) =>
                    updateMatch(setTurnTargets(match, { targetPieceId: event.target.value || null }))
                  }
                >
                  {targetPlayer.pieces
                    .filter((piece) => !piece.removed)
                    .map((piece) => (
                      <option key={piece.id} value={piece.id}>
                        {piece.id}
                      </option>
                    ))}
                </select>

                <label htmlFor="secondary-target-piece">Secondary Target Piece</label>
                <select
                  id="secondary-target-piece"
                  value={match.turn.secondaryTargetPieceId ?? ""}
                  onChange={(event) =>
                    updateMatch(setTurnTargets(match, { secondaryTargetPieceId: event.target.value || null }))
                  }
                >
                  {targetPlayer.pieces
                    .filter((piece) => !piece.removed)
                    .map((piece) => (
                      <option key={piece.id} value={piece.id}>
                        {piece.id}
                      </option>
                    ))}
                </select>
              </>
            ) : null}

            <label htmlFor="own-piece-caster">Caster Piece For Redirected Effects</label>
            <select
              id="own-piece-caster"
              value={match.turn.ownPieceId ?? ""}
              onChange={(event) => updateMatch(setTurnTargets(match, { ownPieceId: event.target.value || null }))}
            >
              {currentPlayer.pieces
                .filter((piece) => !piece.removed)
                .map((piece) => (
                  <option key={piece.id} value={piece.id}>
                    {piece.id}
                  </option>
                ))}
            </select>

            <div className="action-grid">
              {curseActions.map((entry) => (
                <button
                  key={entry.id}
                  className="piece-btn"
                  type="button"
                  onClick={() => updateMatch(castCurse(match, entry.id))}
                >
                  Cast {entry.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {match.phase === "assign" ? (
          <div className="assign-area">
            <p>
              Spinner Values: {match.turn.spinnerValues.map((value, index) => `${index + 1}:${value}`).join(" | ")}
            </p>
            <p>
              Active Spinner: {currentSpinnerIndex >= 0 ? `${currentSpinnerIndex + 1}` : "None"}
            </p>

            <div className="piece-grid">
              {currentPlayer.pieces.map((piece) => {
                const canUse = legalPieceIds.includes(piece.id);
                return (
                  <button
                    key={piece.id}
                    className="piece-btn"
                    type="button"
                    disabled={!canUse || currentSpinnerIndex < 0}
                    onClick={() => {
                      if (currentSpinnerIndex < 0) {
                        return;
                      }

                      updateMatch(applySpinnerToPiece(match, currentSpinnerIndex, piece.id));
                    }}
                  >
                    {piece.id} | Tile {piece.tile} | Lap {piece.lap}
                    {piece.skipNextMove ? " | Skip Next" : ""}
                  </button>
                );
              })}
            </div>

            {currentSpinnerIndex >= 0 ? (
              <button
                className="danger"
                type="button"
                onClick={() => updateMatch(skipSpinnerWithPenalty(match, currentSpinnerIndex))}
              >
                {hasLegalAssignments ? "Skip Value (-50p)" : "No legal target, consume value"}
              </button>
            ) : null}
          </div>
        ) : null}

        <h2>Players</h2>
        <ul className="players">
          {match.players.map((player) => (
            <li key={player.id} className={player.id === currentPlayer.id ? "active-player" : undefined}>
              {player.name} | {player.points}p | Tier {player.spinnerTier} | Pieces {player.pieces.filter((p) => !p.removed).length}
              {` | Safe ${player.safeCharges} | Blocker ${player.blockerCharges}`}
            </li>
          ))}
        </ul>

        <h2>Event Log</h2>
        <ol className="events">
          {match.events.map((event) => (
            <li key={event.id}>{event.message}</li>
          ))}
        </ol>

        <button className="secondary" type="button" onClick={leaveMatch}>
          Exit to Mode Select
        </button>
      </section>
    </main>
  );
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

export default App;

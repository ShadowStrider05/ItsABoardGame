import { useMemo, useState } from "react";
import { applyMove, createInitialBoard } from "./game/rules";
import { loadLocalSession, saveLocalSession } from "./game/localSession";

function App(): JSX.Element {
  const initialBoard = useMemo(() => loadLocalSession() ?? createInitialBoard(), []);
  const [board, setBoard] = useState(initialBoard);

  function onCellClick(index: number): void {
    const next = applyMove(board, index);
    setBoard(next);
    saveLocalSession(next);
  }

  function reset(): void {
    const fresh = createInitialBoard();
    setBoard(fresh);
    saveLocalSession(fresh);
  }

  const status = board.winner
    ? `Winner: Player ${board.winner}`
    : board.moveCount === 9
      ? "Draw"
      : `Turn: Player ${board.currentTurn}`;

  return (
    <main className="app-shell">
      <header>
        <h1>ItsABoardGame</h1>
        <p className="subtitle">MVP local mode with deterministic rule engine.</p>
      </header>

      <section className="panel">
        <p className="status">{status}</p>
        <div className="grid" role="grid" aria-label="Board">
          {board.cells.map((cell, index) => (
            <button
              key={index}
              className="cell"
              type="button"
              onClick={() => onCellClick(index)}
              aria-label={`Cell ${index + 1}`}
            >
              {cell ?? ""}
            </button>
          ))}
        </div>
        <button className="reset" type="button" onClick={reset}>
          New Game
        </button>
      </section>
    </main>
  );
}

export default App;

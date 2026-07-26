import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { applyMove, createInitialBoard } from "./game/rules";
import { loadLocalSession, saveLocalSession } from "./game/localSession";
function App() {
    const initialBoard = useMemo(() => loadLocalSession() ?? createInitialBoard(), []);
    const [board, setBoard] = useState(initialBoard);
    function onCellClick(index) {
        const next = applyMove(board, index);
        setBoard(next);
        saveLocalSession(next);
    }
    function reset() {
        const fresh = createInitialBoard();
        setBoard(fresh);
        saveLocalSession(fresh);
    }
    const status = board.winner
        ? `Winner: Player ${board.winner}`
        : board.moveCount === 9
            ? "Draw"
            : `Turn: Player ${board.currentTurn}`;
    return (_jsxs("main", { className: "app-shell", children: [_jsxs("header", { children: [_jsx("h1", { children: "ItsABoardGame" }), _jsx("p", { className: "subtitle", children: "MVP local mode with deterministic rule engine." })] }), _jsxs("section", { className: "panel", children: [_jsx("p", { className: "status", children: status }), _jsx("div", { className: "grid", role: "grid", "aria-label": "Board", children: board.cells.map((cell, index) => (_jsx("button", { className: "cell", type: "button", onClick: () => onCellClick(index), "aria-label": `Cell ${index + 1}`, children: cell ?? "" }, index))) }), _jsx("button", { className: "reset", type: "button", onClick: reset, children: "New Game" })] })] }));
}
export default App;

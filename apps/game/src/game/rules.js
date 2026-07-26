const winningTriples = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];
export function createInitialBoard() {
    return {
        cells: Array.from({ length: 9 }, () => null),
        currentTurn: "A",
        winner: null,
        moveCount: 0
    };
}
function nextPlayer(player) {
    return player === "A" ? "B" : "A";
}
function detectWinner(cells) {
    for (const [a, b, c] of winningTriples) {
        if (cells[a] && cells[a] === cells[b] && cells[b] === cells[c]) {
            return cells[a];
        }
    }
    return null;
}
export function applyMove(board, index) {
    if (board.winner) {
        return board;
    }
    if (index < 0 || index > 8 || board.cells[index] !== null) {
        return board;
    }
    const updatedCells = [...board.cells];
    updatedCells[index] = board.currentTurn;
    const winner = detectWinner(updatedCells);
    return {
        cells: updatedCells,
        currentTurn: winner ? board.currentTurn : nextPlayer(board.currentTurn),
        winner,
        moveCount: board.moveCount + 1
    };
}

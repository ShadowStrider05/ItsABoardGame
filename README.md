# ItsABoardGame

Cross-platform digital board game project with a custom launcher and an eventual Steam release path.

## Tech Baseline

- Game client: React + Vite + TypeScript
- Shared game model: TypeScript packages
- Backend: Firebase (Auth, Firestore, Cloud Functions)
- Launcher: Electron + TypeScript

## Quick Start

1. Install Node.js 20+.
2. Install dependencies:
   - `npm install`
3. Start the game app:
   - `npm run dev:game`

## Firebase

- You can run the game without Firebase; it falls back to local profile storage.
- To connect a real Firebase project, follow [docs/firebase-setup.md](docs/firebase-setup.md).
- Use `apps/game/.env.example` as your template for client env vars.

## Repository Notes

- Primary branch: `main`
- Feature branches: `feature/<name>`
- Integration branch: `develop` (optional once team expands)

# Architecture Overview

## Top-Level

- apps/game: game client
- apps/launcher: custom desktop launcher
- packages/shared-types: canonical DTO and domain types
- packages/shared-rules: deterministic game rule validation
- firebase/functions: online rule authority and multiplayer helpers

## Rule Authority

Local games run rules in-client. Online games submit proposed moves to Cloud Functions for authoritative validation.

## Persistence

- Local saves for offline/local mode
- Firestore documents for online sessions

## Steam Path

Keep launcher for alpha/beta. Migrate distribution to Steam depots while reusing game app and backend services.

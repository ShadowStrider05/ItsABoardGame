import type { TileEffect } from "./types";

export const TRACK_END_INDEX = 29;

export const TILE_EFFECTS: Record<number, TileEffect> = {
  1: { jump: 2 },
  4: { points: 5 },
  6: { jump: -3 },
  9: { points: 3 },
  10: { jump: 1 },
  11: { points: 3 },
  12: { jump: -4 },
  14: { points: 5, despair: true },
  15: { points: 7, despair: true },
  19: { jump: -1 },
  20: { points: 15 },
  21: { jump: 3 },
  27: { points: 3 },
  28: { points: 5 }
};

export const MAP_ID = "place_of_disper" as const;

export function getTileEffect(tile: number): TileEffect | undefined {
  return TILE_EFFECTS[tile];
}

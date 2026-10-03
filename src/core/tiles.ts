/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Portions derived from KShisen (src/board.cpp) and libkmahjongg

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

/** Value stored in the board field for a position without a tile. */
export const EMPTY = 0;

/** Number of different kinds of tiles in the game. */
export const N_TILES = 42;

/** First tile value of the four season tiles. */
export const SEASONS_START = 28;

/** First tile value of the four flower tiles. */
export const FLOWERS_START = 39;

export const CHARACTER_COUNT = 9;
export const BAMBOO_COUNT = 9;
export const ROD_COUNT = 9;
export const SEASON_COUNT = 4;
export const WIND_COUNT = 4;
export const DRAGON_COUNT = 3;
export const FLOWER_COUNT = 4;

/**
 * The element ids of the tile faces inside a libkmahjongg SVG tile set,
 * indexed by tile value - 1. The order matches the enumeration used by
 * KMahjonggTileset::buildElementIdTable().
 */
export const FACE_ELEMENT_IDS: readonly string[] = (() => {
  const ids: string[] = [];
  const push = (prefix: string, count: number): void => {
    for (let i = 1; i <= count; ++i) {
      ids.push(`${prefix}_${i}`);
    }
  };
  push("CHARACTER", CHARACTER_COUNT);
  push("BAMBOO", BAMBOO_COUNT);
  push("ROD", ROD_COUNT);
  push("SEASON", SEASON_COUNT);
  push("WIND", WIND_COUNT);
  push("DRAGON", DRAGON_COUNT);
  push("FLOWER", FLOWER_COUNT);
  return ids;
})();

/** Element id of the unselected tile base (a tile set provides four variants). */
export const TILE_ELEMENT_IDS: readonly string[] = [
  "TILE_1",
  "TILE_2",
  "TILE_3",
  "TILE_4",
];

/** Element id of the selected (highlighted) tile base. */
export const SELECTED_TILE_ELEMENT_IDS: readonly string[] = [
  "TILE_1_SEL",
  "TILE_2_SEL",
  "TILE_3_SEL",
  "TILE_4_SEL",
];

export function isTileSeason(tile: number): boolean {
  return tile >= SEASONS_START && tile < SEASONS_START + SEASON_COUNT;
}

export function isTileFlower(tile: number): boolean {
  return tile >= FLOWERS_START && tile < FLOWERS_START + FLOWER_COUNT;
}

export function isSpecialTile(tile: number): boolean {
  return isTileSeason(tile) || isTileFlower(tile);
}

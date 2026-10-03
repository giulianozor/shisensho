/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Checks that the bundled tile sets and backgrounds are complete.

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import { describe, expect, it } from 'vitest';

import {
  FACE_ELEMENT_IDS,
  SELECTED_TILE_ELEMENT_IDS,
  TILE_ELEMENT_IDS,
} from '../src/core/tiles';

const tilesetFiles = import.meta.glob('../src/assets/tilesets/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const backgroundFiles = import.meta.glob('../src/assets/backgrounds/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const TILESET_IDS = [
  'default',
  'alphabet',
  'bamboo',
  'classic',
  'egypt',
  'jade',
  'traditional',
] as const;

const BACKGROUND_IDS = [
  'default',
  'chinese_landscape',
  'egyptian',
  'summerfield',
  'wood_light',
] as const;

function contentsOf(
  files: Record<string, string>,
  id: string,
): string | undefined {
  const key = Object.keys(files).find((path) => path.endsWith(`/${id}.svg`));
  return key === undefined ? undefined : files[key];
}

describe('bundled tile sets', () => {
  for (const id of TILESET_IDS) {
    it(`provides the tiles of the ${id} tile set`, () => {
      const contents = contentsOf(tilesetFiles, id);
      expect(contents, `the ${id} tile set is missing`).toBeDefined();
      const ids = [
        TILE_ELEMENT_IDS[0],
        SELECTED_TILE_ELEMENT_IDS[0],
        ...FACE_ELEMENT_IDS,
      ];
      const missing = ids.filter(
        (element) => !(contents ?? '').includes(`id="${element}"`),
      );
      expect(missing).toEqual([]);
    });
  }
});

describe('bundled backgrounds', () => {
  for (const id of BACKGROUND_IDS) {
    it(`provides the ${id} background`, () => {
      const contents = contentsOf(backgroundFiles, id);
      expect(contents, `the ${id} background is missing`).toBeDefined();
      expect(contents).toMatch(/<svg[\s>]/);
    });
  }
});

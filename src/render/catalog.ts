/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    The tile sets and backgrounds bundled from libkmahjongg.

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import type { TileMetrics } from "./tileset";

const tilesetUrls = import.meta.glob("../assets/tilesets/*.svg", {
  query: "?url",
  import: "default",
}) as unknown as Record<string, () => Promise<string>>;

const backgroundUrls = import.meta.glob("../assets/backgrounds/*.svg", {
  query: "?url",
  import: "default",
}) as unknown as Record<string, () => Promise<string>>;

/** A tile set the player can choose. */
export interface TilesetInfo {
  /** The id, which is also the file name of the tile set. */
  id: string;
  /** The translated name of the tile set, as shown in the settings. */
  name: string;
  /** The sizes of the tile set, as declared in its desktop file. */
  metrics: TileMetrics;
  /** Resolves the URL of the SVG file of the tile set. */
  load(): Promise<string>;
}

/** A background the player can choose. */
export interface BackgroundInfo {
  /** The id, which is also the file name of the background. */
  id: string;
  /** The translated name of the background, as shown in the settings. */
  name: string;
  /** A plain background draws no image and uses the window color instead. */
  plain: boolean;
  /** A tiled background repeats its image, otherwise it is stretched. */
  tiled: boolean;
  /** The width of one copy of a tiled background, from the desktop file. */
  tileWidth: number;
  /** The height of one copy of a tiled background, from the desktop file. */
  tileHeight: number;
  /** Resolves the URL of the SVG file, absent for a plain background. */
  load?: () => Promise<string>;
}

/**
 * The tile sets of libkmahjongg, with the metrics of their desktop files.
 *
 * The face offset is the position of the face inside the complete tile. It is
 * not part of the desktop file, so it was measured from the artwork: for every
 * tile set the face is the largest area that is flat in the base tile.
 */
const TILESET_ENTRIES: readonly {
  id: string;
  name: string;
  metrics: TileMetrics;
}[] = [
  {
    id: "default",
    name: "Default",
    metrics: {
      width: 96,
      height: 116,
      faceWidth: 69,
      faceHeight: 89,
      faceOffsetX: 27,
      faceOffsetY: 1,
      levelOffsetX: 12,
      levelOffsetY: 12,
    },
  },
  {
    id: "alphabet",
    name: "Alphabet",
    metrics: {
      width: 231,
      height: 283,
      faceWidth: 173,
      faceHeight: 211,
      faceOffsetX: 40,
      faceOffsetY: 18,
      levelOffsetX: 28,
      levelOffsetY: 32,
    },
  },
  {
    id: "bamboo",
    name: "Bamboo",
    metrics: {
      width: 95,
      height: 125,
      faceWidth: 70,
      faceHeight: 100,
      faceOffsetX: 24,
      faceOffsetY: 1,
      levelOffsetX: 10,
      levelOffsetY: 10,
    },
  },
  {
    id: "classic",
    name: "Classic",
    metrics: {
      width: 90,
      height: 114,
      faceWidth: 69,
      faceHeight: 95,
      faceOffsetX: 1,
      faceOffsetY: 1,
      levelOffsetX: 10,
      levelOffsetY: 10,
    },
  },
  {
    id: "egypt",
    name: "Ancient Egyptians",
    metrics: {
      width: 96,
      height: 116,
      faceWidth: 69,
      faceHeight: 89,
      faceOffsetX: 27,
      faceOffsetY: 1,
      levelOffsetX: 12,
      levelOffsetY: 12,
    },
  },
  {
    id: "jade",
    name: "Imperial Jade",
    metrics: {
      width: 93,
      height: 98,
      faceWidth: 71,
      faceHeight: 86,
      faceOffsetX: 22,
      faceOffsetY: 6,
      levelOffsetX: 10,
      levelOffsetY: 10,
    },
  },
  {
    id: "traditional",
    name: "Traditional",
    metrics: {
      width: 96,
      height: 116,
      faceWidth: 69,
      faceHeight: 89,
      faceOffsetX: 27,
      faceOffsetY: 1,
      levelOffsetX: 12,
      levelOffsetY: 12,
    },
  },
];

/**
 * The backgrounds of libkmahjongg, with the tiling flags of their desktop
 * files. The plain background has no image.
 */
const BACKGROUND_ENTRIES: readonly {
  id: string;
  name: string;
  plain?: boolean;
  tiled?: boolean;
  tileWidth?: number;
  tileHeight?: number;
}[] = [
  { id: "default", name: "Default", tiled: true, tileWidth: 50, tileHeight: 70 },
  { id: "chinese_landscape", name: "Chinese Landscape" },
  { id: "color_plain", name: "Plain Color", plain: true },
  { id: "egyptian", name: "Egyptian" },
  { id: "summerfield", name: "Summer Field" },
  {
    id: "wood_light",
    name: "Light Wood",
    tiled: true,
    tileWidth: 205,
    tileHeight: 180,
  },
];

function findLoader(
  urls: Record<string, () => Promise<string>>,
  id: string,
): () => Promise<string> {
  const match = Object.keys(urls).find((path) => path.endsWith(`/${id}.svg`));
  if (match === undefined) {
    throw new Error(`no SVG file for the "${id}" asset`);
  }
  return urls[match]!;
}

/** The bundled tile sets, in the order they are shown in the settings. */
export const TILESETS: readonly TilesetInfo[] = TILESET_ENTRIES.map((entry) => ({
  ...entry,
  load: () => findLoader(tilesetUrls, entry.id)(),
}));

/** The bundled backgrounds, in the order they are shown in the settings. */
export const BACKGROUNDS: readonly BackgroundInfo[] = BACKGROUND_ENTRIES.map(
  (entry) => ({
    id: entry.id,
    name: entry.name,
    plain: entry.plain ?? false,
    tiled: entry.tiled ?? false,
    tileWidth: entry.tileWidth ?? 0,
    tileHeight: entry.tileHeight ?? 0,
    ...(entry.plain === true
      ? {}
      : { load: () => findLoader(backgroundUrls, entry.id)() }),
  }),
);

/** The tile set with the given id, or the default one. */
export function findTileset(id: string): TilesetInfo {
  return TILESETS.find((tileset) => tileset.id === id) ?? TILESETS[0]!;
}

/** The background with the given id, or the default one. */
export function findBackground(id: string): BackgroundInfo {
  return BACKGROUNDS.find((background) => background.id === id) ?? BACKGROUNDS[0]!;
}

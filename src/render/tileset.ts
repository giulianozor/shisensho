/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Port of the metrics handling of libkmahjongg's KMahjonggTileset.

    SPDX-FileCopyrightText: 1997 Mathias Mueller <in5y158@public.uni-hamburg.de>
    SPDX-FileCopyrightText: 2006-2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import {
  FACE_ELEMENT_IDS,
  SELECTED_TILE_ELEMENT_IDS,
  TILE_ELEMENT_IDS,
} from "../core/tiles";
import { elementToSvg, extractSvgElements, type SvgElement } from "./svg";

/** The element ids a tile set has to provide. */
function requiredElementIds(): string[] {
  return [
    TILE_ELEMENT_IDS[0]!,
    SELECTED_TILE_ELEMENT_IDS[0]!,
    ...FACE_ELEMENT_IDS,
  ];
}

/** The tile sizes of a tile set, as declared in its desktop file. */
export interface TileMetrics {
  /** Width of a complete tile, including border and shadow. */
  width: number;
  /** Height of a complete tile, including border and shadow. */
  height: number;
  /** Width of the face of a tile. */
  faceWidth: number;
  /** Height of the face of a tile. */
  faceHeight: number;
  /**
   * Horizontal position of the face inside a complete tile.
   *
   * A complete tile reserves room for its bevel and its drop shadow, so its
   * face does not start at its own top left corner.
   */
  faceOffsetX: number;
  /** Vertical position of the face inside a complete tile. */
  faceOffsetY: number;
  /** Horizontal offset of a tile that lies on top of another one. */
  levelOffsetX: number;
  /** Vertical offset of a tile that lies on top of another one. */
  levelOffsetY: number;
}

/** The metrics of the default tile set. */
export const DEFAULT_METRICS: Readonly<TileMetrics> = Object.freeze({
  width: 96,
  height: 116,
  faceWidth: 69,
  faceHeight: 89,
  faceOffsetX: 27,
  faceOffsetY: 1,
  levelOffsetX: 12,
  levelOffsetY: 12,
});

/** The tile sizes scaled to a board of a given size in a view of a given size. */
export interface TileScale extends TileMetrics {
  /** Distance between two tiles in a row. */
  cellWidth: number;
  /** Distance between two tiles in a column. */
  cellHeight: number;
  /** Width of the lines that show the connection and the possible moves. */
  lineWidth: number;
}

function trunc(value: number): number {
  return Math.trunc(value);
}

/**
 * The tile size that fits a board of xTiles by yTiles into a view, as
 * calculated by KMahjonggTileset::preferredTileSize() and updateScaleInfo().
 */
export function computeScale(
  metrics: TileMetrics,
  viewWidth: number,
  viewHeight: number,
  xTiles: number,
  yTiles: number,
): TileScale {
  // one complete tile extra for the margin
  const fullWidth = metrics.faceWidth * xTiles + metrics.width;
  const fullHeight = metrics.faceHeight * yTiles + metrics.height;

  let ratio: number;
  if (fullWidth / fullHeight > viewWidth / viewHeight) {
    // space is left on the height, so the width is the limit
    ratio = viewWidth / fullWidth;
  } else {
    ratio = viewHeight / fullHeight;
  }

  const width = trunc(ratio * metrics.width);
  const height = trunc(ratio * metrics.height);
  const scale = width / metrics.width;
  const faceWidth = trunc(metrics.faceWidth * scale);
  const faceHeight = trunc(metrics.faceHeight * scale);

  return {
    width,
    height,
    faceWidth,
    faceHeight,
    faceOffsetX: trunc(metrics.faceOffsetX * scale),
    faceOffsetY: trunc(metrics.faceOffsetY * scale),
    levelOffsetX: trunc(metrics.levelOffsetX * scale),
    levelOffsetY: trunc(metrics.levelOffsetY * scale),
    // the tiles are placed half a face apart, rounded down like in libkmahjongg
    cellWidth: trunc(faceWidth / 2) * 2,
    cellHeight: trunc(faceHeight / 2) * 2,
    lineWidth: Math.max(3, Math.round(height / 10)),
  };
}

/**
 * The tiles of a tile set, rasterized on demand.
 *
 * The images are cached per size, so a window resize only rasterizes again
 * when the tile size really changed.
 */
export class TileSheet {
  private readonly elements: Map<string, SvgElement>;
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly cache = new Map<string, HTMLCanvasElement>();

  private constructor(elements: Map<string, SvgElement>) {
    this.elements = elements;
  }

  /** Loads the tiles of an SVG tile set file. */
  static async load(url: string): Promise<TileSheet> {
    const contents = await fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error(
          `could not load the tile set ${url}: ${response.status}`,
        );
      }
      return response.text();
    });
    return TileSheet.fromContents(contents);
  }

  /** Loads the tiles from the contents of an SVG tile set file. */
  static fromContents(contents: string): TileSheet {
    const sheet = new TileSheet(
      extractSvgElements(contents, requiredElementIds()),
    );
    if (sheet.missing().length > 0) {
      throw new Error(
        `the tile set does not provide ${sheet.missing().join(", ")}`,
      );
    }
    return sheet;
  }

  /**
   * Rasterizes all tiles once, so the first frame is complete.
   *
   * @return A message for every element that could not be loaded.
   */
  async prepare(): Promise<string[]> {
    const failures = new Map<string, string>();
    await Promise.all(
      requiredElementIds().map(async (id) => {
        const image = this.image(id);
        if (image === undefined) {
          failures.set(id, "not part of the tile set");
          return;
        }
        try {
          await image.decode();
          if (image.naturalWidth === 0) {
            failures.set(id, "the element is empty");
          }
        } catch (error) {
          failures.set(id, error instanceof Error ? error.message : "unknown error");
        }
      }),
    );
    return [...failures].map(([id, reason]) => `${id}: ${reason}`);
  }

  /** Whether the tile set provides the given element. */
  has(id: string): boolean {
    return this.elements.has(id);
  }

  /** All element ids that could not be found in the tile set. */
  missing(): string[] {
    return requiredElementIds().filter((id) => !this.elements.has(id));
  }

  private image(id: string): HTMLImageElement | undefined {
    const cached = this.images.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const element = this.elements.get(id);
    if (element === undefined) {
      return undefined;
    }
    const svg = elementToSvg(element, element.width, element.height);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    this.images.set(id, image);
    return image;
  }

  /** The rasterized element of the given id and size, or undefined. */
  raster(
    id: string,
    width: number,
    height: number,
    ratio: number,
  ): CanvasImageSource | undefined {
    const key = `${id}@${width}x${height}@${ratio}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const image = this.image(id);
    if (image === undefined || image.naturalWidth === 0) {
      return undefined;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const context = canvas.getContext("2d");
    if (context === null) {
      return undefined;
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    this.cache.set(key, canvas);
    return canvas;
  }

  /** The rasterized base of an unselected tile. */
  tile(scale: TileScale, ratio: number): CanvasImageSource | undefined {
    return this.raster(TILE_ELEMENT_IDS[0]!, scale.width, scale.height, ratio);
  }

  /** The rasterized base of a highlighted tile. */
  selectedTile(scale: TileScale, ratio: number): CanvasImageSource | undefined {
    return this.raster(
      SELECTED_TILE_ELEMENT_IDS[0]!,
      scale.width,
      scale.height,
      ratio,
    );
  }

  /** The rasterized face of a tile, counted from one. */
  face(
    tileValue: number,
    scale: TileScale,
    ratio: number,
  ): CanvasImageSource | undefined {
    const id = FACE_ELEMENT_IDS[tileValue - 1];
    if (id === undefined) {
      return undefined;
    }
    return this.raster(id, scale.faceWidth, scale.faceHeight, ratio);
  }

  /** Forgets all rasterized tiles, e.g. when the tile set changed. */
  clear(): void {
    for (const image of this.images.values()) {
      URL.revokeObjectURL(image.src);
    }
    this.images.clear();
    this.cache.clear();
  }
}

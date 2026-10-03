/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Checks the rendering of the tile set in a real browser: every tile of the
    board is compared with a reference rendering of the same tile, so geometry
    and rasterization can be verified without looking at the screen.

    Run it with "npm run check:render" and read the result in the page.

    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import tileSetUrl from "../src/assets/tilesets/default.svg?url";
import { Board } from "../src/core/board";
import { EMPTY, N_TILES } from "../src/core/tiles";
import type { TilePos } from "../src/core/types";
import { BoardRenderer } from "../src/render/renderer";
import {
  DEFAULT_METRICS,
  TileSheet,
  computeScale,
  type TileScale,
} from "../src/render/tileset";

const X_TILES = 14;
const Y_TILES = 6;
const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 700;

interface Failure {
  check: string;
  detail: string;
}

interface Rectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const failures: Failure[] = [];

function fail(check: string, detail: string): void {
  failures.push({ check, detail });
}

function report(): void {
  const out = document.querySelector<HTMLElement>("#out");
  if (out === null) {
    return;
  }
  out.textContent =
    failures.length === 0
      ? "RENDER CHECK OK"
      : [
          `RENDER CHECK FAILED (${failures.length})`,
          ...failures.map((failure) => `${failure.check}: ${failure.detail}`),
        ].join("\n");
}

/** A board with the given tiles, filled row by row, like the game does. */
function boardWith(tiles: readonly number[]): Board {
  const board = new Board({ width: X_TILES, height: Y_TILES });
  const rows: number[][] = [];
  for (let y = 0; y < Y_TILES; ++y) {
    const row: number[] = [];
    for (let x = 0; x < X_TILES; ++x) {
      row.push(tiles[y * X_TILES + x] ?? EMPTY);
    }
    rows.push(row);
  }
  board.restore(rows);
  return board;
}

/** Two of each tile, so every tile of the board has a pair. */
function twoOfEachTile(): number[] {
  return Array.from({ length: X_TILES * Y_TILES }, (_, cell) => (cell % N_TILES) + 1);
}

function contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("no drawing context");
  }
  return context;
}

/**
 * Paints the whole board the way the renderer is expected to do it, on top of
 * the given background. The coordinates are not rounded, so the result can be
 * compared with the canvas pixel by pixel.
 */
function referenceBoard(
  sheet: TileSheet,
  scale: TileScale,
  tiles: readonly number[],
  xTiles: number,
  yTiles: number,
  viewWidth: number,
  viewHeight: number,
  background: ImageData,
  highlightedTile: number | null,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = background.width;
  canvas.height = background.height;
  const context = contextOf(canvas);
  context.putImageData(background, 0, 0);
  const xOffset = (viewWidth - scale.cellWidth * xTiles) / 2;
  const yOffset = (viewHeight - scale.cellHeight * yTiles) / 2;
  // the tiles overlap, so the painting order matters: Board::paint() walks the
  // columns first
  for (let x = 0; x < xTiles; ++x) {
    for (let y = 0; y < yTiles; ++y) {
      const tile = tiles[y * xTiles + x] ?? EMPTY;
      if (tile === EMPTY) {
        continue;
      }
      const left = xOffset + x * scale.cellWidth;
      const top = yOffset + y * scale.cellHeight;
      // a tile value highlights every field with that value
      const selected = tile === highlightedTile;
      const base = selected ? sheet.selectedTile(scale, 1) : sheet.tile(scale, 1);
      const face = sheet.face(tile, scale, 1);
      if (base === undefined || face === undefined) {
        throw new Error(`the tile ${tile} is missing`);
      }
      context.drawImage(base, left, top, scale.width, scale.height);
      context.drawImage(
        face,
        left + scale.faceOffsetX,
        top + scale.faceOffsetY,
        scale.faceWidth,
        scale.faceHeight,
      );
    }
  }
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function compare(name: string, actual: ImageData, expected: ImageData): void {
  if (actual.width !== expected.width || actual.height !== expected.height) {
    fail(
      name,
      `size ${actual.width}x${actual.height} != ${expected.width}x${expected.height}`,
    );
    return;
  }
  for (let index = 0; index < actual.data.length; index += 4) {
    for (let channel = 0; channel < 4; channel += 1) {
      if (
        (actual.data[index + channel] ?? 0) !== (expected.data[index + channel] ?? 0)
      ) {
        const pixel = index / 4;
        fail(
          name,
          `differs at ${pixel % actual.width},${Math.floor(pixel / actual.width)} by ${
            (actual.data[index + channel] ?? 0) - (expected.data[index + channel] ?? 0)
          }`,
        );
        return;
      }
    }
  }
}

/** The area that the tiles painted, i.e. that differs from the background. */
function paintedBounds(actual: ImageData, below: ImageData): Rectangle | null {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < actual.data.length; index += 4) {
    if (actual.data[index] !== below.data[index]) {
      const pixel = index / 4;
      const x = pixel % actual.width;
      const y = Math.floor(pixel / actual.width);
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (!Number.isFinite(left)) {
    return null;
  }
  return { left, top, right, bottom };
}

async function main(): Promise<void> {
  Object.defineProperty(window, "devicePixelRatio", {
    value: 1,
    configurable: true,
  });

  const sheet = await TileSheet.load(tileSetUrl);
  const broken = await sheet.prepare();
  if (sheet.missing().length > 0) {
    fail("tile set", `missing ${sheet.missing().join(", ")}`);
  }
  if (broken.length > 0) {
    fail("tile set", broken.join(", "));
    report();
    return;
  }

  const canvas = document.querySelector<HTMLCanvasElement>("#board");
  if (canvas === null) {
    throw new Error("missing canvas");
  }
  const context = contextOf(canvas);

  // the background is what an empty board shows
  const empty = boardWith([]);
  const backgroundRenderer = new BoardRenderer(canvas, empty, sheet);
  backgroundRenderer.resize();
  backgroundRenderer.paint();
  if (canvas.width !== VIEW_WIDTH || canvas.height !== VIEW_HEIGHT) {
    fail("canvas", `${canvas.width}x${canvas.height} != ${VIEW_WIDTH}x${VIEW_HEIGHT}`);
    report();
    return;
  }
  const background = context.getImageData(0, 0, canvas.width, canvas.height);

  // the expected scale and position are calculated here on purpose, so that
  // the renderer does not check itself
  const expectedScale = computeScale(
    DEFAULT_METRICS,
    VIEW_WIDTH,
    VIEW_HEIGHT,
    X_TILES,
    Y_TILES,
  );
  const scale = { ...expectedScale };
  const usedScale = backgroundRenderer.currentScale();
  for (const key of Object.keys(expectedScale) as (keyof TileScale)[]) {
    if (usedScale[key] !== expectedScale[key]) {
      fail("scale", `${key}: ${usedScale[key]} instead of ${expectedScale[key]}`);
    }
  }

  const board = boardWith(twoOfEachTile());
  const renderer = new BoardRenderer(canvas, board, sheet);
  renderer.resize();
  renderer.paint();
  const painted = context.getImageData(0, 0, canvas.width, canvas.height);
  const values = twoOfEachTile();

  compare(
    "board",
    painted,
    referenceBoard(
      sheet,
      scale,
      values,
      X_TILES,
      Y_TILES,
      VIEW_WIDTH,
      VIEW_HEIGHT,
      background,
      null,
    ),
  );

  // the board has to start at the centered position and fit into the view
  {
    const bounds = paintedBounds(painted, background);
    const xOffset = (VIEW_WIDTH - scale.cellWidth * X_TILES) / 2;
    const yOffset = (VIEW_HEIGHT - scale.cellHeight * Y_TILES) / 2;
    if (bounds === null) {
      fail("board position", "nothing was painted");
    } else {
      if (bounds.left !== Math.ceil(xOffset) || bounds.top !== Math.ceil(yOffset)) {
        fail(
          "board position",
          `starts at ${bounds.left},${bounds.top} instead of ${Math.ceil(xOffset)},${Math.ceil(yOffset)}`,
        );
      }
      // the last row and column have to be painted completely
      if (bounds.right < Math.ceil(xOffset + (X_TILES - 1) * scale.cellWidth)) {
        fail("board position", `the board is cut off at x=${bounds.right}`);
      }
      if (bounds.bottom < Math.ceil(yOffset + (Y_TILES - 1) * scale.cellHeight)) {
        fail("board position", `the board is cut off at y=${bounds.bottom}`);
      }
    }
  }

  // an empty field has to stay untouched
  {
    const sparse = [...values];
    sparse[0] = EMPTY;
    const sparseRenderer = new BoardRenderer(canvas, boardWith(sparse), sheet);
    sparseRenderer.resize();
    sparseRenderer.paint();
    compare(
      "empty field",
      context.getImageData(0, 0, canvas.width, canvas.height),
      referenceBoard(
        sheet,
        scale,
        sparse,
        X_TILES,
        Y_TILES,
        VIEW_WIDTH,
        VIEW_HEIGHT,
        background,
        null,
      ),
    );
  }

  // a highlighted tile has to use the selected base
  {
    const highlighted: TilePos = { x: 3, y: 2 };
    board.setHighlightedTile(board.fieldAt(highlighted));
    renderer.paint();
    compare(
      "highlighted tile",
      context.getImageData(0, 0, canvas.width, canvas.height),
      referenceBoard(
        sheet,
        scale,
        values,
        X_TILES,
        Y_TILES,
        VIEW_WIDTH,
        VIEW_HEIGHT,
        background,
        board.fieldAt(highlighted),
      ),
    );
    board.setHighlightedTile(-1);
    renderer.paint();
  }

  // all 42 faces have to be different
  {
    const faces = new Set<string>();
    for (let tile = 1; tile <= N_TILES; ++tile) {
      const canvas = document.createElement("canvas");
      canvas.width = scale.width;
      canvas.height = scale.height;
      const context = contextOf(canvas);
      const face = sheet.face(tile, scale, 1);
      if (face === undefined) {
        throw new Error(`the tile ${tile} is missing`);
      }
      context.drawImage(face, 0, 0, scale.faceWidth, scale.faceHeight);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      let hash = 2166136261;
      for (const value of image.data) {
        hash = Math.imul(hash ^ value, 16777619) >>> 0;
      }
      faces.add(hash.toString(16));
    }
    if (faces.size !== N_TILES) {
      fail("tile faces", `${faces.size} different faces instead of ${N_TILES}`);
    }
  }

  // an empty board must not paint any tile
  {
    backgroundRenderer.paint();
    const bounds = paintedBounds(
      context.getImageData(0, 0, canvas.width, canvas.height),
      background,
    );
    if (bounds !== null) {
      fail("empty board", `painted ${bounds.left},${bounds.top}`);
    }
  }

  report();
}

main().catch((error: unknown) => {
  fail("script", error instanceof Error ? error.message : "unknown error");
  report();
});
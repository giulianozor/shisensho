/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Plays the game in a frame: the board has to show every tile of the tile set
    in pairs, a pair has to be removable, undo has to put the tiles back, and
    the toolbar has to work. This covers what the unit tests and the render
    check cannot reach.

    The tiles are read from the canvas and compared with the tile set that the
    game itself uses, so the check finds the pairs without looking into the
    game. Run it with "npm run check:app" and read the result in the page.

    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import tileSetUrl from "../src/assets/tilesets/default.svg?url";
import { EMPTY, N_TILES } from "../src/core/tiles";
import {
  delayForSpeed,
  heightForSize,
  loadSettings,
  widthForSize,
  type Settings,
} from "../src/core/settings";
import type { TilePos } from "../src/core/types";
import {
  DEFAULT_METRICS,
  TileSheet,
  computeScale,
  type TileScale,
} from "../src/render/tileset";

interface Failure {
  check: string;
  detail: string;
}

const failures: Failure[] = [];
const errors: string[] = [];

function fail(check: string, detail: string): void {
  failures.push({ check, detail });
}

function expect(check: string, condition: boolean, detail: string): void {
  if (!condition) {
    fail(check, detail);
  }
}

function report(): void {
  const out = document.querySelector<HTMLElement>("#out");
  if (out === null) {
    return;
  }
  const messages = [
    ...failures.map((failure) => `${failure.check}: ${failure.detail}`),
    ...errors.map((error) => `error: ${error}`),
  ];
  out.textContent =
    messages.length === 0
      ? "APP CHECK OK"
      : [`APP CHECK FAILED (${messages.length})`, ...messages].join("\n");
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

/** A field of the board, together with the way it looks. */
interface Field {
  readonly position: TilePos;
  /** How much of the field is covered by a tile. */
  readonly covered: number;
  /**
   * The pixels of the tile that no neighbour paints over. Only these can be
   * compared with a tile of the tile set: everywhere else the tile shows the
   * background or the tile that was drawn before it.
   */
  readonly artwork: Uint8ClampedArray;
}

class Game {
  readonly window: Window;
  readonly document: Document;
  readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly xTiles: number;
  private readonly yTiles: number;
  private readonly scale: TileScale;
  private readonly ratio: number;
  private readonly cellWidth: number;
  private readonly cellHeight: number;
  private readonly artworkWidth: number;
  private readonly artworkHeight: number;
  private readonly xOffset: number;
  private readonly yOffset: number;
  readonly settings: Settings;
  readonly delay: number;

  constructor(window_: Window) {
    this.window = window_;
    this.document = window_.document;
    const canvas = this.document.querySelector<HTMLCanvasElement>("#board");
    if (canvas === null) {
      throw new Error("the game has no canvas");
    }
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("no drawing context");
    }
    this.context = context;
    this.settings = loadSettings(window_.localStorage);
    this.xTiles = widthForSize(this.settings.size);
    this.yTiles = heightForSize(this.settings.size);
    this.ratio = Math.min(3, Math.max(1, window_.devicePixelRatio || 1));
    this.scale = computeScale(
      DEFAULT_METRICS,
      canvas.clientWidth,
      canvas.clientHeight,
      this.xTiles,
      this.yTiles,
    );
    this.cellWidth = Math.floor(this.scale.cellWidth);
    this.cellHeight = Math.floor(this.scale.cellHeight);
    // the base of a tile reaches into the next field, so the artwork is only
    // read where no neighbour can paint over it
    this.artworkWidth = Math.max(
      1,
      this.scale.faceWidth - (this.scale.width - this.scale.cellWidth),
    );
    this.artworkHeight = Math.max(
      1,
      this.scale.faceHeight - (this.scale.height - this.scale.cellHeight),
    );
    this.xOffset = (canvas.clientWidth - this.scale.cellWidth * this.xTiles) / 2;
    this.yOffset = (canvas.clientHeight - this.scale.cellHeight * this.yTiles) / 2;
    this.delay = delayForSpeed(this.settings.speed);
  }

  get fieldCount(): number {
    return this.xTiles * this.yTiles;
  }

  /** The way every field of the board looks right now. */
  fields(): Field[] {
    const fields: Field[] = [];
    for (let y = 0; y < this.yTiles; ++y) {
      for (let x = 0; x < this.xTiles; ++x) {
        const position: TilePos = { x, y };
        const cell = this.context.getImageData(
          Math.round(this.xOffset + x * this.cellWidth),
          Math.round(this.yOffset + y * this.cellHeight),
          this.cellWidth,
          this.cellHeight,
        );
        let covered = 0;
        for (let index = 3; index < cell.data.length; index += 4) {
          if ((cell.data[index] ?? 0) > 250) {
            covered += 1;
          }
        }
        // the artwork starts where the game draws the face of the tile, which
        // is inset by the bevel and the shadow, and whose position is rounded
        // down so that the tile keeps its position inside the field
        const tile = this.context.getImageData(
          Math.floor(this.xOffset + x * this.cellWidth) + this.scale.faceOffsetX,
          Math.floor(this.yOffset + y * this.cellHeight) + this.scale.faceOffsetY,
          this.artworkWidth,
          this.artworkHeight,
        );
        fields.push({
          position,
          artwork: new Uint8ClampedArray(tile.data),
          covered: covered / (this.cellWidth * this.cellHeight),
        });
      }
    }
    return fields;
  }

  /**
   * The artwork a tile of every value would have on this board. The tiles are
   * drawn at the same fractional position as the game does it, so that the
   * pixels line up.
   */
  async artwork(sheet: TileSheet): Promise<Map<number, Uint8ClampedArray>> {
    const artwork = new Map<number, Uint8ClampedArray>();
    const canvas = document.createElement("canvas");
    canvas.width = this.artworkWidth;
    canvas.height = this.artworkHeight;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("no drawing context for the tile set");
    }
    // the game centers the board, which can put a tile on a fraction of a pixel
    const fractionX = this.xOffset - Math.floor(this.xOffset);
    const fractionY = this.yOffset - Math.floor(this.yOffset);
    for (let value = 1; value <= N_TILES; ++value) {
      const base = sheet.tile(this.scale, this.ratio);
      const face = sheet.face(value, this.scale, this.ratio);
      if (base === undefined || face === undefined) {
        throw new Error(`the tile set has no tile ${value}`);
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      // the canvas holds the face of the tile, so the base of the tile is drawn
      // relative to it
      context.drawImage(
        base,
        fractionX - this.scale.faceOffsetX,
        fractionY - this.scale.faceOffsetY,
        this.scale.width,
        this.scale.height,
      );
      context.drawImage(
        face,
        fractionX,
        fractionY,
        this.scale.faceWidth,
        this.scale.faceHeight,
      );
      artwork.set(
        value,
        context.getImageData(0, 0, canvas.width, canvas.height).data.slice(),
      );
    }
    return artwork;
  }

  /**
   * The tile every field shows, or EMPTY where no tile of the tile set is
   * found. The comparison uses the pixels of the tile itself, so the background
   * and the neighbouring tiles cannot change the result.
   */
  identify(
    fields: readonly Field[],
    artwork: ReadonlyMap<number, Uint8ClampedArray>,
  ): Map<TilePos, number> {
    const found = new Map<TilePos, number>();
    for (const field of fields) {
      let best = EMPTY;
      let bestDifference = Number.POSITIVE_INFINITY;
      for (const [value, reference] of artwork) {
        const difference = compare(field.artwork, reference);
        if (difference < bestDifference) {
          bestDifference = difference;
          best = value;
        }
      }
      found.set(field.position, bestDifference < 0.5 ? best : EMPTY);
    }
    return found;
  }

  /** The fields that look different now than in the given fields. */
  changed(before: readonly Field[]): TilePos[] {
    const after = this.fields();
    return after
      .filter(
        (field, index) =>
          !sameArtwork(field, before[index]) ||
          field.covered !== before[index]?.covered,
      )
      .map((field) => field.position);
  }

  clickTile(position: TilePos, button = 0): void {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = rect.left + this.xOffset + (position.x + 0.5) * this.cellWidth;
    const clientY = rect.top + this.yOffset + (position.y + 0.5) * this.cellHeight;
    // the game selects a tile on pointerup, so a click needs both events
    this.canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX,
        clientY,
        button,
        buttons: 1,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
    this.canvas.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX,
        clientY,
        button,
        buttons: 0,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  }

  /** A right click always removes the selection, as in the original game. */
  clearSelection(position: TilePos): void {
    this.clickTile(position, 2);
  }

  click(action: string): void {
    this.document
      .querySelector<HTMLButtonElement>(`[data-action="${action}"]`)
      ?.click();
  }

  text(selector: string): string {
    return this.document.querySelector<HTMLElement>(selector)?.textContent ?? "";
  }

  removed(): { removed: number; total: number } {
    const match = this.text("#tiles").match(/(\d+)\s*\/\s*(\d+)/);
    if (match === null) {
      return { removed: -1, total: -1 };
    }
    return { removed: Number(match[1]), total: Number(match[2]) };
  }

  /** Waits until the board is completely painted, and returns the fields. */
  async waitForBoard(): Promise<Field[]> {
    let best = 0;
    for (let attempt = 0; attempt < 300; ++attempt) {
      await sleep(50);
      const fields = this.fields();
      best = Math.max(best, ...fields.map((field) => field.covered));
      if (fields.every((field) => field.covered > 0.9)) {
        return fields;
      }
    }
    throw new Error(
      `the board is not complete, the most covered field is ${(best * 100).toFixed(0)}% ` +
        `of ${this.cellWidth}x${this.cellHeight} at ` +
        `${this.canvas.clientWidth}x${this.canvas.clientHeight}`,
    );
  }
}

/** How much two artworks differ, where the tile set paints the tile itself. */
function compare(pixels: Uint8ClampedArray, reference: Uint8ClampedArray): number {
  let total = 0;
  let channels = 0;
  for (let index = 0; index < reference.length; index += 4) {
    if ((reference[index + 3] ?? 0) < 250) {
      continue;
    }
    for (let channel = 0; channel < 3; channel += 1) {
      total += Math.abs(
        (pixels[index + channel] ?? 0) - (reference[index + channel] ?? 0),
      );
    }
    channels += 3;
  }
  return channels === 0 ? Number.POSITIVE_INFINITY : total / channels;
}

function sameArtwork(left: Field | undefined, right: Field | undefined): boolean {
  if (left === undefined || right === undefined) {
    return false;
  }
  for (let index = 0; index < left.artwork.length; index += 4) {
    if (left.artwork[index] !== right.artwork[index]) {
      return false;
    }
  }
  return true;
}

/** The pairs of the board: two fields show the same tile. */
function pairs(tiles: ReadonlyMap<TilePos, number>): TilePos[][] {
  const byTile = new Map<number, TilePos[]>();
  for (const [position, tile] of tiles) {
    const positions = byTile.get(tile) ?? [];
    positions.push(position);
    byTile.set(tile, positions);
  }
  const found: TilePos[][] = [];
  for (const [tile, positions] of byTile) {
    if (tile === EMPTY) {
      continue;
    }
    for (let index = 0; index + 1 < positions.length; index += 2) {
      found.push([positions[index]!, positions[index + 1]!]);
    }
  }
  return found;
}

function position(position_: TilePos): string {
  return `${position_.x},${position_.y}`;
}

/**
 * Waits until the canvas has the size the stylesheet gives it. The page appears
 * as soon as its markup is parsed, which can be before its stylesheet is
 * loaded, and a canvas that has no size in the layout yet has no width to
 * measure the board with.
 */
async function waitForLayout(canvas: HTMLCanvasElement): Promise<void> {
  let previous = "";
  for (let attempt = 0; attempt < 300; ++attempt) {
    await sleep(50);
    const size = `${canvas.clientWidth}x${canvas.clientHeight}`;
    const settled = size === previous && canvas.clientWidth > 0;
    previous = size;
    if (settled) {
      return;
    }
  }
  throw new Error(
    `the canvas did not get its size, it is still ${canvas.clientWidth}x${canvas.clientHeight}`,
  );
}

async function open(): Promise<Game> {
  const frame = document.querySelector<HTMLIFrameElement>("#app");
  if (frame === null) {
    throw new Error("missing frame");
  }
  const gameWindow = frame.contentWindow;
  if (gameWindow === null) {
    throw new Error("missing window");
  }
  gameWindow.addEventListener("error", (event) => {
    errors.push(event.message);
  });
  gameWindow.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    errors.push(reason instanceof Error ? reason.message : "unknown error");
  });

  let canvas: HTMLCanvasElement | null = null;
  for (let attempt = 0; attempt < 300 && canvas === null; ++attempt) {
    await sleep(50);
    canvas = gameWindow.document.querySelector<HTMLCanvasElement>("#board");
  }
  if (canvas === null) {
    throw new Error("the game did not start");
  }
  // the board is measured against the size of the canvas, so the check has to
  // wait for the layout as well, or it reads the board with the wrong geometry
  await waitForLayout(canvas);
  return new Game(gameWindow);
}

async function main(): Promise<void> {
  const game = await open();
  let fields = await game.waitForBoard();

  // the status bar shows a complete board
  expect(
    "board",
    game.removed().total === game.fieldCount,
    `the tile counter shows "${game.text("#tiles")}"`,
  );
  expect(
    "board",
    /^Your time: \d\d:\d\d$/.test(game.text("#time")),
    `the time shows "${game.text("#time")}"`,
  );

  // every field shows a tile of the tile set, and every tile comes in pairs
  const sheet = await TileSheet.load(tileSetUrl);
  await sheet.prepare();
  const artwork = await game.artwork(sheet);
  let tiles = game.identify(fields, artwork);
  const unknown = [...tiles].filter(([, tile]) => tile === EMPTY);
  expect(
    "tiles",
    unknown.length === 0,
    `${unknown.length} fields show no tile of the tile set, for example ` +
      `${unknown.map(([where]) => position(where)).slice(0, 4).join(" ")}`,
  );
  const tilePairs = pairs(tiles);
  expect(
    "tiles",
    tilePairs.length === game.fieldCount / 2,
    `${tilePairs.length} pairs of tiles were found instead of ${game.fieldCount / 2}`,
  );
  const odd = [...countTiles(tiles)].filter(([, count]) => count % 2 !== 0);
  expect(
    "tiles",
    odd.length === 0,
    `the tiles ${odd.map(([tile]) => tile).join(", ")} do not come in pairs`,
  );
  const values = new Set(tiles.values());
  expect(
    "tiles",
    values.size >= 30,
    `the board only shows ${values.size} different tiles`,
  );

  // the hint shows one of the moves that are possible
  game.click("hint");
  await sleep(150);
  expect(
    "hint",
    !game.document.querySelector<HTMLElement>("#cheat")?.hasAttribute("hidden"),
    "the cheat mode is not shown after a hint",
  );
  expect(
    "hint",
    game.changed(fields).length > 0,
    "the board does not show the move of the hint",
  );

  // a pair of tiles can be removed, but only when its tiles are connected: the
  // pairs are tried one after the other
  let removedPair: TilePos[] | null = null;
  for (const pair of tilePairs) {
    game.clearSelection(pair[0]!);
    game.clickTile(pair[0]!);
    game.clickTile(pair[1]!);
    await sleep(60);
    if (game.text("#tip").includes("did not match")) {
      continue;
    }
    await sleep(game.delay + 400);
    if (game.removed().removed === 2) {
      removedPair = pair;
      break;
    }
  }
  expect(
    "move",
    removedPair !== null,
    `no pair of tiles could be removed, the tip says "${game.text("#tip")}"`,
  );
  if (removedPair === null) {
    report();
    return;
  }

  // the removed tiles are gone: gravity can pull other tiles into their fields
  await sleep(game.delay + 400);
  const afterMove = game.identify(game.fields(), artwork);
  for (const gone of removedPair) {
    expect(
      "move",
      afterMove.get(gone) !== tiles.get(gone),
      `the tile at ${position(gone)} is still there`,
    );
  }
  const countsBefore = countTiles(tiles);
  const countsAfter = countTiles(afterMove);
  const shownBefore = [...tiles.values()].filter((tile) => tile !== EMPTY).length;
  const shownAfter = [...afterMove.values()].filter((tile) => tile !== EMPTY).length;
  expect(
    "move",
    shownAfter === shownBefore - removedPair.length,
    `the board shows ${shownAfter} tiles instead of ${shownBefore - removedPair.length}`,
  );
  expect(
    "move",
    [...countsAfter].every(
      ([tile, count]) => tile === EMPTY || count <= (countsBefore.get(tile) ?? 0),
    ),
    "the board shows tiles that were not on it before",
  );

  // undo puts the tiles back
  game.click("undo");
  await sleep(game.delay + 600);
  expect(
    "undo",
    game.removed().removed === 0,
    `the tile counter shows "${game.text("#tiles")}"`,
  );
  fields = await game.waitForBoard();
  tiles = game.identify(fields, artwork);
  expect(
    "undo",
    [...tiles.values()].filter((tile) => tile === EMPTY).length === 0,
    "the board is not complete after an undo",
  );

  // the game can be paused and continued
  game.click("pause");
  await sleep(150);
  expect(
    "pause",
    game.document
      .querySelector('[data-action="pause"]')
      ?.getAttribute("aria-pressed") === "true",
    "the pause button is not pressed",
  );
  expect(
    "pause",
    game.changed(fields).length > 0,
    "the board does not show that the game is paused",
  );
  game.click("pause");
  await sleep(150);
  expect(
    "pause",
    game.changed(fields).length === 0,
    "the board does not show the tiles again",
  );

  // the settings dialog opens and closes
  game.click("settings");
  await sleep(150);
  const settingsDialog = game.document.querySelector("#settings-dialog");
  expect(
    "settings",
    settingsDialog?.hasAttribute("open") === true,
    "the dialog did not open",
  );
  expect(
    "settings",
    game.document.querySelectorAll("#settings-dialog input, #settings-dialog select")
      .length > 4,
    "the dialog has no settings",
  );
  game.document
    .querySelector<HTMLButtonElement>('#settings-dialog [data-action="cancel"]')
    ?.click();
  await sleep(150);
  expect(
    "settings",
    settingsDialog?.hasAttribute("open") === false,
    "the dialog did not close",
  );

  // the high score dialog opens and shows the table
  game.click("high-scores");
  await sleep(150);
  const scoreDialog = game.document.querySelector("#high-score-dialog");
  expect(
    "high scores",
    scoreDialog?.hasAttribute("open") === true,
    "the dialog did not open",
  );
  expect(
    "high scores",
    (scoreDialog?.querySelector("table") !== null) ||
      (scoreDialog?.textContent?.includes("No") ?? false),
    "the dialog shows no scores",
  );
  game.document
    .querySelector<HTMLButtonElement>('#high-score-dialog [data-action="close"]')
    ?.click();
  await sleep(150);
  expect(
    "high scores",
    scoreDialog?.hasAttribute("open") === false,
    "the dialog did not close",
  );

  // the help dialog opens, explains how to play and closes
  game.click("help");
  await sleep(150);
  const helpDialog = game.document.querySelector("#help-dialog");
  expect(
    "help",
    helpDialog?.hasAttribute("open") === true,
    "the dialog did not open",
  );
  expect(
    "help",
    (helpDialog?.querySelectorAll(".dialog-body p").length ?? 0) >= 3,
    "the dialog does not explain how to play",
  );
  expect(
    "help",
    (helpDialog?.querySelectorAll('.dialog-body a[href^="https://"]').length ??
      0) >= 2,
    "the dialog does not link to the project",
  );
  game.document
    .querySelector<HTMLButtonElement>('#help-dialog [data-action="close"]')
    ?.click();
  await sleep(150);
  expect(
    "help",
    helpDialog?.hasAttribute("open") === false,
    "the dialog did not close",
  );

  // the help dialog also opens with F1
  game.window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "F1", bubbles: true }),
  );
  await sleep(150);
  expect(
    "help",
    helpDialog?.hasAttribute("open") === true,
    "F1 did not open the dialog",
  );
  game.document
    .querySelector<HTMLButtonElement>('#help-dialog [data-action="close"]')
    ?.click();
  await sleep(150);

  // a new game shows a complete board again
  game.click("new-game");
  await sleep(300);
  expect(
    "new game",
    game.removed().removed === 0,
    `the tile counter shows "${game.text("#tiles")}"`,
  );
  const newFields = await game.waitForBoard();
  const newTiles = game.identify(newFields, artwork);
  expect(
    "new game",
    [...newTiles.values()].filter((tile) => tile === EMPTY).length === 0,
    "the new board is not complete",
  );
  expect(
    "new game",
    layout(newTiles) !== layout(tiles),
    "the new board is laid out like the old one",
  );

  report();
}

function countTiles(tiles: ReadonlyMap<TilePos, number>): Map<number, number> {
  const counts = new Map<number, number>();
  for (const tile of tiles.values()) {
    counts.set(tile, (counts.get(tile) ?? 0) + 1);
  }
  return counts;
}

/** The tiles of a board, row by row, as one string. */
function layout(tiles: ReadonlyMap<TilePos, number>): string {
  const fields = [...tiles].sort(
    (left, right) =>
      left[0].y - right[0].y || left[0].x - right[0].x,
  );
  return fields.map(([, tile]) => tile).join(",");
}

main().catch((error: unknown) => {
  // String() rather than a check for Error, so that a thrown DOMException, for
  // example from an invalid selector, still says what it was
  fail("script", error instanceof Error ? error.message : String(error));
  report();
});

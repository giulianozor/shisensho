/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Tests for the board rules, ported from KShisen's src/board.cpp

    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BOARD_SIZES,
  Board,
  SHUFFLE_PASSES,
  type BoardObserver,
  type BoardOptions,
} from "../src/core/board";
import { mulberry32 } from "../src/core/rng";
import { EMPTY, N_TILES } from "../src/core/tiles";
import { type PossibleMove, pos, type TilePos } from "../src/core/types";

const SEASON_1 = 28;
const SEASON_2 = 29;
const SEASON_4 = 31;
const FLOWER_1 = 39;
const FLOWER_2 = 40;
const FLOWER_4 = 42;

/** Builds a board and fills it with the given rows (top row first). */
function boardWith(rows: number[][], options: BoardOptions = {}): Board {
  const height = rows.length;
  const width = (rows[0] as number[]).length;
  const board = new Board({
    width,
    height,
    shuffle: 0,
    random: mulberry32(1),
    ...options,
  });
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      board.setField(pos(x, y), (rows[y] as number[])[x] as number);
    }
  }
  return board;
}

function counts(board: Board): Map<number, number> {
  const map = new Map<number, number>();
  for (const row of board.snapshot()) {
    for (const tile of row) {
      map.set(tile, (map.get(tile) ?? 0) + 1);
    }
  }
  return map;
}

describe("Board geometry", () => {
  it("uses the board sizes and shuffle counts of KShisen", () => {
    expect(BOARD_SIZES.map((s) => `${s.x}x${s.y}`)).toEqual([
      "14x6",
      "16x9",
      "18x8",
      "24x12",
      "26x14",
      "30x16",
    ]);
    expect(SHUFFLE_PASSES).toEqual([1, 5, 9]);
  });

  it("knows the field size and valid positions", () => {
    const board = boardWith([
      [1, 2],
      [3, 4],
    ]);
    expect(board.xTiles()).toBe(2);
    expect(board.yTiles()).toBe(2);
    expect(board.tiles()).toBe(4);
    expect(board.isValidPos(pos(1, 1))).toBe(true);
    expect(board.isValidPos(pos(2, 1))).toBe(false);
    expect(board.isValidPos(pos(-1, 1))).toBe(false);
    expect(board.isValidPosWithOutline(pos(-1, -1))).toBe(true);
    expect(board.isValidPosWithOutline(pos(2, 2))).toBe(true);
    expect(board.isValidPosWithOutline(pos(3, 0))).toBe(false);
  });

  it("returns EMPTY outside of the board", () => {
    const board = boardWith([
      [1, 2],
      [3, 4],
    ]);
    expect(board.fieldAt(pos(0, 0))).toBe(1);
    expect(board.fieldAt(pos(-1, 0))).toBe(EMPTY);
    expect(board.fieldAt(pos(0, 5))).toBe(EMPTY);
  });
});

describe("Board.newGame", () => {
  it("uses four tiles of every type that fits on the board", () => {
    // the default 18x8 board has room for 144 tiles, so only the first 36 of
    // the 42 tile types are dealt, exactly like in KShisen
    const size = BOARD_SIZES[2] as { x: number; y: number };
    const board = new Board({
      width: size.x,
      height: size.y,
      random: mulberry32(7),
    });
    expect(board.tiles()).toBe(size.x * size.y);
    const map = counts(board);
    const used = (size.x * size.y) / 4;
    for (let tile = 1; tile <= used; ++tile) {
      expect(map.get(tile)).toBe(4);
    }
    for (let tile = used + 1; tile <= N_TILES; ++tile) {
      expect(map.get(tile)).toBeUndefined();
    }
    expect(map.get(EMPTY)).toBeUndefined();
  });

  it("uses the season and flower tiles only once in chinese style", () => {
    const size = BOARD_SIZES[2] as { x: number; y: number };
    const board = new Board({
      width: size.x,
      height: size.y,
      chineseStyle: true,
      random: mulberry32(11),
    });
    const map = counts(board);
    for (let tile = 1; tile <= SEASON_1 - 1; ++tile) {
      expect(map.get(tile)).toBe(4);
    }
    for (let tile = SEASON_1; tile <= SEASON_4; ++tile) {
      expect(map.get(tile)).toBe(1);
    }
    for (let tile = SEASON_4 + 1; tile <= FLOWER_1 - 1; ++tile) {
      expect(map.get(tile)).toBe(4);
    }
    for (let tile = FLOWER_1; tile <= FLOWER_4; ++tile) {
      expect(map.get(tile)).toBe(1);
    }
    expect(map.get(EMPTY)).toBeUndefined();
  });

  it("starts a new game when the chinese style changes", () => {
    const board = boardWith([
      [1, 2],
      [3, 4],
    ]);
    const before = board.snapshot();
    board.setChineseStyleFlag(true);
    expect(board.chineseStyleFlag()).toBe(true);
    expect(board.snapshot()).not.toEqual(before);
  });

  it("creates solvable games when asked for", () => {
    const size = BOARD_SIZES[1] as { x: number; y: number };
    const board = new Board({
      width: size.x,
      height: size.y,
      solvable: true,
      random: mulberry32(3),
    });
    const before = board.snapshot();
    expect(board.isSolvable(false)).toBe(true);
    // isSolvable() restores the field it was called with
    expect(board.snapshot()).toEqual(before);
  });
});

describe("Board.tilesMatch", () => {
  it("only matches identical tiles by default", () => {
    const board = boardWith([
      [1, 2],
      [3, 4],
    ]);
    expect(board.tilesMatch(7, 7)).toBe(true);
    expect(board.tilesMatch(SEASON_1, SEASON_2)).toBe(false);
    expect(board.tilesMatch(FLOWER_1, FLOWER_2)).toBe(false);
    expect(board.tilesMatch(SEASON_1, FLOWER_1)).toBe(false);
  });

  it("matches all seasons and all flowers in chinese style", () => {
    const board = boardWith([
      [1, 2],
      [3, 4],
    ]);
    board.setChineseStyleFlag(true);
    expect(board.tilesMatch(SEASON_1, SEASON_4)).toBe(true);
    expect(board.tilesMatch(FLOWER_1, FLOWER_4)).toBe(true);
    expect(board.tilesMatch(SEASON_1, FLOWER_1)).toBe(false);
    expect(board.tilesMatch(7, 8)).toBe(false);
  });
});

describe("Board.canMakePath", () => {
  const board = boardWith([
    [1, 0, 0, 0, 1],
    [9, 0, 2, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 3, 0, 0],
  ]);

  it("accepts a clear straight line", () => {
    expect(board.canMakePath(pos(0, 0), pos(4, 0))).toBe(true);
    expect(board.canMakePath(pos(2, 1), pos(2, 3))).toBe(true);
  });

  it("rejects blocked and diagonal lines", () => {
    expect(board.canMakePath(pos(1, 1), pos(3, 3))).toBe(false);
    expect(board.canMakePath(pos(0, 0), pos(0, 3))).toBe(false);
  });
});

describe("Board.findPath", () => {
  it("finds a direct path", () => {
    const board = boardWith([
      [1, 0, 0, 0, 1],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const moves: PossibleMove[] = [];
    // the direct line is found first, the 3 segment search adds the detours
    // around the free cells above the two tiles
    expect(board.findPath(pos(0, 0), pos(4, 0), moves)).toBeGreaterThan(0);
    expect(moves[0]?.path).toEqual([pos(0, 0), pos(4, 0)]);
    expect(moves[0]?.hasSlide).toBe(false);
    for (const move of moves) {
      expect(move.path.length).toBeLessThanOrEqual(4);
    }
  });

  it("finds both corner paths of a blocked diagonal pair", () => {
    const board = boardWith([
      [1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ]);
    const moves2: PossibleMove[] = [];
    expect(board.findSimplePath(pos(0, 0), pos(1, 2), moves2)).toBe(2);
    expect(moves2.map((m) => m.path)).toEqual([
      [pos(0, 0), pos(1, 0), pos(1, 2)],
      [pos(0, 0), pos(0, 2), pos(1, 2)],
    ]);
  });

  it("allows paths with two bends using the outline", () => {
    // the two tiles are in the same row, the row is blocked between them
    const board = boardWith([
      [0, 0, 0, 0, 0, 0, 0],
      [1, 0, 9, 9, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ]);
    const moves: PossibleMove[] = [];
    expect(board.findPath(pos(0, 1), pos(3, 1), moves)).toBeGreaterThan(0);
    for (const move of moves) {
      // at most 4 positions: the tile, the outline and two more corners
      expect(move.path.length).toBeLessThanOrEqual(4);
      expect(move.path[0]).toEqual(pos(0, 1));
      expect(move.path[move.path.length - 1]).toEqual(pos(3, 1));
      // the middle part is empty space
      for (let i = 1; i < move.path.length - 1; ++i) {
        const p = move.path[i] as TilePos;
        expect(board.fieldAt(p)).toBe(EMPTY);
      }
    }
    // at least one of the paths uses the outline above the tiles
    expect(moves.some((m) => m.path.some((p) => p.y === 0))).toBe(true);
  });

  it("finds no path at all when the tiles are walled in", () => {
    const board = boardWith([
      [1, 9, 9, 9],
      [9, 0, 0, 9],
      [9, 0, 0, 9],
      [9, 9, 9, 1],
    ]);
    const moves: PossibleMove[] = [];
    expect(board.findPath(pos(0, 0), pos(3, 3), moves)).toBe(0);
    expect(moves).toHaveLength(0);
  });
});

describe("Board.canSlideTiles", () => {
  //  0 1 2 3 4 5 6
  const slideBoard = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 1, 9, 0, 0, 0, 9],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ];

  it("cannot slide without free space", () => {
    const board = boardWith([
      [1, 9, 9, 9],
      [9, 0, 0, 0],
    ]);
    expect(board.canSlideTiles(pos(0, 0), pos(1, 0))).toEqual([]);
    expect(board.canSlideTiles(pos(0, 0), pos(0, 0))).toEqual([]);
    expect(board.canSlideTiles(pos(0, 0), pos(2, 0))).toEqual([]);
  });

  it("does not slide when the free space is just next to the tile", () => {
    const board = boardWith([
      [0, 0, 0, 0],
      [0, 1, 0, 9],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(board.canSlideTiles(pos(1, 1), pos(3, 1))).toEqual([]);
  });

  it("slides to the right when there is enough free space", () => {
    const board = boardWith(slideBoard, { tilesCanSlide: true });
    expect(board.canSlideTiles(pos(1, 1), pos(4, 1))).toEqual([
      pos(2, 1),
      pos(5, 1),
    ]);
  });

  it("slides to the left", () => {
    const board = boardWith(
      [
        [0, 0, 0, 0, 0, 0, 0],
        [9, 0, 0, 0, 9, 1, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ],
      { tilesCanSlide: true },
    );
    // from (5,1) to (2,1): the free space is (1,1) and (0,1) is occupied by 9
    expect(board.canSlideTiles(pos(5, 1), pos(2, 1))).toEqual([
      pos(4, 1),
      pos(1, 1),
    ]);
  });

  it("slides downwards", () => {
    const board = boardWith(
      [
        [0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
        [0, 9, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
      { tilesCanSlide: true },
    );
    // the free cells are (1,3) and (1,4), so the tile at (1,2) may move two down
    expect(board.canSlideTiles(pos(1, 1), pos(1, 3))).toEqual([
      pos(1, 2),
      pos(1, 4),
    ]);
    expect(board.canSlideTiles(pos(1, 1), pos(1, 4))).toEqual([]);
  });
});

describe("Board.click", () => {
  const board = (): Board =>
    boardWith([
      [1, 0, 1, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

  it("marks a tile and unmarks it on a second click", () => {
    const b = board();
    expect(b.click(pos(0, 0))).toEqual({ kind: "selected" });
    expect(b.markedTile()).toEqual(pos(0, 0));
    expect(b.click(pos(0, 0))).toEqual({ kind: "unmarked" });
    expect(b.markedTile()).toBeNull();
  });

  it("unmarks when clicking outside of the board", () => {
    const b = board();
    b.click(pos(0, 0));
    expect(b.click(null)).toEqual({ kind: "unmarked" });
    expect(b.markedTile()).toBeNull();
  });

  it("unmarks and reports when the tiles do not match", () => {
    const b = board();
    b.click(pos(0, 0));
    expect(b.click(pos(0, 1))).toEqual({ kind: "no-match" });
    expect(b.markedTile()).toBeNull();
  });

  it("reports an invalid move when the tiles match but are not connected", () => {
    const b = boardWith([
      [1, 9, 9, 9],
      [9, 0, 0, 9],
      [9, 0, 0, 9],
      [9, 9, 1, 9],
    ]);
    b.click(pos(0, 0));
    expect(b.click(pos(2, 3))).toEqual({ kind: "invalid" });
    // the marked tile is kept so that the player can try another tile
    expect(b.markedTile()).toEqual(pos(0, 0));
  });

  it("performs a matching move and keeps the tiles until the animation ends", () => {
    const b = board();
    b.click(pos(0, 0));
    expect(b.click(pos(2, 0))).toEqual({ kind: "moved" });
    expect(b.pendingRemoval()).toBe(true);
    expect(b.getConnection()).toEqual([pos(0, 0), pos(2, 0)]);
    // not removed yet
    expect(b.tilesLeft()).toBe(3);
    b.finishConnection();
    expect(b.pendingRemoval()).toBe(false);
    // the two 1s are gone, only the 2 is left
    expect(b.tilesLeft()).toBe(1);
    expect(b.getConnection()).toEqual([]);
    expect(b.canUndo()).toBe(true);
  });

  //  0 1 2 3 4 5 6
  //0 . . . . . . .
  //1 . A . . . . .
  //2 . T . . . . .
  //3 . . . . B . .
  //4 . . . . . . .
  const choosingBoard = (): Board =>
    boardWith(
      [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0],
        [0, 9, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ],
      { tilesCanSlide: true },
    );

  it("asks the player to choose when several moves are possible", () => {
    const b = choosingBoard();
    b.click(pos(1, 1));
    expect(b.click(pos(4, 3))).toEqual({ kind: "choose-move" });
    const moves = b.getPossibleMoves();
    expect(moves.length).toBe(2);
    // the slide of the tile at (1,2) is offered first
    expect(moves[0]?.hasSlide).toBe(true);
    expect(moves[0]?.slide).toEqual([pos(1, 2), pos(1, 4)]);
    expect(moves[0]?.path).toEqual([pos(1, 1), pos(1, 3), pos(4, 3)]);
    // and the plain path around the corner as the second option
    expect(moves[1]?.hasSlide).toBe(false);
    expect(moves[1]?.path).toEqual([pos(1, 1), pos(4, 1), pos(4, 3)]);
  });

  it("performs the chosen move when the player clicks on the path", () => {
    const b = choosingBoard();
    b.click(pos(1, 1));
    b.click(pos(4, 3));
    // clicking on the connecting line of the slide selects that move
    expect(b.click(pos(1, 2))).toEqual({ kind: "moved" });
    // the tile at (1,2) slid down to (1,4)
    expect(b.fieldAt(pos(1, 2))).toBe(EMPTY);
    expect(b.fieldAt(pos(1, 4))).toBe(9);
    b.finishConnection();
    expect(b.fieldAt(pos(1, 1))).toBe(EMPTY);
    expect(b.fieldAt(pos(4, 3))).toBe(EMPTY);
    expect(b.tilesLeft()).toBe(1);
  });

  it("performs the plain move when the player clicks on its line", () => {
    const b = choosingBoard();
    b.click(pos(1, 1));
    b.click(pos(4, 3));
    expect(b.click(pos(3, 1))).toEqual({ kind: "moved" });
    expect(b.fieldAt(pos(1, 2))).toBe(9);
    b.finishConnection();
    expect(b.fieldAt(pos(1, 1))).toBe(EMPTY);
    expect(b.fieldAt(pos(4, 3))).toBe(EMPTY);
    expect(b.tilesLeft()).toBe(1);
  });

  it("highlights all tiles of the same type on a secondary click", () => {
    const b = board();
    expect(b.click(pos(0, 0), "right")).toEqual({ kind: "highlighted" });
    expect(b.highlightedTile()).toBe(1);
    expect(b.isTileHighlighted(pos(2, 0))).toBe(true);
    expect(b.isTileHighlighted(pos(0, 1))).toBe(false);
    // a normal click clears the highlight again
    b.click(pos(0, 0));
    expect(b.highlightedTile()).toBe(-1);
  });
});

describe("Board game state", () => {
  it("pauses and resumes", () => {
    const board = boardWith([
      [1, 2],
      [3, 4],
    ]);
    board.setPauseEnabled(true);
    expect(board.isPaused()).toBe(true);
    board.setPauseEnabled(false);
    expect(board.isNormal()).toBe(true);
  });

  it("starts a new game when the game is over and the board is clicked", () => {
    const board = boardWith([
      [1, 0],
      [0, 0],
    ]);
    board.setField(pos(1, 0), 1);
    board.setGameOverEnabled(true);
    expect(board.isOver()).toBe(true);
    const before = board.snapshot();
    expect(board.click(pos(0, 0))).toEqual({ kind: "ignored" });
    expect(board.snapshot()).not.toEqual(before);
    expect(board.isNormal()).toBe(true);
  });

  it("ignores clicks while the game is stuck", () => {
    const board = boardWith([
      [1, 2],
      [3, 4],
    ]);
    board.setGameStuckEnabled(true);
    expect(board.click(pos(0, 0))).toEqual({ kind: "ignored" });
    expect(board.markedTile()).toBeNull();
  });
});

describe("Board end of game", () => {
  it("ends the game when the last tiles are removed", () => {
    const observer = { endOfGame: vi.fn() };
    const board = boardWith(
      [
        [1, 0],
        [0, 0],
      ],
      { observer },
    );
    board.setField(pos(1, 0), 1);
    board.click(pos(0, 0));
    board.click(pos(1, 0));
    expect(board.pendingRemoval()).toBe(true);
    board.finishConnection();
    expect(observer.endOfGame).toHaveBeenCalledTimes(1);
    expect(board.tilesLeft()).toBe(0);
  });

  it("ends the game when no move is possible any more", () => {
    const observer = { endOfGame: vi.fn() };
    // all tiles are of a different type, so only the two 1s can match
    const board = boardWith(
      [
        [11, 12, 1, 13, 14],
        [15, 16, 1, 17, 18],
        [19, 20, 0, 21, 22],
        [23, 24, 0, 25, 26],
      ],
      { observer },
    );
    board.click(pos(2, 0));
    board.click(pos(2, 1));
    board.finishConnection();
    expect(observer.endOfGame).toHaveBeenCalledTimes(1);
    expect(board.tilesLeft()).toBe(16);
  });

  it("does not complain about unsolvable boards when the message is off", () => {
    const observer = { endOfGame: vi.fn() };
    const board = boardWith(
      [
        [11, 12, 1, 13, 14],
        [15, 16, 1, 17, 18],
        [19, 20, 0, 21, 22],
        [23, 24, 0, 25, 26],
      ],
      { observer, showUnsolvableMessage: false },
    );
    board.click(pos(2, 0));
    board.click(pos(2, 1));
    board.finishConnection();
    expect(observer.endOfGame).not.toHaveBeenCalled();
    expect(board.tilesLeft()).toBe(16);
  });
});

describe("Board gravity", () => {
  it("lets the tiles fall after a removal", () => {
    const board = boardWith([
      [9, 0, 9, 0],
      [1, 0, 1, 0],
      [2, 0, 2, 0],
      [3, 0, 3, 0],
    ]);
    board.click(pos(0, 1));
    board.click(pos(2, 1));
    board.finishConnection();
    // the 9 of the first column fell down onto the 2
    expect(board.fieldAt(pos(0, 0))).toBe(EMPTY);
    expect(board.fieldAt(pos(0, 1))).toBe(9);
    expect(board.fieldAt(pos(0, 2))).toBe(2);
    expect(board.fieldAt(pos(2, 1))).toBe(9);
  });

  it("keeps the tiles in place without gravity", () => {
    const board = boardWith(
      [
        [9, 0, 9, 0],
        [1, 0, 1, 0],
        [2, 0, 2, 0],
        [3, 0, 3, 0],
      ],
      { gravity: false },
    );
    board.click(pos(0, 1));
    board.click(pos(2, 1));
    board.finishConnection();
    expect(board.fieldAt(pos(0, 0))).toBe(9);
    expect(board.fieldAt(pos(0, 1))).toBe(EMPTY);
  });
});

describe("Board undo and redo", () => {
  const gravityBoard = (): Board =>
    boardWith([
      [9, 0, 9, 0],
      [1, 0, 1, 0],
      [2, 0, 2, 0],
      [3, 0, 3, 0],
    ]);

  it("restores the board exactly, with gravity", () => {
    const board = gravityBoard();
    const before = board.snapshot();
    board.click(pos(0, 1));
    board.click(pos(2, 1));
    board.finishConnection();
    expect(board.snapshot()).not.toEqual(before);
    board.undo();
    expect(board.snapshot()).toEqual(before);
    expect(board.canRedo()).toBe(true);
    board.redo();
    expect(board.fieldAt(pos(0, 0))).toBe(EMPTY);
    expect(board.fieldAt(pos(0, 1))).toBe(9);
    board.undo();
    expect(board.snapshot()).toEqual(before);
  });

  // A gravity valid board (every column is packed to the bottom) in which the
  // tile at (2,3) can only reach the tile at (4,4) by sliding.
  //  0  1  2  3  4  5  6
  //0 . 11 12  .  .  .  .
  //1 . 13 14  .  .  .  .
  //2 . 15 16  .  .  .  .
  //3 .  A  T  .  .  .  .
  //4 . 17 18  .  B  .  .
  //
  // The free run after T reaches the right border, so the tile slides to (5,3).
  const slideBoard = (options: BoardOptions = {}): Board =>
    boardWith(
      [
        [0, 11, 12, 0, 0, 0, 0],
        [0, 13, 14, 0, 0, 0, 0],
        [0, 15, 16, 0, 0, 0, 0],
        [0, 1, 9, 0, 0, 0, 0],
        [0, 17, 18, 0, 1, 0, 0],
      ],
      { tilesCanSlide: true, ...options },
    );

  it("restores the board exactly, with a slide", () => {
    const board = slideBoard();
    const before = board.snapshot();
    board.click(pos(1, 3));
    board.click(pos(4, 4));
    expect(board.getPossibleMoves()).toHaveLength(0);
    board.finishConnection();
    // T slid from (2,3) to (5,3) and then fell to the bottom of its column,
    // while the tile above it dropped into the gap
    expect(board.fieldAt(pos(2, 3))).toBe(16);
    expect(board.fieldAt(pos(5, 3))).toBe(EMPTY);
    expect(board.fieldAt(pos(5, 4))).toBe(9);
    expect(board.tilesLeft()).toBe(9);
    board.undo();
    expect(board.snapshot()).toEqual(before);
    board.redo();
    expect(board.fieldAt(pos(2, 3))).toBe(16);
    expect(board.fieldAt(pos(5, 4))).toBe(9);
    expect(board.tilesLeft()).toBe(9);
    board.undo();
    expect(board.snapshot()).toEqual(before);
  });

  it("restores the board without gravity and with a slide", () => {
    const board = slideBoard({ gravity: false });
    const before = board.snapshot();
    board.click(pos(1, 3));
    board.click(pos(4, 4));
    board.finishConnection();
    expect(board.tilesLeft()).toBe(9);
    expect(board.fieldAt(pos(2, 3))).toBe(EMPTY);
    expect(board.fieldAt(pos(5, 3))).toBe(9);
    board.undo();
    expect(board.snapshot()).toEqual(before);
  });

  it("drops the redo stack on a new move", () => {
    const board = gravityBoard();
    const before = board.snapshot();
    board.click(pos(0, 1));
    board.click(pos(2, 1));
    board.finishConnection();
    board.undo();
    expect(board.canRedo()).toBe(true);
    board.click(pos(0, 1));
    board.click(pos(2, 1));
    board.finishConnection();
    expect(board.canRedo()).toBe(false);
    board.undo();
    expect(board.snapshot()).toEqual(before);
  });

  it("undoes a move in the same column from the lower tile up", () => {
    const board = boardWith([
      [1, 0, 0],
      [9, 0, 0],
      [1, 0, 0],
    ]);
    const before = board.snapshot();
    board.click(pos(0, 0));
    board.click(pos(0, 2));
    board.finishConnection();
    expect(board.tilesLeft()).toBe(1);
    board.undo();
    expect(board.snapshot()).toEqual(before);
  });
});

describe("Board hints and solvability", () => {
  it("finds a move for the hint", () => {
    const board = boardWith([
      [1, 0, 1, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const hint = board.showHint();
    expect(hint).not.toBeNull();
    expect(hint?.[0]).toEqual(pos(0, 0));
    expect(hint?.[hint!.length - 1]).toEqual(pos(2, 0));
    // the hint does not remove anything
    expect(board.tilesLeft()).toBe(3);
    expect(board.pendingRemoval()).toBe(false);
  });

  it("has no hint when no move is left", () => {
    const board = boardWith([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    expect(board.showHint()).toBeNull();
  });

  it("detects an unsolvable board", () => {
    const board = boardWith([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    const before = board.snapshot();
    expect(board.isSolvable(false)).toBe(false);
    expect(board.snapshot()).toEqual(before);
    expect(board.pathFoundBetweenMatchingTiles([])).toBe(false);
  });

  it("detects a solvable board", () => {
    const board = boardWith([
      [1, 0, 1, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(board.pathFoundBetweenMatchingTiles([])).toBe(true);
  });

  // The 1s at (1,1) and (4,3) can only be connected by sliding the tile at
  // (1,2) down, or by the plain corner at (4,1).
  //  0 1 2 3 4 5 6
  //0 . . . . . . .
  //1 . A . . . . .
  //2 . T . . . . .
  //3 . . . . B . .
  //4 . . . . . . .
  const slidingBoard = (options: BoardOptions = {}): Board =>
    boardWith(
      [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0],
        [0, 9, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ],
      { tilesCanSlide: true, gravity: false, ...options },
    );

  it("hints a clear path when tiles can slide", () => {
    const board = slidingBoard();
    const hint = board.showHint();
    // not the path that needs the tile at (1,2) to slide out of the way
    expect(hint).toEqual([pos(1, 1), pos(4, 1), pos(4, 3)]);
    expect(board.getConnectionSlide()).toEqual([]);
    for (const step of hint!.slice(1, -1)) {
      expect(board.fieldAt(step)).toBe(EMPTY);
    }
  });

  it("lets the player play the move that the hint showed", () => {
    const board = slidingBoard();
    const hint = board.showHint() as TilePos[];
    const first = hint[0] as TilePos;
    const last = hint[hint.length - 1] as TilePos;
    expect(board.click(first)).toEqual({ kind: "selected" });
    // the plain path is one of the moves that are offered
    const outcome = board.click(last);
    if (outcome.kind === "choose-move") {
      expect(board.click(hint[1] as TilePos)).toEqual({ kind: "moved" });
    } else {
      expect(outcome).toEqual({ kind: "moved" });
    }
    board.finishConnection();
    // only the two tiles of the hint are gone, nothing has been slid
    expect(board.fieldAt(first)).toBe(EMPTY);
    expect(board.fieldAt(last)).toBe(EMPTY);
    expect(board.fieldAt(pos(1, 2))).toBe(9);
    expect(board.tilesLeft()).toBe(1);
  });

  //  0 1 2 3 4
  //0 . A . . .
  //1 . T . X .
  //2 . . . B .
  //3 . . . . .
  //
  // The 1s can only be connected when the tile at (1,1) slides to (1,3), so
  // the hint has to show the slide along with the path.
  const slideOnlyBoard = (): Board =>
    boardWith(
      [
        [0, 1, 0, 0, 0],
        [0, 9, 0, 8, 0],
        [0, 0, 0, 1, 0],
        [0, 0, 0, 0, 0],
      ],
      { tilesCanSlide: true },
    );

  it("hints a sliding move together with its slide", () => {
    const board = slideOnlyBoard();
    expect(board.showHint()).toEqual([pos(1, 0), pos(1, 2), pos(3, 2)]);
    // the tile on the path is marked as sliding, so the hint can be read
    expect(board.fieldAt(pos(1, 1))).toBe(9);
    expect(board.getConnectionSlide()).toEqual([pos(1, 1), pos(1, 3)]);
  });

  it("drops the slide of the hint with the connection", () => {
    const board = slideOnlyBoard();
    board.showHint();
    board.finishConnection();
    expect(board.getConnection()).toEqual([]);
    expect(board.getConnectionSlide()).toEqual([]);
  });

  it("marks the two tiles of the hint as selected", () => {
    const board = slidingBoard();
    const hint = board.showHint() as TilePos[];
    const first = hint[0] as TilePos;
    const last = hint[hint.length - 1] as TilePos;
    // a line alone does not tell which tiles to click, so both are marked
    expect(board.getHintTiles()).toEqual([first, last]);
    expect(board.isTileHighlighted(first)).toBe(true);
    expect(board.isTileHighlighted(last)).toBe(true);
    expect(board.isTileHighlighted(pos(1, 2))).toBe(false);
  });

  it("marks the two tiles of a sliding hint as selected", () => {
    const board = slideOnlyBoard();
    const hint = board.showHint() as TilePos[];
    const first = hint[0] as TilePos;
    const last = hint[hint.length - 1] as TilePos;
    // the path crosses the tile at (1,1), which only the marking identifies
    expect(board.fieldAt(pos(1, 1))).not.toBe(EMPTY);
    expect(board.getHintTiles()).toEqual([first, last]);
    expect(board.isTileHighlighted(first)).toBe(true);
    expect(board.isTileHighlighted(last)).toBe(true);
    expect(board.isTileHighlighted(pos(1, 1))).toBe(false);
  });

  it("drops the marking of the hint with the connection", () => {
    const board = boardWith([
      [1, 0, 1, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const hint = board.showHint() as TilePos[];
    const first = hint[0] as TilePos;
    const last = hint[hint.length - 1] as TilePos;
    // clicking the first tile of the hint starts the move, so it must not unmark it
    expect(board.click(first)).toEqual({ kind: "selected" });
    expect(board.getHintTiles()).toEqual([]);
    // only the clicked tile is selected now
    expect(board.isTileHighlighted(first)).toBe(true);
    expect(board.isTileHighlighted(last)).toBe(false);
    expect(board.click(last)).toEqual({ kind: "moved" });
  });

  it("has nothing marked when there is no hint", () => {
    const board = boardWith([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    expect(board.showHint()).toBeNull();
    expect(board.getHintTiles()).toEqual([]);
    expect(board.isTileHighlighted(pos(0, 0))).toBe(false);
  });
});

describe("Board observer", () => {
  let events: string[];

  beforeEach(() => {
    events = [];
  });

  const observer = (name: string, list: string[]): void => {
    list.push(name);
  };

  it("reports the removal of tiles", () => {
    const o: BoardObserver = {
      changed: () => observer("changed", events),
      tileCountChanged: () => observer("tileCountChanged", events),
      selectATile: () => observer("selectATile", events),
      newGameStarted: () => observer("newGameStarted", events),
      endOfGame: () => observer("endOfGame", events),
    };
    const board = boardWith(
      [
        [1, 0, 1, 0],
        [2, 0, 0, 0],
      ],
      { observer: o },
    );
    events.length = 0;
    board.click(pos(0, 0));
    board.click(pos(2, 0));
    expect(events).toContain("selectATile");
    expect(board.pendingRemoval()).toBe(true);
    board.finishConnection();
    expect(events).toContain("tileCountChanged");
    expect(events).toContain("endOfGame");
  });
});

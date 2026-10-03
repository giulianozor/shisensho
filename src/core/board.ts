/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    The board logic is a direct port of KShisen's src/board.cpp

    SPDX-FileCopyrightText: 1997 Mario Weilguni <mweilguni@sime.com>
    SPDX-FileCopyrightText: 2002-2004 Dave Corrie <kde@davecorrie.com>
    SPDX-FileCopyrightText: 2007 Mauricio Piacentini <mauricio@tabuleiro.com>
    SPDX-FileCopyrightText: 2009-2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import { GameClock } from "./clock";
import { EMPTY, N_TILES, isTileFlower, isTileSeason } from "./tiles";
import {
  Move,
  PossibleMove,
  pos,
  type Path,
  type Slide,
  type TilePos,
} from "./types";

/** Board sizes offered by the "Board Size" option, indexed by `Settings.size`. */
export const BOARD_SIZES: readonly { x: number; y: number }[] = [
  { x: 14, y: 6 },
  { x: 16, y: 9 },
  { x: 18, y: 8 },
  { x: 24, y: 12 },
  { x: 26, y: 14 },
  { x: 30, y: 16 },
];

/** Number of tiles shuffled per board cell, indexed by `Settings.level`. */
export const SHUFFLE_PASSES: readonly number[] = [1, 5, 9];

/** Delay before matched tiles are removed in ms, indexed by `Settings.speed`. */
export const REMOVAL_DELAYS: readonly number[] = [1000, 750, 500, 250, 125];

export type GameState = "normal" | "paused" | "stuck" | "over";

/** Outcome of a click on the board, mirroring the signals of KShisen's Board. */
export type ClickOutcome =
  | { kind: "selected" }
  | { kind: "unmarked" }
  | { kind: "highlighted" }
  | { kind: "moved" }
  | { kind: "choose-move" }
  | { kind: "no-match" }
  | { kind: "invalid" }
  | { kind: "ignored" };

/** Callbacks mirroring the signals of KShisen's Board class. */
export interface BoardObserver {
  changed?(): void;
  tileCountChanged?(): void;
  endOfGame?(): void;
  newGameStarted?(): void;
  cheatStatusChanged?(): void;
  selectATile?(): void;
  selectAMatchingTile?(): void;
  selectAMove?(): void;
  tilesDoNotMatch?(): void;
  invalidMove?(): void;
  /** Called for every tile that falls, so the client can play a sound. */
  tileFell?(): void;
}

export interface BoardOptions {
  width?: number;
  height?: number;
  gravity?: boolean;
  chineseStyle?: boolean;
  tilesCanSlide?: boolean;
  solvable?: boolean;
  showUnsolvableMessage?: boolean;
  /** Shuffle passes; see SHUFFLE_PASSES. */
  shuffle?: number;
  /** Delay before matched tiles are removed in ms; see REMOVAL_DELAYS. */
  delay?: number;
  random?: () => number;
  clock?: GameClock;
  observer?: BoardObserver;
}

const STEPS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/**
 * The game board and all of its rules. This class is free of any DOM access so
 * that it can be unit tested and reused by any front end.
 */
export class Board {
  private readonly clock: GameClock;
  private readonly random: () => number;
  private readonly observer: BoardObserver;

  private field: number[] = [];
  private m_xTiles = 0;
  private m_yTiles = 0;

  private undoStack: Move[] = [];
  private redoStack: Move[] = [];

  private markX = -1;
  private markY = -1;
  private connection: Path = [];
  private connectionSlide: Slide = [];
  private possibleMoves: PossibleMove[] = [];
  private m_highlightedTile = -1;

  /** The two tiles that the last hint suggested, drawn as selected tiles. */
  private hintTiles: TilePos[] = [];

  /** Positions of the tiles that are going to be removed (drawn connection). */
  private remove1: TilePos | null = null;
  private remove2: TilePos | null = null;

  private gameState: GameState = "normal";
  private cheat = false;
  private m_delay = REMOVAL_DELAYS[2]!;

  private m_gravityFlag = true;
  private m_solvableFlag = false;
  private m_showUnsolvableMessageFlag = true;
  private m_chineseStyleFlag = false;
  private m_tilesCanSlideFlag = false;
  private shuffle: number;

  constructor(options: BoardOptions = {}) {
    const size = BOARD_SIZES[2]!;
    this.clock = options.clock ?? new GameClock();
    this.random = options.random ?? Math.random;
    this.observer = options.observer ?? {};
    this.m_gravityFlag = options.gravity ?? true;
    this.m_solvableFlag = options.solvable ?? false;
    this.m_showUnsolvableMessageFlag = options.showUnsolvableMessage ?? true;
    this.m_chineseStyleFlag = options.chineseStyle ?? false;
    this.m_tilesCanSlideFlag = options.tilesCanSlide ?? false;
    this.shuffle = options.shuffle ?? SHUFFLE_PASSES[1]!;
    this.m_delay = options.delay ?? REMOVAL_DELAYS[2]!;

    this.setSize(options.width ?? size.x, options.height ?? size.y);
  }

  // --- geometry -------------------------------------------------------------

  xTiles(): number {
    return this.m_xTiles;
  }

  yTiles(): number {
    return this.m_yTiles;
  }

  /** Overall number of positions of the current board size. */
  tiles(): number {
    return this.field.length;
  }

  isValidPos(tilePos: TilePos): boolean {
    return (
      tilePos.x >= 0 &&
      tilePos.y >= 0 &&
      tilePos.x < this.xTiles() &&
      tilePos.y < this.yTiles()
    );
  }

  isValidPosWithOutline(tilePos: TilePos): boolean {
    return (
      tilePos.x >= -1 &&
      tilePos.y >= -1 &&
      tilePos.x <= this.xTiles() &&
      tilePos.y <= this.yTiles()
    );
  }

  /** Reads the tile at the given position, EMPTY outside of the board. */
  fieldAt(tilePos: TilePos): number {
    if (!this.isValidPos(tilePos)) {
      return EMPTY;
    }
    return this.field[tilePos.y * this.xTiles() + tilePos.x]!;
  }

  private setFieldAt(tilePos: TilePos, value: number): void {
    this.field[tilePos.y * this.xTiles() + tilePos.x] = value;
  }

  // --- game state -----------------------------------------------------------

  isOver(): boolean {
    return this.gameState === "over";
  }

  isPaused(): boolean {
    return this.gameState === "paused";
  }

  isStuck(): boolean {
    return this.gameState === "stuck";
  }

  isNormal(): boolean {
    return this.gameState === "normal";
  }

  getState(): GameState {
    return this.gameState;
  }

  hasCheated(): boolean {
    return this.cheat;
  }

  setCheatModeEnabled(enabled: boolean): void {
    if (this.cheat === enabled) {
      return;
    }
    this.cheat = enabled;
    this.observer.cheatStatusChanged?.();
  }

  setPauseEnabled(enabled: boolean): void {
    if (
      (this.gameState === "paused" && enabled) ||
      this.gameState === "stuck"
    ) {
      return;
    }
    if (enabled) {
      this.gameState = "paused";
      this.clock.pause();
    } else {
      this.gameState = "normal";
      this.clock.resume();
    }
    this.observer.changed?.();
  }

  setGameStuckEnabled(enabled: boolean): void {
    if (this.gameState === "stuck" && enabled) {
      return;
    }
    if (enabled) {
      this.gameState = "stuck";
      this.clock.pause();
    } else {
      this.gameState = "normal";
      this.clock.resume();
    }
    this.observer.changed?.();
  }

  setGameOverEnabled(enabled: boolean): void {
    if (this.gameState === "over" && enabled) {
      return;
    }
    this.gameState = "over";
    this.observer.changed?.();
  }

  // --- option flags ---------------------------------------------------------

  solvableFlag(): boolean {
    return this.m_solvableFlag;
  }

  showUnsolvableMessageFlag(): boolean {
    return this.m_showUnsolvableMessageFlag;
  }

  gravityFlag(): boolean {
    return this.m_gravityFlag;
  }

  chineseStyleFlag(): boolean {
    return this.m_chineseStyleFlag;
  }

  tilesCanSlideFlag(): boolean {
    return this.m_tilesCanSlideFlag;
  }

  setSolvableFlag(enabled: boolean): void {
    if (this.m_solvableFlag === enabled) {
      return;
    }
    this.m_solvableFlag = enabled;
    // if the solvable flag was set and the current game is not solvable, start a new game
    if (this.m_solvableFlag && !this.isSolvable(true)) {
      this.newGame();
    }
  }

  setShowUnsolvableMessageFlag(enabled: boolean): void {
    this.m_showUnsolvableMessageFlag = enabled;
  }

  setGravityFlag(enabled: boolean): void {
    if (this.m_gravityFlag === enabled) {
      return;
    }
    this.m_gravityFlag = enabled;
    // start a new game if the player is in the middle of a game
    if (this.canUndo() || this.canRedo()) {
      this.newGame();
    }
  }

  setChineseStyleFlag(enabled: boolean): void {
    if (this.m_chineseStyleFlag === enabled) {
      return;
    }
    this.m_chineseStyleFlag = enabled;
    // board generation differs, so a new game is needed
    this.newGame();
  }

  setTilesCanSlideFlag(enabled: boolean): void {
    if (this.m_tilesCanSlideFlag === enabled) {
      return;
    }
    this.m_tilesCanSlideFlag = enabled;
    // start a new game if the player is in the middle of a game
    if (this.canUndo() || this.canRedo()) {
      this.newGame();
    }
  }

  setShufflePasses(passes: number): void {
    this.shuffle = passes;
  }

  // --- size / new game ------------------------------------------------------

  setSize(x: number, y: number): void {
    if (
      x === this.m_xTiles &&
      y === this.m_yTiles &&
      this.field.length === x * y
    ) {
      return;
    }
    this.field = new Array<number>(x * y).fill(EMPTY);
    this.m_xTiles = x;
    this.m_yTiles = y;
    this.newGame();
    this.observer.changed?.();
  }

  /** Distributes the tiles on the board, shuffles them and restarts the clock. */
  newGame(): void {
    this.gameState = "normal";
    this.setCheatModeEnabled(false);

    this.markX = -1;
    this.markY = -1;
    this.m_highlightedTile = -1; // will clear previous highlight

    this.resetUndo();
    this.resetRedo();
    this.setConnection([]);
    this.possibleMoves = [];
    this.remove1 = null;
    this.remove2 = null;

    // distribute all tiles on board
    let curTile = 1;
    let tileCount = 0;

    /*
     * Note by jwickers: the way the tiles are distributed follows Chinese
     * Mahjongg: there are 4 tiles of each kind except for flowers and seasons
     * (4 flowers and 4 seasons, but one unique tile of each, that is why they
     * are the only ones numbered). That uses the chineseStyle flag.
     */
    for (let y = 0; y < this.yTiles(); ++y) {
      for (let x = 0; x < this.xTiles(); ++x) {
        // do not duplicate flowers or seasons
        if (
          !this.m_chineseStyleFlag ||
          !(isTileSeason(curTile) || isTileFlower(curTile))
        ) {
          this.setFieldAt(pos(x, y), curTile);
          if (++tileCount >= 4) {
            tileCount = 0;
            ++curTile;
          }
        } else {
          tileCount = 0;
          this.setFieldAt(pos(x, y), curTile++);
        }
        if (curTile > N_TILES) {
          curTile = 1;
        }
      }
    }

    if (this.shuffle === 0) {
      this.clock.restart();
      this.observer.newGameStarted?.();
      this.observer.changed?.();
      return;
    }

    // shuffle the field
    const tx = this.xTiles();
    const ty = this.yTiles();
    for (let i = 0, total = tx * ty * this.shuffle; i < total; ++i) {
      const tilePos1 = pos(this.randInt(tx), this.randInt(ty));
      const tilePos2 = pos(this.randInt(tx), this.randInt(ty));
      // keep t, because the next setFieldAt() changes what fieldAt() returns
      const t = this.fieldAt(tilePos1);
      this.setFieldAt(tilePos1, this.fieldAt(tilePos2));
      this.setFieldAt(tilePos2, t);
    }

    // if solvable is false, the game does not need to be solvable; we can drop out here
    if (!this.m_solvableFlag) {
      this.clock.restart();
      this.observer.newGameStarted?.();
      this.observer.changed?.();
      return;
    }

    let oldField = this.field.slice();
    const tiles = new Array<number>(this.field.length);
    const positions = new Array<number>(this.field.length);
    // in case the game cannot be made solvable we do not want to run an infinite loop
    let maxAttempts = 200;

    while (!this.isSolvable(false) && maxAttempts > 0) {
      // generate a list of free tiles and positions
      let numberOfTiles = 0;
      for (let i = 0, total = this.xTiles() * this.yTiles(); i < total; ++i) {
        if (this.field[i] !== EMPTY) {
          positions[numberOfTiles] = i;
          tiles[numberOfTiles] = this.field[i]!;
          ++numberOfTiles;
        }
      }

      // restore field
      this.field = oldField.slice();

      // redistribute unsolved tiles
      while (numberOfTiles > 0) {
        const r1 = this.randInt(numberOfTiles);
        const r2 = this.randInt(numberOfTiles);
        const tile = tiles[r1]!;
        const apos = positions[r2]!;

        // truncate list
        tiles[r1] = tiles[numberOfTiles - 1]!;
        positions[r2] = positions[numberOfTiles - 1]!;
        --numberOfTiles;

        // put this tile on the new position
        this.field[apos] = tile;
      }

      // remember field
      oldField = this.field.slice();
      --maxAttempts;
    }

    // restore field
    this.field = oldField;

    this.clock.restart();
    this.observer.changed?.();
  }

  private randInt(max: number): number {
    return Math.floor(this.random() * max) % Math.max(max, 1);
  }

  // --- timer ----------------------------------------------------------------

  /**
   * Milliseconds the front end shall draw the connection of a move before
   * calling finishConnection(). Set from the "Piece Removal Speed" option.
   */
  setDelay(newValue: number): void {
    if (this.m_delay === newValue) {
      return;
    }
    this.m_delay = newValue;
  }

  delay(): number {
    return this.m_delay;
  }

  resetTimer(): void {
    this.clock.restart();
  }

  currentTime(): number {
    return Math.floor(this.clock.seconds());
  }

  // --- tile helpers ---------------------------------------------------------

  /** Number of tiles left on the board. */
  tilesLeft(): number {
    let n = 0;
    for (const t of this.field) {
      if (t !== EMPTY) {
        ++n;
      }
    }
    return n;
  }

  /** Checks if two tiles can match. */
  tilesMatch(tile1: number, tile2: number): boolean {
    // identical tiles always match
    if (tile1 === tile2) {
      return true;
    }
    // when chinese style is set, there are special rules for flowers and seasons
    if (this.m_chineseStyleFlag) {
      if (isTileSeason(tile1) && isTileSeason(tile2)) {
        return true;
      }
      if (isTileFlower(tile1) && isTileFlower(tile2)) {
        return true;
      }
    }
    return false;
  }

  private applyGravity(): void {
    if (!this.m_gravityFlag) {
      return;
    }
    for (let column = 0; column < this.xTiles(); ++column) {
      let rptr = this.yTiles() - 1;
      let wptr = this.yTiles() - 1;
      while (rptr >= 0) {
        const wptrPos = pos(column, wptr);
        if (this.fieldAt(wptrPos) !== EMPTY) {
          --rptr;
          --wptr;
        } else {
          const rptrPos = pos(column, rptr);
          if (this.fieldAt(rptrPos) !== EMPTY) {
            this.setFieldAt(wptrPos, this.fieldAt(rptrPos));
            this.setFieldAt(rptrPos, EMPTY);
            --wptr;
            --rptr;
            this.observer.tileFell?.();
          } else {
            --rptr;
          }
        }
      }
    }
  }

  // --- selection / highlight ------------------------------------------------

  markedTile(): TilePos | null {
    return this.markX < 0 ? null : pos(this.markX, this.markY);
  }

  /** Tile value the player highlighted with a right click, -1 if none. */
  highlightedTile(): number {
    return this.m_highlightedTile;
  }

  setHighlightedTile(tile: number): void {
    this.m_highlightedTile = tile;
  }

  clearHighlight(): void {
    if (this.m_highlightedTile === -1) {
      return;
    }
    this.m_highlightedTile = -1;
    this.observer.changed?.();
  }

  /** True if the given position is drawn as a selected tile. */
  isTileHighlighted(tilePos: TilePos): boolean {
    if (tilePos.x === this.markX && tilePos.y === this.markY) {
      return true;
    }
    if (this.tilesMatch(this.m_highlightedTile, this.fieldAt(tilePos))) {
      return true;
    }
    if (this.connection.length > 0 && this.remove1 !== null) {
      const first = this.connection[0]!;
      const last = this.connection[this.connection.length - 1]!;
      if (tilePos.x === first.x && tilePos.y === first.y) {
        return true;
      }
      if (tilePos.x === last.x && tilePos.y === last.y) {
        return true;
      }
    }
    // the tiles of a hint stay marked until the drawn connection is dropped
    for (const hint of this.hintTiles) {
      if (tilePos.x === hint.x && tilePos.y === hint.y) {
        return true;
      }
    }
    return false;
  }

  unmarkTile(): void {
    if (this.markX === -1 || this.markY === -1) {
      return;
    }
    this.markX = -1;
    this.markY = -1;
    this.possibleMoves = [];
    this.observer.changed?.();
  }

  /** All moves the player currently may choose from (drawn as blue lines). */
  getPossibleMoves(): readonly PossibleMove[] {
    return this.possibleMoves;
  }

  /** The connection line that is currently drawn, if any. */
  getConnection(): Path {
    return this.connection;
  }

  /**
   * The slide that the drawn connection needs before it is clear.
   *
   * This is only set for the move that the hint suggests: the path of a
   * sliding move crosses the tiles that have to be moved out of the way first.
   */
  getConnectionSlide(): Slide {
    return this.connectionSlide;
  }

  /**
   * The two tiles that the last hint suggested, drawn as selected tiles. They
   * are empty while no hint is drawn.
   */
  getHintTiles(): Path {
    return this.hintTiles;
  }

  private setConnection(path: Path, slide: Slide = []): void {
    this.connection = path;
    this.connectionSlide = slide;
    if (path.length === 0) {
      this.hintTiles = [];
    }
  }

  // --- clicking -------------------------------------------------------------

  /**
   * Handles a click on the board. The position is null when the click happened
   * outside of the board.
   *
   * Port of KShisen's Board::mousePressEvent().
   */
  click(
    tilePos: TilePos | null,
    button: "left" | "right" = "left",
  ): ClickOutcome {
    // Do not process clicks while the connection is drawn. Clicking on one of
    // the already connected tiles would have selected it before removing it.
    // This is more a workaround than a proper fix. (schwarzer)
    if (this.pendingRemoval()) {
      this.finishConnection();
      return { kind: "ignored" };
    }

    switch (this.gameState) {
      case "over":
        this.newGame();
        return { kind: "ignored" };
      case "paused":
        this.setPauseEnabled(false);
        return { kind: "ignored" };
      case "stuck":
        return { kind: "ignored" };
      case "normal":
        break;
    }

    if (button === "right") {
      return this.highlightTile(tilePos);
    }

    this.clearHighlight();

    if (tilePos === null) {
      // unmark when clicking outside the board
      this.unmarkTile();
      return { kind: "unmarked" };
    }

    return this.marked(tilePos);
  }

  /**
   * Highlights all tiles of the same type as the clicked one.
   * Port of the right button branch of KShisen's Board::mousePressEvent().
   */
  private highlightTile(tilePos: TilePos | null): ClickOutcome {
    const clickedTile = tilePos === null ? EMPTY : this.fieldAt(tilePos);

    // Clear the marked tile
    const marked = this.markedTile();
    if (marked !== null && this.fieldAt(marked) !== clickedTile) {
      this.unmarkTile();
    } else {
      this.markX = -1;
      this.markY = -1;
    }

    // Perform the highlighting
    if (clickedTile !== this.m_highlightedTile) {
      this.m_highlightedTile = clickedTile;
      this.observer.changed?.();
    }
    return { kind: "highlighted" };
  }

  /**
   * Handles a click on a tile or on a position of the board.
   * Port of KShisen's Board::marked().
   */
  marked(tilePos: TilePos): ClickOutcome {
    if (this.fieldAt(tilePos) === EMPTY) {
      // click on empty space on the board
      if (this.possibleMoves.length > 1) {
        // if the click is on any of the current possible moves, make that move
        for (const move of this.possibleMoves) {
          if (move.isInPath(tilePos)) {
            this.performMove(move);
            this.observer.selectATile?.();
            return { kind: "moved" };
          }
        }
        // otherwise fall through, like the original implementation does
      } else {
        // unmark when not clicking on a tile
        this.unmarkTile();
        return { kind: "unmarked" };
      }
    }

    // make sure that the previous connection is correctly undrawn
    this.finishConnection(); // is this still needed? (schwarzer)

    if (tilePos.x === this.markX && tilePos.y === this.markY) {
      // the piece is already marked, unmark it
      this.unmarkTile();
      this.observer.selectATile?.();
      return { kind: "unmarked" };
    }

    if (this.markX === -1) {
      // nothing is selected so far
      this.markX = tilePos.x;
      this.markY = tilePos.y;
      this.possibleMoves = [];
      this.observer.changed?.();
      this.observer.selectAMatchingTile?.();
      return { kind: "selected" };
    }

    if (this.possibleMoves.length > 1) {
      // if the click is on any of the current possible moves, make that move
      for (const move of this.possibleMoves) {
        if (move.isInPath(tilePos)) {
          this.performMove(move);
          this.observer.selectATile?.();
          return { kind: "moved" };
        }
      }
    }

    const tile1 = this.fieldAt(pos(this.markX, this.markY));
    const tile2 = this.fieldAt(tilePos);

    // both tiles do not match
    if (!this.tilesMatch(tile1, tile2)) {
      this.unmarkTile();
      this.observer.tilesDoNotMatch?.();
      return { kind: "no-match" };
    }

    // trace and perform the move and get the list of possible moves
    if (
      this.findPath(pos(this.markX, this.markY), tilePos, this.possibleMoves) >
      0
    ) {
      if (this.possibleMoves.length > 1) {
        let withSlide = 0;
        for (const move of this.possibleMoves) {
          if (move.hasSlide) {
            ++withSlide;
          }
        }
        // if all moves have no slide, it doesn't matter
        if (withSlide > 0) {
          this.observer.selectAMove?.();
          return { kind: "choose-move" };
        }
      }

      // only one move possible, perform it
      // game over? must be delayed until after the tiles fall, see finishConnection()
      this.performMove(this.possibleMoves[0]!);
      this.observer.selectATile?.();
      return { kind: "moved" };
    }

    this.observer.invalidMove?.();
    this.setConnection([]);
    return { kind: "invalid" };
  }

  private performMove(possibleMove: PossibleMove): void {
    // the slide has been performed already, so only the path is drawn
    this.setConnection(possibleMove.path);
    if (possibleMove.hasSlide) {
      this.performSlide(pos(this.markX, this.markY), possibleMove.slide);
      this.madeMove(
        pos(this.markX, this.markY),
        pos(
          (possibleMove.path[possibleMove.path.length - 1] as TilePos).x,
          (possibleMove.path[possibleMove.path.length - 1] as TilePos).y,
        ),
        possibleMove.slide,
      );
    } else {
      this.madeMove(
        pos(this.markX, this.markY),
        pos(
          (possibleMove.path[possibleMove.path.length - 1] as TilePos).x,
          (possibleMove.path[possibleMove.path.length - 1] as TilePos).y,
        ),
      );
    }
    this.possibleMoves = [];
    this.remove1 = pos(this.markX, this.markY);
    this.remove2 = pos(
      (possibleMove.path[possibleMove.path.length - 1] as TilePos).x,
      (possibleMove.path[possibleMove.path.length - 1] as TilePos).y,
    );
    this.markX = -1;
    this.markY = -1;
  }

  private madeMove(
    tilePos1: TilePos,
    tilePos2: TilePos,
    slide: Slide = [],
  ): void {
    const move =
      slide.length === 0
        ? new Move(
            tilePos1,
            tilePos2,
            this.fieldAt(tilePos1),
            this.fieldAt(tilePos2),
          )
        : new Move(
            tilePos1,
            tilePos2,
            this.fieldAt(tilePos1),
            this.fieldAt(tilePos2),
            slide,
          );
    this.undoStack.push(move);
    if (this.redoStack.length > 0) {
      this.redoStack = [];
    }
    this.observer.changed?.();
  }

  /**
   * The two matched tiles stay on the board for a moment so that the connecting
   * line can be drawn; this tells whether they still have to be removed.
   */
  pendingRemoval(): boolean {
    return this.remove1 !== null;
  }

  /**
   * Removes the two matched tiles from the board and applies gravity.
   * Port of the removal part of KShisen's Board::undrawConnection().
   */
  completeRemoval(): void {
    if (this.remove1 === null) {
      return;
    }
    this.setFieldAt(this.remove1, EMPTY);
    this.setFieldAt(this.remove2 ?? this.remove1, EMPTY);
    this.applyGravity();
    this.remove1 = null;
    this.remove2 = null;
    this.observer.changed?.();
    this.observer.tileCountChanged?.();
  }

  /**
   * Finishes the animation of a move: the connecting line is dropped and the
   * end of the game is checked.
   *
   * Port of KShisen's Board::undrawConnection(). Note that the end of the game
   * is only checked when there was a connection to draw.
   */
  finishConnection(): void {
    this.completeRemoval();

    // is already undrawn?
    if (this.connection.length === 0) {
      return;
    }
    this.setConnection([]);
    this.checkEndOfGame();
  }

  /** True if the game is over, i.e. no matching tiles are left or board is empty. */
  checkEndOfGame(): boolean {
    if (
      (!this.pathFoundBetweenMatchingTiles([]) &&
        this.m_showUnsolvableMessageFlag) ||
      this.tilesLeft() === 0
    ) {
      this.clock.pause();
      this.observer.endOfGame?.();
      return true;
    }
    return false;
  }

  // --- undo / redo ----------------------------------------------------------

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  resetUndo(): void {
    this.undoStack = [];
  }

  resetRedo(): void {
    this.redoStack = [];
  }

  private performSlide(tilePos: TilePos, slide: Slide): void {
    // check if there is something to slide
    if (slide.length === 0) {
      return;
    }

    // slide[0] is the current location of the last tile to slide,
    // slide[1] is its destination
    const first = slide[0] as TilePos;
    const last = slide[slide.length - 1] as TilePos;
    const dx = last.x - first.x;
    const dy = last.y - first.y;

    // move all tiles between the marked tile and the last tile to slide with that offset
    if (dx === 0) {
      if (tilePos.y < first.y) {
        for (let i = first.y; i > tilePos.y; --i) {
          const currentTile = this.fieldAt(pos(tilePos.x, i));
          this.setFieldAt(pos(tilePos.x, i), EMPTY);
          this.setFieldAt(pos(tilePos.x, i + dy), currentTile);
        }
      } else {
        for (let i = first.y; i < tilePos.y; ++i) {
          const currentTile = this.fieldAt(pos(tilePos.x, i));
          this.setFieldAt(pos(tilePos.x, i), EMPTY);
          this.setFieldAt(pos(tilePos.x, i + dy), currentTile);
        }
      }
    } else if (dy === 0) {
      if (tilePos.x < first.x) {
        for (let i = first.x; i > tilePos.x; --i) {
          const currentTile = this.fieldAt(pos(i, tilePos.y));
          this.setFieldAt(pos(i, tilePos.y), EMPTY);
          this.setFieldAt(pos(i + dx, tilePos.y), currentTile);
        }
      } else {
        for (let i = first.x; i < tilePos.x; ++i) {
          const currentTile = this.fieldAt(pos(i, tilePos.y));
          this.setFieldAt(pos(i, tilePos.y), EMPTY);
          this.setFieldAt(pos(i + dx, tilePos.y), currentTile);
        }
      }
    }
  }

  private reverseSlide(tilePos: TilePos, slide: Slide): void {
    // slide[0] is the current location of the last tile to slide,
    // slide[1] is its destination; calculate the offset for the tiles to slide
    if (slide.length === 0) {
      return;
    }
    const first = slide[0] as TilePos;
    const last = slide[slide.length - 1] as TilePos;
    const dx = first.x - last.x;
    const dy = first.y - last.y;

    // move all tiles between slidePos2 and tilePos back with that offset
    if (dx === 0) {
      if (tilePos.y < last.y) {
        for (let i = tilePos.y + 1; i <= last.y; ++i) {
          const currentTile = this.fieldAt(pos(tilePos.x, i));
          if (currentTile === EMPTY) {
            continue;
          }
          this.setFieldAt(pos(tilePos.x, i), EMPTY);
          this.setFieldAt(pos(tilePos.x, i + dy), currentTile);
        }
      } else {
        for (let i = tilePos.y - 1; i >= last.y; --i) {
          const currentTile = this.fieldAt(pos(tilePos.x, i));
          if (currentTile === EMPTY) {
            continue;
          }
          this.setFieldAt(pos(tilePos.x, i), EMPTY);
          this.setFieldAt(pos(tilePos.x, i + dy), currentTile);
        }
      }
    } else if (dy === 0) {
      if (tilePos.x < last.x) {
        for (let i = tilePos.x + 1; i <= last.x; ++i) {
          const currentTile = this.fieldAt(pos(i, tilePos.y));
          if (currentTile === EMPTY) {
            continue;
          }
          this.setFieldAt(pos(i, tilePos.y), EMPTY);
          this.setFieldAt(pos(i + dx, tilePos.y), currentTile);
        }
      } else {
        for (let i = tilePos.x - 1; i >= last.x; --i) {
          const currentTile = this.fieldAt(pos(i, tilePos.y));
          if (currentTile === EMPTY) {
            continue;
          }
          this.setFieldAt(pos(i, tilePos.y), EMPTY);
          this.setFieldAt(pos(i + dx, tilePos.y), currentTile);
        }
      }
    }
  }

  /**
   * Undoes one step.
   * Port of KShisen's Board::undo().
   */
  undo(): void {
    if (!this.canUndo()) {
      return;
    }

    this.clearHighlight();
    this.finishConnection();
    const move = this.undoStack.pop() as Move;

    if (this.gravityFlag()) {
      // When both tiles reside in the same column, the order of undo is
      // significant (we must undo the lower tile first).
      // Also in that case there cannot be a slide.
      if (move.x1 === move.x2 && move.y1 < move.y2) {
        move.swapTiles();
      }

      // if there is no slide, keep previous implementation: move both columns up
      if (!move.hasSlide) {
        // move tiles from the first column up
        for (let y = 0; y < move.y1; ++y) {
          this.setFieldAt(pos(move.x1, y), this.fieldAt(pos(move.x1, y + 1)));
        }

        // move tiles from the second column up
        for (let y = 0; y < move.y2; ++y) {
          this.setFieldAt(pos(move.x2, y), this.fieldAt(pos(move.x2, y + 1)));
        }
      } else {
        // else check all tiles from the slide that may have fallen down
        if (move.slideY1 === move.slideY2) {
          // horizontal slide
          // because tiles that slide horizontally may fall down in columns
          // different from the two taken tiles' columns, we need to take them
          // back up and then undo the slide
          // the number of slid tiles is n = abs(x1 - slideX1())
          let n = move.x1 - move.slideX1;
          if (n < 0) {
            n = -n;
          }
          // distance slid is
          let dx = move.slideX2 - move.slideX1;
          if (dx < 0) {
            dx = -dx;
          }

          // slid tiles may fall down after the slide, so any tile on top of the
          // columns between slideX2() -> slideX2() +/- n (excluded) should go up
          // to slideY1()
          if (move.slideX2 > move.slideX1) {
            // slide to the right
            for (let i = move.slideX2; i > move.slideX2 - n; --i) {
              // find top tile
              let j = 0;
              for (j = 0; j < this.yTiles(); ++j) {
                if (this.fieldAt(pos(i, j)) !== EMPTY) {
                  break;
                }
              }

              // ignore if the tile did not fall
              if (j <= move.slideY1) {
                continue;
              }

              // put it back up
              this.setFieldAt(pos(i, move.slideY1), this.fieldAt(pos(i, j)));
              this.setFieldAt(pos(i, j), EMPTY);
            }
          } else {
            // slide to the left
            for (let i = move.slideX2; i < move.slideX2 + n; ++i) {
              let j = 0;
              for (j = 0; j < this.yTiles(); ++j) {
                if (this.fieldAt(pos(i, j)) !== EMPTY) {
                  break;
                }
              }

              if (j <= move.slideY1) {
                continue;
              }

              this.setFieldAt(pos(i, move.slideY1), this.fieldAt(pos(i, j)));
              this.setFieldAt(pos(i, j), EMPTY);
            }
          }

          // move tiles from the second column up
          for (let y = 0; y <= move.y2; ++y) {
            this.setFieldAt(pos(move.x2, y), this.fieldAt(pos(move.x2, y + 1)));
          }

          // and all columns that fell after the tiles slid between
          // only if they were not replaced by a sliding tile
          if (move.slideX2 > move.slideX1) {
            // slide to the right
            if (move.slideY1 > 0) {
              for (let i = move.x1 + dx; i >= move.x1; --i) {
                for (let j = 0; j < move.slideY1; ++j) {
                  this.setFieldAt(pos(i, j), this.fieldAt(pos(i, j + 1)));
                }
                this.setFieldAt(pos(i, move.slideY1), EMPTY);
              }
            }
          } else {
            // slide to the left
            if (move.slideY1 > 0) {
              for (let i = move.x1 - dx; i <= move.x1; ++i) {
                for (let j = 0; j < move.slideY1; ++j) {
                  this.setFieldAt(pos(i, j), this.fieldAt(pos(i, j + 1)));
                }
                this.setFieldAt(pos(i, move.slideY1), EMPTY);
              }
            }
          }

          // then undo the slide to put the tiles back to their original location
          this.reverseSlide(pos(move.x1, move.y1), move.slide);
        } else {
          // vertical slide, in fact nothing special is necessary, the default
          // implementation works because it only affects the two columns the
          // tiles were taken from

          // move tiles from the first column up
          for (let y = 0; y < move.y1; ++y) {
            this.setFieldAt(pos(move.x1, y), this.fieldAt(pos(move.x1, y + 1)));
          }

          // move tiles from the second column up
          for (let y = 0; y < move.y2; ++y) {
            this.setFieldAt(pos(move.x2, y), this.fieldAt(pos(move.x2, y + 1)));
          }
        }
      }
    } else if (move.hasSlide) {
      // no gravity: undo the slide if any
      this.reverseSlide(pos(move.x1, move.y1), move.slide);
    }

    // replace taken tiles
    this.setFieldAt(pos(move.x1, move.y1), move.tile1);
    this.setFieldAt(pos(move.x2, move.y2), move.tile2);

    this.redoStack.unshift(move);
    this.observer.changed?.();
    this.observer.tileCountChanged?.();
  }

  /**
   * Redoes one step.
   * Port of KShisen's Board::redo().
   */
  redo(): void {
    if (!this.canRedo()) {
      return;
    }
    this.clearHighlight();
    this.finishConnection();
    const move = this.redoStack.shift() as Move;
    // redo the slide if any
    if (move.hasSlide) {
      this.performSlide(pos(move.x1, move.y1), [
        pos(move.slideX1, move.slideY1),
        pos(move.slideX2, move.slideY2),
      ]);
    }
    this.setFieldAt(pos(move.x1, move.y1), EMPTY);
    this.setFieldAt(pos(move.x2, move.y2), EMPTY);
    this.applyGravity();
    this.undoStack.push(move);
    this.observer.changed?.();
    this.observer.tileCountChanged?.();
  }

  // --- hints / solvability --------------------------------------------------

  /**
   * Finds the path of one move and returns it for drawing.
   * Port of KShisen's Board::showHint().
   *
   * A move that needs no slide is preferred, because its path is clear right
   * away. When the board has none, a sliding move is shown together with the
   * tiles that have to slide, as its path crosses them until they have moved.
   *
   * The two tiles of the move are marked as selected: a line alone does not tell
   * the player which tiles to click when the path crosses other tiles.
   */
  showHint(): Path | null {
    this.finishConnection();
    const moves: PossibleMove[] = [];
    const found =
      this.pathFoundBetweenMatchingTiles(moves, false) ||
      this.pathFoundBetweenMatchingTiles(moves);
    if (found) {
      const path = moves[0]!.path;
      this.setConnection(path, moves[0]!.slide);
      this.hintTiles = [path[0]!, path[path.length - 1]!];
      this.observer.changed?.();
      return this.connection;
    }
    this.setConnection([]);
    this.observer.changed?.();
    return null;
  }

  /**
   * Checks whether the game is solvable, i.e. whether all tiles can be removed
   * by greedily playing the first move that is found over and over again.
   * Port of KShisen's Board::isSolvable().
   */
  isSolvable(restore: boolean): boolean {
    let oldField: number[] | null = null;

    if (!restore) {
      oldField = this.field.slice();
    }

    const p: PossibleMove[] = [];
    while (this.pathFoundBetweenMatchingTiles(p)) {
      const path = p[0]!.path;
      const front = path[0] as TilePos;
      const back = path[path.length - 1] as TilePos;
      this.setFieldAt(front, EMPTY);
      this.setFieldAt(back, EMPTY);
    }

    const left = this.tilesLeft();

    if (oldField !== null) {
      this.field = oldField;
    }

    return left === 0;
  }

  /**
   * Searches the whole board for a matching pair that can be connected.
   * Port of KShisen's Board::pathFoundBetweenMatchingTiles().
   */
  pathFoundBetweenMatchingTiles(
    possibleMoves: PossibleMove[],
    allowSlide = true,
  ): boolean {
    const done = new Array<number>(N_TILES).fill(0);

    for (let x = 0; x < this.xTiles(); ++x) {
      for (let y = 0; y < this.yTiles(); ++y) {
        const tile = this.fieldAt(pos(x, y));
        if (tile !== EMPTY && done[tile - 1] !== 4) {
          // for all these types of tile search paths
          for (let xx = 0; xx < this.xTiles(); ++xx) {
            for (let yy = 0; yy < this.yTiles(); ++yy) {
              if (xx !== x || yy !== y) {
                if (this.tilesMatch(this.fieldAt(pos(xx, yy)), tile)) {
                  if (
                    this.findPath(pos(x, y), pos(xx, yy), possibleMoves, allowSlide) >
                    0
                  ) {
                    return true;
                  }
                }
              }
            }
          }
          done[tile - 1]++;
        }
      }
    }
    return false;
  }

  // --- path finding ---------------------------------------------------------

  /**
   * Checks if a path between two tiles can be made with a single line.
   * Port of KShisen's Board::canMakePath().
   */
  canMakePath(tilePos1: TilePos, tilePos2: TilePos): boolean {
    if (tilePos1.x === tilePos2.x) {
      const lo = Math.min(tilePos1.y, tilePos2.y) + 1;
      const hi = Math.max(tilePos1.y, tilePos2.y);
      for (let i = lo; i < hi; ++i) {
        if (this.fieldAt(pos(tilePos1.x, i)) !== EMPTY) {
          return false;
        }
      }
      return true;
    }

    if (tilePos1.y === tilePos2.y) {
      const lo = Math.min(tilePos1.x, tilePos2.x) + 1;
      const hi = Math.max(tilePos1.x, tilePos2.x);
      for (let i = lo; i < hi; ++i) {
        if (this.fieldAt(pos(i, tilePos1.y)) !== EMPTY) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Checks whether a slide from tilePos1 towards tilePos2 is possible.
   * Port of KShisen's Board::canSlideTiles().
   */
  canSlideTiles(tilePos1: TilePos, tilePos2: TilePos): Slide {
    const slide: Slide = [];
    let distance = -1;

    if (tilePos1.x === tilePos2.x) {
      if (tilePos1.y > tilePos2.y) {
        distance = tilePos1.y - tilePos2.y;
        // count how much free space we have for sliding
        let startFree = -1;
        let endFree = -1;
        // find first empty tile
        for (let i = tilePos1.y - 1; i >= 0; --i) {
          if (this.fieldAt(pos(tilePos1.x, i)) === EMPTY) {
            startFree = i;
            break;
          }
        }
        // if not found, cannot slide;
        // if the first empty tile is just next to the sliding tile, no slide
        if (startFree === -1 || startFree === tilePos1.y - 1) {
          return slide;
        }
        // find last empty tile
        for (let i = startFree - 1; i >= 0; --i) {
          if (this.fieldAt(pos(tilePos1.x, i)) !== EMPTY) {
            endFree = i;
            break;
          }
        }
        // if not found, it is the border: 0

        // so we can slide by startFree - endFree, compare this to the distance
        if (distance <= startFree - endFree) {
          slide.push(pos(tilePos1.x, startFree + 1));
          slide.push(pos(tilePos1.x, startFree + 1 - distance));
          return slide;
        }
        return slide;
      } else if (tilePos2.y > tilePos1.y) {
        distance = tilePos2.y - tilePos1.y;
        let startFree = -1;
        let endFree = this.yTiles();
        // find first empty tile
        for (let i = tilePos1.y + 1; i < this.yTiles(); ++i) {
          if (this.fieldAt(pos(tilePos1.x, i)) === EMPTY) {
            startFree = i;
            break;
          }
        }
        if (startFree === -1 || startFree === tilePos1.y + 1) {
          return slide;
        }
        // find last empty tile
        for (let i = startFree + 1; i < this.yTiles(); ++i) {
          if (this.fieldAt(pos(tilePos1.x, i)) !== EMPTY) {
            endFree = i;
            break;
          }
        }
        // if not found, it is the border: yTiles() - 1

        if (distance <= endFree - startFree) {
          slide.push(pos(tilePos1.x, startFree - 1));
          slide.push(pos(tilePos1.x, startFree - 1 + distance));
          return slide;
        }
        return slide;
      }
      // y1 === y2
      return slide;
    }

    if (tilePos1.y === tilePos2.y) {
      if (tilePos1.x > tilePos2.x) {
        distance = tilePos1.x - tilePos2.x;
        let startFree = -1;
        let endFree = -1;
        for (let i = tilePos1.x - 1; i >= 0; --i) {
          if (this.fieldAt(pos(i, tilePos1.y)) === EMPTY) {
            startFree = i;
            break;
          }
        }
        if (startFree === -1 || startFree === tilePos1.x - 1) {
          return slide;
        }
        for (let i = startFree - 1; i >= 0; --i) {
          if (this.fieldAt(pos(i, tilePos1.y)) !== EMPTY) {
            endFree = i;
            break;
          }
        }
        if (distance <= startFree - endFree) {
          slide.push(pos(startFree + 1, tilePos1.y));
          slide.push(pos(startFree + 1 - distance, tilePos1.y));
          return slide;
        }
        return slide;
      } else if (tilePos2.x > tilePos1.x) {
        distance = tilePos2.x - tilePos1.x;
        let startFree = -1;
        let endFree = this.xTiles();
        for (let i = tilePos1.x + 1; i < this.xTiles(); ++i) {
          if (this.fieldAt(pos(i, tilePos1.y)) === EMPTY) {
            startFree = i;
            break;
          }
        }
        if (startFree === -1 || startFree === tilePos1.x + 1) {
          return slide;
        }
        for (let i = startFree + 1; i < this.xTiles(); ++i) {
          if (this.fieldAt(pos(i, tilePos1.y)) !== EMPTY) {
            endFree = i;
            break;
          }
        }
        if (distance <= endFree - startFree) {
          slide.push(pos(startFree - 1, tilePos1.y));
          slide.push(pos(startFree - 1 + distance, tilePos1.y));
          return slide;
        }
        return slide;
      }
      // x1 === x2
      return slide;
    }
    return slide;
  }

  /**
   * Checks if a path between two tiles can be made with 2 or 3 segments.
   * Port of KShisen's Board::findPath().
   *
   * Pass allowSlide = false to leave out the moves that first have to slide
   * tiles out of the way; the hint uses this to only offer a path that is
   * already clear.
   */
  findPath(
    tilePos1: TilePos,
    tilePos2: TilePos,
    possibleMoves: PossibleMove[],
    allowSlide = true,
  ): number {
    possibleMoves.length = 0;

    let simplePath = 0;

    // first find the simple paths
    let numberOfPaths = this.findSimplePath(
      tilePos1,
      tilePos2,
      possibleMoves,
      allowSlide,
    );

    // if the tiles can slide, 2 lines max is allowed
    if (this.m_tilesCanSlideFlag) {
      return numberOfPaths;
    }

    // Find paths of 3 segments
    for (const [dx, dy] of STEPS) {
      let tempX = tilePos1.x + dx;
      let tempY = tilePos1.y + dy;
      while (
        this.isValidPosWithOutline(pos(tempX, tempY)) &&
        this.fieldAt(pos(tempX, tempY)) === EMPTY
      ) {
        simplePath = this.findSimplePath(
          pos(tempX, tempY),
          tilePos2,
          possibleMoves,
          allowSlide,
        );
        if (simplePath > 0) {
          possibleMoves[possibleMoves.length - 1]!.prependTile(tilePos1);
          numberOfPaths += simplePath;
        }
        tempX += dx;
        tempY += dy;
      }
    }
    return numberOfPaths;
  }

  /**
   * Find a path of 1 or 2 segments between tiles.
   * Port of KShisen's Board::findSimplePath().
   */
  findSimplePath(
    tilePos1: TilePos,
    tilePos2: TilePos,
    possibleMoves: PossibleMove[],
    allowSlide = true,
  ): number {
    let numberOfPaths = 0;
    let path: Path = [];

    // Find direct line (path of 1 segment)
    if (this.canMakePath(tilePos1, tilePos2)) {
      path = [tilePos1, tilePos2];
      possibleMoves.push(new PossibleMove(path));
      ++numberOfPaths;
    }

    // If the tiles are in the same row or column, then a 'simple path' cannot
    // be found between them; canMakePath() should have returned true above if
    // that was possible
    if (tilePos1.x === tilePos2.x || tilePos1.y === tilePos2.y) {
      return numberOfPaths;
    }

    // The special code for tiles that can slide duplicates code for now:
    // can we make a path by sliding tiles? the slide move is always first,
    // then a normal path
    if (this.m_tilesCanSlideFlag && allowSlide) {
      // Find path of 2 segments (route A)
      const slideA = this.canSlideTiles(tilePos1, pos(tilePos2.x, tilePos1.y));
      if (
        slideA.length > 0 &&
        this.canMakePath(pos(tilePos2.x, tilePos1.y), tilePos2)
      ) {
        path = [tilePos1, pos(tilePos2.x, tilePos1.y), tilePos2];
        possibleMoves.push(new PossibleMove(path, slideA));
        ++numberOfPaths;
      }

      // Find path of 2 segments (route B)
      const slideB = this.canSlideTiles(tilePos1, pos(tilePos1.x, tilePos2.y));
      if (
        slideB.length > 0 &&
        this.canMakePath(pos(tilePos1.x, tilePos2.y), tilePos2)
      ) {
        path = [tilePos1, pos(tilePos1.x, tilePos2.y), tilePos2];
        possibleMoves.push(new PossibleMove(path, slideB));
        ++numberOfPaths;
      }
    }

    // Even if tiles can slide, a path could still be done without sliding

    // Find path of 2 segments (route A)
    if (
      this.fieldAt(pos(tilePos2.x, tilePos1.y)) === EMPTY &&
      this.canMakePath(tilePos1, pos(tilePos2.x, tilePos1.y)) &&
      this.canMakePath(pos(tilePos2.x, tilePos1.y), tilePos2)
    ) {
      path = [tilePos1, pos(tilePos2.x, tilePos1.y), tilePos2];
      possibleMoves.push(new PossibleMove(path));
      ++numberOfPaths;
    }

    // Find path of 2 segments (route B)
    if (
      this.fieldAt(pos(tilePos1.x, tilePos2.y)) === EMPTY &&
      this.canMakePath(tilePos1, pos(tilePos1.x, tilePos2.y)) &&
      this.canMakePath(pos(tilePos1.x, tilePos2.y), tilePos2)
    ) {
      path = [tilePos1, pos(tilePos1.x, tilePos2.y), tilePos2];
      possibleMoves.push(new PossibleMove(path));
      ++numberOfPaths;
    }

    return numberOfPaths;
  }

  // --- debug helpers --------------------------------------------------------

  /** Returns a copy of the board field, row by row. */
  snapshot(): number[][] {
    const rows: number[][] = [];
    for (let y = 0; y < this.yTiles(); ++y) {
      const row: number[] = [];
      for (let x = 0; x < this.xTiles(); ++x) {
        row.push(this.fieldAt(pos(x, y)));
      }
      rows.push(row);
    }
    return rows;
  }

  /** Restores a board previously obtained with snapshot(). Used by the tests. */
  restore(rows: readonly (readonly number[])[]): void {
    for (let y = 0; y < rows.length && y < this.yTiles(); ++y) {
      for (let x = 0; x < rows[y]!.length && x < this.xTiles(); ++x) {
        this.setFieldAt(pos(x, y), rows[y]![x]!);
      }
    }
  }

  /** Overwrites a single position. Used to set up test positions. */
  setField(tilePos: TilePos, value: number): void {
    this.setFieldAt(tilePos, value);
  }

  /** Returns the board field values used by the KDE unit test. */
  toString(): string {
    return this.snapshot()
      .map((row) =>
        row
          .map((t) => (t === EMPTY ? " --" : String(t).padStart(3, " ")))
          .join("")
          .trimEnd(),
      )
      .join("\n");
  }
}

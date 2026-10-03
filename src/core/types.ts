/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Portions derived from KShisen (src/types.h, src/move.h, src/possiblemove.h)

    SPDX-FileCopyrightText: 1997 Mario Weilguni <mweilguni@sime.com>
    SPDX-FileCopyrightText: 2002-2004 Dave Corrie <kde@davecorrie.com>
    SPDX-FileCopyrightText: 2007 Mauricio Piacentini <mauricio@tabuleiro.com>
    SPDX-FileCopyrightText: 2009-2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

/** Position of a tile on the board. */
export interface TilePos {
  readonly x: number;
  readonly y: number;
}

/** A list of positions (at least 2) that makes a connection path. */
export type Path = TilePos[];

/**
 * A list of two positions describing the movement of the last slid tile:
 * the first entry is where the tile is, the second one is where it goes to.
 */
export type Slide = TilePos[];

export const pos = (x: number, y: number): TilePos => ({ x, y });

/**
 * A move on the board made by the player.
 *
 * Contains all the information needed to undo or redo a move.
 */
export class Move {
  private pos1: TilePos;
  private pos2: TilePos;
  private t1: number;
  private t2: number;
  private readonly slid: Slide;

  constructor(
    tilePos1: TilePos,
    tilePos2: TilePos,
    tile1: number,
    tile2: number,
    slide: Slide = [],
  ) {
    this.pos1 = tilePos1;
    this.pos2 = tilePos2;
    this.t1 = tile1;
    this.t2 = tile2;
    this.slid = slide;
  }

  get x1(): number {
    return this.pos1.x;
  }

  get y1(): number {
    return this.pos1.y;
  }

  get x2(): number {
    return this.pos2.x;
  }

  get y2(): number {
    return this.pos2.y;
  }

  get tile1(): number {
    return this.t1;
  }

  get tile2(): number {
    return this.t2;
  }

  get hasSlide(): boolean {
    return this.slid.length > 0;
  }

  get slide(): Slide {
    return this.slid;
  }

  get slideX1(): number {
    return this.slid.length === 0 ? 0 : (this.slid[0] as TilePos).x;
  }

  get slideY1(): number {
    return this.slid.length === 0 ? 0 : (this.slid[0] as TilePos).y;
  }

  get slideX2(): number {
    return this.slid.length === 0
      ? 0
      : (this.slid[this.slid.length - 1] as TilePos).x;
  }

  get slideY2(): number {
    return this.slid.length === 0
      ? 0
      : (this.slid[this.slid.length - 1] as TilePos).y;
  }

  /**
   * Swaps the two tiles involved in a move.
   *
   * This is needed for undoing a move in case both tiles are in the same column.
   */
  swapTiles(): void {
    const p = this.pos1;
    this.pos1 = this.pos2;
    this.pos2 = p;
    const t = this.t1;
    this.t1 = this.t2;
    this.t2 = t;
  }
}

/**
 * A possible move is a connection path between two tiles and optionally a slide.
 *
 * Sometimes for a couple of tiles to match there may be multiple possible moves
 * for the player to choose between.
 */
export class PossibleMove {
  private pathList: Path;
  private readonly slideList: Slide;

  constructor(path: Path, slide: Slide = []) {
    this.pathList = path;
    this.slideList = slide;
  }

  get path(): Path {
    return this.pathList;
  }

  get hasSlide(): boolean {
    return this.slideList.length > 0;
  }

  get slide(): Slide {
    return this.slideList;
  }

  prependTile(tilePos: TilePos): void {
    this.pathList.unshift(tilePos);
  }

  /**
   * Checks whether the given position lies on one of the segments of the path,
   * i.e. whether clicking there would choose this move. The last position of
   * the path (the matched partner tile) never selects the move.
   */
  isInPath(tilePos: TilePos): boolean {
    const last = this.pathList[this.pathList.length - 1] as TilePos;
    if (tilePos.x === last.x && tilePos.y === last.y) {
      return false;
    }
    // a path has at least 2 positions
    let pathX = (this.pathList[0] as TilePos).x;
    let pathY = (this.pathList[0] as TilePos).y;
    for (let i = 1; i < this.pathList.length; ++i) {
      const iter = this.pathList[i] as TilePos;
      if (
        (tilePos.x === iter.x &&
          ((tilePos.y > pathY && tilePos.y <= iter.y) ||
            (tilePos.y < pathY && tilePos.y >= iter.y))) ||
        (tilePos.y === iter.y &&
          ((tilePos.x > pathX && tilePos.x <= iter.x) ||
            (tilePos.x < pathX && tilePos.x >= iter.x)))
      ) {
        return true;
      }
      pathX = iter.x;
      pathY = iter.y;
    }
    return false;
  }
}

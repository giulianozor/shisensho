/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Port of Board::paintEvent() and the drawing helpers of KShisen's src/board.cpp

    SPDX-FileCopyrightText: 1997 Mario Weilguni <mweilguni@sime.com>
    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import type { Board } from "../core/board";
import { EMPTY } from "../core/tiles";
import { pos, type Path, type Slide, type TilePos } from "../core/types";
import {
  DEFAULT_METRICS,
  computeScale,
  type TileMetrics,
  type TileScale,
} from "./tileset";

/** The part of the tile sheet that the renderer uses. */
export interface TileSheetLike {
  tile(scale: TileScale, ratio: number): CanvasImageSource | undefined;
  selectedTile(scale: TileScale, ratio: number): CanvasImageSource | undefined;
  face(
    tile: number,
    scale: TileScale,
    ratio: number,
  ): CanvasImageSource | undefined;
}

/** A point on the canvas. */
export interface Point {
  x: number;
  y: number;
}

/** The renderer of the playing area, a port of KShisen's Board widget. */
export class BoardRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly board: Board;
  private sheet: TileSheetLike | null = null;
  private metrics: TileMetrics = DEFAULT_METRICS;
  private background: CanvasImageSource | null = null;
  private backgroundPattern: CanvasPattern | null = null;
  private backgroundTiled = true;
  private backgroundTileWidth = 0;
  private backgroundTileHeight = 0;
  private ratio = 1;
  private scale: TileScale;
  private pausedMessage = "Game Paused\nClick to resume game.";
  private stuckMessage = "Game Stuck\nNo more moves possible.";
  private overMessage = "Game Over\nClick to start a new game.";

  constructor(canvas: HTMLCanvasElement, board: Board, sheet?: TileSheetLike) {
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("could not get a drawing context");
    }
    this.canvas = canvas;
    this.context = context;
    this.board = board;
    this.sheet = sheet ?? null;
    this.scale = computeScale(
      this.metrics,
      canvas.clientWidth,
      canvas.clientHeight,
      board.xTiles(),
      board.yTiles(),
    );
  }

  /** The part of the tile sheet the renderer needs, so tests can replace it. */
  setSheet(sheet: TileSheetLike | null): void {
    this.sheet = sheet;
  }

  /** The metrics of the tile set that is currently drawn. */
  setMetrics(metrics: TileMetrics): void {
    this.metrics = metrics;
    this.resize();
  }

  /**
   * The background to draw behind the tiles.
   *
   * A tiled background repeats its image, resized to the given tile size when
   * one is given, like the brush of libkmahjongg. Otherwise the image is
   * stretched over the whole view. A null image draws the plain window color.
   */
  setBackground(
    background:
      | {
          image: CanvasImageSource | null;
          tiled?: boolean;
          tileWidth?: number;
          tileHeight?: number;
        }
      | null,
  ): void {
    this.background = background?.image ?? null;
    this.backgroundTiled = background?.tiled ?? true;
    this.backgroundTileWidth = background?.tileWidth ?? 0;
    this.backgroundTileHeight = background?.tileHeight ?? 0;
    this.backgroundPattern = null;
  }

  setMessages(messages: {
    paused?: string;
    stuck?: string;
    over?: string;
  }): void {
    if (messages.paused !== undefined) {
      this.pausedMessage = messages.paused;
    }
    if (messages.stuck !== undefined) {
      this.stuckMessage = messages.stuck;
    }
    if (messages.over !== undefined) {
      this.overMessage = messages.over;
    }
  }

  /** The tile sizes currently used. */
  currentScale(): TileScale {
    return this.scale;
  }

  /** Matches the canvas to its size in the layout, including the pixel ratio. */
  resize(): void {
    const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (
      this.canvas.width !== pixelWidth ||
      this.canvas.height !== pixelHeight
    ) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.ratio = ratio;
    this.scale = computeScale(
      this.metrics,
      width,
      height,
      this.board.xTiles(),
      this.board.yTiles(),
    );
  }

  /** The board position of a point on the canvas, or null outside the board. */
  positionAt(point: Point): TilePos | null {
    const x = Math.floor((point.x - this.xOffset()) / this.scale.cellWidth);
    const y = Math.floor((point.y - this.yOffset()) / this.scale.cellHeight);
    if (point.x < this.xOffset() || point.y < this.yOffset()) {
      return null;
    }
    if (x >= this.board.xTiles() || y >= this.board.yTiles()) {
      return null;
    }
    return { x, y };
  }

  /** The horizontal offset of the centered board. */
  xOffset(): number {
    return (
      (this.canvas.clientWidth - this.scale.cellWidth * this.board.xTiles()) / 2
    );
  }

  /** The vertical offset of the centered board. */
  yOffset(): number {
    return (
      (this.canvas.clientHeight - this.scale.cellHeight * this.board.yTiles()) /
      2
    );
  }

  /**
   * The middle of a tile, or the position outside the board that a connection
   * uses for its outline, as calculated by Board::midCoord().
   */
  midCoord(tilePos: TilePos): Point {
    const w = this.scale.cellWidth;
    const h = this.scale.cellHeight;
    let x: number;
    if (tilePos.x === -1) {
      x = this.xOffset() - w / 4;
    } else if (tilePos.x === this.board.xTiles()) {
      x = this.xOffset() + w * this.board.xTiles() + w / 4;
    } else {
      x = this.xOffset() + w * tilePos.x + w / 2;
    }
    let y: number;
    if (tilePos.y === -1) {
      y = this.yOffset() - w / 4;
    } else if (tilePos.y === this.board.yTiles()) {
      y = this.yOffset() + h * this.board.yTiles() + w / 4;
    } else {
      y = this.yOffset() + h * tilePos.y + h / 2;
    }
    return { x, y };
  }

  /** Draws the whole board, as Board::paintEvent() does. */
  paint(): void {
    const context = this.context;
    context.save();
    context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    context.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    this.paintBackground(context);

    switch (this.board.getState()) {
      case "normal":
        this.paintTiles(context);
        break;
      case "paused":
        this.paintInfoRect(context, this.pausedMessage);
        break;
      case "stuck":
        this.paintTiles(context);
        this.paintInfoRect(context, this.stuckMessage);
        break;
      case "over":
        this.paintInfoRect(context, this.overMessage);
        break;
    }

    const connection = this.board.getConnection();
    if (connection.length > 1) {
      const slide = this.board.getConnectionSlide();
      const sliding = slide.length === 2;
      // a path that needs a slide is drawn dashed: it is not free yet
      this.paintPath(
        context,
        connection,
        sliding ? "#ff6666" : "#ff0000",
        this.scale.lineWidth,
        sliding,
      );
      if (sliding) {
        this.paintSlide(context, connection[0] as TilePos, slide);
      }
    }

    const possibleMoves = this.board.getPossibleMoves();
    if (possibleMoves.length > 1) {
      for (const move of possibleMoves) {
        this.paintPath(context, move.path, "#0000ff", this.scale.lineWidth);
      }
    }

    context.restore();
  }

  private paintBackground(context: CanvasRenderingContext2D): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (this.background !== null) {
      if (!this.backgroundTiled) {
        // backgrounds that are not tiled are stretched over the whole view
        context.drawImage(this.background, 0, 0, width, height);
        return;
      }
      // tiled backgrounds are drawn with a repeating brush that keeps its own
      // size instead of being stretched over the whole view
      if (this.backgroundPattern === null) {
        this.backgroundPattern = context.createPattern(
          this.backgroundCanvas(),
          "repeat",
        );
      }
      if (this.backgroundPattern !== null) {
        context.fillStyle = this.backgroundPattern;
        context.fillRect(0, 0, width, height);
        return;
      }
      context.drawImage(this.background, 0, 0, width, height);
      return;
    }
    context.fillStyle = "#0b3d0b";
    context.fillRect(0, 0, width, height);
  }

  /**
   * The image of a tiled background, resized to the size declared by its
   * desktop file. Without a declared size the image keeps its natural size.
   */
  private backgroundCanvas(): CanvasImageSource {
    const image = this.background;
    if (
      image === null ||
      this.backgroundTileWidth <= 0 ||
      this.backgroundTileHeight <= 0
    ) {
      return image as CanvasImageSource;
    }
    const canvas = document.createElement("canvas");
    canvas.width = this.backgroundTileWidth;
    canvas.height = this.backgroundTileHeight;
    const context = canvas.getContext("2d");
    if (context === null) {
      return image;
    }
    context.drawImage(
      image,
      0,
      0,
      this.backgroundTileWidth,
      this.backgroundTileHeight,
    );
    return canvas;
  }

  private paintTiles(context: CanvasRenderingContext2D): void {
    const sheet = this.sheet;
    if (sheet === null) {
      return;
    }
    for (let i = 0; i < this.board.xTiles(); ++i) {
      for (let j = 0; j < this.board.yTiles(); ++j) {
        const tile = this.board.fieldAt({ x: i, y: j });
        if (tile === EMPTY) {
          continue;
        }
        const x = this.xOffset() + i * this.scale.cellWidth;
        const y = this.yOffset() + j * this.scale.cellHeight;
        const base = this.board.isTileHighlighted({ x: i, y: j })
          ? sheet.selectedTile(this.scale, this.ratio)
          : sheet.tile(this.scale, this.ratio);
        if (base !== undefined) {
          context.drawImage(base, x, y, this.scale.width, this.scale.height);
        }
        const face = sheet.face(tile, this.scale, this.ratio);
        if (face !== undefined) {
          context.drawImage(
            face,
            x + this.scale.faceOffsetX,
            y + this.scale.faceOffsetY,
            this.scale.faceWidth,
            this.scale.faceHeight,
          );
        }
      }
    }
  }

  private paintPath(
    context: CanvasRenderingContext2D,
    path: Path,
    color: string,
    width: number,
    dashed = false,
  ): void {
    if (path.length < 2) {
      return;
    }
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = "round";
    context.setLineDash(dashed ? [3 * width, 3 * width] : []);
    context.beginPath();
    const start = this.midCoord(path[0]!);
    context.moveTo(start.x, start.y);
    for (let i = 1; i < path.length; ++i) {
      const point = this.midCoord(path[i]!);
      context.lineTo(point.x, point.y);
    }
    context.stroke();
  }

  /**
   * Draws the tiles that have to slide before the drawn connection is clear:
   * a frame on every tile that slides and an arrow to where it slides to.
   */
  private paintSlide(
    context: CanvasRenderingContext2D,
    tilePos: TilePos,
    slide: Slide,
  ): void {
    const first = slide[0] as TilePos;
    const last = slide[slide.length - 1] as TilePos;
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const width = this.scale.cellWidth;
    const height = this.scale.cellHeight;
    const line = this.scale.lineWidth;

    context.save();
    context.strokeStyle = "#ff9900";

    // a solid frame marks every tile that slides, so it cannot be mistaken for
    // part of the dashed connection
    context.lineWidth = 2 * line;
    context.setLineDash([]);

    // all the tiles between the marked tile and the free space slide aside
    const stepX = dx === 0 ? 0 : tilePos.x > first.x ? 1 : -1;
    const stepY = dy === 0 ? 0 : tilePos.y > first.y ? 1 : -1;
    for (
      let x = first.x, y = first.y;
      x !== tilePos.x || y !== tilePos.y;
      x += stepX, y += stepY
    ) {
      const center = this.midCoord(pos(x, y));
      context.strokeRect(
        center.x - width / 2 + line,
        center.y - height / 2 + line,
        width - 2 * line,
        height - 2 * line,
      );
    }

    // the arrow points from the tile that moves the most to its new place
    const from = this.midCoord(first);
    const to = this.midCoord(last);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const head = Math.max(4, 4 * line);

    context.lineWidth = line;
    context.fillStyle = "#ff9900";
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();

    context.beginPath();
    context.moveTo(to.x, to.y);
    context.lineTo(
      to.x - head * Math.cos(angle - Math.PI / 6),
      to.y - head * Math.sin(angle - Math.PI / 6),
    );
    context.lineTo(
      to.x - head * Math.cos(angle + Math.PI / 6),
      to.y - head * Math.sin(angle + Math.PI / 6),
    );
    context.closePath();
    context.fill();
    context.restore();
  }

  private paintInfoRect(
    context: CanvasRenderingContext2D,
    message: string,
  ): void {
    const boxWidth = this.canvas.clientWidth * 0.6;
    const boxHeight = this.canvas.clientHeight * 0.6;
    const x = (this.canvas.clientWidth - boxWidth) / 2;
    const y = (this.canvas.clientHeight - boxHeight) / 2;

    context.fillStyle = "rgba(100, 100, 100, 0.59)";
    context.beginPath();
    if (typeof context.roundRect === "function") {
      context.roundRect(x, y, boxWidth, boxHeight, [10, 10]);
    } else {
      context.rect(x, y, boxWidth, boxHeight);
    }
    context.fill();

    context.fillStyle = "#ffffff";
    context.font = `${Math.max(8, Math.trunc(boxHeight / 13))}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const lines = message.split("\n");
    const lineHeight = context.font.match(/(\d+)px/)?.[1] ?? "16";
    const start =
      y + boxHeight / 2 - ((lines.length - 1) * Number(lineHeight)) / 2;
    lines.forEach((line, index) => {
      context.fillText(
        line,
        x + boxWidth / 2,
        start + index * Number(lineHeight),
      );
    });
    context.textAlign = "start";
    context.textBaseline = "alphabetic";
  }
}

/** The part of the tile sheet that the renderer uses. */
export interface TileSheetLike {
  tile(scale: TileScale, ratio: number): CanvasImageSource | undefined;
  selectedTile(scale: TileScale, ratio: number): CanvasImageSource | undefined;
  face(
    tile: number,
    scale: TileScale,
    ratio: number,
  ): CanvasImageSource | undefined;
}

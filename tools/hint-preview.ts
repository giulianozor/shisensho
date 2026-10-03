/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Draws the hinted move of a board, with the tiles to slide marked. Only used
    by hand while working on the hint, it needs "npm run dev" to be running.

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import tileSetUrl from "../src/assets/tilesets/default.svg?url";
import { Board } from "../src/core/board";
import { mulberry32 } from "../src/core/rng";
import { EMPTY } from "../src/core/tiles";
import { pos, type TilePos } from "../src/core/types";
import { BoardRenderer } from "../src/render/renderer";
import { TileSheet } from "../src/render/tileset";

const out = document.querySelector<HTMLElement>("#out")!;
const lines: string[] = [];

const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const board = new Board({
  width: 14,
  height: 6,
  shuffle: 0,
  random: mulberry32(1),
  tilesCanSlide: true,
  gravity: false,
});

// every tile is unique, so the pair below is the only move on the board
for (let y = 0; y < 6; ++y) {
  for (let x = 0; x < 14; ++x) {
    board.setField(pos(x, y), 100 + y * 14 + x);
  }
}
// a pair that can only be connected by sliding the tiles in between aside
board.setField(pos(1, 1), 1);
board.setField(pos(4, 3), 1);
board.setField(pos(1, 2), 9);
board.setField(pos(2, 1), 11);
board.setField(pos(3, 1), 12);
// the free space the tile at (1,2) slides into
for (const cell of [
  pos(1, 3),
  pos(1, 4),
  pos(1, 5),
  pos(2, 3),
  pos(3, 3),
]) {
  board.setField(cell, EMPTY);
}

const sheet = await TileSheet.load(tileSetUrl);
const renderer = new BoardRenderer(canvas, board, sheet);
renderer.resize();
const hint = board.showHint();
const slide = board.getConnectionSlide();
renderer.paint();

lines.push(`hint ${JSON.stringify(hint)}`);
lines.push(`slide ${JSON.stringify(slide)}`);

const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
const context = canvas.getContext("2d")!;
const scale = renderer.currentScale();

function pixel(point: { x: number; y: number }): number[] {
  const data = context.getImageData(
    Math.round(point.x * ratio),
    Math.round(point.y * ratio),
    1,
    1,
  ).data;
  return [data[0] as number, data[1] as number, data[2] as number];
}

function isOrange(c: number[]): boolean {
  return (c[0] as number) > 200 && (c[1] as number) > 100 && (c[1] as number) < 200 && (c[2] as number) < 100;
}

// the connection is drawn in red, lighter and dashed when it needs a slide
function isConnection(c: number[]): boolean {
  return (c[0] as number) > 200 && (c[1] as number) < 130 && (c[2] as number) < 130;
}

if (hint !== null && slide.length === 2) {
  const first = slide[0] as TilePos;
  const last = slide[slide.length - 1] as TilePos;
  // the connection is drawn for every segment of the path
  for (let i = 1; i < hint.length; ++i) {
    const from = renderer.midCoord(hint[i - 1] as TilePos);
    const to = renderer.midCoord(hint[i] as TilePos);
    let found = false;
    for (let step = 0; step <= 20 && !found; ++step) {
      found = isConnection(
        pixel({
          x: from.x + ((to.x - from.x) * step) / 20,
          y: from.y + ((to.y - from.y) * step) / 20,
        }),
      );
    }
    lines.push(`segment ${i - 1}->${i} connection: ${found}`);
  }
  // the two tiles to click are drawn as selected tiles
  lines.push(`marked first: ${board.isTileHighlighted(hint[0] as TilePos)}`);
  lines.push(
    `marked last: ${board.isTileHighlighted(hint[hint.length - 1] as TilePos)}`,
  );
  // the slide is drawn in orange, from the first to the last position
  lines.push(`slide start orange: ${isOrange(pixel(renderer.midCoord(first)))}`);
  lines.push(`slide end orange: ${isOrange(pixel(renderer.midCoord(last)))}`);
  const middle = renderer.midCoord({
    x: (first.x + last.x) / 2,
    y: (first.y + last.y) / 2,
  });
  lines.push(`slide middle orange: ${isOrange(pixel(middle))}`);
  // every sliding tile has a frame
  const stepX = first.x < (hint[0] as TilePos).x ? 1 : 0;
  const stepY = first.y < (hint[0] as TilePos).y ? 1 : 0;
  for (
    let x = first.x, y = first.y;
    x !== (hint[0] as TilePos).x || y !== (hint[0] as TilePos).y;
    x += stepX, y += stepY
  ) {
    const center = renderer.midCoord(pos(x, y));
    let found = false;
    for (let dy = -1; dy <= 1 && !found; ++dy) {
      for (let dx = -1; dx <= 1 && !found; ++dx) {
        const edge = renderer.midCoord(
          pos(x + Math.sign(dx || 0), y + Math.sign(dy || 0)),
        );
        const p = pixel({
          x: (center.x + edge.x) / 2,
          y: (center.y + edge.y) / 2,
        });
        found = isOrange(p);
      }
    }
    lines.push(`frame on (${x},${y}): ${found}`);
  }
  // the whole board has no other orange
  const image = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let orange = 0;
  for (let i = 0; i < image.length; i += 4) {
    if (isOrange([image[i] as number, image[i + 1] as number, image[i + 2] as number])) {
      orange++;
    }
  }
  lines.push(`orange pixels: ${orange}`);
  lines.push(`cell ${scale.cellWidth.toFixed(1)}x${scale.cellHeight.toFixed(1)}`);
}

out.textContent = lines.join("\n");

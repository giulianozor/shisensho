/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Tests for the tile metrics, ported from libkmahjongg's KMahjonggTileset

    SPDX-FileCopyrightText: 1997 Mathias Mueller <in5y158@public.uni-hamburg.de>
    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import { describe, expect, it } from 'vitest';

import { DEFAULT_METRICS, computeScale } from '../src/render/tileset';

describe('tile metrics', () => {
  it('has the metrics of the default tile set', () => {
    expect(DEFAULT_METRICS).toEqual({
      width: 96,
      height: 116,
      faceWidth: 69,
      faceHeight: 89,
      faceOffsetX: 27,
      faceOffsetY: 1,
      levelOffsetX: 12,
      levelOffsetY: 12,
    });
  });

  it('keeps the natural size in a view that fits the board', () => {
    const scale = computeScale(DEFAULT_METRICS, 18 * 69 + 96, 8 * 89 + 116, 18, 8);
    expect(scale.width).toBe(96);
    expect(scale.height).toBe(116);
    expect(scale.faceWidth).toBe(69);
    expect(scale.faceHeight).toBe(89);
  });

  it('advances a cell by an even number of face pixels', () => {
    for (const size of [200, 480, 800, 1333]) {
      const scale = computeScale(DEFAULT_METRICS, size, size, 18, 8);
      expect(scale.cellWidth % 2).toBe(0);
      expect(scale.cellHeight % 2).toBe(0);
      expect(scale.cellWidth).toBe(Math.trunc(scale.faceWidth / 2) * 2);
      expect(scale.cellHeight).toBe(Math.trunc(scale.faceHeight / 2) * 2);
    }
  });

  it('shrinks the tiles to fit a small view', () => {
    const scale = computeScale(DEFAULT_METRICS, 320, 240, 18, 8);
    expect(scale.width).toBeLessThan(DEFAULT_METRICS.width);
    expect(scale.height).toBeLessThan(DEFAULT_METRICS.height);
    expect(scale.cellWidth * 18).toBeLessThanOrEqual(320);
    expect(scale.cellHeight * 8).toBeLessThanOrEqual(240);
  });

  it('keeps the aspect ratio of a tile', () => {
    const scale = computeScale(DEFAULT_METRICS, 900, 600, 24, 12);
    expect(scale.width / scale.height).toBeCloseTo(
      DEFAULT_METRICS.width / DEFAULT_METRICS.height,
      1,
    );
  });

  it('uses the height as the limit of a wide view', () => {
    // a wide view leaves space left and right of the board
    const scale = computeScale(DEFAULT_METRICS, 1000, 300, 18, 8);
    expect(scale.cellHeight * 8).toBeLessThanOrEqual(300);
    expect(scale.cellHeight * 8).toBeGreaterThan(300 / 2);
    expect(scale.cellWidth * 18).toBeLessThan(1000 / 2);
  });

  it('uses the width as the limit of a tall view', () => {
    const scale = computeScale(DEFAULT_METRICS, 300, 1000, 18, 8);
    expect(scale.cellWidth * 18).toBeLessThanOrEqual(300);
    expect(scale.cellWidth * 18).toBeGreaterThan(300 / 2);
    expect(scale.cellHeight * 8).toBeLessThan(1000 / 2);
  });

  it('scales the level offsets with the tiles', () => {
    const scale = computeScale(DEFAULT_METRICS, 480, 320, 18, 8);
    expect(scale.levelOffsetX).toBeLessThan(DEFAULT_METRICS.levelOffsetX);
    expect(scale.levelOffsetX).toBeGreaterThan(0);
    expect(scale.levelOffsetY / scale.levelOffsetX).toBeCloseTo(1, 1);
  });

  it('draws a line of at least three pixels', () => {
    expect(computeScale(DEFAULT_METRICS, 20, 20, 18, 8).lineWidth).toBe(3);
    expect(computeScale(DEFAULT_METRICS, 1600, 1200, 18, 8).lineWidth).toBeGreaterThan(3);
  });

  it('grows the tiles in a view much larger than the board', () => {
    const scale = computeScale(DEFAULT_METRICS, 4000, 3000, 6, 4);
    expect(scale.width).toBeGreaterThan(DEFAULT_METRICS.width);
    expect(scale.cellWidth).toBeGreaterThan(DEFAULT_METRICS.faceWidth);
    expect(scale.width / scale.height).toBeCloseTo(
      DEFAULT_METRICS.width / DEFAULT_METRICS.height,
      1,
    );
  });
});
/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Tests ported from KShisen's src/tests/movetest.cpp

    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import { describe, expect, it } from "vitest";

import { Move, PossibleMove, pos } from "../src/core/types";

const m_slidePos1 = pos(15, 16);
const m_slidePos2 = pos(17, 18);

const m_moveWithoutSlide = new Move(pos(1, 2), pos(3, 4), 12, 34);
const m_moveWithSlide = new Move(pos(5, 6), pos(7, 8), 56, 78, [
  m_slidePos1,
  m_slidePos2,
]);

describe("Move", () => {
  it("exposes the positions of both tiles", () => {
    expect([m_moveWithoutSlide.x1, m_moveWithoutSlide.y1]).toEqual([1, 2]);
    expect([m_moveWithSlide.x1, m_moveWithSlide.y1]).toEqual([5, 6]);
    expect([m_moveWithoutSlide.x2, m_moveWithoutSlide.y2]).toEqual([3, 4]);
    expect([m_moveWithSlide.x2, m_moveWithSlide.y2]).toEqual([7, 8]);
  });

  it("exposes both tile values", () => {
    expect([m_moveWithoutSlide.tile1, m_moveWithoutSlide.tile2]).toEqual([
      12, 34,
    ]);
    expect([m_moveWithSlide.tile1, m_moveWithSlide.tile2]).toEqual([56, 78]);
  });

  it("knows whether a slide is involved", () => {
    expect(m_moveWithoutSlide.hasSlide).toBe(false);
    expect(m_moveWithSlide.hasSlide).toBe(true);
  });

  it("exposes the slide, empty without a slide", () => {
    expect(m_moveWithoutSlide.slide).toEqual([]);
    expect(m_moveWithSlide.slide).toEqual([m_slidePos1, m_slidePos2]);
  });

  it("exposes the slide coordinates, zero without a slide", () => {
    expect([
      m_moveWithoutSlide.slideX1,
      m_moveWithoutSlide.slideY1,
      m_moveWithoutSlide.slideX2,
      m_moveWithoutSlide.slideY2,
    ]).toEqual([0, 0, 0, 0]);
    expect([
      m_moveWithSlide.slideX1,
      m_moveWithSlide.slideY1,
      m_moveWithSlide.slideX2,
      m_moveWithSlide.slideY2,
    ]).toEqual([15, 16, 17, 18]);
  });

  it("swaps both positions and tile values", () => {
    const withoutSlide = new Move(pos(1, 2), pos(3, 4), 12, 34);
    withoutSlide.swapTiles();
    expect([withoutSlide.x1, withoutSlide.y1, withoutSlide.tile1]).toEqual([
      3, 4, 34,
    ]);
    expect([withoutSlide.x2, withoutSlide.y2, withoutSlide.tile2]).toEqual([
      1, 2, 12,
    ]);

    const withSlide = new Move(pos(5, 6), pos(7, 8), 56, 78, [
      m_slidePos1,
      m_slidePos2,
    ]);
    withSlide.swapTiles();
    expect([withSlide.x1, withSlide.y1, withSlide.tile1]).toEqual([7, 8, 78]);
    expect([withSlide.x2, withSlide.y2, withSlide.tile2]).toEqual([5, 6, 56]);
    // the slide is not affected by swapping the tiles
    expect(withSlide.slide).toEqual([m_slidePos1, m_slidePos2]);
  });
});

describe("PossibleMove", () => {
  // a straight path from (1,1) to (4,1)
  const straight = new PossibleMove([pos(1, 1), pos(4, 1)]);

  it("detects positions on the path", () => {
    expect(straight.isInPath(pos(2, 1))).toBe(true);
    expect(straight.isInPath(pos(3, 1))).toBe(true);
  });

  it("ignores the marked tile, only its partner is excluded by name", () => {
    // the first position of the path is the already marked tile
    expect(straight.isInPath(pos(1, 1))).toBe(false);
  });

  it("ignores positions next to the path", () => {
    expect(straight.isInPath(pos(2, 2))).toBe(false);
    expect(straight.isInPath(pos(2, 0))).toBe(false);
    expect(straight.isInPath(pos(0, 1))).toBe(false);
  });

  it("never selects the move by clicking the matched partner tile", () => {
    expect(straight.isInPath(pos(4, 1))).toBe(false);
    const path = [pos(1, 1), pos(1, 3), pos(4, 3), pos(4, 4)];
    const corner = new PossibleMove(path);
    expect(corner.isInPath(pos(1, 2))).toBe(true);
    expect(corner.isInPath(pos(4, 4))).toBe(false);
  });

  it("prepends the marked tile to the path", () => {
    const path: ReturnType<typeof pos>[] = [pos(1, 2), pos(4, 2)];
    const move = new PossibleMove(path);
    move.prependTile(pos(1, 1));
    expect(move.path).toEqual([pos(1, 1), pos(1, 2), pos(4, 2)]);
  });

  it("carries a slide", () => {
    const slide = [pos(2, 1), pos(5, 1)];
    const move = new PossibleMove([pos(1, 1), pos(4, 1), pos(4, 3)], slide);
    expect(move.hasSlide).toBe(true);
    expect(move.slide).toEqual(slide);
    expect(new PossibleMove([pos(1, 1), pos(2, 1)]).hasSlide).toBe(false);
  });
});

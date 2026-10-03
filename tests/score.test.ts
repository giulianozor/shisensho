/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Tests for the score, ported from KShisen's src/app.cpp

    SPDX-FileCopyrightText: 2001-2002 Hans-Joachim Bremer <hans@bremer.org>
    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import { describe, expect, it } from 'vitest';

import { score } from '../src/core/score';

// The expected values were calculated with the original C++ implementation.
describe('score', () => {
  it('scores a game of the default board size', () => {
    expect(score(18, 8, 30, false)).toBe(26934);
    expect(score(18, 8, 30, true)).toBe(53868);
    expect(score(18, 8, 60, false)).toBe(13467);
    expect(score(18, 8, 60, true)).toBe(26934);
    expect(score(18, 8, 123, false)).toBe(6569);
    expect(score(18, 8, 123, true)).toBe(13138);
    expect(score(18, 8, 300, false)).toBe(2693);
    expect(score(18, 8, 300, true)).toBe(5386);
    expect(score(18, 8, 3600, false)).toBe(224);
    expect(score(18, 8, 3600, true)).toBe(448);
  });

  it('scores the smallest and the largest board', () => {
    expect(score(14, 6, 42, false)).toBe(8571);
    expect(score(30, 16, 100, true)).toBe(98350);
  });

  it('doubles the score when gravity is used', () => {
    for (const seconds of [10, 42, 300, 1000]) {
      const plain = score(16, 9, seconds, false);
      // the score is truncated, so the bonus can add one point
      expect(score(16, 9, seconds, true)).toBeGreaterThanOrEqual(plain * 2);
      expect(score(16, 9, seconds, true)).toBeLessThanOrEqual(plain * 2 + 1);
    }
  });

  it('halves the score when the game took twice as long', () => {
    expect(score(24, 12, 200, true)).toBe(Math.floor(score(24, 12, 100, true) / 2));
    expect(score(24, 12, 200, false)).toBe(Math.floor(score(24, 12, 100, false) / 2));
  });

  it('scores a game without a time as zero', () => {
    expect(score(18, 8, 0, true)).toBe(0);
    expect(score(18, 8, -1, true)).toBe(0);
  });
});
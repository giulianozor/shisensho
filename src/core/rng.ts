/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

/**
 * Creates a deterministic pseudo random generator (mulberry32).
 *
 * KShisen uses QRandomGenerator; the web port uses Math.random by default and
 * this generator for reproducible unit tests.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

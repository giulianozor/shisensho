/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Port of App::score() from KShisen's src/app.cpp

    SPDX-FileCopyrightText: 2001-2002 Hans-Joachim Bremer <hans@bremer.org>
    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

/**
 * The score of a finished game, as calculated by KShisen.
 *
 * The number of tiles per second dominates the result, both the board size and
 * playing with gravity give a bonus.
 *
 * @param x Board width in tiles.
 * @param y Board height in tiles.
 * @param seconds Playing time of the game in seconds.
 * @param gravity Whether gravity was enabled.
 */
export function score(x: number, y: number, seconds: number, gravity: boolean): number {
  if (seconds <= 0) {
    return 0;
  }
  const nTiles = x * y;
  const tilesPerSec = nTiles / seconds;
  const sizeBonus = Math.sqrt((nTiles / 14) * 6);
  const points = (tilesPerSec / 0.14) * 100;
  const gravityBonus = gravity ? 2 : 1;
  return Math.trunc(points * sizeBonus * gravityBonus);
}
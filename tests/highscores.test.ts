/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Tests for the high scores, ported from the KGameHighScore dialog used by
    KShisen's src/app.cpp

    SPDX-FileCopyrightText: 2006-2007 Matthias Kretz <kretz@kde.org>
    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import { describe, expect, it } from 'vitest';

import {
  HIGH_SCORES_KEY,
  MAX_ENTRIES,
  addHighScore,
  formatHighScoreTime,
  highScoreGroup,
  loadHighScores,
  rankOf,
  type HighScoreEntry,
  type HighScoreStorage,
} from '../src/core/highscores';

function entry(over: Partial<HighScoreEntry> = {}): HighScoreEntry {
  return {
    name: 'Player',
    time: 300,
    score: 1000,
    gravity: true,
    date: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function memoryStorage(initial: Record<string, string> = {}): HighScoreStorage {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

describe('high scores', () => {
  it('groups the scores by board size', () => {
    expect(highScoreGroup(18, 8)).toBe('18x8');
    expect(highScoreGroup(14, 6)).toBe('14x6');
  });

  it('stores an entry and reports its rank', () => {
    const storage = memoryStorage();
    const table = loadHighScores(storage);
    expect(addHighScore(storage, table, '18x8', entry({ score: 1000 }))).toBe(0);
    expect(addHighScore(storage, table, '18x8', entry({ score: 2000 }))).toBe(0);
    expect(addHighScore(storage, table, '18x8', entry({ score: 1500 }))).toBe(1);
    expect(table['18x8']?.map((e) => e.score)).toEqual([2000, 1500, 1000]);
    expect(loadHighScores(storage)['18x8']).toEqual(table['18x8']);
  });

  it('keeps the groups apart', () => {
    const storage = memoryStorage();
    const table = loadHighScores(storage);
    addHighScore(storage, table, '18x8', entry({ score: 1000 }));
    addHighScore(storage, table, '14x6', entry({ score: 100 }));
    expect(Object.keys(loadHighScores(storage)).sort()).toEqual(['14x6', '18x8']);
  });

  it('sorts equal scores by the shorter time', () => {
    const entries = [entry({ score: 100, time: 400 }), entry({ score: 100, time: 300 })];
    expect(rankOf(entries, entry({ score: 100, time: 350 }))).toBe(1);
    expect(rankOf(entries, entry({ score: 100, time: 500 }))).toBe(2);
  });

  it('keeps at most ten entries per board size', () => {
    const storage = memoryStorage();
    const table = loadHighScores(storage);
    for (let i = 0; i < MAX_ENTRIES; ++i) {
      addHighScore(storage, table, '18x8', entry({ score: i * 10 }));
    }
    expect(table['18x8']).toHaveLength(MAX_ENTRIES);
    // the new entry is the best one, the worst one is dropped
    expect(addHighScore(storage, table, '18x8', entry({ score: 1000 }))).toBe(0);
    expect(table['18x8']).toHaveLength(MAX_ENTRIES);
    expect(table['18x8']?.[0]?.score).toBe(1000);
    expect(table['18x8']?.at(-1)?.score).toBe(10);
    // a worse entry does not make it into the list any more
    expect(addHighScore(storage, table, '18x8', entry({ score: 5 }))).toBe(-1);
    expect(table['18x8']).toHaveLength(MAX_ENTRIES);
  });

  it('ignores a malformed storage', () => {
    expect(loadHighScores(memoryStorage())).toEqual({});
    expect(loadHighScores(memoryStorage({ [HIGH_SCORES_KEY]: '{' }))).toEqual({});
    expect(
      loadHighScores(memoryStorage({ [HIGH_SCORES_KEY]: '["nonsense"]' })),
    ).toEqual({});
    expect(
      loadHighScores(
        memoryStorage({
          [HIGH_SCORES_KEY]: JSON.stringify({
            '18x8': [{ name: 'Player' }, { name: 'Other', time: 5, score: 1, gravity: false, date: 'x' }],
          }),
        }),
      )['18x8'],
    ).toHaveLength(1);
  });

  it('survives a storage that refuses to work', () => {
    const broken: HighScoreStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const table = loadHighScores(broken);
    expect(table).toEqual({});
    expect(() => addHighScore(broken, table, '18x8', entry())).not.toThrow();
  });

  it('formats the time of an entry', () => {
    expect(formatHighScoreTime(0)).toBe('00:00');
    expect(formatHighScoreTime(59)).toBe('00:59');
    expect(formatHighScoreTime(300)).toBe('05:00');
    expect(formatHighScoreTime(3600)).toBe('1:00:00');
    expect(formatHighScoreTime(3725)).toBe('1:02:05');
    expect(formatHighScoreTime(-1)).toBe('00:00');
  });
});
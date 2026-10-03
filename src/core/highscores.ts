/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Port of the KGameHighScore storage used by KShisen's high score dialog,
    kept in the browser storage instead of the KDE configuration.

    SPDX-FileCopyrightText: 2006-2007 Matthias Kretz <kretz@kde.org>
    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

/** One finished game, with the fields of KShisen's high score dialog. */
export interface HighScoreEntry {
  /** Player name. */
  name: string;
  /** Playing time in seconds. */
  time: number;
  /** Score as returned by score(). */
  score: number;
  /** Whether gravity was enabled. */
  gravity: boolean;
  /** Date of the game as an ISO 8601 string. */
  date: string;
}

/** All high scores, grouped by board size, e.g. "18x8". */
export type HighScoreTable = Record<string, HighScoreEntry[]>;

/** The key the high scores are stored under. */
export const HIGH_SCORES_KEY = "kshisen-highscores";

/** Number of entries kept per board size. */
export const MAX_ENTRIES = 10;

/** The name used when the player does not enter one. */
export const ANONYMOUS = "Anonymous";

/** The minimal storage interface, so tests do not need a browser. */
export interface HighScoreStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The group name of a board size, as used by KShisen's dialog. */
export function highScoreGroup(x: number, y: number): string {
  return `${x}x${y}`;
}

function isEntry(value: unknown): value is HighScoreEntry {
  const entry = value as Partial<HighScoreEntry> | null;
  return (
    entry !== null &&
    typeof entry === "object" &&
    typeof entry.name === "string" &&
    typeof entry.time === "number" &&
    Number.isFinite(entry.time) &&
    typeof entry.score === "number" &&
    Number.isFinite(entry.score) &&
    typeof entry.gravity === "boolean" &&
    typeof entry.date === "string"
  );
}

function normalizeTable(value: unknown): HighScoreTable {
  const table: HighScoreTable = {};
  if (value === null || typeof value !== "object") {
    return table;
  }
  for (const [group, entries] of Object.entries(value)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    table[group] = sortEntries(entries.filter(isEntry).slice(0, MAX_ENTRIES));
  }
  return table;
}

/** Sorts by score descending and, for equal scores, by the shorter time first. */
export function sortEntries(entries: HighScoreEntry[]): HighScoreEntry[] {
  return [...entries].sort((a, b) => b.score - a.score || a.time - b.time);
}

/** Reads all high scores from the storage, ignoring malformed data. */
export function loadHighScores(storage: HighScoreStorage): HighScoreTable {
  let stored: string | null = null;
  try {
    stored = storage.getItem(HIGH_SCORES_KEY);
  } catch {
    return {};
  }
  if (stored === null || stored === "") {
    return {};
  }
  try {
    return normalizeTable(JSON.parse(stored));
  } catch {
    return {};
  }
}

/** Writes all high scores to the storage, ignoring a storage that is full. */
export function saveHighScores(
  storage: HighScoreStorage,
  table: HighScoreTable,
): void {
  try {
    storage.setItem(HIGH_SCORES_KEY, JSON.stringify(table));
  } catch {
    // A storage that rejects the high scores must not break the game.
  }
}

/**
 * The place an entry would take in the list, or -1 if it does not qualify.
 * Once the list is full, only entries that beat the last one are kept, which
 * is what KGameHighScore::addScore() does.
 */
export function rankOf(entries: HighScoreEntry[], entry: HighScoreEntry): number {
  const rank = sortEntries([...entries, entry]).indexOf(entry);
  if (entries.length < MAX_ENTRIES) {
    return rank;
  }
  const worst = sortEntries(entries).at(MAX_ENTRIES - 1);
  if (worst === undefined) {
    return rank;
  }
  const beatsWorst =
    entry.score > worst.score ||
    (entry.score === worst.score && entry.time < worst.time);
  return beatsWorst ? rank : -1;
}

/**
 * Adds an entry to the table of its board size and stores the table.
 *
 * @return The zero based rank of the new entry, or -1 if it was not kept.
 */
export function addHighScore(
  storage: HighScoreStorage,
  table: HighScoreTable,
  group: string,
  entry: HighScoreEntry,
): number {
  const entries = table[group] ?? [];
  const rank = rankOf(entries, entry);
  if (rank < 0) {
    return -1;
  }
  const updated = sortEntries([...entries, entry]).slice(0, MAX_ENTRIES);
  const next: HighScoreTable = { ...table, [group]: updated };
  saveHighScores(storage, next);
  Object.assign(table, next);
  return rank;
}

/** The playing time as hh:mm:ss, the format of KShisen's time field. */
export function formatHighScoreTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
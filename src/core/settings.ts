/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Port of the KConfigXT generated settings class (Prefs) from KShisen's
    src/kshisen.kcfg, stored in the browser instead of kshisenrc.

    SPDX-FileCopyrightText: 2001-2002 Hans-Joachim Bremer <hans@bremer.org>
    SPDX-FileCopyrightText: 2009-2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import { BOARD_SIZES, REMOVAL_DELAYS, SHUFFLE_PASSES } from "./board";

/** The game options, in the order and with the defaults of kshisen.kcfg. */
export interface Settings {
  /** Name of the tile set to use. */
  tileSet: string;
  /** Name of the background to use. */
  background: string;
  /** Any flower matches any flower, any season matches any season. */
  chineseStyle: boolean;
  /** Tiles may slide, and only two line connections are allowed. */
  tilesCanSlide: boolean;
  /** Only deal solvable games. */
  solvable: boolean;
  /** Warn when the board can no longer be solved. */
  showUnsolvableMessage: boolean;
  /** Let tiles fall into the gaps of their column. */
  gravity: boolean;
  /** Play sounds. */
  sounds: boolean;
  /** Index of the removal speed, see REMOVAL_DELAYS. */
  speed: number;
  /** Index of the board size, see BOARD_SIZES. */
  size: number;
  /** Index of the board difficulty, see SHUFFLE_PASSES. */
  level: number;
}

/** The defaults of kshisen.kcfg, with the bundled tile set and background. */
export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  tileSet: "default",
  background: "default",
  chineseStyle: false,
  tilesCanSlide: false,
  solvable: false,
  showUnsolvableMessage: true,
  gravity: true,
  sounds: true,
  speed: 2,
  size: 2,
  level: 1,
});

/** The key the settings are stored under, mirroring the kshisenrc file name. */
export const SETTINGS_KEY = "kshisenrc";

/** The minimal storage interface, so tests do not need a browser. */
export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The board width in tiles of the given size option. */
export function widthForSize(size: number): number {
  return BOARD_SIZES[clampIndex(size, BOARD_SIZES.length)]!.x;
}

/** The board height in tiles of the given size option. */
export function heightForSize(size: number): number {
  return BOARD_SIZES[clampIndex(size, BOARD_SIZES.length)]!.y;
}

/** The removal delay in ms of the given speed option. */
export function delayForSpeed(speed: number): number {
  return REMOVAL_DELAYS[clampIndex(speed, REMOVAL_DELAYS.length)]!;
}

/** The number of shuffle passes of the given difficulty option. */
export function shufflePassesForLevel(level: number): number {
  return SHUFFLE_PASSES[clampIndex(level, SHUFFLE_PASSES.length)]!;
}

function clampIndex(value: number, length: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(Math.trunc(value), 0), length - 1);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function index(value: unknown, fallback: number, length: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return clampIndex(value, length);
}

function name(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/**
 * Completes and validates a partial settings object, ignoring entries of the
 * wrong type. This is what KConfig does with a hand edited configuration file.
 */
export function normalizeSettings(partial: unknown): Settings {
  const source = (partial ?? {}) as Partial<Record<keyof Settings, unknown>>;
  return {
    tileSet: name(source.tileSet, DEFAULT_SETTINGS.tileSet),
    background: name(source.background, DEFAULT_SETTINGS.background),
    chineseStyle: bool(source.chineseStyle, DEFAULT_SETTINGS.chineseStyle),
    tilesCanSlide: bool(source.tilesCanSlide, DEFAULT_SETTINGS.tilesCanSlide),
    solvable: bool(source.solvable, DEFAULT_SETTINGS.solvable),
    showUnsolvableMessage: bool(
      source.showUnsolvableMessage,
      DEFAULT_SETTINGS.showUnsolvableMessage,
    ),
    gravity: bool(source.gravity, DEFAULT_SETTINGS.gravity),
    sounds: bool(source.sounds, DEFAULT_SETTINGS.sounds),
    speed: index(source.speed, DEFAULT_SETTINGS.speed, REMOVAL_DELAYS.length),
    size: index(source.size, DEFAULT_SETTINGS.size, BOARD_SIZES.length),
    level: index(source.level, DEFAULT_SETTINGS.level, SHUFFLE_PASSES.length),
  };
}

/** Reads the settings from the storage, falling back to the defaults. */
export function loadSettings(storage: SettingsStorage): Settings {
  let stored: string | null = null;
  try {
    stored = storage.getItem(SETTINGS_KEY);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (stored === null || stored === "") {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    return normalizeSettings(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Writes the settings to the storage, ignoring a storage that is full. */
export function saveSettings(storage: SettingsStorage, settings: Settings): void {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
  } catch {
    // A storage that rejects the settings must not break the game.
  }
}
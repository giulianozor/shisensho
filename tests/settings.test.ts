/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Tests for the settings, ported from KShisen's src/kshisen.kcfg

    SPDX-FileCopyrightText: 2001-2002 Hans-Joachim Bremer <hans@bremer.org>
    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  delayForSpeed,
  heightForSize,
  loadSettings,
  normalizeSettings,
  saveSettings,
  shufflePassesForLevel,
  widthForSize,
  type SettingsStorage,
} from '../src/core/settings';

function memoryStorage(initial: Record<string, string> = {}): SettingsStorage {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

describe('Settings', () => {
  it('has the defaults of kshisen.kcfg', () => {
    expect(DEFAULT_SETTINGS.chineseStyle).toBe(false);
    expect(DEFAULT_SETTINGS.tilesCanSlide).toBe(false);
    expect(DEFAULT_SETTINGS.solvable).toBe(false);
    expect(DEFAULT_SETTINGS.showUnsolvableMessage).toBe(true);
    expect(DEFAULT_SETTINGS.gravity).toBe(true);
    expect(DEFAULT_SETTINGS.sounds).toBe(true);
    expect(DEFAULT_SETTINGS.speed).toBe(2);
    expect(DEFAULT_SETTINGS.size).toBe(2);
    expect(DEFAULT_SETTINGS.level).toBe(1);
  });

  it('maps the size option to the board sizes', () => {
    expect([widthForSize(0), heightForSize(0)]).toEqual([14, 6]);
    expect([widthForSize(1), heightForSize(1)]).toEqual([16, 9]);
    expect([widthForSize(2), heightForSize(2)]).toEqual([18, 8]);
    expect([widthForSize(3), heightForSize(3)]).toEqual([24, 12]);
    expect([widthForSize(4), heightForSize(4)]).toEqual([26, 14]);
    expect([widthForSize(5), heightForSize(5)]).toEqual([30, 16]);
  });

  it('clamps the size option to the offered sizes', () => {
    expect([widthForSize(-3), heightForSize(-3)]).toEqual([14, 6]);
    expect([widthForSize(99), heightForSize(99)]).toEqual([30, 16]);
    expect(widthForSize(Number.NaN)).toBe(14);
  });

  it('maps the speed option to the removal delays', () => {
    expect([0, 1, 2, 3, 4].map(delayForSpeed)).toEqual([1000, 750, 500, 250, 125]);
    expect(delayForSpeed(-1)).toBe(1000);
    expect(delayForSpeed(5)).toBe(125);
  });

  it('maps the difficulty option to the shuffle passes', () => {
    expect([0, 1, 2].map(shufflePassesForLevel)).toEqual([1, 5, 9]);
    expect(shufflePassesForLevel(7)).toBe(9);
    expect(shufflePassesForLevel(-7)).toBe(1);
  });

  it('keeps the entries that are of the right type', () => {
    const settings = normalizeSettings({
      gravity: false,
      sounds: false,
      speed: 4,
      size: 0,
      level: 0,
      tileSet: 'egypt',
      chineseStyle: 'yes',
    });
    expect(settings.gravity).toBe(false);
    expect(settings.sounds).toBe(false);
    expect(settings.speed).toBe(4);
    expect(settings.size).toBe(0);
    expect(settings.level).toBe(0);
    expect(settings.tileSet).toBe('egypt');
    expect(settings.chineseStyle).toBe(false);
  });

  it('falls back to the defaults for missing entries', () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ tileSet: '' })).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps out of range entries', () => {
    expect(normalizeSettings({ speed: 12 }).speed).toBe(4);
    expect(normalizeSettings({ size: -12 }).size).toBe(0);
    expect(normalizeSettings({ level: 2.7 }).level).toBe(2);
  });

  it('stores and reads the settings', () => {
    const storage = memoryStorage();
    const settings = { ...DEFAULT_SETTINGS, gravity: false, size: 4 };
    saveSettings(storage, settings);
    expect(loadSettings(storage)).toEqual(settings);
    expect(JSON.parse(storage.getItem(SETTINGS_KEY) ?? '{}').size).toBe(4);
  });

  it('reads the defaults from an empty or broken storage', () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: '{' }))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: '' }))).toEqual(DEFAULT_SETTINGS);
  });

  it('survives a storage that refuses to work', () => {
    const broken: SettingsStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(broken, DEFAULT_SETTINGS)).not.toThrow();
  });
});
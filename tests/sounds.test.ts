/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Tests for choosing the sound format a browser can play

    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import { describe, expect, it } from 'vitest';

import { DEFAULT_SOUNDS, OGG_SOUNDS, supportedSounds } from '../src/render/sounds';

describe('sound formats', () => {
  it('names a file of every sound in every format', () => {
    expect(DEFAULT_SOUNDS.touch).toMatch(/\.m4a$/);
    expect(DEFAULT_SOUNDS.fall).toMatch(/\.m4a$/);
    expect(OGG_SOUNDS.touch).toMatch(/\.ogg$/);
    expect(OGG_SOUNDS.fall).toMatch(/\.ogg$/);
  });

  it('takes the OGG files when the browser plays them', () => {
    expect(supportedSounds(() => true)).toBe(OGG_SOUNDS);
  });

  it('takes the M4A files when the browser does not play OGG', () => {
    expect(supportedSounds(() => false)).toBe(DEFAULT_SOUNDS);
  });
});
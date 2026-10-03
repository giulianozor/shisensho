/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    The sounds of KShisen's board, played when a tile is picked or falls.

    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import fallSound from "../assets/sounds/tile-fall-tile.m4a?url";
import fallOgg from "../assets/sounds/tile-fall-tile.ogg?url";
import touchSound from "../assets/sounds/tile-touch.m4a?url";
import touchOgg from "../assets/sounds/tile-touch.ogg?url";

export interface SoundFiles {
  /** Played on every click on the board. */
  touch: string;
  /** Played for every tile that falls into a gap. */
  fall: string;
}

/** The sounds of KShisen as M4A, the format Safari plays. */
export const DEFAULT_SOUNDS: Readonly<SoundFiles> = Object.freeze({
  touch: touchSound,
  fall: fallSound,
});

/** The same sounds as OGG, which most other browsers prefer. */
export const OGG_SOUNDS: Readonly<SoundFiles> = Object.freeze({
  touch: touchOgg,
  fall: fallOgg,
});

/**
 * The sounds in the format a browser can play. Browsers answer with an empty
 * string for a format they do not know.
 */
export function supportedSounds(
  canPlay: (type: string) => boolean = (type) =>
    new Audio().canPlayType(type) !== "",
): SoundFiles {
  return canPlay('audio/ogg; codecs="vorbis"') ? OGG_SOUNDS : DEFAULT_SOUNDS;
}

/**
 * Plays the sounds of the game.
 *
 * Browsers only allow sound after a user gesture, so the first click on the
 * board unlocks the audio elements.
 */
export class SoundPlayer {
  private readonly touch: HTMLAudioElement;
  private readonly fall: HTMLAudioElement;
  private unlocked = false;

  constructor(files: SoundFiles = supportedSounds()) {
    this.touch = new Audio(files.touch);
    this.fall = new Audio(files.fall);
    for (const audio of [this.touch, this.fall]) {
      audio.preload = "auto";
    }
  }

  /** Whether the sounds may be played. */
  get enabled(): boolean {
    return this.unlocked;
  }

  setEnabled(enabled: boolean): void {
    this.unlocked = enabled;
    if (!enabled) {
      this.touch.pause();
      this.fall.pause();
    }
  }

  /** Starts the sound of a picked up tile. */
  playTouch(): void {
    if (this.unlocked) {
      this.touch.currentTime = 0;
      void this.touch.play().catch(() => {
        // the browser may still refuse, the game continues without sound
      });
    }
  }

  /** Starts the sound of a falling tile. */
  playFall(): void {
    if (this.unlocked) {
      this.fall.currentTime = 0;
      void this.fall.play().catch(() => {
        // the browser may still refuse, the game continues without sound
      });
    }
  }
}
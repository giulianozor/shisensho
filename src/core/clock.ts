/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Port of the KGameTimer based clock used by KShisen.

    SPDX-FileCopyrightText: 2002-2004 Dave Corrie <kde@davecorrie.com>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

export interface GameClockOptions {
  /** Injectable time source, in milliseconds; defaults to Date.now. */
  now?: () => number;
}

/**
 * Counts the playing time of a game. The clock starts on restart(), is stopped
 * when the game is over, and can be paused and resumed independently.
 */
export class GameClock {
  private readonly now: () => number;
  private paused = false;
  private pauseTime = 0;
  private start = 0;
  private running = false;

  constructor(options: GameClockOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  restart(): void {
    this.start = this.now();
    this.running = true;
    this.paused = false;
  }

  pause(): void {
    if (this.running && !this.paused) {
      this.pauseTime = this.now();
      this.paused = true;
    }
  }

  resume(): void {
    if (this.running && this.paused) {
      this.start += this.now() - this.pauseTime;
      this.paused = false;
    }
  }

  isRunning(): boolean {
    return this.running && !this.paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Elapsed time in seconds, excluding the paused periods. */
  seconds(): number {
    if (!this.running) {
      return 0;
    }
    const end = this.paused ? this.pauseTime : this.now();
    return (end - this.start) / 1000;
  }

  /** Elapsed time formatted as H:MM:SS or MM:SS. */
  toString(): string {
    const total = Math.max(0, Math.floor(this.seconds()));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
    const ss = String(secs).padStart(2, "0");
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
  }
}

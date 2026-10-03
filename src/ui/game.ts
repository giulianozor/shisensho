/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    The main window of KShisen's src/app.cpp: the actions, the status bar and
    the wiring between the board and the user interface.

    SPDX-FileCopyrightText: 1997 Mario Weilguni <mweilguni@sime.com>
    SPDX-FileCopyrightText: 2002-2004 Dave Corrie <kde@davecorrie.com>
    SPDX-FileCopyrightText: 2009-2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import { Board } from "../core/board";
import {
  ANONYMOUS,
  addHighScore,
  formatHighScoreTime,
  highScoreGroup,
  loadHighScores,
  rankOf,
  type HighScoreEntry,
  type HighScoreTable,
} from "../core/highscores";
import { score } from "../core/score";
import {
  delayForSpeed,
  heightForSize,
  loadSettings,
  saveSettings,
  shufflePassesForLevel,
  widthForSize,
  type Settings,
  type SettingsStorage,
} from "../core/settings";
import { findBackground, findTileset } from "../render/catalog";
import { BoardRenderer } from "../render/renderer";
import { SoundPlayer } from "../render/sounds";
import { TileSheet } from "../render/tileset";
import {
  openHelpDialog,
  openHighScoreDialog,
  openMessageDialog,
  openNameDialog,
  openSettingsDialog,
} from "./dialogs";

const TIPS = {
  selectATile: "Select a tile",
  selectAMatchingTile: "Select a matching tile",
  selectAMove: "Select the move you want by clicking on the blue line",
  tilesDoNotMatch: "This tile did not match the one you selected",
  invalidMove: "You cannot make this move",
} as const;

/**
 * Movement in pixels above which a pointer gesture counts as a drag instead
 * of a click. Dragging the page or pinching to zoom must not select or
 * unselect a tile.
 */
const DRAG_THRESHOLD = 8;

/**
 * How long a touch has to be held on a tile before it counts as a long tap
 * and highlights the matching tiles, the touch alternative to a right click.
 */
const LONG_PRESS_DELAY = 500;

interface Actions {
  newGame: HTMLButtonElement;
  restart: HTMLButtonElement;
  undo: HTMLButtonElement;
  redo: HTMLButtonElement;
  hint: HTMLButtonElement;
  pause: HTMLButtonElement;
  sounds: HTMLButtonElement;
  settings: HTMLButtonElement;
  highScores: HTMLButtonElement;
  help: HTMLButtonElement;
}

interface StatusBar {
  tip: HTMLElement;
  time: HTMLElement;
  tiles: HTMLElement;
  cheat: HTMLElement;
}

/** The default shortcuts of the actions of KShisen. */
export const SHORTCUTS: Readonly<Record<string, string>> = Object.freeze({
  newGame: "Control+n",
  restart: "F5",
  undo: "Control+z",
  redo: "Control+Shift+z",
  hint: "Control+h",
  pause: "Control+p",
  settings: "Control+comma",
  highScores: "Control+Shift+h",
  help: "F1",
});

/** The main window: a board, a renderer and the actions around them. */
export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly actions: Actions;
  private readonly status: StatusBar;
  private readonly storage: SettingsStorage;
  private readonly board: Board;
  private readonly renderer: BoardRenderer;
  private readonly sounds: SoundPlayer;
  private readonly sheets = new Map<string, TileSheet>();

  private settings: Settings;
  private highScores: HighScoreTable;
  private removalTimer = 0;
  private ready = false;

  constructor(root: HTMLElement, options: { storage?: SettingsStorage } = {}) {
    this.storage = options.storage ?? window.localStorage;
    this.settings = loadSettings(this.storage);
    this.highScores = loadHighScores(this.storage);

    const canvas = root.querySelector<HTMLCanvasElement>("#board");
    if (canvas === null) {
      throw new Error("missing canvas");
    }
    this.canvas = canvas;
    this.actions = {
      newGame: root.querySelector<HTMLButtonElement>("[data-action=new-game]")!,
      restart: root.querySelector<HTMLButtonElement>("[data-action=restart]")!,
      undo: root.querySelector<HTMLButtonElement>("[data-action=undo]")!,
      redo: root.querySelector<HTMLButtonElement>("[data-action=redo]")!,
      hint: root.querySelector<HTMLButtonElement>("[data-action=hint]")!,
      pause: root.querySelector<HTMLButtonElement>("[data-action=pause]")!,
      sounds: root.querySelector<HTMLButtonElement>("[data-action=sounds]")!,
      settings: root.querySelector<HTMLButtonElement>(
        "[data-action=settings]",
      )!,
      highScores: root.querySelector<HTMLButtonElement>(
        "[data-action=high-scores]",
      )!,
      help: root.querySelector<HTMLButtonElement>("[data-action=help]")!,
    };
    this.status = {
      tip: root.querySelector<HTMLElement>("#tip")!,
      time: root.querySelector<HTMLElement>("#time")!,
      tiles: root.querySelector<HTMLElement>("#tiles")!,
      cheat: root.querySelector<HTMLElement>("#cheat")!,
    };

    this.board = new Board({
      width: widthForSize(this.settings.size),
      height: heightForSize(this.settings.size),
      gravity: this.settings.gravity,
      solvable: this.settings.solvable,
      showUnsolvableMessage: this.settings.showUnsolvableMessage,
      chineseStyle: this.settings.chineseStyle,
      tilesCanSlide: this.settings.tilesCanSlide,
      shuffle: shufflePassesForLevel(this.settings.level),
      delay: delayForSpeed(this.settings.speed),
      observer: {
        changed: this.whenReady(() => {
          this.updateItems();
          this.paint();
        }),
        tileCountChanged: this.whenReady(() => {
          this.updateTileDisplay();
        }),
        endOfGame: this.whenReady(() => {
          void this.endOfGame();
        }),
        cheatStatusChanged: this.whenReady(() => {
          this.updateCheatDisplay();
        }),
        selectATile: this.whenReady(() => {
          this.showTip(TIPS.selectATile);
        }),
        selectAMatchingTile: this.whenReady(() => {
          this.showTip(TIPS.selectAMatchingTile);
        }),
        selectAMove: this.whenReady(() => {
          this.showTip(TIPS.selectAMove);
        }),
        tilesDoNotMatch: this.whenReady(() => {
          this.showTip(TIPS.tilesDoNotMatch);
        }),
        invalidMove: this.whenReady(() => {
          this.showTip(TIPS.invalidMove);
        }),
        tileFell: this.whenReady(() => {
          this.sounds.playFall();
        }),
      },
    });
    this.renderer = new BoardRenderer(this.canvas, this.board);
    this.sounds = new SoundPlayer();

    this.setupActions();
    this.setupShortcuts();
    this.setupPointer();

    window.addEventListener("resize", () => {
      this.paint();
    });
    window.setInterval(() => {
      this.updateTimeDisplay();
    }, 1000);

    this.ready = true;
  }

  /**
   * The board reports changes while it is being built, before the renderer and
   * the sounds are there, so those changes are ignored until the game is ready.
   */
  private whenReady(action: () => void): () => void {
    return (): void => {
      if (this.ready) {
        action();
      }
    };
  }

  /** Loads the tile set and the background, then shows the first game. */
  async start(): Promise<void> {
    await this.loadAssets(this.settings);
    this.newGame();
    this.paint();
  }

  /** The settings the game was started with. */
  currentSettings(): Settings {
    return { ...this.settings };
  }

  private async loadAssets(settings: Settings): Promise<void> {
    const tileset = findTileset(settings.tileSet);
    let sheet = this.sheets.get(settings.tileSet);
    if (sheet === undefined) {
      sheet = await TileSheet.load(await tileset.load());
      await sheet.prepare();
      this.sheets.set(settings.tileSet, sheet);
    }
    this.renderer.setSheet(sheet);
    this.renderer.setMetrics(tileset.metrics);

    const background = findBackground(settings.background);
    if (background.plain || background.load === undefined) {
      this.renderer.setBackground(null);
      return;
    }
    const image = await loadImage(await background.load());
    this.renderer.setBackground({
      image,
      tiled: background.tiled,
      tileWidth: background.tileWidth,
      tileHeight: background.tileHeight,
    });
  }

  private setupActions(): void {
    const run = (action: () => void) => (): void => {
      action();
    };
    this.actions.newGame.onclick = run(() => {
      this.newGame();
    });
    this.actions.restart.onclick = run(() => {
      this.restartGame();
    });
    this.actions.undo.onclick = run(() => {
      this.undo();
    });
    this.actions.redo.onclick = run(() => {
      this.redo();
    });
    this.actions.hint.onclick = run(() => {
      this.hint();
    });
    this.actions.pause.onclick = run(() => {
      this.togglePause();
    });
    this.actions.sounds.onclick = run(() => {
      this.settings.sounds = !this.settings.sounds;
      this.sounds.setEnabled(this.settings.sounds);
      this.actions.sounds.setAttribute(
        "aria-pressed",
        String(this.settings.sounds),
      );
      saveSettings(this.storage, this.settings);
    });
    this.actions.settings.onclick = run(() => {
      void this.showSettingsDialog();
    });
    this.actions.highScores.onclick = run(() => {
      this.showHighScores();
    });
    if (this.actions.help) {
      this.actions.help.onclick = run(() => {
        this.showHelp();
      });
    }

    this.actions.sounds.setAttribute(
      "aria-pressed",
      String(this.settings.sounds),
    );
    this.sounds.setEnabled(this.settings.sounds);
  }

  private setupShortcuts(): void {
    window.addEventListener("keydown", (event) => {
      if (event.target instanceof HTMLInputElement) {
        return;
      }
      const parts = `${event.ctrlKey || event.metaKey ? "control+" : ""}${
        event.shiftKey ? "shift+" : ""
      }${event.key.toLowerCase()}`;
      const match = Object.entries(SHORTCUTS).find(
        ([, shortcut]) => shortcut.toLowerCase() === parts,
      );
      if (match === undefined) {
        return;
      }
      event.preventDefault();
      switch (match[0]) {
        case "newGame":
          this.newGame();
          break;
        case "restart":
          this.restartGame();
          break;
        case "undo":
          this.undo();
          break;
        case "redo":
          this.redo();
          break;
        case "hint":
          this.hint();
          break;
        case "pause":
          this.togglePause();
          break;
        case "settings":
          void this.showSettingsDialog();
          break;
        case "highScores":
          this.showHighScores();
          break;
        case "help":
          this.showHelp();
          break;
      }
    });
  }

  private setupPointer(): void {
    // The click is handled on pointerup so that a drag or a pinch (panning or
    // zooming the page) does not select or unselect a tile.
    let activePointer: number | null = null;
    let startX = 0;
    let startY = 0;
    let dragged = false;
    let longPressed = false;
    let longPressTimer = 0;

    const cancelLongPress = (): void => {
      if (longPressTimer !== 0) {
        window.clearTimeout(longPressTimer);
        longPressTimer = 0;
      }
    };

    const performClick = (
      clientX: number,
      clientY: number,
      button: "left" | "right",
    ): void => {
      const rect = this.canvas.getBoundingClientRect();
      const point = { x: clientX - rect.left, y: clientY - rect.top };
      const position = this.renderer.positionAt(point);
      if (button === "left") {
        this.sounds.playTouch();
      }
      const outcome = this.board.click(position, button);
      this.paint();
      if (outcome.kind === "moved" || outcome.kind === "choose-move") {
        this.scheduleRemoval();
      }
    };

    this.canvas.addEventListener("pointerdown", (event) => {
      // the first gesture of the user allows the sounds to play
      if (this.settings.sounds) {
        this.sounds.setEnabled(true);
      }
      // A second pointer means a pinch gesture; do not treat it as a click.
      if (activePointer !== null) {
        dragged = true;
        cancelLongPress();
        return;
      }
      activePointer = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      dragged = false;
      longPressed = false;
      // Holding a touch on a tile highlights the matching tiles, the touch
      // alternative to a right click.
      if (event.pointerType !== "mouse" && event.button === 0) {
        longPressTimer = window.setTimeout(() => {
          longPressTimer = 0;
          longPressed = true;
          performClick(startX, startY, "right");
        }, LONG_PRESS_DELAY);
      }
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (event.pointerId !== activePointer) {
        return;
      }
      if (
        Math.abs(event.clientX - startX) > DRAG_THRESHOLD ||
        Math.abs(event.clientY - startY) > DRAG_THRESHOLD
      ) {
        dragged = true;
        cancelLongPress();
      }
    });

    const endPointer = (event: PointerEvent, cancelled: boolean): void => {
      if (event.pointerId !== activePointer) {
        return;
      }
      cancelLongPress();
      const wasDragged = dragged;
      const wasLongPress = longPressed;
      activePointer = null;
      dragged = false;
      longPressed = false;
      if (cancelled || wasDragged || wasLongPress) {
        return;
      }
      performClick(
        event.clientX,
        event.clientY,
        event.button === 2 ? "right" : "left",
      );
    };

    this.canvas.addEventListener("pointerup", (event) => {
      endPointer(event, false);
    });
    this.canvas.addEventListener("pointercancel", (event) => {
      endPointer(event, true);
    });
    this.canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
  }

  /** Removes the connected tiles after the configured delay. */
  private scheduleRemoval(): void {
    window.clearTimeout(this.removalTimer);
    const outcome = this.board.pendingRemoval();
    if (!outcome) {
      return;
    }
    this.removalTimer = window.setTimeout(() => {
      this.board.finishConnection();
      this.paint();
    }, this.board.delay());
  }

  private newGame(): void {
    this.board.newGame();
    this.setCheatMode(false);
    this.board.setPauseEnabled(false);
    this.updateItems();
    this.updateTileDisplay();
    this.showTip(TIPS.selectATile);
    this.paint();
  }

  private restartGame(): void {
    while (this.board.canUndo()) {
      this.board.undo();
    }
    this.board.resetRedo();
    this.board.resetTimer();
    this.setCheatMode(false);
    this.board.setGameOverEnabled(false);
    this.board.setGameStuckEnabled(false);
    this.updateItems();
    this.updateTileDisplay();
    this.paint();
  }

  private undo(): void {
    if (!this.board.canUndo()) {
      return;
    }
    this.board.undo();
    this.setCheatMode(true);
    // a stuck game can be continued by undoing a move
    this.board.setGameStuckEnabled(false);
    this.updateItems();
    this.updateTileDisplay();
    this.paint();
  }

  private redo(): void {
    if (!this.board.canRedo()) {
      return;
    }
    this.board.redo();
    this.updateItems();
    this.updateTileDisplay();
    this.paint();
  }

  private hint(): void {
    if (this.board.isOver() || this.board.isPaused() || this.board.isStuck()) {
      return;
    }
    this.board.showHint();
    this.setCheatMode(true);
    this.updateItems();
    this.paint();
  }

  private togglePause(): void {
    if (this.board.isOver() || this.board.isStuck()) {
      return;
    }
    this.board.setPauseEnabled(!this.board.isPaused());
    this.updateItems();
    this.paint();
  }

  private setCheatMode(enabled: boolean): void {
    this.board.setCheatModeEnabled(enabled);
    this.updateCheatDisplay();
  }

  private async endOfGame(): Promise<void> {
    if (this.board.tilesLeft() > 0) {
      this.board.setGameStuckEnabled(true);
      this.updateItems();
      this.paint();
      return;
    }

    const dialog = document.querySelector<HTMLDialogElement>("#message-dialog");
    if (dialog === null) {
      return;
    }
    const time = this.board.currentTime();
    const timeString = formatHighScoreTime(time);
    if (this.board.hasCheated()) {
      openMessageDialog(
        dialog,
        "End of Game",
        "You could have been in the high scores\nif you did not use Undo or Hint.\nTry without them next time.",
      );
      this.updateItems();
      this.paint();
      return;
    }

    const group = highScoreGroup(this.board.xTiles(), this.board.yTiles());
    const entry: HighScoreEntry = {
      name: ANONYMOUS,
      time,
      score: score(
        this.board.xTiles(),
        this.board.yTiles(),
        time,
        this.board.gravityFlag(),
      ),
      gravity: this.board.gravityFlag(),
      date: new Date().toISOString(),
    };
    const rank = rankOf(this.highScores[group] ?? [], entry);
    if (rank < 0) {
      openMessageDialog(dialog, "End of Game", `You made it in ${timeString}`);
      this.updateItems();
      this.paint();
      return;
    }

    const nameDialog =
      document.querySelector<HTMLDialogElement>("#name-dialog");
    const name =
      nameDialog === null
        ? ANONYMOUS
        : await openNameDialog(nameDialog, group, rank);
    entry.name = name ?? ANONYMOUS;
    addHighScore(this.storage, this.highScores, group, entry);
    this.showHighScores();
    this.updateItems();
    this.paint();
  }

  private showHighScores(): void {
    const dialog =
      document.querySelector<HTMLDialogElement>("#high-score-dialog");
    if (dialog === null) {
      return;
    }
    const group = highScoreGroup(this.board.xTiles(), this.board.yTiles());
    openHighScoreDialog(dialog, group, this.highScores);
  }

  private showHelp(): void {
    const dialog = document.querySelector<HTMLDialogElement>("#help-dialog");
    if (dialog === null) {
      return;
    }
    openHelpDialog(dialog);
  }

  private async showSettingsDialog(): Promise<void> {
    const dialog =
      document.querySelector<HTMLDialogElement>("#settings-dialog");
    if (dialog === null) {
      return;
    }
    const settings = await openSettingsDialog(dialog, this.settings);
    if (settings === null) {
      return;
    }
    this.settings = settings;
    saveSettings(this.storage, this.settings);
    await this.loadAssets(this.settings);
    this.board.setGravityFlag(this.settings.gravity);
    this.board.setSolvableFlag(this.settings.solvable);
    this.board.setShowUnsolvableMessageFlag(
      this.settings.showUnsolvableMessage,
    );
    this.board.setChineseStyleFlag(this.settings.chineseStyle);
    this.board.setTilesCanSlideFlag(this.settings.tilesCanSlide);
    this.board.setShufflePasses(shufflePassesForLevel(this.settings.level));
    this.board.setDelay(delayForSpeed(this.settings.speed));
    this.board.setSize(
      widthForSize(this.settings.size),
      heightForSize(this.settings.size),
    );
    this.setCheatMode(false);
    this.board.setPauseEnabled(false);
    this.board.newGame();
    this.sounds.setEnabled(this.settings.sounds);
    this.actions.sounds.setAttribute(
      "aria-pressed",
      String(this.settings.sounds),
    );
    this.updateItems();
    this.updateTileDisplay();
    this.paint();
  }

  private showTip(tip: string): void {
    this.status.tip.textContent = tip;
  }

  private updateItems(): void {
    const board = this.board;
    if (board.isOver()) {
      this.setEnabled(this.actions.undo, false);
      this.setEnabled(this.actions.redo, false);
      this.setEnabled(this.actions.pause, false);
      this.setEnabled(this.actions.hint, false);
      return;
    }
    if (board.isPaused()) {
      this.setEnabled(this.actions.undo, false);
      this.setEnabled(this.actions.redo, false);
      this.setEnabled(this.actions.restart, false);
      this.setEnabled(this.actions.hint, false);
      this.actions.pause.setAttribute("aria-pressed", "true");
      return;
    }
    if (board.isStuck()) {
      this.setEnabled(this.actions.pause, false);
      this.setEnabled(this.actions.hint, false);
    } else {
      this.setEnabled(this.actions.pause, true);
      this.setEnabled(this.actions.hint, true);
      this.actions.pause.setAttribute("aria-pressed", "false");
    }
    this.setEnabled(this.actions.undo, board.canUndo());
    this.setEnabled(this.actions.redo, board.canRedo());
    this.setEnabled(this.actions.restart, board.canUndo());
  }

  private setEnabled(button: HTMLButtonElement, enabled: boolean): void {
    button.disabled = !enabled;
  }

  private updateTimeDisplay(): void {
    const board = this.board;
    if (board.isStuck() || board.isOver()) {
      return;
    }
    this.status.time.textContent = `Your time: ${formatHighScoreTime(board.currentTime())}${
      board.isPaused() ? " (Paused) " : ""
    }`;
  }

  private updateTileDisplay(): void {
    const total = this.board.tiles();
    this.status.tiles.textContent = `Removed: ${total - this.board.tilesLeft()}/${total}`;
  }

  private updateCheatDisplay(): void {
    this.status.cheat.hidden = !this.board.hasCheated();
  }

  private paint(): void {
    this.renderer.resize();
    this.renderer.paint();
  }
}

async function loadImage(url: string): Promise<CanvasImageSource | null> {
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game

    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import "./styles.css";
import { Game } from "./ui/game";

const root = document.querySelector<HTMLElement>("#app");
if (root === null) {
  throw new Error("missing application root");
}

const game = new Game(root);
game.start().catch((error: unknown) => {
  // the game cannot start without its tiles, e.g. when the build is broken
  const status = document.querySelector<HTMLElement>("#tip");
  if (status !== null) {
    status.textContent =
      error instanceof Error ? `Error: ${error.message}` : "Error: could not start";
  }
  throw error;
});
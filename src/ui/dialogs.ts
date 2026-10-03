/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    The dialogs of KShisen's src/app.cpp: the settings dialog with the pages of
    src/settings.ui, the high score dialog and the end of game message.

    SPDX-FileCopyrightText: 2001-2002 Hans-Joachim Bremer <hans@bremer.org>
    SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import { BOARD_SIZES, REMOVAL_DELAYS, SHUFFLE_PASSES } from "../core/board";
import {
  ANONYMOUS,
  formatHighScoreTime,
  type HighScoreEntry,
  type HighScoreTable,
} from "../core/highscores";
import { normalizeSettings, type Settings } from "../core/settings";
import { BACKGROUNDS, TILESETS } from "../render/catalog";

function element<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (found === null) {
    throw new Error(`missing element ${selector}`);
  }
  return found;
}

function show(dialog: HTMLDialogElement): void {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function close(dialog: HTMLDialogElement): void {
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
    dialog.dispatchEvent(new Event("close"));
  }
}

const SIZE_LABELS = BOARD_SIZES.map((size) => `${size.x}x${size.y}`);

/** The texts and tooltips of KShisen's settings dialog. */
const OPTION_TEXTS = {
  gravity: {
    label: "Gravity",
    help: "Checking this makes the game even harder: If a tile is removed, all tiles lying above it will fall down one step.",
  },
  solvable: {
    label: "Create solvable games only",
    help: "If checked, you will only be presented with games that are possible to solve. Note: Even in solvable games you can fail to complete if you remove the tiles in the wrong order.",
  },
  showUnsolvableMessage: {
    label: "Show message if board can no longer be solved",
    help: "Checking this makes the game show a message to abort the game in case there are no possible moves left to win the game.",
  },
  chineseStyle: {
    label:
      "Use Chinese style: any flower match any flower, any season match any season",
    help: "Use the traditional rules for matching the tiles. Previous version of the game used to allow only exact tiles matches, which is inconsistent with Mah-jongg rules. It is recommended to keep this option checked.",
  },
  tilesCanSlide: {
    label: "Tiles can slide out of the way, and connect with 2 lines instead of 3",
    help: "This option changes two rules at once. Sliding means that when the way between two matching tiles is blocked, the tiles standing in the way move along their row or column into the empty space at its end, so that the way becomes free and the tiles can be matched. And two matching tiles only have to be connected by two lines, that is by a single corner, instead of the customary three. Tiles are only slid when the way is blocked, never to make a shortcut. If more than one connection is possible, click on one of the blue lines to choose the one you prefer. The hint marks the two tiles to click; when their way is blocked it also marks the tiles that slide first, so the drawn line is not free yet.",
  },
} as const;

type OptionKey = keyof typeof OPTION_TEXTS;

/** Builds the option rows of the settings dialog. */
export function renderSettingsForm(
  container: HTMLElement,
  settings: Settings,
  onChange: (settings: Settings) => void,
): void {
  const controls = new Map<OptionKey, HTMLInputElement>();
  const sliders = new Map<
    string,
    { input: HTMLInputElement; value: HTMLElement }
  >();

  container.textContent = "";
  const form = document.createElement("form");
  form.method = "dialog";

  const addSelect = (
    name: string,
    title: string,
    help: string,
    options: readonly { id: string; name: string }[],
    value: string,
  ): void => {
    const row = document.createElement("label");
    row.className = "option";
    row.title = help;
    const label = document.createElement("span");
    label.textContent = title;
    const select = document.createElement("select");
    select.name = name;
    for (const option of options) {
      const item = document.createElement("option");
      item.value = option.id;
      item.textContent = option.name;
      item.selected = option.id === value;
      select.append(item);
    }
    select.addEventListener("change", () => {
      onChange({ ...settings, [name]: select.value });
    });
    row.append(label, select);
    form.append(row);
  };

  addSelect(
    "tileSet",
    "Tile set",
    "Choose the artwork of the tiles.",
    TILESETS,
    settings.tileSet,
  );
  addSelect(
    "background",
    "Background",
    "Choose the background of the playing area.",
    BACKGROUNDS,
    settings.background,
  );

  for (const [key, text] of Object.entries(OPTION_TEXTS) as [
    OptionKey,
    (typeof OPTION_TEXTS)[OptionKey],
  ][]) {
    const row = document.createElement("label");
    row.className = "option";
    row.title = text.help;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = key;
    input.checked = settings[key];
    input.addEventListener("change", () => {
      onChange({ ...settings, [key]: input.checked });
    });
    const label = document.createElement("span");
    label.textContent = text.label;
    row.append(input, label);
    form.append(row);
    controls.set(key, input);
  }

  const addSlider = (
    name: string,
    title: string,
    help: string,
    maximum: number,
    current: number,
    ticks: string[],
  ): void => {
    const field = document.createElement("div");
    field.className = "slider";
    field.title = help;
    const heading = document.createElement("span");
    heading.className = "slider-title";
    heading.textContent = title;
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = String(maximum);
    input.step = "1";
    input.value = String(current);
    input.name = name;
    const value = document.createElement("span");
    value.className = "slider-value";
    const labels = document.createElement("span");
    labels.className = "slider-ticks";
    for (const tick of ticks) {
      const span = document.createElement("span");
      span.textContent = tick;
      labels.append(span);
    }
    const update = (notify: boolean): void => {
      value.textContent = ticks[Number(input.value)] ?? input.value;
      if (notify) {
        onChange({ ...settings, [name]: Number(input.value) });
      }
    };
    input.addEventListener("input", () => {
      update(true);
    });
    update(false);
    field.append(heading, input, value, labels);
    form.append(field);
    sliders.set(name, { input, value });
  };

  addSlider(
    "level",
    "Board Difficulty",
    "The slider controls the difficulty of the board from Easy to Hard.",
    SHUFFLE_PASSES.length - 1,
    settings.level,
    ["Easy", "Medium", "Hard"],
  );
  addSlider(
    "speed",
    "Piece Removal Speed",
    "Adjusting this slider alters the speed at which the pieces are removed from the screen after a match has been made.",
    REMOVAL_DELAYS.length - 1,
    settings.speed,
    ["Slow", "", "Normal", "", "Fast"],
  );
  addSlider(
    "size",
    "Board Size",
    "This slider allows you to change the number of tiles on the board. The more tiles you have, the harder (and longer) the game will be.",
    BOARD_SIZES.length - 1,
    settings.size,
    SIZE_LABELS,
  );

  container.append(form);
}

/** Opens the settings dialog and returns the changed settings, or null. */
export function openSettingsDialog(
  dialog: HTMLDialogElement,
  settings: Settings,
): Promise<Settings | null> {
  return new Promise((resolve) => {
    let cancelled = false;
    let settled = false;
    const settle = (confirmed: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(
        confirmed
          ? normalizeSettings(readSettingsForm(dialog, settings))
          : null,
      );
    };
    renderSettingsForm(element(dialog, ".dialog-body"), settings, () => {
      // the settings are read from the form when the dialog is closed
    });
    element<HTMLButtonElement>(dialog, "[data-action=cancel]").onclick = () => {
      cancelled = true;
      settle(false);
      close(dialog);
    };
    element<HTMLButtonElement>(dialog, "[data-action=confirm]").onclick = () => {
      settle(!cancelled);
      close(dialog);
    };
    element<HTMLFormElement>(dialog, "form").addEventListener("submit", (event) => {
      event.preventDefault();
      settle(!cancelled);
      close(dialog);
    });
    dialog.addEventListener("close", () => settle(!cancelled), { once: true });
    show(dialog);
    // avoid focusing the first control (tileset dropdown) which may auto-open
    element<HTMLButtonElement>(dialog, "[data-action=cancel]").focus();
  });
}

/** Reads the settings the user chose in the settings dialog. */
export function readSettingsForm(
  dialog: HTMLDialogElement,
  fallback: Settings,
): Settings {
  const form = element<HTMLFormElement>(dialog, "form");
  const data = new FormData(form);
  const read = (name: string, fallbackValue: number): number => {
    const value = data.get(name);
    const parsed = Number(value);
    return value === null || Number.isNaN(parsed) ? fallbackValue : parsed;
  };
  const text = (
    entry: FormDataEntryValue | null,
    fallbackValue: string,
  ): string =>
    typeof entry === "string" && entry.length > 0 ? entry : fallbackValue;
  return normalizeSettings({
    ...fallback,
    tileSet: text(data.get("tileSet"), fallback.tileSet),
    background: text(data.get("background"), fallback.background),
    gravity: data.get("gravity") !== null,
    solvable: data.get("solvable") !== null,
    showUnsolvableMessage: data.get("showUnsolvableMessage") !== null,
    chineseStyle: data.get("chineseStyle") !== null,
    tilesCanSlide: data.get("tilesCanSlide") !== null,
    level: read("level", fallback.level),
    speed: read("speed", fallback.speed),
    size: read("size", fallback.size),
  });
}

/** The rows of a high score table. */
export function renderHighScoreTable(
  container: HTMLElement,
  entries: readonly HighScoreEntry[],
): void {
  container.textContent = "";
  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No games recorded yet.";
    container.append(empty);
    return;
  }
  const table = document.createElement("table");
  const head = document.createElement("tr");
  for (const heading of ["#", "Name", "Score", "Time", "Gravity", "Date"]) {
    const cell = document.createElement("th");
    cell.textContent = heading;
    head.append(cell);
  }
  table.append(head);
  entries.forEach((entry, index) => {
    const row = document.createElement("tr");
    const cells = [
      String(index + 1),
      entry.name === "" ? ANONYMOUS : entry.name,
      String(entry.score),
      formatHighScoreTime(entry.time),
      entry.gravity ? "Yes" : "No",
      entry.date.slice(0, 10),
    ];
    for (const value of cells) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    table.append(row);
  });
  container.append(table);
}

/** Opens the high score dialog of one board size. */
export function openHighScoreDialog(
  dialog: HTMLDialogElement,
  group: string,
  table: HighScoreTable,
): void {
  element(dialog, ".dialog-title").textContent = `High Scores - ${group}`;
  renderHighScoreTable(element(dialog, ".dialog-body"), table[group] ?? []);
  element<HTMLButtonElement>(dialog, "[data-action=close]").onclick = () => {
    close(dialog);
  };
  show(dialog);
}

/** Asks for the name of a player who reached the high scores. */
export function openNameDialog(
  dialog: HTMLDialogElement,
  group: string,
  rank: number,
): Promise<string | null> {
  element(dialog, ".dialog-title").textContent = "Congratulations!";
  const body = element(dialog, ".dialog-body");
  body.textContent = "";
  const form = document.createElement("form");
  form.method = "dialog";
  const message = document.createElement("p");
  message.textContent = `You made it into the hall of fame of ${group}, at place ${rank + 1}.`;
  const input = document.createElement("input");
  input.type = "text";
  input.name = "name";
  input.maxLength = 32;
  input.placeholder = ANONYMOUS;
  form.append(message, input);
  body.append(form);
  element<HTMLButtonElement>(dialog, "[data-action=confirm]").onclick = () => {
    close(dialog);
  };
  return new Promise((resolve) => {
    dialog.addEventListener(
      "close",
      () => {
        const name = (new FormData(form).get("name") ?? "").toString().trim();
        resolve(name === "" ? ANONYMOUS : name);
      },
      { once: true },
    );
    show(dialog);
  });
}

/** Shows a message with an OK button. */
export function openMessageDialog(
  dialog: HTMLDialogElement,
  title: string,
  message: string,
): void {
  element(dialog, ".dialog-title").textContent = title;
  const body = element(dialog, ".dialog-body");
  body.textContent = "";
  for (const line of message.split("\n")) {
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    body.append(paragraph);
  }
  element<HTMLButtonElement>(dialog, "[data-action=close]").onclick = () => {
    close(dialog);
  };
  show(dialog);
}

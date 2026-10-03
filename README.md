# Shisen-sho

A web port of [KShisen](https://apps.kde.org/kshisen), the Shisen-Sho
Mahjongg game of the KDE Games project. It plays in a browser, needs no server
and no installation, and works on a desktop as well as on a phone.

Play the latest version of the game at
<https://giulianozor.github.io/shisensho/>.

The game follows the original rules: two tiles of the same kind can be removed
when they are connected by a line that does not cross other tiles, tiles fall
down when gravity is on, and a board is only dealt when it can be solved.

## Playing

- Click a tile and then its partner to remove the pair.
- Right click a tile to mark it: all tiles of the same kind are then shown
  with the marked drawing, which helps to find a partner on a full board.
- Remove two tiles of the same kind when they are connected by a line that does
  not cross other tiles. With `Tiles can slide` on in the settings, a tile that
  blocks the way can also slide into the empty space at the end of its row or
  column to clear it.
- Click the hint button to have the game mark a pair that can be removed. If
  the pair needs a slide, the hint marks the tiles that slide first as well.
- The toolbar holds new game, restart, undo, redo, hint, pause, sounds,
  settings, high scores and help. The help button (`F1`) opens a dialog that
  explains the rules. The keyboard shortcuts are shown in the tooltips
  (`Ctrl+N`, `F5`, `Ctrl+Z`, `Ctrl+Shift+Z`, `Ctrl+H`, `Ctrl+P`, `Ctrl+,`,
  `Ctrl+Shift+H`, `F1`).
- The high score of the finished game is asked for and stored in the browser.
  Settings and high scores are stored as well, so they survive a reload.

## Settings

The settings dialog has a page for the board, a page for the appearance and a
page for the tile set. Every option explains itself in its tooltip.

### Board

- **Gravity** — makes the game harder: when a tile is removed, all tiles above
  it fall down one step.
- **Create solvable games only** — only deals boards that can actually be
  solved. Even a solvable board can be lost by removing the tiles in the wrong
  order.
- **Show message if board can no longer be solved** — the game offers to end
  the game when no move is left that could still win it.
- **Tiles can slide out of the way, and connect with 2 lines instead of 3** —
  changes two rules at once. *Sliding* means that when the way between two
  matching tiles is blocked, the tiles standing in the way move along their row
  or column into the empty space at its end, so that the way becomes free and
  the pair can be removed. Two matching tiles then only need two lines, that is
  a single corner, instead of the customary three. Tiles are only slid when the
  way is blocked, never to make a shortcut. If more than one connection is
  possible, click on one of the blue lines to pick the one you prefer.
  With sliding on, a connection that needs a slide is drawn as a dashed line:
  the dashes are the part of the way that still has to be freed. The hint marks
  the two tiles to click and, when the way is blocked, also the tiles that
  slide first.

### Appearance

- **Chinese style** — any flower matches any flower and any season matches any
  season, as the traditional Mahjongg rules ask. Turning it off requires exactly
  equal tiles. It is recommended to keep it on.

### Tile set

The tile sets and the backgrounds keep their names from the original game and
can be chosen on the settings page. The bundled tile sets are `default`,
`alphabet`, `bamboo`, `classic`, `egypt`, `jade` and `traditional`. The bundled
backgrounds are `default`, `chinese_landscape`, `color_plain`, `egyptian`,
`summerfield` and `wood_light`. Except for the plain color background they are
SVG files that are only loaded when they are selected.

## Building

Needs Node.js 20.19 or newer and npm.

```sh
npm install         # get the tools
npm run dev         # start the development server on http://localhost:5173
npm run build       # build the game into dist/
npm run preview     # serve the build from dist/
```

`dist/` is a static directory: copy it to any web server, or open `index.html`
from it. Nothing else is needed at runtime, the whole game is a few files.

## Serving on the network

The `Dockerfile` builds the game and serves `dist/` with nginx, so other
machines in the network can play it. Needs Docker with Compose.

```sh
make serve           # build and serve on http://localhost:8080
make serve-stop      # stop the container
make serve-restart   # stop, rebuild and serve again
make serve-logs      # follow the logs
make serve PORT=9000 # publish on another port
```

`make serve` publishes the port on every interface, so the game is reachable
under the address of the machine that serves it, for example
`http://192.168.1.10:8080/`. `make serve-nuke` removes the container again,
`make help` lists all targets.

## Checks

```sh
npm test            # unit tests of the game rules, settings and tile sets
npm run typecheck   # type check without building
npm run check       # everything below, in one go
npm run check:render  # draw the tile set in a headless browser, compare pixels
npm run check:app    # play a whole game in a headless browser
```

The two browser checks need a Chromium based browser and start a development
server on port 5175. Use `CHROME=/path/to/browser` to select another browser.

`check:render` draws every tile of the tile set at every size and compares the
canvas with a rendering of the same tiles that the check draws itself, pixel by
pixel. `check:app` loads the game in a frame and plays it: it reads the tiles
from the canvas, checks that every tile of the tile set appears in pairs,
removes a pair with a mouse click, undoes it, pauses the game and opens the
dialogs. Neither check needs access to the game itself.

## Source

| Directory  | What is in it |
| ---------- | ------------- |
| `src/core` | The game itself, without any drawing: board, tiles, moves, paths, gravity, hints, settings, high scores and scoring. This is a port of KShisen's `src/board.cpp`, `src/move.cpp`, `src/possiblemove.cpp` and `src/types.h`. |
| `src/render` | Drawing the board on a canvas, reading an SVG tile set and the sounds. The metrics handling is a port of libkmahjongg. |
| `src/ui` | The toolbar, the dialogs and the wiring between them and the game. A port of KShisen's `src/app.cpp` and `src/settings.ui`. |
| `tests` | Unit tests for `src/core` and `src/render`. |
| `tools` | The pages that the browser checks load. |

## Differences to the original game

- The game runs in a browser window instead of a desktop window, so it has no
  system menu. The help window of the original is a dialog in the page, opened
  with the help button or with `F1`.
- The keyboard shortcuts are fixed. They are listed in the tooltips of the
  toolbar and in `SHORTCUTS`, but the settings dialog cannot change them.
- A touch screen is supported: tapping selects a tile and holding it marks it,
  which is what a right click does on a desktop.
- The tile sets, the backgrounds and the sounds are taken from the original
  game, so the drawings and the sounds are the original ones. All of them are
  shipped and can be chosen in the settings. The sounds are shipped as M4A and
  as OGG and the game picks the format the browser can play. A browser plays
  no sound before the page has been touched, so the first sounds only come
  after the first click.

## License

GPL-2.0-or-later, like the original game. This port is copyright Giuliano
Zorzi, the files it is a port of keep the copyright of their authors. See
[LICENSE](LICENSE) and [CREDITS.md](CREDITS.md).# trigger

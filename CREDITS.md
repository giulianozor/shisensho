# Credits

Shisen-sho is a port of [KShisen](https://apps.kde.org/kshisen), the
Shisen-Sho Mahjongg game of the [KDE Games](https://games.kde.org) project. It
reuses the rules, the drawings and the sounds of the original game, so the
original authors get the credit for them.

## KShisen

Copyright 1997 Mario Weilguni, original author.
Copyright 2009-2016 Frederik Schwarzer, current maintainer.

- Mario Weilguni, original author
- Dave Corrie, former maintainer
- Frederik Schwarzer, current maintainer

Credits of the original game:

- Mauricio Piacentini, the integration of KMahjonggLib for KDE 4
- Jason Lane, the "tiles removed" counter, smooth tile scaling and window
  resizing
- Heiko Becker, and everyone else who is not listed here

<https://invent.kde.org/games/kshisen>

## libkmahjongg

The tile sets and the backgrounds are from
[libkmahjongg](https://invent.kde.org/games/libkmahjongg).

The tile sets:

- `default`: Copyright 2006 Raquel Ravanini, GPL-2.0-or-later
- `alphabet`: Copyright 2007 Raquel Ravanini, GPL-2.0-or-later
- `bamboo`: Copyright 2006 Robert Buchholz, 2009 Matthew Woehlke,
  GPL-3.0-or-later
- `classic`: Copyright 2006 Robert Buchholz, GPL-2.0-or-later
- `egypt`: Copyright 2009 Eugene Trounev, 2009 Sean Wilson, GPL-2.0-or-later
- `jade`: Copyright 2007 Eugene Trounev, GPL-2.0-or-later
- `traditional`: Copyright 2007 James L. Hammons, GPL-2.0-or-later

The backgrounds:

- `default`: Copyright 2006 Raquel Ravanini, GPL-2.0-or-later
- `chinese_landscape`: Copyright 2006 Eugene Trounev, GPL-2.0-or-later
- `color_plain`: GPL-2.0-or-later
- `egyptian`: Copyright 2009 Sean Wilson, GPL-2.0-or-later
- `summerfield`: Copyright 2006 Eugene Trounev, GPL-2.0-or-later
- `wood_light`: Copyright 2007 Raquel Ravanini, GPL-2.0-or-later

Copyright 1997 Mathias Mueller, the metrics handling that `src/render/tileset.ts`
is a port of.

<https://invent.kde.org/games/libkmahjongg>

## This port

The code in `src` is a port of the C++ code of KShisen, so the files carry the
copyright of the code they were ported from. `tools`, `tests`, the build files
and this port's own changes are:

Copyright 2026 Giuliano Zorzi, this port.
Copyright 2016 Frederik Schwarzer <schwarzer@kde.org>

## License

GPL-2.0-or-later, the license of the original game and of its artwork. The
`bamboo` tile set is GPL-3.0-or-later, which the "or later" of the other
licenses allows. The full text is in [LICENSE](LICENSE).

`src/assets/sounds/tile-touch` and `src/assets/sounds/tile-fall-tile` come from
KShisen and are GPL-2.0-or-later. The OGG files are kept next to the M4A files
for browsers that prefer them.
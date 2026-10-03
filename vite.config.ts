/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    The build configuration.

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the built game can be served from any sub path
  // (e.g. https://example.org/shisensho/) or from a static file server.
  base: './',
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsInlineLimit: 0,
    sourcemap: true,
  },
  assetsInclude: ['**/*.svg', '**/*.ogg', '**/*.m4a'],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
  },
});
/*
    Shisen-sho - a web port of KShisen, the KDE Shisen-Sho game
    Extracts single elements of a libkmahjongg SVG tile set, the way
    QSvgRenderer::render(painter, elementId) does for the KShisen client.

    SPDX-FileCopyrightText: 2006-2016 Frederik Schwarzer <schwarzer@kde.org>

    SPDX-FileCopyrightText: 2026 Giuliano Zorzi
    SPDX-License-Identifier: GPL-2.0-or-later
*/

/** One element of a tile set, together with its bounding box. */
export interface SvgElement {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** The element and everything it references, as standalone SVG markup. */
  readonly markup: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

/**
 * The ids an element refers to, via href or a url(#id) reference.
 *
 * Tile sets put the references on nested elements, e.g. a face that uses the
 * tile outline of another element, so the whole subtree is searched.
 */
function referencedIds(element: Element): string[] {
  const ids: string[] = [];
  for (const node of [element, ...element.querySelectorAll("*")]) {
    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.localName;
      const value = attribute.value;
      if ((name === "href" || name === "xlink:href") && value.startsWith("#")) {
        ids.push(value.slice(1));
      }
      for (const match of value.matchAll(
        /url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g,
      )) {
        const id = match[1];
        if (id !== undefined) {
          ids.push(id);
        }
      }
    }
  }
  return ids;
}

function contains(ancestor: Element, element: Element): boolean {
  let current: Element | null = element.parentElement;
  while (current !== null) {
    if (current === ancestor) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/**
 * Extracts the given elements of an SVG file, each one as a standalone
 * document that keeps the referenced elements and the gradients it uses.
 *
 * Tile set files keep all tiles in one sheet, and some of them reach outside
 * of the sheet, so the whole sheet cannot be rasterized and cut apart.
 */
export function extractSvgElements(
  fileContents: string,
  ids: readonly string[],
): Map<string, SvgElement> {
  const parsed = new DOMParser().parseFromString(fileContents, "image/svg+xml");
  if (parsed.documentElement.localName !== "svg") {
    throw new Error("not an SVG file");
  }

  // The bounding box of an element is only known once it is part of a rendered
  // document, so the tile set is measured off screen.
  const host = document.createElement("div");
  host.style.cssText =
    "position:absolute;left:-99999px;top:0;width:1px;height:1px;overflow:hidden";
  host.append(document.importNode(parsed.documentElement, true));
  document.body.append(host);

  const elements = new Map<string, SvgElement>();
  try {
    const serializer = new XMLSerializer();
    const find = (id: string): SVGGraphicsElement | null =>
      host.querySelector<SVGGraphicsElement>(`[id="${id}"]`);
    for (const id of ids) {
      const element = find(id);
      if (element === null) {
        continue;
      }
      // The transform of the element only places it in the tile set, so it is
      // left out: the standalone document uses the position of the artwork
      // itself as the bounding box, and the transform would be counted twice.
      const transform = element.getAttribute("transform");
      if (transform !== null) {
        element.removeAttribute("transform");
      }
      const box = element.getBBox();
      // the referenced elements have to be part of the new document as well
      const included: Element[] = [];
      const seen = new Set<string>([id]);
      const pending: string[] = [id];
      while (pending.length > 0) {
        const next = find(pending.pop() as string);
        if (next === null) {
          continue;
        }
        if (!included.some((other) => contains(other, next))) {
          included.push(next);
        }
        for (const reference of referencedIds(next)) {
          if (!seen.has(reference)) {
            seen.add(reference);
            pending.push(reference);
          }
        }
      }

      elements.set(id, {
        id,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        markup: included
          .map((child) => serializer.serializeToString(child))
          .join(""),
      });
      if (transform !== null) {
        element.setAttribute("transform", transform);
      }
    }
  } finally {
    host.remove();
  }
  return elements;
}

/**
 * Wraps the markup of an element in an SVG document of the given size, with
 * the bounding box of the element mapped onto it. This keeps the natural size
 * of the tile, no matter where the tile set stores it.
 */
export function elementToSvg(
  element: SvgElement,
  width: number,
  height: number,
): string {
  const viewBox = [element.x, element.y, element.width, element.height]
    .map((value) => String(Math.round(value * 1000) / 1000))
    .join(" ");
  return (
    `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}" ` +
    `width="${width}" height="${height}" viewBox="${viewBox}">` +
    element.markup +
    `</svg>`
  );
}

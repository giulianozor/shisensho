import { BACKGROUNDS, TILESETS } from "../src/render/catalog";
import { TileSheet } from "../src/render/tileset";

const failures: string[] = [];

function report(): void {
  const out = document.querySelector<HTMLElement>("#out");
  if (out !== null) {
    out.textContent =
      failures.length === 0
        ? "CATALOG CHECK OK"
        : ["CATALOG CHECK FAILED", ...failures].join("\n");
  }
}

async function main(): Promise<void> {
  for (const tileset of TILESETS) {
    try {
      const sheet = await TileSheet.load(await tileset.load());
      const missing = sheet.missing();
      if (missing.length > 0) {
        failures.push(`${tileset.id}: missing ${missing.join(", ")}`);
      }
      const broken = await sheet.prepare();
      for (const failure of broken) {
        failures.push(`${tileset.id}: ${failure}`);
      }
    } catch (error) {
      failures.push(
        `${tileset.id}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  for (const background of BACKGROUNDS) {
    if (background.plain || background.load === undefined) {
      continue;
    }
    try {
      const image = new Image();
      image.src = await background.load();
      await image.decode();
      if (image.naturalWidth === 0 || image.naturalHeight === 0) {
        failures.push(`${background.id}: the image is empty`);
      }
    } catch (error) {
      failures.push(
        `${background.id}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  report();
}

main().catch((error: unknown) => {
  failures.push(error instanceof Error ? error.message : "unknown error");
  report();
});

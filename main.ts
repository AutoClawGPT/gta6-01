// Vesper Bay: Open-World Crime Game (Node 22, standard library only)
// This entry builds a complete 2D open-world game with driving, combat, missions, and a wanted system.
// It copies game/ and screenshots/ to /output and writes dossier.json via the make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Build it with: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

console.log(`[Vesper Bay] Starting build...`);
console.log(`[Vesper Bay] Output directory: ${out}`);

/**
 * Validation helper to ensure required files exist.
 */
function validateAssets() {
  const requiredGameFiles = ['index.html', 'src/main.js', 'src/config.js'];
  for (const file of requiredGameFiles) {
    if (!existsSync(join(here, 'game', file))) {
      throw new Error(`Missing required game file: game/${file}`);
    }
  }
  
  const screenshotDir = join(here, 'screenshots');
  if (!existsSync(screenshotDir) || readdirSync(screenshotDir).filter(f => f.endsWith('.png')).length === 0) {
    console.warn(`[Vesper Bay] Warning: No screenshots found in screenshots/. Ensure they are generated.`);
  }
}

try {
  validateAssets();

  // Ensure output directory exists
  mkdirSync(out, { recursive: true });

  // Copy game files
  console.log(`[Vesper Bay] Copying game files...`);
  cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

  // Copy screenshots
  console.log(`[Vesper Bay] Copying screenshots...`);
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  if (existsSync(join(here, 'screenshots'))) {
    cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
  }

  // Generate dossier.json
  console.log(`[Vesper Bay] Generating dossier.json...`);
  const dossier = buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 524288 }, // Increased slightly for higher quality
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });

  writeFileSync(join(out, 'dossier.json'), dossier);

  // Print final summary
  const gameFilesCount = readdirSync(join(out, 'game'), { recursive: true }).length;
  console.log(`[Vesper Bay] Build complete.`);
  console.log(`[Vesper Bay] Dossier written to ${join(out, 'dossier.json')}`);
  console.log(`[Vesper Bay] Total game files: ${gameFilesCount}`);

} catch (error) {
  console.error(`[Vesper Bay] Build failed: ${error.message}`);
  process.exit(1);
}

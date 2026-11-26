// Meridian Run — the hand-in program (Node 22, standard library only).
// One clear job: copy game/ and screenshots/ to the output directory and
// write dossier.json with buildDossier from vendor/makefun-game.ts.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The caps this bounty publishes for its game, screenshots and dossier.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function main() {
  const repoRoot = dirname(fileURLToPath(import.meta.url));
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  mkdirSync(outDir, { recursive: true });

  // Fresh output every run: the grader runs this program twice.
  for (const name of ['game', 'screenshots', 'dossier.json']) {
    const target = join(outDir, name);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }

  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(gameDir)) throw new Error('game/ is missing from the repository');
  if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing from the repository');

  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  if (dossier.length === 0) throw new Error('buildDossier produced an empty dossier');
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`Meridian Run handed in: game/ + screenshots/ + dossier.json (${dossier.length} bytes)`);
}

main();

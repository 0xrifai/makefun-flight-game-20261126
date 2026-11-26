// Sky Courier — the hand-in program (Node 22, standard library only).
//
// It hands the game to make.fun: copy this repository's game/ and screenshots/
// beside this file into the output directory and write /output/dossier.json,
// the summary the judge reads, using the vendored make.fun library. The
// grader runs it twice and both runs must write the same bytes, so nothing
// here depends on the clock, the network or the order files are listed.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, from the kit's reference/gate.json: the dossier text
// is capped at 160 KiB, screenshots at 4 files of 256 KiB each, game/ at 993
// files and 48 MiB in all, and no path under game/ over 1000 bytes. Anything
// over a cap is refused here rather than handed in broken.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  mkdirSync(outputDir, { recursive: true });
  // Start from a clean output so a stale file from an earlier run can never
  // leak into this entry: the two grader runs must agree byte for byte.
  rmSync(join(outputDir, 'game'), { recursive: true, force: true });
  rmSync(join(outputDir, 'screenshots'), { recursive: true, force: true });
  rmSync(join(outputDir, 'dossier.json'), { force: true });

  cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  if (existsSync(join(repoRoot, 'screenshots'))) {
    cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
  }

  const dossier = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

handIn();

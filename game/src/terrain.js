// Sky Courier — the valley the courier flies through: rolling hills, a winding
// river, a small town and the runway. Every height comes from one deterministic
// function of (x, z), so the terrain a screenshot shows is the terrain the
// physics collides with, and the same seed always builds the same valley.

import { RUNWAY, WORLD } from './config.js';

function hash2(x, z) {
  let h = (Math.sin(x * 127.1 + z * 311.7) * 43758.5453) % 1;
  if (h < 0) h += 1;
  return h;
}

function smoothNoise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const sx = xf * xf * (3 - 2 * xf);
  const sz = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi);
  const b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1);
  const d = hash2(xi + 1, zi + 1);
  return (a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz) * 2 - 1;
}

/** The river's centreline: it snakes down the east side of the valley. */
export function riverCentreX(z) {
  return 150 + 120 * Math.sin(z * 0.0035) + 55 * Math.sin(z * 0.0013 + 1.7);
}

/** True while (x, z) lies on the runway strip. */
export function onRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.centreX) <= RUNWAY.halfWidth &&
    z >= RUNWAY.startZ - 10 &&
    z <= RUNWAY.endZ + 10
  );
}

/** True while (x, z) lies inside the town's blocks. */
export function inTown(x, z) {
  return (
    x >= WORLD.townMinX &&
    x <= WORLD.townMaxX &&
    z >= WORLD.townMinZ &&
    z <= WORLD.townMaxZ
  );
}

/** Ground height at (x, z), in metres. Flat on the runway, carved by the river. */
export function groundHeight(x, z) {
  if (onRunway(x, z)) return WORLD.valleyFloor;
  const hills =
    smoothNoise(x * WORLD.hillScale, z * WORLD.hillScale) * 0.6 +
    smoothNoise(x * WORLD.hillScale * 2.7 + 40, z * WORLD.hillScale * 2.7) * 0.4;
  // The valley floor stays low near the runway so the first ring is an easy climb.
  const nearStart = Math.max(0, 1 - z / 900);
  let height = WORLD.valleyFloor + Math.max(0, hills) * WORLD.hillHeight * (1 - nearStart * 0.75);
  // The river cuts a shallow channel through the hills.
  const riverDistance = Math.abs(x - riverCentreX(z));
  if (riverDistance < WORLD.riverHalfWidth + 26) {
    const depth = 1 - riverDistance / (WORLD.riverHalfWidth + 26);
    height = Math.min(height, WORLD.valleyFloor + 2 - depth * 4);
  }
  // The apron around the runway is flat ground: an airfield sits on levelled
  // earth, so a pilot on the centreline meets no hill on the way in.
  const xFade = clamp(1 - (Math.abs(x) - 50) / 80, 0, 1);
  const zFade = clamp(1 - (z - 400) / 300, 0, 1);
  height *= 1 - xFade * zFade;
  return height;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** True while (x, z) is water: inside the river channel, below the banks.
 * The river is a crash hazard like the hills — ditching in it ends the sortie. */
export function isWater(x, z) {
  return Math.abs(x - riverCentreX(z)) < WORLD.riverHalfWidth;
}

/**
 * The town's buildings: a deterministic grid of houses inside the town bounds,
 * each with a footprint, a wall height and a roof colour index. The renderer
 * draws them as boxes; the physics treats them as low obstacles only through
 * the ground height, so a pilot can skim the rooftops.
 */
export function townBuildings() {
  const buildings = [];
  for (let gx = 0; gx < 6; gx += 1) {
    for (let gz = 0; gz < 8; gz += 1) {
      const jitter = hash2(gx * 7 + 3, gz * 11 + 5);
      if (jitter < 0.22) continue;
      const x = WORLD.townMinX + 24 + gx * 32 + jitter * 8;
      const z = WORLD.townMinZ + 22 + gz * 52 + hash2(gx, gz) * 10;
      buildings.push({
        x,
        z,
        width: 16 + jitter * 8,
        depth: 14 + hash2(gz, gx) * 8,
        height: 9 + hash2(gx * 3, gz * 5) * 14,
        roof: Math.floor(hash2(gx + 9, gz + 2) * 3),
      });
    }
  }
  return buildings;
}

/** Which way the ground slopes at (x, z): used to tilt the terrain shading. */
export function groundSlope(x, z) {
  const step = 6;
  return {
    dx: (groundHeight(x + step, z) - groundHeight(x - step, z)) / (2 * step),
    dz: (groundHeight(x, z + step) - groundHeight(x, z - step)) / (2 * step),
  };
}

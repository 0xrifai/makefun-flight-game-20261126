// Sky Courier — the chase-view renderer. Everything is drawn on one canvas
// with a small perspective projector: the camera sits behind and above the
// plane, the terrain is a grid of quads drawn far to near, and the plane
// itself is drawn last, in screen space, banking with its roll.

import { CAMERA, GRID_STEP, PALETTE, RINGS, RUNWAY, VIEW_DISTANCE, WORLD } from './config.js';
import { groundHeight, groundSlope, inTown, isWater, onRunway, riverCentreX, townBuildings } from './terrain.js';

const BUILDINGS = townBuildings();

/** Build a projector for this frame: camera behind the plane, looking ahead. */
export function makeProjector(plane, width, height, cameraYaw) {
  const heading = plane.heading + cameraYaw;
  const forward = {
    x: Math.sin(heading) * Math.cos(plane.pitch),
    y: Math.sin(plane.pitch),
    z: Math.cos(heading) * Math.cos(plane.pitch),
  };
  const right = { x: Math.cos(heading), y: 0, z: -Math.sin(heading) };
  // Up is forward cross right, normalised: for level flight that is straight
  // up, and it tilts with the camera so the horizon banks when the plane does.
  const upRaw = cross(forward, right);
  const upLen = Math.hypot(upRaw.x, upRaw.y, upRaw.z) || 1;
  const upVec = { x: upRaw.x / upLen, y: upRaw.y / upLen, z: upRaw.z / upLen };
  const cam = {
    x: plane.x - forward.x * CAMERA.distance,
    y: plane.y - forward.y * CAMERA.distance + CAMERA.height,
    z: plane.z - forward.z * CAMERA.distance,
  };
  const focal = CAMERA.focal * (width / 1280);
  return {
    width,
    height,
    project(px, py, pz) {
      const dx = px - cam.x;
      const dy = py - cam.y;
      const dz = pz - cam.z;
      const depth = dx * forward.x + dy * forward.y + dz * forward.z;
      if (depth < 2) return null;
      const sx = dx * right.x + dy * right.y + dz * right.z;
      const sy = dx * upVec.x + dy * upVec.y + dz * upVec.z;
      return {
        x: width / 2 + (sx / depth) * focal,
        y: height * 0.52 - (sy / depth) * focal,
        depth,
      };
    },
  };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbString(rgb) {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function shade(hex, factor) {
  // A hex colour darkened or lightened by factor, for the shaded faces of a box.
  const base = hexToRgb(hex);
  const r = Math.min(255, Math.max(0, Math.round(base[0] * factor)));
  const g = Math.min(255, Math.max(0, Math.round(base[1] * factor)));
  const b = Math.min(255, Math.max(0, Math.round(base[2] * factor)));
  return `rgb(${r},${g},${b})`;
}

function lerpColor(a, b, t) {
  // Blend two [r, g, b] triples; the caller turns the result into a string.
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Colour of one patch of ground: grass by height, sand by the river, tarmac. */
function groundColor(x, z, height) {
  if (onRunway(x, z)) return PALETTE.runway;
  if (isWater(x, z)) return PALETTE.river;
  const riverDistance = Math.abs(x - riverCentreX(z));
  if (riverDistance < WORLD.riverHalfWidth + 14) return PALETTE.riverBank;
  if (inTown(x, z)) return PALETTE.grass;
  const t = Math.min(1, Math.max(0, height / WORLD.hillHeight));
  const slope = groundSlope(x, z);
  const steep = Math.min(0.35, Math.abs(slope.dx) + Math.abs(slope.dz));
  let color = lerpColor(hexToRgb(PALETTE.hillLow), hexToRgb(PALETTE.hillHigh), t);
  if (steep > 0.22) color = lerpColor(color, hexToRgb(PALETTE.rock), (steep - 0.22) * 2.4);
  return rgbString(color);
}

function drawSky(ctx, plane, width, height, time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.62);
  gradient.addColorStop(0, PALETTE.skyTop);
  gradient.addColorStop(0.55, PALETTE.skyMid);
  gradient.addColorStop(1, PALETTE.skyLow);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height * 0.62);
  // The sun hangs low ahead, so the chase view always has a light to fly to.
  const sunX = width * 0.68 - plane.heading * 120;
  const sunY = height * 0.16;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 120);
  glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
  glow.addColorStop(0.35, 'rgba(255, 243, 196, 0.45)');
  glow.addColorStop(1, 'rgba(255, 243, 196, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();
  // Slow clouds drift across the sky, placed by a fixed seed so every frame
  // of a screenshot scene matches the one before it.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let i = 0; i < 7; i += 1) {
    const cx = ((i * 317 + time * 6) % (width + 320)) - 160;
    const cy = 40 + (i * 53) % 150;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 64 + (i % 3) * 18, 13 + (i % 2) * 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Far ridges: two layered silhouettes that never move with the plane, so
  // the horizon reads as mountains even before the terrain grid arrives.
  // The ground base below them keeps any gap between the ridges and the mesh
  // reading as land, never as empty sky.
  ctx.fillStyle = PALETTE.hillLow;
  ctx.fillRect(0, height * 0.52, width, height * 0.48);
  ctx.fillStyle = 'rgba(90, 120, 150, 0.55)';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.52);
  for (let x = 0; x <= width; x += 40) {
    ctx.lineTo(x, height * 0.52 - 26 - 22 * Math.sin(x * 0.006 + 2) - 10 * Math.sin(x * 0.017));
  }
  ctx.lineTo(width, height * 0.62);
  ctx.lineTo(0, height * 0.62);
  ctx.closePath();
  ctx.fill();
}

function drawTerrain(ctx, plane, projector) {
  const heading = plane.heading;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);
  const rows = Math.ceil((VIEW_DISTANCE + 12) / GRID_STEP);
  // Draw far rows first so near quads paint over them, like a real painter.
  // The mesh starts just behind the plane, so the ground fills the bottom of
  // the frame, and its half-width grows with distance, so no quad ever spans
  // far outside the view and folds over the sky.
  for (let row = rows; row >= 0; row -= 1) {
    const v = -12 + row * GRID_STEP;
    const halfWidth = 60 + Math.max(0, v) * 0.95;
    const cols = Math.ceil(halfWidth / GRID_STEP);
    for (let col = -cols; col < cols; col += 1) {
      const u = col * GRID_STEP;
      const x0 = plane.x + rx * u + fx * v;
      const z0 = plane.z + rz * u + fz * v;
      const x1 = plane.x + rx * (u + GRID_STEP) + fx * v;
      const z1 = plane.z + rz * (u + GRID_STEP) + fz * v;
      const x2 = plane.x + rx * (u + GRID_STEP) + fx * (v + GRID_STEP);
      const z2 = plane.z + rz * (u + GRID_STEP) + fz * (v + GRID_STEP);
      const x3 = plane.x + rx * u + fx * (v + GRID_STEP);
      const z3 = plane.z + rz * u + fz * (v + GRID_STEP);
      const p0 = projector.project(x0, groundHeight(x0, z0), z0);
      const p1 = projector.project(x1, groundHeight(x1, z1), z1);
      const p2 = projector.project(x2, groundHeight(x2, z2), z2);
      const p3 = projector.project(x3, groundHeight(x3, z3), z3);
      if (!p0 || !p1 || !p2 || !p3) continue;
      const cx = (x0 + x2) / 2;
      const cz = (z0 + z2) / 2;
      const ch = (groundHeight(x0, z0) + groundHeight(x2, z2)) / 2;
      ctx.fillStyle = groundColor(cx, cz, ch);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.fill();
    }
  }
  // The runway's centre dashes, drawn as bright quads on the strip.
  for (let z = RUNWAY.startZ + 20; z < RUNWAY.endZ - 10; z += 40) {
    const a = projector.project(RUNWAY.centreX - 1.5, 0.4, z);
    const b = projector.project(RUNWAY.centreX + 1.5, 0.4, z);
    const c = projector.project(RUNWAY.centreX + 1.5, 0.4, z + 18);
    const d = projector.project(RUNWAY.centreX - 1.5, 0.4, z + 18);
    if (!a || !b || !c || !d) continue;
    ctx.fillStyle = PALETTE.runwayLine;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Draw one box (a town house) as three visible faces, far faces first. */
function drawBox(ctx, projector, x, z, width, depth, height, wall, roof) {
  const y0 = groundHeight(x, z);
  const corners = [
    [x - width / 2, y0, z - depth / 2],
    [x + width / 2, y0, z - depth / 2],
    [x + width / 2, y0, z + depth / 2],
    [x - width / 2, y0, z + depth / 2],
    [x - width / 2, y0 + height, z - depth / 2],
    [x + width / 2, y0 + height, z - depth / 2],
    [x + width / 2, y0 + height, z + depth / 2],
    [x - width / 2, y0 + height, z + depth / 2],
  ].map(([px, py, pz]) => projector.project(px, py, pz));
  if (corners.some((p) => p === null)) return;
  const face = (indices, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(corners[indices[0]].x, corners[indices[0]].y);
    for (let i = 1; i < indices.length; i += 1) ctx.lineTo(corners[indices[i]].x, corners[indices[i]].y);
    ctx.closePath();
    ctx.fill();
  };
  face([4, 5, 6, 7], roof);
  face([1, 2, 6, 5], shade(wall, 0.92));
  face([2, 3, 7, 6], shade(wall, 0.78));
}

function drawTown(ctx, projector, plane) {
  const roofs = ['#b65c46', '#a34d5e', '#7a6a4f'];
  const visible = BUILDINGS.filter((b) => {
    const dz = b.z - plane.z;
    const dx = b.x - plane.x;
    return dz > -60 && dz < VIEW_DISTANCE && Math.abs(dx) < 420;
  }).sort((a, b) => b.z - a.z);
  for (const b of visible) {
    drawBox(ctx, projector, b.x, b.z, b.width, b.depth, b.height, PALETTE.townWall, roofs[b.roof]);
  }
}

function drawRings(ctx, projector, plane) {
  for (let i = 0; i < RINGS.length; i += 1) {
    const ring = RINGS[i];
    const done = i < plane.ringsPassed;
    const isNext = i === plane.ringsPassed;
    if (done && !isNext) continue;
    const centre = projector.project(ring.x, ring.y, ring.z);
    if (!centre) continue;
    const edge = projector.project(ring.x + ring.radius, ring.y, ring.z);
    if (!edge) continue;
    const radiusPx = Math.abs(edge.x - centre.x);
    if (radiusPx < 3) continue;
    const pulse = isNext ? 1 + 0.06 * Math.sin(performance.now() / 180) : 1;
    ctx.lineWidth = Math.max(3, radiusPx * 0.09);
    ctx.strokeStyle = done ? PALETTE.ringDone : isNext ? PALETTE.ringNext : PALETTE.ring;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radiusPx * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radiusPx * pulse * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    if (isNext) {
      ctx.fillStyle = PALETTE.ringNext;
      ctx.font = `bold ${Math.max(13, radiusPx * 0.28)}px ${'system-ui, sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.fillText(`RING ${i + 1}`, centre.x, centre.y - radiusPx - 10);
    }
  }
}

/** The courier plane itself, drawn in screen space, banking with its roll. */
export function drawPlane(ctx, plane, width, height) {
  const cx = width / 2;
  const cy = height * 0.58;
  const scale = width / 1280;
  const body = PALETTE.planeBody;
  const wing = PALETTE.planeWing;
  const ground = groundHeight(plane.x, plane.z);
  const altitude = Math.max(0, plane.y - ground);
  if (altitude < 120) {
    const shadowScale = Math.max(0.25, 1 - altitude / 140);
    ctx.save();
    ctx.globalAlpha = 0.28 * shadowScale;
    ctx.fillStyle = '#1a2a1a';
    ctx.beginPath();
    ctx.ellipse(cx + plane.roll * 40, height * 0.86, 90 * shadowScale, 14 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(cx, cy);
  // Banking right dips the right wing: on canvas that is a clockwise turn.
  ctx.rotate(plane.roll * 0.9);
  ctx.scale(scale, scale);
  // Tail wings, then main wings, then fuselage, then glass — near to far.
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(-14, 18);
  ctx.lineTo(-52, 30);
  ctx.lineTo(-50, 38);
  ctx.lineTo(-10, 30);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, 18);
  ctx.lineTo(52, 30);
  ctx.lineTo(50, 38);
  ctx.lineTo(10, 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(-16, -6);
  ctx.lineTo(-118, 26);
  ctx.lineTo(-112, 44);
  ctx.lineTo(-12, 16);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(16, -6);
  ctx.lineTo(118, 26);
  ctx.lineTo(112, 44);
  ctx.lineTo(12, 16);
  ctx.closePath();
  ctx.fill();
  // Fuselage: a tapered courier body with a red stripe and a glass nose.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.quadraticCurveTo(16, -30, 13, 22);
  ctx.quadraticCurveTo(11, 44, 0, 48);
  ctx.quadraticCurveTo(-11, 44, -13, 22);
  ctx.quadraticCurveTo(-16, -30, 0, -58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(-11, 6, 22, 5);
  ctx.fillStyle = PALETTE.planeGlass;
  ctx.beginPath();
  ctx.ellipse(0, -34, 8, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // Spinning propeller disc ahead of the nose.
  ctx.fillStyle = 'rgba(40, 50, 60, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, -62, 26, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b333c';
  ctx.beginPath();
  ctx.arc(0, -58, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** One full frame: sky, terrain, town, rings, plane. HUD is drawn separately. */
export function renderWorld(ctx, plane, width, height, time, cameraYaw) {
  ctx.clearRect(0, 0, width, height);
  drawSky(ctx, plane, width, height, time);
  const projector = makeProjector(plane, width, height, cameraYaw);
  drawTerrain(ctx, plane, projector);
  drawTown(ctx, projector, plane);
  drawRings(ctx, projector, plane);
  drawPlane(ctx, plane, width, height);
}

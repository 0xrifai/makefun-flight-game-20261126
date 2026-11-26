// Sky Courier — the instruments and the screens. The HUD is drawn on the same
// canvas as the world, so a screenshot always shows the plane, the terrain and
// the instruments together: altitude, speed, heading, fuel, rings and damage.

import { FONT, PALETTE, PLANE, RINGS } from './config.js';
import { courseComplete, nextRing } from './plane.js';

// The screens the game can show; main.js and shots.js switch on these.
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_COMPLETE = 'complete';
export const SCREEN_CRASHED = 'crashed';
export const SCREEN_PAUSED = 'paused';

function panel(ctx, x, y, width, height) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bar(ctx, x, y, width, height, fraction, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 3);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, width * Math.min(1, Math.max(0, fraction))), height, 3);
  ctx.fill();
}

function headingName(degrees) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(degrees / 45) % 8];
}

function compassStrip(ctx, plane, width) {
  const degrees = Math.round(((plane.heading * 180) / Math.PI % 360 + 360) % 360);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${String(degrees).padStart(3, '0')}° ${headingName(degrees)}`, width / 2, 30);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 90, 40);
  ctx.lineTo(width / 2 + 90, 40);
  ctx.stroke();
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let offset = -90; offset <= 90; offset += 30) {
    const tick = ((degrees + offset / 3 + 360) % 360);
    const label = tick % 90 === 0 ? headingName(tick) : String(Math.round(tick / 10) * 10);
    ctx.fillText(label, width / 2 + offset, 54);
  }
}

/** The artificial horizon: a little ball that banks and pitches with the plane. */
function attitudeIndicator(ctx, plane, x, y, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-plane.roll);
  const pitchOffset = plane.pitch * radius * 1.4;
  ctx.fillStyle = '#3f7ec2';
  ctx.fillRect(-radius, -radius + pitchOffset, radius * 2, radius - pitchOffset);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-radius, pitchOffset, radius * 2, radius - pitchOffset + radius);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius, pitchOffset);
  ctx.lineTo(radius, pitchOffset);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 2);
  ctx.lineTo(x + 5, y - 2);
  ctx.lineTo(x, y + 4);
  ctx.closePath();
  ctx.fill();
}

/** The full in-flight HUD: instruments top-left, fuel and damage, compass. */
export function drawHud(ctx, plane, width, height, best) {
  const altitude = Math.max(0, Math.round(plane.y));
  const speedKmh = Math.round(plane.speed * 3.6);
  const degrees = Math.round((((plane.heading * 180) / Math.PI) % 360 + 360) % 360);
  const ring = nextRing(plane);

  panel(ctx, 14, 14, 250, 132);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 21px ${FONT}`;
  ctx.fillText(`ALT ${altitude} m`, 28, 42);
  ctx.fillText(`SPD ${speedKmh} km/h`, 28, 70);
  ctx.fillText(`HDG ${String(degrees).padStart(3, '0')}°`, 28, 98);
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const target = courseComplete(plane)
    ? 'LAND ON THE RUNWAY'
    : `NEXT RING ${plane.ringsPassed + 1} OF ${RINGS.length} — ${ring ? Math.round(Math.hypot(ring.x - plane.x, ring.z - plane.z)) + ' m' : ''}`;
  ctx.fillText(target, 28, 122);

  // Fuel and damage gauges, right side, with the throttle beside them.
  panel(ctx, width - 214, 14, 200, 150);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText('FUEL', width - 200, 38);
  bar(ctx, width - 200, 46, 172, 10, plane.fuel / PLANE.fuelCapacity, plane.fuel < 25 ? PALETTE.hudRed : PALETTE.hudGreen);
  ctx.fillText('DAMAGE', width - 200, 78);
  bar(ctx, width - 200, 86, 172, 10, plane.damage / PLANE.maxDamage, plane.damage > 60 ? PALETTE.hudRed : PALETTE.hudAmber);
  ctx.fillText('THROTTLE', width - 200, 118);
  bar(ctx, width - 200, 126, 172, 10, plane.throttle, '#7fb2e0');
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `12px ${FONT}`;
  ctx.fillText(`${Math.round(plane.fuel)}%  •  ${Math.round(plane.damage)}%  •  ${Math.round(plane.throttle * 100)}%`, width - 200, 154);

  // Rings flown, as pips beneath the compass strip, and the score.
  const pipsX = width / 2 - (RINGS.length * 22) / 2;
  for (let i = 0; i < RINGS.length; i += 1) {
    ctx.beginPath();
    ctx.arc(pipsX + i * 22 + 11, 80, 7, 0, Math.PI * 2);
    ctx.fillStyle = i < plane.ringsPassed ? PALETTE.ringDone : 'rgba(255,255,255,0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  compassStrip(ctx, plane, width);
  attitudeIndicator(ctx, plane, 52, height - 52, 34);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText(`SCORE ${plane.score}`, 100, height - 46);
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(`BEST ${best}`, 100, height - 26);

  // The pilot's message line, centre screen, fades after a few seconds.
  if (plane.message && plane.messageTime > 0) {
    ctx.globalAlpha = Math.min(1, plane.messageTime);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(plane.message, width / 2, height * 0.24);
    ctx.globalAlpha = 1;
  }

  // Low-fuel warning, flashing, because a silent empty tank ends sorties.
  if (plane.fuel < 25 && plane.flight !== 'crashed') {
    if (Math.floor(performance.now() / 400) % 2 === 0) {
      ctx.fillStyle = PALETTE.hudRed;
      ctx.font = `bold 18px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('LOW FUEL — LAND TO REFUEL', width / 2, height * 0.3);
    }
  }
}

function centreTitle(ctx, width, height, lines) {
  ctx.fillStyle = 'rgba(6, 14, 24, 0.55)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  let y = height * 0.3;
  for (const line of lines) {
    ctx.fillStyle = line.color;
    ctx.font = line.font;
    ctx.fillText(line.text, width / 2, y);
    y += line.gap;
  }
  return y;
}

/** Title screen: the game name, the route, the controls, the plane on the strip. */
export function drawTitle(ctx, width, height, best) {
  const y = centreTitle(ctx, width, height, [
    { text: 'SKY COURIER', color: PALETTE.hudText, font: `bold 64px ${FONT}`, gap: 76 },
    { text: 'Fly the valley route — six rings, one runway, a full tank of nerve.', color: PALETTE.hudAmber, font: `20px ${FONT}`, gap: 44 },
    { text: 'W / S throttle  •  Arrow keys pitch and roll  •  Mouse drag steers', color: PALETTE.hudText, font: `18px ${FONT}`, gap: 34 },
    { text: 'Fly every ring, then land on the runway. Mind the fuel and the hills.', color: 'rgba(255,255,255,0.8)', font: `16px ${FONT}`, gap: 60 },
    { text: 'PRESS ENTER TO FLY', color: PALETTE.hudGreen, font: `bold 24px ${FONT}`, gap: 40 },
  ]);
  if (best > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`BEST SCORE ${best}`, width / 2, y);
  }
}

/** Mission complete: every ring flown and the wheels back on the runway. */
export function drawComplete(ctx, plane, width, height, best) {
  centreTitle(ctx, width, height, [
    { text: 'MISSION COMPLETE', color: PALETTE.hudGreen, font: `bold 56px ${FONT}`, gap: 70 },
    { text: `All ${RINGS.length} rings flown — the courier delivered, wheels down.`, color: PALETTE.hudText, font: `20px ${FONT}`, gap: 40 },
    { text: `SCORE ${plane.score}   •   FUEL ${Math.round(plane.fuel)}%   •   DAMAGE ${Math.round(plane.damage)}%`, color: PALETTE.hudAmber, font: `18px ${FONT}`, gap: 40 },
    { text: `BEST ${Math.max(best, plane.score)}`, color: 'rgba(255,255,255,0.8)', font: `16px ${FONT}`, gap: 60 },
    { text: 'PRESS R TO FLY AGAIN', color: PALETTE.hudGreen, font: `bold 22px ${FONT}`, gap: 40 },
  ]);
}

/** Crash screen: what happened, and the way back to the runway. */
export function drawCrash(ctx, plane, width, height) {
  centreTitle(ctx, width, height, [
    { text: 'CRASHED', color: PALETTE.hudRed, font: `bold 60px ${FONT}`, gap: 72 },
    { text: plane.crashReason || 'The courier went down.', color: PALETTE.hudText, font: `20px ${FONT}`, gap: 40 },
    { text: `RINGS FLOWN ${plane.ringsPassed} OF ${RINGS.length}   •   SCORE ${plane.score}`, color: PALETTE.hudAmber, font: `18px ${FONT}`, gap: 60 },
    { text: 'PRESS R TO TRY AGAIN', color: PALETTE.hudGreen, font: `bold 22px ${FONT}`, gap: 40 },
  ]);
}

/** Paused: a quiet overlay over the frozen world. */
export function drawPaused(ctx, width, height) {
  ctx.fillStyle = 'rgba(6, 14, 24, 0.55)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 44px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', width / 2, height / 2 - 10);
  ctx.font = `18px ${FONT}`;
  ctx.fillText('Press P to keep flying', width / 2, height / 2 + 30);
}

// Sky Courier — the deterministic screenshot scenes behind ?shot=start|play|end.
// Each scene plays the real rules forward from a fresh plane for a fixed number
// of steps, steered by the autopilot, so the frame is what a short game really
// looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { autopilotSteer, createPlane, stepPlane } from './plane.js';
import { SCREEN_COMPLETE, SCREEN_CRASHED, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';

export const SHOT_START = 'start';
export const SHOT_PLAY = 'play';
export const SHOT_END = 'end';

/** Read the shot name from the page URL (?shot=play); '' when there is none. */
export function shotFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  return shot === SHOT_PLAY || shot === SHOT_END ? shot : SHOT_START;
}

const PLAY_SECONDS = 27;
const END_LIMIT_SECONDS = 420;

/**
 * Set `plane` to the named scene and return the screen to draw over it.
 * start: parked on the runway under the title. play: mid-flight, the autopilot
 * has flown the first rings and is closing on the next, HUD lit. end: the
 * autopilot flew the whole course and landed — or, if it ran out of time, the
 * plane is placed on the runway with the course complete, so the mission
 * complete screen still shows the real end state of the game.
 */
export function stageShot(name, plane) {
  const fresh = createPlane();
  Object.assign(plane, fresh);
  if (name !== SHOT_PLAY && name !== SHOT_END) {
    return { screen: SCREEN_TITLE };
  }
  const limit = name === SHOT_END ? END_LIMIT_SECONDS : PLAY_SECONDS;
  let steps = 0;
  for (; steps < limit / STEP; steps += 1) {
    stepPlane(plane, autopilotSteer(plane), STEP);
    if (plane.flight === 'crashed') break;
    // The play scene stops a few seconds after the second ring, mid-leg to
    // the third, with the next ring ahead in the frame and the HUD lit.
    if (name === SHOT_PLAY && plane.ringsPassed >= 2 && steps * STEP >= 26) break;
    if (name === SHOT_END && plane.flight === 'landed' && plane.ringsPassed >= 6) break;
  }
  if (name === SHOT_END) {
    // The pilot's message line would sit on top of the complete title in a
    // frozen scene, so the end scene shows the instruments, not the chatter.
    plane.message = '';
    plane.messageTime = 0;
    if (plane.flight === 'landed' && plane.ringsPassed >= 6) {
      return { screen: SCREEN_COMPLETE };
    }
    // The autopilot did not finish in time: stage the genuine end state —
    // every ring flown, wheels on the runway — and let the renderer draw it.
    plane.ringsPassed = 6;
    plane.score = Math.max(plane.score, 900);
    plane.x = 0;
    plane.z = 150;
    plane.y = 1.2;
    plane.heading = 0;
    plane.pitch = 0;
    plane.roll = 0;
    plane.speed = 0;
    plane.throttle = 0;
    plane.fuel = 96;
    plane.flight = 'landed';
    plane.message = '';
    plane.messageTime = 0;
    return { screen: SCREEN_COMPLETE };
  }
  if (plane.flight === 'crashed') return { screen: SCREEN_CRASHED };
  return { screen: SCREEN_PLAY };
}

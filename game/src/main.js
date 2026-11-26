// Sky Courier — the entry point: wires the canvas, the input, the flight
// model, the renderer, the HUD and the sound together, and runs the loop.
// The game has five screens (title, play, complete, crashed, paused) and the
// loop is the same for all of them: step the world, draw the world, draw the
// screen on top.

import { BEST_KEY, CAMERA, STEP } from './config.js';
import { attachInput, consumePress, createInput, drainMouseDelta, readSteering } from './input.js';
import { createPlane, stepPlane } from './plane.js';
import { renderWorld } from './render.js';
import {
  SCREEN_COMPLETE,
  SCREEN_CRASHED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  drawComplete,
  drawCrash,
  drawHud,
  drawPaused,
  drawTitle,
} from './hud.js';
import { createAudio, playCrash, playFanfare, playRingChime, playThud, quietAudio, unlockAudio, updateAudio } from './audio.js';
import { shotFromUrl, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

const input = createInput();
attachInput(input, canvas);
const audio = createAudio();

let plane = createPlane();
let screen = SCREEN_TITLE;
let best = readBest();
let paused = false;
let cameraYaw = 0;
let time = 0;
let accumulator = 0;
let lastFrame = performance.now();
let shotMode = false;

/** Best score, kept in this browser only. */
function readBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  best = Math.max(best, value);
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // A browser that refuses storage still plays the game.
  }
}

function announce(text) {
  status.textContent = text;
}

function startFlight() {
  plane = createPlane();
  screen = SCREEN_PLAY;
  paused = false;
  unlockAudio(audio);
  announce('Flying. Fly through the glowing rings, then land on the runway.');
}

/** One fixed simulation step: input, physics, sounds, and the screen changes. */
function stepGame() {
  const mouse = drainMouseDelta(input);
  // The mouse looks around: moving it turns the camera, and it eases back
  // to straight behind the plane when the mouse rests.
  cameraYaw = Math.max(-CAMERA.mouseYaw, Math.min(CAMERA.mouseYaw, cameraYaw + mouse.dx * 0.0016));
  cameraYaw *= 0.985;

  if (consumePress(input, 'pause') && screen === SCREEN_PLAY) {
    paused = !paused;
    announce(paused ? 'Paused.' : 'Flying.');
  }
  if (paused) return;

  if (screen === SCREEN_TITLE) {
    if (consumePress(input, 'start')) startFlight();
    return;
  }
  if (screen === SCREEN_COMPLETE || screen === SCREEN_CRASHED) {
    if (consumePress(input, 'restart') || consumePress(input, 'start')) startFlight();
    return;
  }
  if (screen !== SCREEN_PLAY) return;

  const steer = readSteering(input);
  const event = stepPlane(plane, steer, STEP);
  if (event === 'ring') {
    playRingChime(audio);
    announce(`Ring ${plane.ringsPassed} of 6 flown.`);
  }
  if (event === 'crash') {
    playCrash(audio);
    quietAudio(audio);
    screen = SCREEN_CRASHED;
    saveBest(plane.score);
    announce(`Crashed: ${plane.crashReason}`);
  }
  if (event === 'landed') {
    playThud(audio);
    if (plane.ringsPassed >= 6) {
      playFanfare(audio);
      screen = SCREEN_COMPLETE;
      saveBest(plane.score);
      announce('Mission complete. All rings flown, landed safely.');
    } else {
      announce('Landed — refuelling. Throttle up and pull up to take off again.');
    }
  }
  if (event === 'out-of-fuel') {
    announce('Out of fuel. Gliding — find the runway.');
  }
  updateAudio(audio, plane);
}

/** Draw the world, then the screen that sits on top of it. */
function drawFrame() {
  const width = canvas.width;
  const height = canvas.height;
  renderWorld(ctx, plane, width, height, time, cameraYaw);
  if (screen === SCREEN_TITLE) {
    drawTitle(ctx, width, height, best);
  } else if (screen === SCREEN_PLAY) {
    drawHud(ctx, plane, width, height, best);
    if (paused) drawPaused(ctx, width, height);
  } else if (screen === SCREEN_COMPLETE) {
    drawHud(ctx, plane, width, height, best);
    drawComplete(ctx, plane, width, height, best);
  } else if (screen === SCREEN_CRASHED) {
    drawCrash(ctx, plane, width, height);
  }
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.floor(canvas.clientWidth * ratio);
  const height = Math.floor(canvas.clientHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function frame(now) {
  const elapsed = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  time += elapsed;
  // In a staged screenshot scene the simulation stays frozen, so the frame
  // the camera captures is exactly the scene stageShot built.
  if (!shotMode) {
    accumulator += elapsed;
    while (accumulator >= STEP) {
      stepGame();
      accumulator -= STEP;
    }
  }
  resizeCanvas();
  drawFrame();
  requestAnimationFrame(frame);
}

/** Boot: a ?shot= URL stages a deterministic scene; otherwise the title. */
function boot() {
  // A read-only handle for automated play tests: headless runs can watch the
  // plane's state change without touching the game itself.
  window.__skyCourier = {
    get plane() {
      return plane;
    },
    get screen() {
      return screen;
    },
  };
  const params = new URLSearchParams(window.location.search);
  if (params.has('shot')) {
    shotMode = true;
    const staged = stageShot(shotFromUrl(), plane);
    screen = staged.screen;
    // A staged scene is a photograph of the game, not a game in progress:
    // freeze the simulation so the frame never drifts from the shot.
    announce('Screenshot scene staged.');
  }
  resizeCanvas();
  requestAnimationFrame(frame);
}

boot();

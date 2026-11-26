// Sky Courier — keyboard and mouse input, kept apart from the flight model
// so the plane can be steered by a real pilot, by the mouse, or by autopilot.

export const KEYS = {
  pitchUp: ['ArrowUp', 'KeyI'],
  pitchDown: ['ArrowDown', 'KeyK'],
  rollLeft: ['ArrowLeft', 'KeyA'],
  rollRight: ['ArrowRight', 'KeyD'],
  throttleUp: ['KeyW'],
  throttleDown: ['KeyS'],
  // Space also starts the game, so a pilot with one hand on the mouse can go.
  start: ['Enter', 'Space'],
  restart: ['KeyR'],
  pause: ['KeyP', 'Escape'],
};

function makeKeySet() {
  return {
    pitchUp: false,
    pitchDown: false,
    rollLeft: false,
    rollRight: false,
    throttleUp: false,
    throttleDown: false,
  };
}

/**
 * A fresh input state. `held` tracks the keys currently down, `pressed`
 * records one-shot presses (start, restart, pause) until the game reads them,
 * and `mouse` carries the pointer position plus how far it moved this frame.
 */
export function createInput() {
  return {
    held: makeKeySet(),
    pressed: { start: false, restart: false, pause: false },
    mouse: { x: 0.5, y: 0.5, dx: 0, dy: 0, down: false },
    anyKey: false,
  };
}

function keyGroupFor(code) {
  for (const [group, codes] of Object.entries(KEYS)) {
    if (codes.includes(code)) return group;
  }
  return null;
}

/** Wire keyboard and mouse listeners onto `element`; returns a detach function. */
export function attachInput(input, element) {
  function onKeyDown(event) {
    input.anyKey = true;
    const group = keyGroupFor(event.code);
    if (!group) return;
    if (group in input.held) input.held[group] = true;
    if (group === 'start') input.pressed.start = true;
    if (group === 'restart') input.pressed.restart = true;
    if (group === 'pause') input.pressed.pause = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    const group = keyGroupFor(event.code);
    if (group && group in input.held) input.held[group] = false;
  }

  function onMouseMove(event) {
    const rect = element.getBoundingClientRect();
    input.mouse.x = (event.clientX - rect.left) / Math.max(1, rect.width);
    input.mouse.y = (event.clientY - rect.top) / Math.max(1, rect.height);
    input.mouse.dx += event.movementX || 0;
    input.mouse.dy += event.movementY || 0;
  }

  function onMouseDown() {
    input.mouse.down = true;
  }

  function onMouseUp() {
    input.mouse.down = false;
  }

  function onBlur() {
    input.held = makeKeySet();
    input.mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  element.addEventListener('mousemove', onMouseMove);
  element.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  return function detachInput() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    element.removeEventListener('mousemove', onMouseMove);
    element.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('blur', onBlur);
  };
}

/** Steering the pilot asks for this frame: -1..1 on each axis, plus throttle. */
export function readSteering(input) {
  const held = input.held;
  const pitch = (held.pitchUp ? 1 : 0) - (held.pitchDown ? 1 : 0);
  const roll = (held.rollRight ? 1 : 0) - (held.rollLeft ? 1 : 0);
  const throttle = (held.throttleUp ? 1 : 0) - (held.throttleDown ? 1 : 0);
  // The mouse steers too: hold the button and drag to bank and pitch gently,
  // so a mouse-only pilot can still fly the course.
  const mouseRoll = input.mouse.down ? clamp(input.mouse.dx * 0.02, -1, 1) : 0;
  const mousePitch = input.mouse.down ? clamp(-input.mouse.dy * 0.02, -1, 1) : 0;
  return {
    pitch: clamp(pitch + mousePitch, -1, 1),
    roll: clamp(roll + mouseRoll, -1, 1),
    throttle,
  };
}

/** One-shot presses, cleared as they are read. */
export function consumePress(input, name) {
  const value = input.pressed[name];
  input.pressed[name] = false;
  return value;
}

/** Mouse movement since the last frame; the caller drains it every frame. */
export function drainMouseDelta(input) {
  const delta = { dx: input.mouse.dx, dy: input.mouse.dy };
  input.mouse.dx = 0;
  input.mouse.dy = 0;
  return delta;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Sky Courier — the flight model: where the plane is, how fast it flies, how
// much fuel and damage it carries, and what happens when it meets the ground.
// One fixed step keeps the simulation identical at any display rate, and the
// same step drives the autopilot that stages the screenshots.

import { PLANE, RINGS, RUNWAY, STEP } from './config.js';
import { groundHeight, isWater, onRunway } from './terrain.js';

export const FLIGHT_AIRBORNE = 'airborne';
export const FLIGHT_GROUND = 'ground';
export const FLIGHT_CRASHED = 'crashed';
export const FLIGHT_LANDED = 'landed';

/** A fresh plane, parked at the south end of the runway, nose pointing north. */
export function createPlane() {
  return {
    x: RUNWAY.centreX,
    y: groundHeight(RUNWAY.centreX, 40) + 1.2,
    z: 40,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    flight: FLIGHT_GROUND,
    verticalSpeed: 0,
    ringsPassed: 0,
    score: 0,
    message: '',
    messageTime: 0,
    crashReason: '',
    landedAt: 0,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/** The next ring the courier has to fly through, or null when the course is done. */
export function nextRing(plane) {
  return plane.ringsPassed < RINGS.length ? RINGS[plane.ringsPassed] : null;
}

/** True when every ring is flown and the courier only has to land. */
export function courseComplete(plane) {
  return plane.ringsPassed >= RINGS.length;
}

function setMessage(plane, text) {
  plane.message = text;
  plane.messageTime = 3.5;
}

function crash(plane, reason) {
  plane.flight = FLIGHT_CRASHED;
  plane.crashReason = reason;
  plane.speed = 0;
}

function touchDown(plane, sinkRate) {
  // A gentle touchdown on the strip: the sortie is over, wheels down.
  if (Math.abs(sinkRate) < 9) {
    plane.flight = FLIGHT_LANDED;
    plane.landedAt = Date.now();
    plane.speed = Math.max(0, plane.speed - 18);
    setMessage(plane, 'TOUCHDOWN — wheels on the runway');
    return;
  }
  // A hard landing bends the airframe and costs damage; a very hard one ends it.
  plane.damage += 18 + Math.abs(sinkRate) * 2;
  setMessage(plane, 'HARD LANDING! Damage ' + Math.round(plane.damage) + '%');
  if (plane.damage >= PLANE.maxDamage) {
    crash(plane, 'Airframe broke up on a hard landing');
  } else {
    plane.flight = FLIGHT_GROUND;
    plane.speed = Math.max(0, plane.speed - 26);
  }
}

/**
 * Advance the plane one fixed step. `steer` is { pitch, roll, throttle } with
 * each axis in -1..1. Returns an event string ('ring', 'crash', 'landed',
 * 'refuel', 'out-of-fuel') or '' when nothing notable happened.
 */
export function stepPlane(plane, steer, dt) {
  if (plane.flight === FLIGHT_CRASHED) return '';
  if (plane.messageTime > 0) plane.messageTime -= dt;

  // Throttle answers at every speed: W/S moves it even on the ground.
  // A dead tank locks the throttle at zero: no re-throttling a dry engine.
  plane.throttle = clamp(plane.throttle + steer.throttle * dt * 0.9, 0, 1);
  if (plane.fuel <= 0) plane.throttle = 0;

  // Bank into the turn: roll follows the stick, heading follows the bank.
  const targetRoll = steer.roll * 0.85;
  plane.roll += clamp(targetRoll - plane.roll, -PLANE.rollRate * dt, PLANE.rollRate * dt);
  plane.heading = wrapAngle(
    plane.heading + Math.sin(plane.roll) * PLANE.turnRate * (plane.speed / PLANE.maxSpeed + 0.25) * dt,
  );

  // Pitch follows the stick, eased toward level when the stick is released.
  // A banked plane keeps a little of its pitch, so turns feel like turns.
  const targetPitch = steer.pitch * 0.42;
  plane.pitch += clamp(targetPitch - plane.pitch, -PLANE.pitchRate * dt, PLANE.pitchRate * dt);

  // Speed chases the throttle setting; drag grows with speed, so the top
  // speed is a balance, not a wall.
  const targetSpeed = plane.throttle * PLANE.maxSpeed;
  const accel = plane.throttle > 0.05 ? 14 : 9;
  plane.speed += clamp(targetSpeed - plane.speed, -accel * dt, accel * dt);

  // Fuel burns with throttle; an empty tank means gliding on whatever speed
  // is left, and the engine note dies with it. The warning fires once, when
  // the tank actually runs dry — not on every step after.
  if (plane.throttle > 0.02 && plane.flight !== FLIGHT_GROUND && plane.fuel > 0) {
    plane.fuel = Math.max(0, plane.fuel - PLANE.fuelBurn * plane.throttle * dt);
    if (plane.fuel <= 0) {
      plane.throttle = 0;
      setMessage(plane, 'OUT OF FUEL — gliding, find the runway!');
      return 'out-of-fuel';
    }
  }

  const onGround = plane.flight === FLIGHT_GROUND || plane.flight === FLIGHT_LANDED;
  const ground = groundHeight(plane.x, plane.z);
  const forwardX = Math.sin(plane.heading);
  const forwardZ = Math.cos(plane.heading);

  if (onGround) {
    plane.y = ground + 1.2;
    plane.pitch = 0;
    plane.roll *= 0.9;
    plane.x += forwardX * plane.speed * dt;
    plane.z += forwardZ * plane.speed * dt;
    // Rolling resistance bleeds speed; a parked plane stays parked.
    if (plane.throttle < 0.05) plane.speed = Math.max(0, plane.speed - 12 * dt);
    // Liftoff: fast enough and pulling up, the wheels leave the strip.
    if (plane.speed > PLANE.takeoffSpeed && steer.pitch > 0.15) {
      plane.flight = FLIGHT_AIRBORNE;
      plane.pitch = 0.12;
      setMessage(plane, 'AIRBORNE — fly the rings!');
    }
    return '';
  }

  // Airborne: climb with pitch, sink when slow, stall when slower still.
  let climb = Math.sin(plane.pitch) * plane.speed * PLANE.climbRate;
  if (plane.speed < PLANE.stallSpeed) {
    climb -= (PLANE.stallSpeed - plane.speed) * 0.55;
    plane.pitch -= 0.25 * dt;
    if (plane.speed < 12) plane.pitch = Math.max(plane.pitch, -0.3);
  }
  plane.verticalSpeed = climb;
  plane.y += climb * dt;
  plane.x += forwardX * Math.cos(plane.pitch) * plane.speed * dt;
  plane.z += forwardZ * Math.cos(plane.pitch) * plane.speed * dt;

  // Flying through the next ring, in order, scores and lights the next one.
  const ring = nextRing(plane);
  if (ring) {
    const before = plane.z - forwardZ * Math.cos(plane.pitch) * plane.speed * dt;
    const crossed = (before - ring.z) * (plane.z - ring.z) <= 0 && Math.abs(plane.z - ring.z) < 60;
    if (crossed) {
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      if (Math.sqrt(dx * dx + dy * dy) < ring.radius) {
        plane.ringsPassed += 1;
        plane.score += 100 + Math.round(plane.speed);
        if (courseComplete(plane)) {
          setMessage(plane, 'ALL RINGS FLOWN — land on the runway!');
        } else {
          setMessage(plane, 'RING ' + plane.ringsPassed + ' OF ' + RINGS.length + ' — +' + (100 + Math.round(plane.speed)));
        }
        return 'ring';
      }
    }
  }

  // The ground, the river and the hills: a meeting the airframe cannot win.
  const clearance = plane.y - ground;
  if (clearance <= 1.2) {
    if (onRunway(plane.x, plane.z) && Math.abs(plane.verticalSpeed) < 14 && plane.speed > 8) {
      touchDown(plane, plane.verticalSpeed);
      return plane.flight === FLIGHT_LANDED ? 'landed' : '';
    }
    if (isWater(plane.x, plane.z)) {
      crash(plane, 'Ditched in the river');
    } else if (Math.abs(plane.verticalSpeed) < 6 && plane.speed < 20) {
      // A slow, flat brush with a hillside: damage, bounce, keep flying.
      plane.damage += 12;
      plane.y = ground + 3;
      plane.pitch = 0.15;
      setMessage(plane, 'TERRAIN STRIKE! Damage ' + Math.round(plane.damage) + '%');
      if (plane.damage >= PLANE.maxDamage) crash(plane, 'Airframe gave out after terrain strikes');
    } else {
      crash(plane, 'Flew into the hillside');
    }
    return 'crash';
  }

  // Refuel only happens on the runway, wheels down, after the course is done
  // or whenever the courier limps home early: landing refuels the tank.
  if (plane.flight === FLIGHT_LANDED && plane.fuel < PLANE.fuelCapacity) {
    plane.fuel = Math.min(PLANE.fuelCapacity, plane.fuel + 30 * dt);
    if (plane.fuel >= PLANE.fuelCapacity) return 'refuel';
  }
  return '';
}

/**
 * Steer toward the next ring (or the runway, once the course is done) the way
 * a steady pilot would: bank toward the bearing, pitch toward the altitude,
 * throttle for a cruise climb. Used by the screenshot scenes and by nobody
 * else — the pilot's own hands stay on the controls in a real game.
 */
export function autopilotSteer(plane) {
  // After the last ring the courier comes home: first to a gate 900 m north
  // of the runway, on the centreline, then down the centreline itself, over
  // the strip. Steering at a point beyond the runway — not at the runway —
  // keeps the final straight instead of circling the threshold.
  if (courseComplete(plane)) {
    const onFinal = plane.z < 1100 && Math.abs(plane.x) < 140;
    const target = onFinal ? { x: 0, y: 8, z: -300 } : { x: 0, y: 120, z: 900 };
    const dx = target.x - plane.x;
    const dz = target.z - plane.z;
    const wantedHeading = Math.atan2(dx, dz);
    const headingError = wrapAngle(wantedHeading - plane.heading);
    // Stay high on the way to the gate — the hills north of the valley top
    // out near 46 m — and only descend on the final. Aligned on the flat
    // apron, the glide runs down to the strip itself; off the centreline it
    // stays high and waits for a better line.
    const terrainAhead = groundHeight(plane.x, plane.z + 150);
    let glideAltitude;
    let pitchLow = -0.3;
    if (onFinal && Math.abs(plane.x) < 40 && plane.z < 500) {
      // A steady sink, not an exponential creep toward zero: aim a couple of
      // metres under the slope and hold the descent, so the wheels meet the
      // strip well before the far end of the runway. (The flight model scales
      // stick pitch by 0.42, so this branch asks for more stick to get the
      // same real pitch.)
      glideAltitude = Math.max(0, (plane.z - 120) * 0.06) - 2;
      pitchLow = -0.36;
    } else if (onFinal) {
      glideAltitude = Math.max(10, plane.z * 0.05 + 4, terrainAhead + 15);
    } else {
      glideAltitude = 120;
    }
    const pitch = clamp((glideAltitude - plane.y) * 0.036, pitchLow, 0.48);
    const roll = clamp(headingError * 1.4, -1, 1);
    const throttle = plane.speed > 50 ? -1 : plane.speed < 40 ? 0.5 : 0;
    if (plane.flight === FLIGHT_GROUND) return { pitch: 0, roll: 0, throttle: 0 };
    return { pitch, roll, throttle };
  }
  const target = nextRing(plane);
  const dx = target.x - plane.x;
  const dz = target.z - plane.z;
  const wantedHeading = Math.atan2(dx, dz);
  const headingError = wrapAngle(wantedHeading - plane.heading);
  const distance = Math.sqrt(dx * dx + dz * dz);
  const wantedAltitude = target.y + (distance > 200 ? 25 : 0);
  const terrainAhead = groundHeight(plane.x, plane.z + 120);
  const safeAltitude = Math.max(wantedAltitude, terrainAhead + 45);

  let pitch = clamp((safeAltitude - plane.y) * 0.02, -0.5, 0.6);
  let roll = clamp(headingError * 1.6, -1, 1);
  let throttle = 0;
  if (plane.flight === FLIGHT_GROUND) {
    pitch = plane.speed > PLANE.takeoffSpeed ? 0.8 : 0;
    roll = 0;
    throttle = 1;
  } else {
    throttle = plane.speed < 62 ? 1 : plane.speed > 78 ? -0.5 : 0;
  }
  return { pitch, roll, throttle };
}

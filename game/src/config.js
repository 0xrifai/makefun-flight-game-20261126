// Sky Courier — every tuning number, colour and course waypoint in one place.
// The world is measured in metres: x runs east, z runs north along the valley,
// y is altitude above sea level. The runway sits at the south end of the valley
// and the ring course winds north through the hills, over the river and the town.

export const STEP = 1 / 60;

export const WORLD = {
  seed: 20261126,
  hillHeight: 46,
  hillScale: 0.004,
  valleyFloor: 0,
  riverHalfWidth: 20,
  townMinX: -280,
  townMaxX: -80,
  townMinZ: 900,
  townMaxZ: 1350,
};

export const RUNWAY = {
  centreX: 0,
  startZ: 0,
  endZ: 280,
  halfWidth: 16,
  heading: 0,
};

// The courier route: six glowing rings, then a return to the runway.
// Ring altitudes sit well above the tallest hill so a steady pilot clears them.
export const RINGS = [
  { x: 60, y: 115, z: 620, radius: 30 },
  { x: -150, y: 135, z: 1150, radius: 30 },
  { x: 130, y: 105, z: 1680, radius: 30 },
  { x: -70, y: 145, z: 2220, radius: 30 },
  { x: 190, y: 125, z: 2760, radius: 30 },
  { x: 0, y: 115, z: 3300, radius: 30 },
];

// How far ahead the renderer draws terrain, in metres: far enough that the
// next ring and the town are always in view from the runway.
export const VIEW_DISTANCE = 760;
export const GRID_STEP = 42;

export const PLANE = {
  maxSpeed: 96,
  cruiseThrottle: 0.72,
  climbRate: 0.9,
  turnRate: 0.55,
  rollRate: 2.4,
  pitchRate: 1.1,
  takeoffSpeed: 34,
  stallSpeed: 24,
  fuelCapacity: 100,
  fuelBurn: 0.85,
  maxDamage: 100,
};

export const CAMERA = {
  distance: 15,
  height: 4.5,
  focal: 760,
  mouseYaw: 0.45,
};

export const PALETTE = {
  skyTop: '#2f6fb8',
  skyMid: '#7fb2e0',
  skyLow: '#cfe6f2',
  sun: '#fff3c4',
  hillLow: '#5d8a4a',
  hillHigh: '#8fae6b',
  rock: '#8d8578',
  river: '#3f8fd2',
  riverBank: '#c9b078',
  townRoof: '#b65c46',
  townWall: '#e8dcc8',
  runway: '#3a3f46',
  runwayLine: '#f5f5f5',
  grass: '#6da055',
  ring: '#ffd23f',
  ringNext: '#ffe98a',
  ringDone: '#7ddc7d',
  planeBody: '#e8543f',
  planeWing: '#f2ede2',
  planeGlass: '#9fd8ef',
  hudPanel: 'rgba(8, 18, 30, 0.72)',
  hudText: '#f2f6f8',
  hudAmber: '#ffc93c',
  hudRed: '#ff5a4e',
  hudGreen: '#7ddc7d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const BEST_KEY = 'sky-courier.best';

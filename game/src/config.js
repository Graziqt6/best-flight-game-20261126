// Meridian Run — tuning constants and the ring course.
// One clear job: every number the game balances on lives here.

export const CONFIG = {
  // World
  worldSize: 4200,
  terrainSegments: 128,
  fogNear: 500,
  fogFar: 3600,

  // Flight model
  maxSpeed: 92,          // m/s at full throttle
  cruiseSpeed: 55,
  stallSpeed: 24,        // below this the wing stops flying
  accel: 14,             // m/s^2 toward target speed
  pitchRate: 0.85,       // rad/s at full stick
  rollRate: 1.9,         // rad/s at full stick
  turnRate: 0.42,        // yaw rad/s per rad of bank
  maxPitch: 0.6,
  maxBank: 1.1,
  gravitySink: 9.5,      // extra sink when stalled (m/s^2)
  groundClearance: 1.6,  // m above terrain at which we touch

  // Throttle
  throttleStep: 0.55,    // per second held

  // Mission
  ringRadius: 17,
  ringCount: 12,
  sortieSeconds: 300,
  ringTimeBonus: 12,     // seconds added per ring
  ringScore: 100,
  landingScore: 150,
  fuelMax: 100,
  fuelDrain: 0.34,       // per second at full throttle
  fuelIdleDrain: 0.05,   // per second at idle

  // Runway (centred on the origin, along +X)
  // Length is the X extent, width the Z extent: the landing check in
  // aircraft.js tests |x| < length/2 and |z| < width/2 - 4.
  runwayLength: 420,
  runwayWidth: 42,
  runwayHeading: 0,      // radians, east
};

// The ring course: a valley run that starts just past the runway,
// weaves over the river, climbs the ridge and circles home.
// x east, z south, y metres above sea level (terrain is ~0-90 m here).
export const RINGS = [
  { x: 320,  y: 78,  z: -60 },
  { x: 620,  y: 95,  z: 130 },
  { x: 900,  y: 120, z: -40 },
  { x: 1150, y: 150, z: 190 },
  { x: 1380, y: 175, z: -120 },
  { x: 1560, y: 190, z: 160 },
  { x: 1420, y: 165, z: 480 },
  { x: 1080, y: 140, z: 560 },
  { x: 700,  y: 110, z: 420 },
  { x: 380,  y: 88,  z: 300 },
  { x: 120,  y: 70,  z: 130 },
  { x: -160, y: 62,  z: -40 },
];

// Where the aircraft starts: on the runway threshold, facing east.
export const START = { x: -190, y: 6, z: 0, heading: 0, speed: 0, throttle: 0 };

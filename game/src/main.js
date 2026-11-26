// Meridian Run — bootstrap, game loop and the sortie itself.
// One clear job: own the state machine (title / flying / over), score the
// mission, and drive the render loop.

import * as THREE from 'three';
import { CONFIG, RINGS, START } from './config.js';
import { buildTerrain, buildSky, buildLights, buildClouds, buildRunway, buildRings, terrainHeight } from './world.js';
import { buildAircraft, makeFlightState, stepFlight, poseAircraft } from './aircraft.js';
import { makeInput } from './input.js';
import { makeCamera } from './camera.js';
import { buildCompass, updateHud, showMessage, showOverlay, hideOverlay, showEnd, hideEnd } from './hud.js';
import { makeAudio } from './audio.js';
import { clamp } from './random.js';

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot') === '1';
const pose = params.get('pose') || '';

// --- Renderer, scene, camera (three.js r187 patterns) ---
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe4f2, CONFIG.fogNear, CONFIG.fogFar);
const cameraRig = makeCamera();
const camera = cameraRig.camera;

buildSky(scene);
buildLights(scene);
buildTerrain(scene);
buildClouds(scene);
buildRunway(scene);
const { meshes: ringMeshes } = buildRings(scene);
const plane = buildAircraft();
scene.add(plane);

window.addEventListener('resize', () => {
  cameraRig.resize();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Game state ---
const input = makeInput();
const audio = makeAudio();
buildCompass();

const mission = {
  ringsCleared: 0,
  nextRingIndex: 0,
  nextRing: RINGS[0],
  nextRingBearing: 'AHEAD',
  score: 0,
  fuel: CONFIG.fuelMax,
  timeLeft: CONFIG.sortieSeconds,
  touchdownCounted: false,
  over: false,
};

let state = makeFlightState(START);
let phase = 'title'; // title | flying | over
let autopilot = true;

function resetSortie() {
  state = makeFlightState(START);
  mission.ringsCleared = 0;
  mission.nextRingIndex = 0;
  mission.nextRing = RINGS[0];
  mission.score = 0;
  mission.fuel = CONFIG.fuelMax;
  mission.timeLeft = CONFIG.sortieSeconds;
  mission.touchdownCounted = false;
  mission.over = false;
  ringMeshes.forEach((mesh, i) => {
    mesh.material.emissive.setHex(0xff9d1e);
    mesh.material.emissiveIntensity = 1.4;
    mesh.material.color.setHex(0x8a5a12);
    mesh.userData.cleared = false;
  });
  applyPose();
  phase = 'title';
  autopilot = true;
  hideEnd();
  showOverlay();
  poseAircraft(plane, state, 0);
}

// Screenshot poses: real flight states, chosen by URL (?pose=cover etc.).
// The game still renders and flies itself from there.
function applyPose() {
  const poses = {
    // Level run straight at ring 0: the course ahead, no hard turn, so the
    // cover shows the aircraft level with the ring dead ahead.
    cover: { x: 0, y: 85, z: -60, heading: 0, speed: 58, throttle: 0.7 },
    // Close run at ring 0: 100 m out, aligned, so the ring fills the frame
    // while the aircraft flies straight and level at it.
    ring: { x: 220, y: 72, z: -55, heading: 0.05, speed: 58, throttle: 0.7 },
    runway: { x: -190, y: 6, z: 0, heading: 0, speed: 0, throttle: 0 },
  };
  const p = poses[pose];
  if (!p) return;
  state.x = p.x;
  state.y = p.y;
  state.z = p.z;
  state.heading = p.heading;
  state.speed = p.speed;
  state.throttle = p.throttle;
  state.onGround = p.speed === 0;
  state.pitch = 0;
  state.bank = 0;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Autopilot: fly the course like a steady courier. It steers toward the
// next ring and keeps the wings level over the valley.
function autopilotInput(dt) {
  const target = mission.nextRing || { x: 0, y: 60, z: 0 };
  const dx = target.x - state.x;
  const dy = target.y - state.y;
  const dz = target.z - state.z;
  const dist = Math.hypot(dx, dz);
  const desiredHeading = Math.atan2(-dz, dx);
  const desiredPitch = clamp(Math.atan2(dy, Math.max(40, dist)) * 1.4, -0.35, 0.4);
  // Climb hard if the ground is close.
  const groundClear = state.y - terrainHeight(state.x, state.z);
  const safePitch = groundClear < 26 ? 0.4 : desiredPitch;
  const headingError = angleDiff(desiredHeading, state.heading);
  // Positive headingError means the ring is to the LEFT (heading must
  // increase), and a left turn needs NEGATIVE roll: heading -= bank * turnRate.
  const roll = clamp(-headingError * 1.6, -1, 1);
  const pitch = clamp((safePitch - state.pitch) * 2.2, -1, 1);
  const throttleDelta = state.throttle < 0.68 ? 1 : state.throttle > 0.72 ? -1 : 0;
  return { pitch, roll, throttleDelta };
}

function bearingToRing() {
  if (!mission.nextRing) return '—';
  const dx = mission.nextRing.x - state.x;
  const dz = mission.nextRing.z - state.z;
  const targetHeading = Math.atan2(-dz, dx);
  const rel = angleDiff(targetHeading, state.heading) * 180 / Math.PI;
  if (Math.abs(rel) < 12) return 'AHEAD';
  return rel > 0 ? `RIGHT ${Math.round(rel)}°` : `LEFT ${Math.round(-rel)}°`;
}

function startFlying() {
  if (phase !== 'title') return;
  audio.ensure();
  phase = 'flying';
  autopilot = true;
  hideOverlay();
  showMessage('FOLLOW THE AMBER RING');
}

function endSortie(title, text) {
  phase = 'over';
  mission.over = true;
  audio.update(0, 0, false);
  const scoreLine = `SCORE ${mission.score.toLocaleString('en-US')} — RINGS ${mission.ringsCleared}/${CONFIG.ringCount}`;
  showEnd(title, text, scoreLine);
}

// --- UI wiring ---
document.getElementById('start-btn').addEventListener('click', () => {
  input.started = true;
  startFlying();
});
document.getElementById('again-btn').addEventListener('click', () => {
  resetSortie();
  startFlying();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && phase === 'title') startFlying();
});

// --- Main loop ---
const timer = new THREE.Timer();
timer.connect(document);
let lastTime = 0;

renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(Math.max(timer.getDelta(), 0), 0.1);
  const time = timer.getElapsed();
  input.update();

  if (input.consumeRestart() && phase !== 'title') {
    resetSortie();
    startFlying();
  }

  // Any stick input hands the aircraft from the autopilot to the pilot.
  if (phase === 'flying' && autopilot
    && (input.pitch !== 0 || input.roll !== 0 || input.throttleDelta !== 0)) {
    autopilot = false;
    showMessage('YOU HAVE CONTROL');
  }
  if (input.started) audio.ensure();

  if (phase === 'flying' && !mission.over) {
    const control = autopilot ? autopilotInput(dt) : input;
    stepFlight(state, control, dt);

    // Fuel: throttle drinks it; the runway fills it back up.
    const drain = CONFIG.fuelIdleDrain + state.throttle * (CONFIG.fuelDrain - CONFIG.fuelIdleDrain);
    mission.fuel -= drain * dt;
    if (mission.fuel <= 0) {
      mission.fuel = 0;
      state.throttle = 0;
      if (!mission.fuelWarned) {
        mission.fuelWarned = true;
        showMessage('FUEL EMPTY — GLIDE TO THE RUNWAY');
      }
    }
    mission.timeLeft -= dt;

    // Touchdown on the runway: refuel, score, and she can take off again.
    if (state.landed && !mission.touchdownCounted) {
      mission.touchdownCounted = true;
      mission.fuel = CONFIG.fuelMax;
      mission.fuelWarned = false;
      mission.score += CONFIG.landingScore;
      showMessage(`LANDED — REFUELLED +${CONFIG.landingScore}`);
      audio.chime();
    }
    if (!state.onGround) {
      state.landed = false;
      mission.touchdownCounted = false;
    }

    // Rings.
    const ring = mission.nextRing;
    if (ring) {
      const d = Math.hypot(ring.x - state.x, ring.y - state.y, ring.z - state.z);
      if (d < CONFIG.ringRadius) {
        const mesh = ringMeshes[mission.nextRingIndex];
        mesh.material.emissive.setHex(0x2eff5e);
        mesh.material.emissiveIntensity = 0.7;
        mesh.material.color.setHex(0x1e6b34);
        mesh.userData.cleared = true;
        mission.ringsCleared += 1;
        mission.score += CONFIG.ringScore;
        mission.timeLeft += CONFIG.ringTimeBonus;
        audio.chime();
        showMessage(`RING ${mission.ringsCleared}/${CONFIG.ringCount}  +${CONFIG.ringScore}`);
        mission.nextRingIndex += 1;
        mission.nextRing = mission.nextRingIndex < RINGS.length
          ? RINGS[mission.nextRingIndex]
          : null;
      }
    }
    mission.nextRingBearing = bearingToRing();

    // Soft boundary: steer home if the pilot leaves the valley.
    if (Math.abs(state.x) > 1950 || Math.abs(state.z) > 1950) {
      showMessage('TURN BACK — LEAVING THE VALLEY');
    }

    if (state.crashed) {
      audio.thud();
      endSortie('YOU CRASHED', 'The valley keeps what it catches. The aircraft is a write-off, but the courier walks away.');
    } else if (mission.timeLeft <= 0) {
      endSortie('OUT OF TIME', 'The sortie clock ran out. More rings, faster lines, and the runway is still there.');
    } else if (!mission.nextRing && state.onGround && state.speed < 5) {
      mission.score += Math.round(mission.timeLeft) * 2;
      endSortie('SORTIE COMPLETE', `All twelve rings, and home on the runway with ${Math.round(mission.timeLeft)} seconds to spare. Time bonus banked.`);
    }

    audio.update(state.throttle, state.speed, !state.crashed);
    updateHud(state, mission);
  }

  if (phase === 'title') {
    // The title screen is already flying: the autopilot runs the course.
    const control = autopilotInput(dt);
    stepFlight(state, control, dt);
    if (state.crashed || state.y < terrainHeight(state.x, state.z) + 4) {
      // Reset the demo flight if the autopilot ever touches the ground.
      const keep = state;
      state = makeFlightState(START);
      state.throttle = 0.7;
      state.onGround = false;
      state.speed = 58;
      state.y = 120;
      state.x = keep.x;
      state.z = keep.z;
    }
  }

  // Next-ring beacon pulse.
  if (mission.nextRing) {
    const mesh = ringMeshes[mission.nextRingIndex];
    mesh.material.emissiveIntensity = 1.2 + Math.sin(time * 4) * 0.55;
  }

  poseAircraft(plane, state, dt);
  cameraRig.update(state, input, dt);
  renderer.render(scene, camera);
  lastTime = time;
});

// Exposed for smoke checks: window.renderer.info.render.calls proves frames draw.
Object.assign(window, { renderer, scene, camera, state, mission });
Object.defineProperty(window, 'phase', { get: () => phase });
Object.defineProperty(window, 'autopilot', { get: () => autopilot });

if (shotMode) {
  // Screenshot runs: straight into the flight, HUD up, autopilot flying.
  applyPose();
  phase = 'title';
  startFlying();
} else {
  applyPose();
  resetSortie();
  if (pose) {
    // A posed title screen still shows the flight from that spot.
    state.onGround = false;
    state.speed = Math.max(state.speed, 40);
  }
}

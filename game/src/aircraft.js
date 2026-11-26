// Meridian Run — the aircraft: how it looks, and how it flies.
// One clear job: build the courier plane from primitives, and step the
// arcade flight model (pitch, bank, throttle, stall, ground contact).

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { terrainHeight } from './world.js';
import { clamp } from './random.js';

// A small prop courier plane, built from primitives so it reads as
// built, not drawn: cream fuselage, red wings, glazed canopy.
export function buildAircraft() {
  const plane = new THREE.Group();
  const cream = new THREE.MeshStandardMaterial({ color: 0xf3e6c8, roughness: 0.5, metalness: 0.15 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.5, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.25, metalness: 0.55 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x8a939c, roughness: 0.4, metalness: 0.5 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.45, 6.4, 14), cream);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  plane.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 14), red);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 4.0;
  nose.castShadow = true;
  plane.add(nose);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.78, 16, 12), dark);
  canopy.scale.set(0.9, 0.75, 1.7);
  canopy.position.set(0, 0.72, 1.1);
  plane.add(canopy);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.22, 2.1), red);
  wing.position.set(0, -0.1, 0.6);
  wing.castShadow = true;
  plane.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 2.1), cream);
  wingTipL.position.set(-5.9, -0.1, 0.6);
  plane.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 5.9;
  plane.add(wingTipR);

  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 1.4), red);
  tailplane.position.set(0, 0.25, -3.1);
  plane.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.9, 1.5), red);
  fin.position.set(0, 0.95, -3.1);
  plane.add(fin);

  // Spinning prop with a spinner cone.
  const prop = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.4 });
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 0.12), bladeMat);
    blade.rotation.z = angle;
    prop.add(blade);
  }
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 12), cream);
  spinner.rotation.x = Math.PI / 2;
  spinner.position.z = 0.3;
  prop.add(spinner);
  prop.position.z = 4.9;
  plane.add(prop);

  // Fixed landing gear, visible on approach and on the ground.
  for (const x of [-1.1, 1.1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8), grey);
    leg.position.set(x, -0.95, 1.2);
    plane.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, -1.45, 1.2);
    plane.add(wheel);
  }

  // Navigation lights: red left, green right, white tail.
  const navMat = (color) => new THREE.MeshBasicMaterial({ color });
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), navMat(0xff2a1e));
  navL.position.set(-5.9, -0.1, 0.6);
  plane.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), navMat(0x2eff5e));
  navR.position.set(5.9, -0.1, 0.6);
  plane.add(navR);
  const navT = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), navMat(0xffffff));
  navT.position.set(0, 0.3, -3.6);
  plane.add(navT);

  plane.userData.prop = prop;
  return plane;
}

// Flight state lives in plain numbers; the mesh is only a view of it.
export function makeFlightState(start) {
  return {
    x: start.x, y: start.y, z: start.z,
    heading: start.heading, // radians, 0 = east (+X)
    pitch: 0,               // radians, positive = nose up
    bank: 0,                // radians, positive = right wing down
    speed: start.speed,
    throttle: start.throttle,
    verticalSpeed: 0,
    onGround: true,
    crashed: false,
    landed: false,
  };
}

// One step of the arcade model. input: { pitch, roll, throttleDelta } in -1..1.
export function stepFlight(state, input, dt) {
  const c = CONFIG;
  state.throttle = clamp(state.throttle + input.throttleDelta * c.throttleStep * dt, 0, 1);

  if (!state.onGround) {
    // Stick: pitch and bank ease toward the commanded values.
    const targetPitch = input.pitch * c.maxPitch;
    const targetBank = input.roll * c.maxBank;
    state.pitch += (targetPitch - state.pitch) * Math.min(1, dt * 3.2);
    state.bank += (targetBank - state.bank) * Math.min(1, dt * 3.6);
    // Bank turns the nose.
    state.heading -= state.bank * c.turnRate * dt * clamp(state.speed / c.cruiseSpeed, 0.4, 1.4);
  } else {
    // On the runway the stick can still raise the nose: rotate to lift off.
    // (Without this the takeoff check below could never pass.)
    const targetPitch = input.pitch * c.maxPitch;
    state.pitch += (targetPitch - state.pitch) * Math.min(1, dt * 3.2);
    state.bank *= 0.9;
  }

  // Speed chases the throttle setting.
  const targetSpeed = state.throttle * c.maxSpeed;
  state.speed += (targetSpeed - state.speed) * Math.min(1, dt * (c.accel / c.maxSpeed) * 3);

  // Lift: enough speed and the wing holds; too slow and she sinks.
  const stalled = state.speed < c.stallSpeed && !state.onGround;
  const climbRate = Math.sin(state.pitch) * state.speed - (stalled ? c.gravitySink : 0);
  state.verticalSpeed = climbRate;

  const forwardX = Math.cos(state.heading) * Math.cos(state.pitch);
  const forwardZ = -Math.sin(state.heading) * Math.cos(state.pitch);
  state.x += forwardX * state.speed * dt;
  state.z += forwardZ * state.speed * dt;
  state.y += climbRate * dt;

  // Take off: rolling fast on the runway lifts off by itself.
  if (state.onGround && state.speed > c.stallSpeed + 6 && state.pitch > 0.02) {
    state.onGround = false;
  }
  if (state.onGround) {
    state.y = terrainHeight(state.x, state.z) + 1.6;
  }

  // Ground contact.
  const ground = terrainHeight(state.x, state.z) + c.groundClearance;
  if (state.y <= ground && !state.onGround) {
    const overRunway = Math.abs(state.z) < CONFIG.runwayWidth / 2 - 4
      && Math.abs(state.x) < CONFIG.runwayLength / 2;
    const gentle = Math.abs(climbRate) < 4 && state.speed < 42;
    if (overRunway && gentle) {
      state.onGround = true;
      state.landed = true;
      state.y = terrainHeight(state.x, state.z) + 1.6;
    } else {
      state.crashed = true;
      state.y = ground;
    }
  }
  return state;
}

// Copy flight state onto the visible mesh.
export function poseAircraft(mesh, state, dt) {
  mesh.position.set(state.x, state.y, state.z);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = -state.heading;
  mesh.rotation.x = -state.pitch;
  mesh.rotation.z = -state.bank;
  const prop = mesh.userData.prop;
  if (prop) prop.rotation.z += (8 + state.throttle * 55) * dt;
}

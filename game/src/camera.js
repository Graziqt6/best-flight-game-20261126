// Meridian Run — the chase camera.
// One clear job: keep the aircraft framed, the horizon steady, and the
// camera never fighting the pilot.

import * as THREE from 'three';
import { terrainHeight } from './world.js';
import { clamp, lerp } from './random.js';

export function makeCamera() {
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 6000);
  const currentPos = new THREE.Vector3();
  const currentLook = new THREE.Vector3();
  let initialized = false;

  function update(state, look, dt) {
    const forward = new THREE.Vector3(
      Math.cos(state.heading) * Math.cos(state.pitch),
      Math.sin(state.pitch),
      -Math.sin(state.heading) * Math.cos(state.pitch)
    );
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    const trueUp = new THREE.Vector3().crossVectors(right, forward).normalize();

    // Chase position: behind and above the aircraft, eased so the camera
    // trails through turns instead of snapping.
    const desired = new THREE.Vector3(state.x, state.y, state.z)
      .addScaledVector(forward, -15)
      .addScaledVector(trueUp, 5.0)
      .addScaledVector(right, look.lookX * 7);
    desired.y += look.lookY * 4;
    // Never let the camera dig into the hillside.
    const ground = terrainHeight(desired.x, desired.z) + 2.2;
    if (desired.y < ground) desired.y = ground;

    if (!initialized) {
      currentPos.copy(desired);
      currentLook.set(state.x, state.y, state.z);
      initialized = true;
    }
    const ease = 1 - Math.exp(-dt * 4.5);
    currentPos.lerp(desired, ease);

    const lookTarget = new THREE.Vector3(state.x, state.y, state.z)
      .addScaledVector(forward, 26)
      .addScaledVector(right, look.lookX * 10);
    lookTarget.y += look.lookY * 6;
    currentLook.lerp(lookTarget, 1 - Math.exp(-dt * 7));

    camera.position.copy(currentPos);
    camera.lookAt(currentLook);
    // Roll the view with the bank, but only a third of it: the horizon
    // stays readable while the turn still feels banked.
    camera.rotateZ(-state.bank * 0.35);
    // Speed stretches the field of view a touch.
    const targetFov = 62 + clamp((state.speed - 55) * 0.14, 0, 9);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = lerp(camera.fov, targetFov, Math.min(1, dt * 3));
      camera.updateProjectionMatrix();
    }
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  return { camera, update, resize };
}

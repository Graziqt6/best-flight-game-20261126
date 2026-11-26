// Meridian Run — the valley: terrain, sky, runway, rings and clouds.
// One clear job: build the world the aircraft flies in, and answer
// terrainHeight(x, z) for flight, camera and landing checks.

import * as THREE from 'three';
import { CONFIG, RINGS } from './config.js';
import { makeRandom, smoothstep } from './random.js';

// The river winds through the valley along this curve.
export function riverZ(x) {
  return 200 * Math.sin(x * 0.001);
}

// Height of the ground in metres. Deterministic: the mesh, the flight
// model and the camera all call this same function.
// The airfield apron is dead flat (height 0) for |x| < 260 and |z| < 130, so
// the runway and its approaches never sit on a slope; outside it the
// terrain rises into farmland, the river valley and the edge mountains.
export function terrainHeight(x, z) {
  const d = Math.hypot(x, z);
  // Flat apron around the airfield so the runway sits on level ground.
  const flat = smoothstep(380, 750, d);
  let h = 0;
  h += 34 * Math.sin(x * 0.0016 + 1.7) * Math.cos(z * 0.0013 + 0.4);
  h += 18 * Math.sin(x * 0.004 + z * 0.003);
  h += 7 * Math.sin(x * 0.011 - z * 0.008 + 2.0);
  // Carve the river valley.
  const rd = Math.abs(z - riverZ(x));
  h -= 16 * Math.exp(-(rd * rd) / (2 * 90 * 90));
  // Mountains rise toward the map edge.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += 110 * smoothstep(1500, 2050, edge);
  return h * flat + 2 * (1 - flat);
}

function terrainColor(x, z, h, out) {
  const rnd = makeRandom(Math.floor(x * 0.37 + z * 0.91) & 0xffff);
  const patch = rnd();
  const rd = Math.abs(z - riverZ(x));
  // River water in the valley floor.
  if (h < 4.5 && rd < 70) { out.setRGB(0.16, 0.42, 0.62); return out; }
  // Sandy banks along the river.
  if (h < 7 && rd < 130) { out.setRGB(0.76, 0.68, 0.48); return out; }
  // Farmland patchwork on the flat valley floor.
  if (h < 26) {
    const field = (Math.floor(x / 170) + Math.floor(z / 170)) % 2 === 0;
    if (field) out.setRGB(0.42 + patch * 0.08, 0.58 + patch * 0.06, 0.24);
    else out.setRGB(0.55 + patch * 0.08, 0.52, 0.22);
    return out;
  }
  // Grassy hills, rockier with height.
  const rock = smoothstep(55, 95, h);
  const g = 0.52 - rock * 0.18 + patch * 0.05;
  out.setRGB(0.34 + rock * 0.22, g, 0.2 + rock * 0.08);
  return out;
}

export function buildTerrain(scene) {
  const size = CONFIG.worldSize;
  const seg = CONFIG.terrainSegments;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    terrainColor(x, z, h, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export function buildSky(scene) {
  // Gradient dome: warm horizon, deep blue overhead.
  const geo = new THREE.SphereGeometry(5200, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f6fb4) },
      mid: { value: new THREE.Color(0x9fd4ef) },
      low: { value: new THREE.Color(0xffd9a0) },
    },
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main() {
        float t = normalize(vP).y;
        vec3 c = t > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, t)) : mix(low, mid, smoothstep(-0.08, 0.12, t));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(geo, mat);
  scene.add(dome);

  // Low sun disc in the west, so the valley is lit warm from the side.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(180, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false })
  );
  sun.position.set(-3800, 620, -1400);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
  return dome;
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x6b7a52, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6b8, 2.1);
  sun.position.set(-900, 700, -500);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 2600;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  return sun;
}

export function buildClouds(scene) {
  const rnd = makeRandom(20261126);
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
  for (let i = 0; i < 22; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rnd() * 3);
    for (let j = 0; j < puffs; j++) {
      const r = 26 + rnd() * 42;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      puff.position.set((rnd() - 0.5) * 130, (rnd() - 0.5) * 14, (rnd() - 0.5) * 60);
      puff.scale.y = 0.42;
      cloud.add(puff);
    }
    cloud.position.set((rnd() - 0.5) * 3800, 260 + rnd() * 160, (rnd() - 0.5) * 3800);
    group.add(cloud);
  }
  scene.add(group);
  return group;
}

export function buildRunway(scene) {
  const group = new THREE.Group();
  const y = 2.6;
  const L = CONFIG.runwayLength;
  const W = CONFIG.runwayWidth;
  const asphalt = new THREE.Mesh(
    new THREE.BoxGeometry(L, 0.5, W),
    new THREE.MeshStandardMaterial({ color: 0x33383d, roughness: 0.95 })
  );
  asphalt.position.set(0, y, 0);
  asphalt.receiveShadow = true;
  group.add(asphalt);
  // Centreline dashes.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf2f2e8 });
  for (let x = -L / 2 + 24; x < L / 2 - 10; x += 34) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(17, 0.2, 2.2), dashMat);
    dash.position.set(x, y + 0.35, 0);
    group.add(dash);
  }
  // Edge lines.
  for (const z of [-W / 2 + 2, W / 2 - 2]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(L, 0.2, 1.6), dashMat);
    edge.position.set(0, y + 0.35, z);
    group.add(edge);
  }
  // Threshold bars at both ends.
  for (const x of [-L / 2 + 12, L / 2 - 12]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, W - 10), dashMat);
    bar.position.set(x, y + 0.35, 0);
    group.add(bar);
  }
  // Windsock on a pole beside the threshold.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 16, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6 })
  );
  pole.position.set(-L / 2 + 30, y + 8, W / 2 + 14);
  group.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 9, 10),
    new THREE.MeshStandardMaterial({ color: 0xff7a2e, roughness: 0.8 })
  );
  sock.rotation.z = Math.PI / 2.4;
  sock.position.set(-L / 2 + 33, y + 15, W / 2 + 14);
  group.add(sock);
  scene.add(group);
  return group;
}

// Rings: torus gates. The next ring glows amber and pulses; cleared
// rings turn green and dim. Returns the ring meshes in course order.
export function buildRings(scene) {
  const group = new THREE.Group();
  const geo = new THREE.TorusGeometry(CONFIG.ringRadius, 1.7, 12, 42);
  const meshes = RINGS.map((ring, i) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8a5a12, emissive: 0xff9d1e, emissiveIntensity: 1.4, roughness: 0.4, metalness: 0.2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ring.x, ring.y, ring.z);
    // Face along the course: toward the next ring.
    const next = RINGS[(i + 1) % RINGS.length];
    mesh.lookAt(next.x, next.y, next.z);
    mesh.userData.index = i;
    group.add(mesh);
    return mesh;
  });
  scene.add(group);
  return { group, meshes };
}

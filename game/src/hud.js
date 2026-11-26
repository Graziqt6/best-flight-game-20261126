// Meridian Run — the instruments: HUD readouts, compass, horizon, overlays.
// One clear job: turn flight state into lit, readable instruments.

import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);

// Compass ticks: one label every 30 degrees.
const COMPASS_LABELS = ['N', '030', '060', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];

export function buildCompass() {
  const strip = $('compass-strip');
  // Three copies so the strip can scroll seamlessly.
  for (let copy = 0; copy < 3; copy++) {
    COMPASS_LABELS.forEach((label, i) => {
      const s = document.createElement('span');
      s.textContent = label;
      if (i % 3 === 0) s.className = 'cardinal';
      strip.appendChild(s);
    });
  }
}

function headingDegrees(heading) {
  // Heading 0 = east (+X); compass 090 = east.
  let deg = 90 - (heading * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return deg;
}

export function updateHud(state, mission) {
  const speedKnots = Math.round(state.speed * 1.944);
  $('speed').textContent = speedKnots;
  $('throttle-fill').style.width = `${Math.round(state.throttle * 100)}%`;

  const altitudeFeet = Math.max(0, Math.round((state.y - 2) * 3.281));
  $('altitude').textContent = altitudeFeet.toLocaleString('en-US');
  const vsi = Math.round(state.verticalSpeed * 196.9);
  $('vsi').textContent = `VS ${vsi >= 0 ? '+' : ''}${vsi.toLocaleString('en-US')} FT/MIN`;

  // Compass: scroll the strip so the current heading sits under the needle.
  const deg = headingDegrees(state.heading);
  $('heading-readout').textContent = String(Math.round(deg)).padStart(3, '0');
  const pxPerDeg = 56 / 30;
  const strip = $('compass-strip');
  const offset = 170 - deg * pxPerDeg - 12 * 56;
  strip.style.transform = `translateX(${offset}px)`;

  // Artificial horizon: the disc rotates with bank, the horizon slides with pitch.
  const disc = $('horizon-disc');
  disc.style.transform = `rotate(${-state.bank}rad)`;
  const sky = $('horizon-sky');
  const ground = $('horizon-ground');
  const pitchShift = (state.pitch * 180) / Math.PI * 1.6;
  sky.style.transform = `translateY(${pitchShift}px)`;
  ground.style.transform = `translateY(${pitchShift}px)`;

  $('ring-count').textContent = `${mission.ringsCleared}/${CONFIG.ringCount}`;
  if (mission.nextRing) {
    const d = Math.hypot(
      mission.nextRing.x - state.x,
      mission.nextRing.y - state.y,
      mission.nextRing.z - state.z
    );
    $('next-ring').textContent = `NEXT RING ${Math.round(d)} M — ${mission.nextRingBearing}`;
  } else {
    $('next-ring').textContent = 'ALL RINGS CLEARED — LAND ON THE RUNWAY';
  }
  $('fuel-fill').style.width = `${Math.max(0, mission.fuel)}%`;
  $('fuel-pct').textContent = `${Math.round(Math.max(0, mission.fuel))}%`;
  $('score').textContent = mission.score.toLocaleString('en-US');
  const t = Math.max(0, Math.ceil(mission.timeLeft));
  $('timer').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function showMessage(text, ms = 2200) {
  const el = $('message');
  el.setAttribute('aria-live', 'polite');
  el.textContent = text;
  clearTimeout(showMessage._t);
  showMessage._t = setTimeout(() => { el.textContent = ''; }, ms);
}

export function showOverlay() {
  $('overlay').classList.remove('hidden');
  $('hud').classList.add('hidden');
}

export function hideOverlay() {
  $('overlay').classList.add('hidden');
  $('hud').classList.remove('hidden');
}

export function showEnd(title, text, scoreLine) {
  $('end-title').textContent = title;
  $('end-text').textContent = text;
  $('end-score').textContent = scoreLine;
  $('end-overlay').classList.remove('hidden');
}

export function hideEnd() {
  $('end-overlay').classList.add('hidden');
}

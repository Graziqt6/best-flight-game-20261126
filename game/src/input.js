// Meridian Run — input: keyboard stick and throttle, mouse look.
// One clear job: turn keys and pointer into a -1..1 control frame.

export function makeInput() {
  const keys = new Set();
  const input = {
    pitch: 0,       // -1 descend .. +1 climb
    roll: 0,        // -1 left .. +1 right
    throttleDelta: 0,
    lookX: 0,       // mouse-look offset, eases back to 0
    lookY: 0,
    started: false, // any key or click: the gesture that starts audio
    restart: false, // R pressed this frame
  };

  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.code);
    input.started = true;
    if (e.code === 'KeyR') input.restart = true;
  };
  const up = (e) => keys.delete(e.code);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => keys.clear());

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const canvas = document.getElementById('scene');
  // Right-click drag looks around too: don't let the browser menu steal it.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    input.started = true;
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    input.lookX += (e.clientX - lastX) * 0.003;
    input.lookY += (e.clientY - lastY) * 0.002;
    lastX = e.clientX;
    lastY = e.clientY;
    input.lookX = Math.max(-0.9, Math.min(0.9, input.lookX));
    input.lookY = Math.max(-0.5, Math.min(0.5, input.lookY));
  });

  input.update = () => {
    const k = (code) => keys.has(code);
    const pitchUp = k('KeyW') || k('ArrowUp');
    const pitchDown = k('KeyS') || k('ArrowDown');
    const rollLeft = k('KeyA') || k('ArrowLeft');
    const rollRight = k('KeyD') || k('ArrowRight');
    input.pitch = (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0);
    input.roll = (rollRight ? 1 : 0) - (rollLeft ? 1 : 0);
    const thrUp = k('ShiftLeft') || k('ShiftRight') || k('Equal');
    const thrDown = k('ControlLeft') || k('ControlRight') || k('Minus');
    input.throttleDelta = (thrUp ? 1 : 0) - (thrDown ? 1 : 0);
    // Mouse look eases back to centre when released.
    if (!dragging) {
      input.lookX *= 0.94;
      input.lookY *= 0.94;
    }
  };

  input.consumeRestart = () => {
    const r = input.restart;
    input.restart = false;
    return r;
  };

  return input;
}

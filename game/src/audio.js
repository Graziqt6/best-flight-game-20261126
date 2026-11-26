// Meridian Run — sound: everything is synthesized, no audio files.
// One clear job: engine hum, wind, ring chimes and the crash thud.

export function makeAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;

  const audio = {
    ensure() {
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();

      // Engine: two detuned saws through a lowpass, pitch follows throttle.
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 62;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 93;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();

      // Wind: looped noise through a bandpass, louder with speed.
      // (Audio noise uses Math.random: it needs no determinism, unlike the world.)
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      noise.start();
    },

    update(throttle, speed, running) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const engineLevel = running ? 0.05 + throttle * 0.075 : 0;
      engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
      engineOsc.frequency.setTargetAtTime(58 + throttle * 95, t, 0.1);
      engineOsc2.frequency.setTargetAtTime(87 + throttle * 140, t, 0.1);
      const windLevel = running ? Math.min(0.11, speed * 0.0011) : 0;
      windGain.gain.setTargetAtTime(windLevel, t, 0.15);
      windFilter.frequency.setTargetAtTime(500 + speed * 9, t, 0.15);
    },

    chime() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [880, 1318.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.22, t + i * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + i * 0.09);
        osc.stop(t + i * 0.09 + 0.55);
      });
    },

    thud() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const len = ctx.sampleRate * 0.4;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 240;
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(t);
    },
  };
  return audio;
}

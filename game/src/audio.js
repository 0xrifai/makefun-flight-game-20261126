// Sky Courier — every sound is synthesised in code with WebAudio: an engine
// hum that follows the throttle, a chime when a ring is flown, a thud for a
// hard landing and a low rumble for a crash. No audio files, no network.

/** A fresh sound engine. Nothing plays until `unlock` runs on a user gesture. */
export function createAudio() {
  return {
    context: null,
    engineOscillator: null,
    engineGain: null,
    windGain: null,
    unlocked: false,
  };
}

/** Start the audio graph. Call from a key or pointer gesture, never at boot. */
export function unlockAudio(audio) {
  if (audio.unlocked) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    audio.context = context;
    audio.unlocked = true;
    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 55;
    const gain = context.createGain();
    gain.gain.value = 0;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    audio.engineOscillator = oscillator;
    audio.engineGain = gain;
    // Wind: filtered noise that rises with speed, built from a short buffer
    // generated once — the same buffer loops for the whole flight.
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 600;
    const windGain = context.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(context.destination);
    noise.start();
    audio.windGain = windGain;
  } catch {
    audio.unlocked = false;
  }
}

/** Follow the plane: engine pitch with throttle, wind with speed. */
export function updateAudio(audio, plane) {
  if (!audio.unlocked || !audio.context) return;
  const now = audio.context.currentTime;
  if (audio.engineOscillator) {
    audio.engineOscillator.frequency.setTargetAtTime(48 + plane.throttle * 70, now, 0.1);
  }
  if (audio.engineGain) {
    const level = plane.flight === 'ground' && plane.speed < 2 ? 0.015 : 0.02 + plane.throttle * 0.05;
    audio.engineGain.gain.setTargetAtTime(level, now, 0.15);
  }
  if (audio.windGain) {
    audio.windGain.gain.setTargetAtTime(Math.min(0.06, plane.speed * 0.0006), now, 0.2);
  }
}

function playTone(audio, frequency, duration, type, level, when) {
  if (!audio.unlocked || !audio.context) return;
  const context = audio.context;
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  const gain = context.createGain();
  const start = context.currentTime + (when || 0);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(level, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

/** Two bright notes: the sound of a ring flown. */
export function playRingChime(audio) {
  playTone(audio, 880, 0.35, 'sine', 0.18, 0);
  playTone(audio, 1318, 0.5, 'sine', 0.15, 0.09);
}

/** A low thud: wheels meeting the runway harder than they should. */
export function playThud(audio) {
  playTone(audio, 70, 0.3, 'triangle', 0.3, 0);
  playTone(audio, 45, 0.4, 'sine', 0.25, 0.02);
}

/** A short noise burst and a falling tone: the sortie is over. */
export function playCrash(audio) {
  if (!audio.unlocked || !audio.context) return;
  const context = audio.context;
  const buffer = context.createBuffer(1, context.sampleRate * 0.4, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const noise = context.createBufferSource();
  noise.buffer = buffer;
  const gain = context.createGain();
  gain.gain.value = 0.35;
  noise.connect(gain);
  gain.connect(context.destination);
  noise.start();
  playTone(audio, 160, 0.8, 'sawtooth', 0.2, 0);
}

/** A short fanfare of three notes: the courier delivered. */
export function playFanfare(audio) {
  playTone(audio, 523, 0.3, 'sine', 0.16, 0);
  playTone(audio, 659, 0.3, 'sine', 0.16, 0.14);
  playTone(audio, 784, 0.55, 'sine', 0.18, 0.28);
}

/** Silence the engine when the game leaves the play screen. */
export function quietAudio(audio) {
  if (!audio.unlocked || !audio.context || !audio.engineGain) return;
  audio.engineGain.gain.setTargetAtTime(0, audio.context.currentTime, 0.1);
  if (audio.windGain) audio.windGain.gain.setTargetAtTime(0, audio.context.currentTime, 0.1);
}

// Tones are synthesized as short WAV clips and played through real <audio>
// elements rather than raw Web Audio oscillators. iOS's Web Audio API is
// notoriously unreliable in standalone (Home Screen installed) web apps —
// silent even with the ringer and volume on — because it uses a flaky
// "ambient" audio session category there. HTMLAudioElement playback goes
// through iOS's ordinary media pipeline instead, which is reliable in that
// same standalone context.

import { getAlarmSound } from "./storage.js";

let enabled = false;
const urlCache = new Map();

export function setEnabled(value) {
  enabled = value;
}

export function isEnabled() {
  return enabled;
}

function renderToneWav(freq, duration, { type = "sine", volume = 0.35 } = {}) {
  const sampleRate = 44100;
  const numSamples = Math.max(1, Math.floor(duration * sampleRate));
  const samples = new Float32Array(numSamples);
  const attackSamples = sampleRate * 0.005;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const phase = 2 * Math.PI * freq * t;
    const wave = type === "square" ? Math.sign(Math.sin(phase)) : Math.sin(phase);
    const attack = Math.min(1, i / attackSamples);
    const decay = Math.exp((-3 * i) / numSamples);
    samples[i] = wave * volume * attack * decay;
  }

  return encodeWavPCM16(samples, sampleRate);
}

function encodeWavPCM16(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function toneUrl(key, factory) {
  if (!urlCache.has(key)) {
    urlCache.set(key, URL.createObjectURL(factory()));
  }
  return urlCache.get(key);
}

// One <audio> element is created per distinct tone and kept forever in this
// map, rather than a fresh element per play. A freshly created element with
// no other reference to it can be garbage collected mid-playback once the
// calling function returns — browsers (mobile Safari especially) don't treat
// an unreferenced element as "in use" just because it's still playing —
// which is why only the very first beep of a session reliably played.
// Reusing one permanently-referenced element per tone sidesteps that
// entirely: it's never eligible for GC for the life of the page.
const audioElements = new Map();

function getAudioElement(key, factory) {
  if (!audioElements.has(key)) {
    audioElements.set(key, new Audio(toneUrl(key, factory)));
  }
  return audioElements.get(key);
}

function play(key, factory) {
  const el = getAudioElement(key, factory);
  el.currentTime = 0;
  el.play().catch(() => {});
}

function playTone(key, freq, duration, options) {
  play(key, () => renderToneWav(freq, duration, options));
}

function tone(key, freq, duration, options) {
  if (!enabled) return;
  playTone(key, freq, duration, options);
}

// Silences the priming playback with `.muted` rather than `.volume = 0`:
// iOS Safari deliberately ignores HTMLMediaElement.volume on <audio>/<video>
// elements (only the hardware buttons may set volume there), so a volume-0
// "silent" priming play is actually fully audible on iOS. `.muted` is
// respected on every platform, including iOS.
function primeTone(key, freq, duration, options) {
  const el = getAudioElement(key, () => renderToneWav(freq, duration, options));
  el.muted = true;
  el.currentTime = 0;
  el.play()
    .then(() => {
      el.pause();
      el.currentTime = 0;
      el.muted = false;
    })
    .catch(() => {
      el.muted = false;
    });
}

// Call from a user gesture (e.g. tapping play) to unlock audio on iOS/Safari.
// Also primes every tone used, since on iOS a freshly created <audio>
// element that's never been played yet can silently drop a play() call if
// it's re-triggered again before its first play has fully loaded/decoded
// ("interrupted by a new load request") — playing each one once, muted,
// well before it's ever needed for real forces it to fully load so later
// plays start instantly and reliably.
export function unlockAudio() {
  play("unlock", () => renderToneWav(440, 0.05, { volume: 0 }));
  primeTone("alarmClassicBeep", 1318.5, 0.16, { type: "square", volume: 0.6 });
  primeTone("alarmChimeLow", 880, 0.35, { type: "sine", volume: 0.5 });
  primeTone("alarmChimeHigh", 1318.5, 0.45, { type: "sine", volume: 0.5 });
  primeTone("alarmUrgentHigh", 1567.98, 0.12, { type: "square", volume: 0.65 });
  primeTone("alarmUrgentLow", 1046.5, 0.12, { type: "square", volume: 0.65 });
  primeTone("itemDone", 660, 0.15, { type: "sine", volume: 0.3 });
}

// A countdown hitting zero (a Focus/Break transition, or a to-do timer
// running out) plays one of three selectable alarm variants — louder and
// more distinct than the old single double-beep, since a subtle single bleep
// was easy to miss.
const ALARM_VARIANTS = {
  classic: (playFn) => {
    playFn("alarmClassicBeep", 1318.5, 0.16, { type: "square", volume: 0.6 });
    setTimeout(() => playFn("alarmClassicBeep", 1318.5, 0.16, { type: "square", volume: 0.6 }), 220);
  },
  chime: (playFn) => {
    playFn("alarmChimeLow", 880, 0.35, { type: "sine", volume: 0.5 });
    setTimeout(() => playFn("alarmChimeHigh", 1318.5, 0.45, { type: "sine", volume: 0.5 }), 260);
  },
  urgent: (playFn) => {
    playFn("alarmUrgentHigh", 1567.98, 0.12, { type: "square", volume: 0.65 });
    setTimeout(() => playFn("alarmUrgentLow", 1046.5, 0.12, { type: "square", volume: 0.65 }), 160);
    setTimeout(() => playFn("alarmUrgentHigh", 1567.98, 0.12, { type: "square", volume: 0.65 }), 320);
    setTimeout(() => playFn("alarmUrgentLow", 1046.5, 0.12, { type: "square", volume: 0.65 }), 480);
  },
};

export function alarm() {
  if (!enabled) return;
  const variant = ALARM_VARIANTS[getAlarmSound()] || ALARM_VARIANTS.classic;
  variant(playTone);
}

// Plays a variant regardless of the mute state — used by the Customize
// picker so tapping an option always previews it, muted or not.
export function previewAlarm(key) {
  const variant = ALARM_VARIANTS[key] || ALARM_VARIANTS.classic;
  variant(playTone);
}

// Soft single tone confirming a to-do item was checked off.
export function itemDone() {
  tone("itemDone", 660, 0.15, { type: "sine", volume: 0.3 });
}

// Cheerful ascending run played once a session or list is fully complete.
export function celebrate() {
  if (!enabled) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    setTimeout(() => tone(`chord-${freq}`, freq, 0.28, { type: "sine", volume: 0.35 }), i * 140);
  });
}

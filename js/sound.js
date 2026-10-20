// 간단한 효과음 (WebAudio 합성 — 외부 파일 불필요)
let ctx = null;
let enabled = true;

function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

export function setEnabled(value) {
  enabled = value;
}

export function isEnabled() {
  return enabled;
}

function beep(freq, duration = 0.08, type = "square", gain = 0.06) {
  if (!enabled) return;
  const ac = audioCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume();
  const osc = ac.createOscillator();
  const vol = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  vol.gain.value = gain;
  osc.connect(vol).connect(ac.destination);
  const now = ac.currentTime;
  osc.start(now);
  vol.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.stop(now + duration);
}

export const sfx = {
  eat: () => beep(660, 0.07, "square"),
  over: () => {
    beep(330, 0.14, "sawtooth");
    setTimeout(() => beep(196, 0.22, "sawtooth"), 110);
  },
};

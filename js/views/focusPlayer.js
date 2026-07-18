import { getFocusTimer, saveFocusTimer, getSoundEnabled, setSoundEnabled, getActivity } from "../storage.js";
import { formatClock, focusTimerSequence } from "../util.js";
import * as audio from "../audio.js";
import { setWakeLockWanted } from "../wakelock.js";
import { ICON_PLAY, ICON_PAUSE, ICON_VOLUME_HIGH, ICON_VOLUME_XMARK } from "../icons.js";
import { activityIconSvg } from "../activityIcons.js";

const LEAD_IN_SECONDS = 3;
const WARNING_SECONDS = 3;
const RING_CIRCUMFERENCE = 2 * Math.PI * 54;

export function renderFocusPlayer(root, nav, timerId) {
  const timer = getFocusTimer(timerId);
  const sequence = timer ? focusTimerSequence(timer) : [];
  if (!timer || sequence.length === 0) {
    nav.toHome();
    return;
  }
  const activity = timer.activityId ? getActivity(timer.activityId) : null;

  const tpl = document.getElementById("tpl-player");
  root.replaceChildren(tpl.content.cloneNode(true));

  const progressFillEl = root.querySelector("#player-progress-fill");
  const totalTimerEl = root.querySelector("#total-timer");
  const intervalCountEl = root.querySelector("#interval-count");
  const intervalNameEl = root.querySelector("#interval-name");
  const setContextEl = root.querySelector("#set-context");
  const activityIconEl = root.querySelector("#player-activity-icon");
  const bigNumberEl = root.querySelector("#big-number");
  const bigLabelEl = root.querySelector("#big-label");
  const upNextEl = root.querySelector("#up-next");
  const countdownRingEl = root.querySelector("#countdown-ring");
  const countdownRingFillEl = root.querySelector("#countdown-ring-fill");
  const playPauseBtn = root.querySelector("#play-pause-btn");
  const prevBtn = root.querySelector("#prev-btn");
  const nextBtn = root.querySelector("#next-btn");
  const exitBtn = root.querySelector(".back-btn");
  const soundToggleBtn = root.querySelector("#sound-toggle-btn");

  const state = {
    index: 0,
    phase: "countdown", // 'countdown' | 'active'
    countdownRemaining: LEAD_IN_SECONDS,
    remaining: 0,
    totalElapsed: 0,
    running: false,
    started: false,
    finished: false,
  };

  let tickHandle = null;

  audio.setEnabled(getSoundEnabled());
  renderSoundToggle();

  enterInterval(0);
  togglePlay(); // start playing immediately — no extra tap needed

  playPauseBtn.addEventListener("click", togglePlay);
  prevBtn.addEventListener("click", goPrev);
  nextBtn.addEventListener("click", goNext);
  exitBtn.addEventListener("click", exit);
  soundToggleBtn.addEventListener("click", toggleSound);

  function togglePlay() {
    if (!state.started) {
      audio.unlockAudio();
      state.started = true;
    }
    state.running = !state.running;
    setWakeLockWanted(state.running);
    if (state.running) startTicking();
    else stopTicking();
    render();
  }

  function toggleSound() {
    const next = !audio.isEnabled();
    audio.setEnabled(next);
    setSoundEnabled(next);
    if (next) audio.unlockAudio();
    renderSoundToggle();
  }

  function renderSoundToggle() {
    const on = audio.isEnabled();
    soundToggleBtn.innerHTML = on ? ICON_VOLUME_HIGH : ICON_VOLUME_XMARK;
    soundToggleBtn.classList.toggle("active", on);
    soundToggleBtn.setAttribute("aria-label", on ? "Mute sound" : "Unmute sound");
  }

  function startTicking() {
    if (tickHandle) return;
    tickHandle = setInterval(tick, 1000);
  }

  function stopTicking() {
    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  function tick() {
    state.totalElapsed += 1;

    if (state.phase === "countdown") {
      state.countdownRemaining -= 1;
      if (state.countdownRemaining <= 0) {
        enterActivePhase();
      }
    } else if (state.phase === "active") {
      state.remaining -= 1;
      if (state.remaining > 0) {
        if (state.remaining <= WARNING_SECONDS) audio.countdownTick();
      } else {
        advance();
        render();
        return;
      }
    }
    render();
  }

  function enterActivePhase() {
    audio.intervalStart();
    state.phase = "active";
    state.remaining = currentInterval().amount;
  }

  function enterInterval(index) {
    state.index = index;
    state.phase = "countdown";
    state.countdownRemaining = LEAD_IN_SECONDS;
  }

  function currentInterval() {
    return sequence[state.index];
  }

  function goNext() {
    advance();
    render();
  }

  function goPrev() {
    if (state.phase === "active" || state.index === 0) {
      enterInterval(state.index);
    } else {
      enterInterval(Math.max(0, state.index - 1));
    }
    render();
  }

  function advance() {
    if (state.index >= sequence.length - 1) {
      finish();
    } else {
      enterInterval(state.index + 1);
    }
  }

  function finish() {
    state.finished = true;
    stopTicking();
    setWakeLockWanted(false);
    audio.workoutComplete();
    timer.lastCompletedSeconds = state.totalElapsed;
    saveFocusTimer(timer);
    nav.toFinish({
      timerName: timer.name,
      completedAt: Date.now(),
      totalSeconds: state.totalElapsed,
      intervals: sequence.map((i) => ({ name: i.name, amount: i.amount, kind: i.kind })),
    });
  }

  function exit() {
    stopTicking();
    setWakeLockWanted(false);
    nav.toHome();
  }

  function render() {
    totalTimerEl.textContent = formatClock(state.totalElapsed);
    intervalCountEl.textContent = `${state.index + 1} / ${sequence.length}`;
    playPauseBtn.innerHTML = state.running ? ICON_PAUSE : ICON_PLAY;
    progressFillEl.style.width = `${(state.index / sequence.length) * 100}%`;

    const interval = currentInterval();
    intervalNameEl.textContent = interval.name;
    intervalNameEl.className = "interval-name" + (interval.kind !== "focus" ? ` kind-${interval.kind}` : "");

    if (interval.totalRounds > 1) {
      setContextEl.textContent = `Round ${interval.round}/${interval.totalRounds}`;
      setContextEl.classList.remove("hidden");
    } else {
      setContextEl.classList.add("hidden");
    }

    if (activity && interval.kind === "focus") {
      activityIconEl.innerHTML = activityIconSvg(activity.iconKey);
      activityIconEl.classList.remove("hidden");
    } else {
      activityIconEl.classList.add("hidden");
    }

    const kindClass = interval.kind !== "focus" ? ` kind-${interval.kind}` : "";

    if (!state.started && state.phase === "countdown") {
      countdownRingEl.classList.add("hidden");
      bigNumberEl.classList.remove("hidden");
      bigNumberEl.textContent = formatClock(interval.amount);
      bigNumberEl.className = "big-number" + kindClass;
      bigLabelEl.textContent = "tap play to start";
    } else if (state.phase === "countdown") {
      bigNumberEl.classList.add("hidden");
      countdownRingEl.classList.remove("hidden");
      const fraction = (LEAD_IN_SECONDS - state.countdownRemaining) / LEAD_IN_SECONDS;
      countdownRingFillEl.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - fraction));
      bigLabelEl.textContent = "Get ready";
    } else {
      countdownRingEl.classList.add("hidden");
      bigNumberEl.classList.remove("hidden");
      bigNumberEl.textContent = formatClock(state.remaining);
      bigNumberEl.className = "big-number" + kindClass + (state.remaining <= WARNING_SECONDS ? " countdown" : "");
      bigLabelEl.textContent = "remaining";
    }

    const nextInterval = sequence[state.index + 1];
    if (state.phase === "active" && nextInterval) {
      upNextEl.textContent = `Up next: ${nextInterval.name}`;
      upNextEl.classList.remove("hidden");
    } else {
      upNextEl.classList.add("hidden");
    }
  }
}

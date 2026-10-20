// 게임 화면 오케스트레이션 (시작 → 게임 → 게임오버)
import { SnakeGame } from "./game.js";
import { getBestScore, saveResult, isReady, parseClassName } from "./db.js";
import { sfx, setEnabled as setSoundEnabled, isEnabled as isSoundEnabled } from "./sound.js";

const STORE_KEY = "snake_player";

const screens = {
  start: document.getElementById("screen-start"),
  game: document.getElementById("screen-game"),
  over: document.getElementById("screen-over"),
};

const el = {
  startForm: document.getElementById("start-form"),
  inputId: document.getElementById("input-student-id"),
  inputName: document.getElementById("input-name"),
  startError: document.getElementById("start-error"),
  hudName: document.getElementById("hud-name"),
  hudId: document.getElementById("hud-id"),
  hudScore: document.getElementById("hud-score"),
  hudBest: document.getElementById("hud-best"),
  btnSound: document.getElementById("btn-sound"),
  overlayPause: document.getElementById("overlay-pause"),
  resultScore: document.getElementById("result-score"),
  resultBest: document.getElementById("result-best"),
  resultSave: document.getElementById("result-save"),
  btnRetry: document.getElementById("btn-retry"),
  canvas: document.getElementById("board"),
};

let game = null;
let player = { studentId: "", name: "" };
let bestScore = 0;

function showScreen(name) {
  Object.entries(screens).forEach(([key, node]) => {
    node.classList.toggle("is-active", key === name);
  });
}

// ===== 시작 화면 =====
const ID_PATTERN = /^\d{1,2}-\d{1,2}-\d{1,2}$/;

function validateInputs(studentId, name) {
  if (!ID_PATTERN.test(studentId)) {
    return "학번 형식이 올바르지 않습니다. 예: 1-3-07";
  }
  if (!name.trim()) {
    return "성명을 입력하세요.";
  }
  return "";
}

el.startForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const studentId = el.inputId.value.trim();
  const name = el.inputName.value.trim();
  const error = validateInputs(studentId, name);
  el.startError.textContent = error;
  if (error) return;

  player = { studentId, name };
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(player));
  } catch { /* 저장소 비활성 환경 무시 */ }

  // 저장된 최고 점수를 불러온다(네트워크 실패해도 게임은 진행).
  bestScore = 0;
  try {
    bestScore = await getBestScore(studentId);
  } catch (err) {
    console.warn("최고 점수 조회 실패:", err);
  }

  startGame();
});

// 이전에 입력한 학생 정보 복원.
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  if (saved?.studentId) {
    el.inputId.value = saved.studentId;
    el.inputName.value = saved.name || "";
  }
} catch { /* 무시 */ }

// ===== 게임 화면 =====
function startGame() {
  el.hudName.textContent = player.name;
  el.hudId.textContent = player.studentId;
  el.hudBest.textContent = bestScore;
  el.hudScore.textContent = "0";
  el.overlayPause.classList.add("hidden");
  showScreen("game");

  if (!game) {
    game = new SnakeGame(el.canvas, {
      onScore: (score) => {
        el.hudScore.textContent = score;
        if (score > bestScore) el.hudBest.textContent = score;
      },
      onEat: () => sfx.eat(),
      onGameOver: handleGameOver,
    });
  }
  game.reset();
  game.start();
}

function handleGameOver(score) {
  sfx.over();
  showResult(score);
}

// 키보드 조작.
const KEY_MAP = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", a: "left", s: "down", d: "right",
  W: "up", A: "left", S: "down", D: "right",
};

window.addEventListener("keydown", (e) => {
  if (!screens.game.classList.contains("is-active")) return;
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    const paused = game?.togglePause();
    el.overlayPause.classList.toggle("hidden", !paused);
    return;
  }
  const dir = KEY_MAP[e.key];
  if (dir) {
    e.preventDefault();
    game?.setDirection(dir);
  }
});

// 사운드 토글.
el.btnSound.addEventListener("click", () => {
  const next = !isSoundEnabled();
  setSoundEnabled(next);
  el.btnSound.textContent = next ? "🔊" : "🔇";
  el.btnSound.setAttribute("aria-pressed", String(next));
});

// ===== 게임 오버 화면 =====
async function showResult(score) {
  el.resultScore.textContent = `점수: ${score}`;
  showScreen("over");

  const isLocalBest = score > bestScore;
  if (isLocalBest) {
    el.resultBest.textContent = "🎉 개인 최고 기록 갱신!";
    bestScore = score;
  } else {
    el.resultBest.textContent = `개인 최고: ${bestScore}`;
  }

  if (!isReady()) {
    el.resultSave.textContent = "⚠️ Firebase 미설정 — 기록이 저장되지 않았습니다(로컬 플레이).";
    return;
  }

  el.resultSave.textContent = "기록 저장 중…";
  try {
    const res = await saveResult({
      studentId: player.studentId,
      name: player.name,
      score,
    });
    bestScore = res.bestScore;
    el.resultSave.textContent = res.isNewBest
      ? `✅ 저장 완료 · 최고 기록 ${res.bestScore}점`
      : `✅ 저장 완료 · 최고 기록 ${res.bestScore}점 유지`;
  } catch (err) {
    console.error("기록 저장 실패:", err);
    el.resultSave.textContent = "❌ 저장 실패 — 네트워크를 확인하세요. (게임은 계속 가능)";
  }
}

el.btnRetry.addEventListener("click", startGame);

// 초기 화면.
showScreen("start");
el.btnSound.textContent = isSoundEnabled() ? "🔊" : "🔇";

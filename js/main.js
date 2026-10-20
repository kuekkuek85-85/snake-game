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
  boardWrap: document.querySelector(".board-wrap"),
  touchControls: document.getElementById("touch-controls"),
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
const ID_PATTERN = /^\d{5}$/;

function validateInputs(studentId, name) {
  if (!ID_PATTERN.test(studentId)) {
    return "학번은 숫자 5자리입니다. 예: 10130 (1학년 1반 30번)";
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

// 일시정지 토글 + 오버레이 동기화 (키보드/버튼 공용).
function togglePause() {
  const paused = game?.togglePause();
  el.overlayPause.classList.toggle("hidden", !paused);
}

window.addEventListener("keydown", (e) => {
  if (!screens.game.classList.contains("is-active")) return;
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    togglePause();
    return;
  }
  const dir = KEY_MAP[e.key];
  if (dir) {
    e.preventDefault();
    game?.setDirection(dir);
  }
});

// ===== 터치(스마트폰) 조작 =====
// 1) 화면 방향 패드(D-pad) 버튼
el.touchControls?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.action === "pause") {
    togglePause();
  } else if (btn.dataset.dir) {
    game?.setDirection(btn.dataset.dir);
  }
});

// 2) 보드 위 스와이프 제스처
const SWIPE_MIN = 24; // 최소 이동 거리(px)
let touchStart = null;

el.boardWrap?.addEventListener(
  "touchstart",
  (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  },
  { passive: true }
);

// 보드 영역에서의 스와이프가 페이지 스크롤로 새지 않게 막는다.
el.boardWrap?.addEventListener(
  "touchmove",
  (e) => {
    if (touchStart) e.preventDefault();
  },
  { passive: false }
);

el.boardWrap?.addEventListener(
  "touchend",
  (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      game?.setDirection(dx > 0 ? "right" : "left");
    } else {
      game?.setDirection(dy > 0 ? "down" : "up");
    }
  },
  { passive: true }
);

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

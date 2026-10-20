// 대시보드: Firestore players 컬렉션 실시간 순위표
import { subscribeRanking, isReady, parseClassName } from "./db.js";

const STORE_KEY = "snake_player";

const el = {
  body: document.getElementById("ranking-body"),
  filter: document.getElementById("filter-class"),
  status: document.getElementById("status-line"),
};

// 내 학번(시작 화면에서 저장됨) — 내 행 하이라이트에 사용.
let myId = "";
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  myId = saved?.studentId || "";
} catch { /* 무시 */ }

let unsubscribe = () => {};
let knownClasses = new Set();

function medalClass(rank) {
  if (rank === 1) return "rank-1";
  if (rank === 2) return "rank-2";
  if (rank === 3) return "rank-3";
  return "";
}

function medalLabel(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return rank;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function render(rows) {
  // 반 필터 옵션을 누적해서 채운다.
  let optionsChanged = false;
  rows.forEach((r) => {
    if (r.className && !knownClasses.has(r.className)) {
      knownClasses.add(r.className);
      optionsChanged = true;
    }
  });
  if (optionsChanged) rebuildClassOptions();

  if (rows.length === 0) {
    el.body.innerHTML = `<tr><td colspan="4" class="empty">아직 기록이 없습니다.</td></tr>`;
    return;
  }

  el.body.innerHTML = rows
    .map((r, i) => {
      const rank = i + 1;
      const isMe = r.studentId === myId;
      return `
        <tr class="${isMe ? "me" : ""}">
          <td class="rank ${medalClass(rank)}">${medalLabel(rank)}</td>
          <td>${escapeHtml(r.studentId)}</td>
          <td>${escapeHtml(r.name)}</td>
          <td class="col-score">${Number(r.bestScore ?? 0)}</td>
        </tr>`;
    })
    .join("");

  const now = new Date().toLocaleTimeString("ko-KR");
  el.status.textContent = `총 ${rows.length}명 · 마지막 갱신 ${now}`;
}

function rebuildClassOptions() {
  const current = el.filter.value;
  const sorted = [...knownClasses].sort();
  el.filter.innerHTML =
    `<option value="">전체</option>` +
    sorted.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}반</option>`).join("");
  el.filter.value = current;
}

function start(className) {
  unsubscribe();
  el.body.innerHTML = `<tr><td colspan="4" class="empty">불러오는 중…</td></tr>`;
  unsubscribe = subscribeRanking(
    { className, max: 50 },
    render,
    (err) => {
      console.error("순위 구독 오류:", err);
      el.body.innerHTML = `<tr><td colspan="4" class="empty">순위를 불러오지 못했습니다.</td></tr>`;
      el.status.textContent = "오류가 발생했습니다. 새로고침 해보세요.";
    }
  );
}

el.filter.addEventListener("change", () => start(el.filter.value));

// 내 반을 기본 옵션으로 미리 추가.
if (myId) {
  const myClass = parseClassName(myId);
  if (myClass) {
    knownClasses.add(myClass);
    rebuildClassOptions();
  }
}

if (!isReady()) {
  el.body.innerHTML = `<tr><td colspan="4" class="empty">⚠️ Firebase가 설정되지 않았습니다.<br/>js/firebase-config.js를 설정하세요.</td></tr>`;
  el.status.textContent = "";
} else {
  start("");
}

// Firebase Firestore 연동 레이어
// -------------------------------------------------------------
// players 컬렉션(학생별 최고 기록 1건)을 기본으로 하고,
// scores 컬렉션(모든 플레이 로그)에도 선택적으로 기록한다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  runTransaction,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

// 비정상 점수 상한(보안 규칙 예시와 일치).
export const MAX_SCORE = 10000;

let db = null;

export function initDb() {
  if (!isFirebaseConfigured()) return null;
  if (db) return db;
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  return db;
}

export function isReady() {
  return isFirebaseConfigured();
}

// "1-3-07" → "1-3"
export function parseClassName(studentId) {
  const parts = String(studentId).split("-");
  return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : "";
}

/** 학생의 현재 저장된 최고 점수를 가져온다. 없으면 0. */
export async function getBestScore(studentId) {
  if (!initDb()) return 0;
  const snap = await getDoc(doc(db, "players", studentId));
  return snap.exists() ? snap.data().bestScore ?? 0 : 0;
}

/**
 * 게임 결과를 저장한다.
 * - players/{학번}: 최고 점수일 때만 bestScore/updatedAt 갱신, playCount는 매판 +1
 * - scores/{자동ID}: 모든 플레이 로그(보조)
 * @returns {Promise<{ bestScore: number, isNewBest: boolean }>}
 */
export async function saveResult({ studentId, name, score }) {
  if (!initDb()) {
    return { bestScore: score, isNewBest: false, skipped: true };
  }
  const safeScore = clampScore(score);
  const className = parseClassName(studentId);
  const playerRef = doc(db, "players", studentId);

  // 트랜잭션으로 최고 기록 갱신과 playCount 증가를 원자적으로 처리.
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(playerRef);
    const prev = snap.exists() ? snap.data() : null;
    const prevBest = prev?.bestScore ?? 0;
    const prevCount = prev?.playCount ?? 0;
    const isNewBest = safeScore > prevBest;
    const bestScore = Math.max(prevBest, safeScore);

    const payload = {
      studentId,
      name,
      className,
      bestScore,
      playCount: prevCount + 1,
    };
    if (isNewBest || !snap.exists()) {
      payload.updatedAt = serverTimestamp();
    }
    tx.set(playerRef, payload, { merge: true });
    return { bestScore, isNewBest };
  });

  // 모든 판 로그 기록(실패해도 전체 저장은 성공으로 간주).
  try {
    await addDoc(collection(db, "scores"), {
      studentId,
      name,
      className,
      score: safeScore,
      playedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("scores 로그 저장 실패(무시):", err);
  }

  return result;
}

function clampScore(score) {
  const n = Math.floor(Number(score) || 0);
  return Math.max(0, Math.min(MAX_SCORE - 1, n));
}

/**
 * 대시보드용 실시간 순위 구독.
 * @param {{ className?: string, max?: number }} opts
 * @param {(rows: Array) => void} onData
 * @param {(err: Error) => void} [onError]
 * @returns {() => void} 구독 해제 함수
 */
export function subscribeRanking({ className = "", max = 50 } = {}, onData, onError) {
  if (!initDb()) {
    onError?.(new Error("Firebase가 설정되지 않았습니다."));
    return () => {};
  }
  const base = collection(db, "players");
  const constraints = [];
  if (className) constraints.push(where("className", "==", className));
  constraints.push(orderBy("bestScore", "desc"));
  constraints.push(limit(max));

  const q = query(base, ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(rows);
    },
    (err) => onError?.(err)
  );
}

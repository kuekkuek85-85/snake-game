// Firebase 프로젝트 설정
// -------------------------------------------------------------
// 아래 값을 본인의 Firebase 프로젝트 설정으로 교체하세요.
// Firebase 콘솔 → 프로젝트 설정 → 일반 → "내 앱" → SDK 설정 및 구성에서 확인할 수 있습니다.
//
// 값을 채우기 전까지는 기록 저장/대시보드 기능이 비활성화되고,
// 게임은 로컬(저장 없이)로만 동작합니다.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// 설정이 실제 값으로 교체되었는지 간단히 확인한다.
export function isFirebaseConfigured() {
  return (
    !!firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.startsWith("YOUR_") &&
    !!firebaseConfig.projectId &&
    !firebaseConfig.projectId.startsWith("YOUR_")
  );
}

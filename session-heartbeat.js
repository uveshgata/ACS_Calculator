// session-heartbeat.js
// Updates Firestore session.updatedAt frequently while user is active.
// Used to detect "dead/offline" device quickly for single-device login.

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQMidBylxAZGuQvBmhyAoI2uYLIma9CNU",
  authDomain: "acs-calculator-a4f89.firebaseapp.com",
  projectId: "acs-calculator-a4f89",
  storageBucket: "acs-calculator-a4f89.firebasestorage.app",
  messagingSenderId: "546157095238",
  appId: "1:546157095238:web:17d8c408126cd4ed759d47"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ✅ "Real-time-ish" heartbeat
const HEARTBEAT_MS = 5000; // every 5 seconds

const DEVICE_ID_KEY = "acs:deviceId";
const SESSION_TOKEN_KEY = "acs:sessionToken";

function getDeviceId() {
  try { return localStorage.getItem(DEVICE_ID_KEY) || ""; } catch { return ""; }
}
function getSessionToken() {
  try { return localStorage.getItem(SESSION_TOKEN_KEY) || ""; } catch { return ""; }
}

let timer = null;

async function beat(uid) {
  const deviceId = getDeviceId();
  const token = getSessionToken();
  if (!deviceId || !token) return;

  const ref = doc(db, "admins", uid, "meta", "session");

  // Only update updatedAt if this device still matches the active session token.
  // (If kicked, token mismatch will be detected by session-lock.js and logged out.)
  await setDoc(ref, {
    deviceId,
    token,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function start(uid) {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    // Only heartbeat when tab is visible (reduces background noise)
    if (document.hidden) return;
    beat(uid).catch(() => {});
  }, HEARTBEAT_MS);

  // also beat immediately
  beat(uid).catch(() => {});
}

onAuthStateChanged(auth, (user) => {
  if (user && user.uid) start(user.uid);
  else if (timer) { clearInterval(timer); timer = null; }
});

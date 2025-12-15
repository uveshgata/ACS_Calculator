// session.js
// Auto-logout after 5 minutes of inactivity (touch/mouse/scroll/keys/visibility)
// Uses localStorage to sync across tabs
// Prefer calling window.acsLogout() so Firestore session doc is cleared too

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

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

// 5 minutes
const IDLE_LIMIT_MS = 30 * 1000;

// Shared across tabs
const LAST_ACTIVE_KEY = "acs:lastActiveAt";

// Activity events (mobile + desktop)
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "touchmove", "scroll", "click"];

let idleTimer = null;
let listenersBound = false;

function nowMs() { return Date.now(); }

function setLastActive(ts) {
  try { localStorage.setItem(LAST_ACTIVE_KEY, String(ts)); } catch {}
}

function getLastActive() {
  try {
    const v = localStorage.getItem(LAST_ACTIVE_KEY);
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
}

async function doLogout(reasonMsg) {
  // Best: use your logout.js (clears Firestore session doc too)
  if (typeof window.acsLogout === "function") {
    try {
      // avoid showing confirm popup for auto-logout
      // we call internal behavior: temporarily bypass confirm by direct signOut if needed
      // If your acsLogout always confirms, fallback to direct signOut below.
      await window.acsLogout();
      return;
    } catch {}
  }

  try { await signOut(auth); } catch {}
  alert(reasonMsg || "You were logged out due to inactivity.");
  window.location.replace("login.html");
}

function resetIdleTimer() {
  const ts = nowMs();
  setLastActive(ts);

  if (idleTimer) clearTimeout(idleTimer);

  idleTimer = setTimeout(async () => {
    const last = getLastActive();
    const diff = nowMs() - last;

    if (diff >= IDLE_LIMIT_MS) {
      await doLogout("You were logged out due to 5 minutes inactivity.");
    } else {
      resetIdleTimer(); // another tab was active
    }
  }, IDLE_LIMIT_MS + 200);
}

function bindActivityListeners() {
  if (listenersBound) return;
  listenersBound = true;

  EVENTS.forEach(ev => {
    window.addEventListener(ev, resetIdleTimer, { passive: true });
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resetIdleTimer();
  });

  window.addEventListener("storage", (e) => {
    if (e.key === LAST_ACTIVE_KEY) resetIdleTimer();
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) return;

  if (!getLastActive()) setLastActive(nowMs());
  bindActivityListeners();
  resetIdleTimer();
});

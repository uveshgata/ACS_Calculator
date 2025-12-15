// session.js
// Auto-logout after 5 minutes of inactivity (touch/mouse/scroll/keys/visibility)
// Works with GitHub Pages + Firebase CDN imports

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

// Use localStorage so multiple tabs stay in sync
const LAST_ACTIVE_KEY = "acs:lastActiveAt";

// Activity events (mobile + desktop)
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "touchmove", "scroll", "click"];

let idleTimer = null;

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

function resetIdleTimer() {
  const ts = nowMs();
  setLastActive(ts);

  if (idleTimer) clearTimeout(idleTimer);

  idleTimer = setTimeout(async () => {
    // Double-check from storage (in case other tab updated)
    const last = getLastActive();
    const diff = nowMs() - last;

    if (diff >= IDLE_LIMIT_MS) {
      try {
        await signOut(auth);
      } catch {}
      alert("You were logged out due to 5 minutes inactivity.");
      window.location.replace("login.html");
    } else {
      // Someone was active in another tab; schedule again
      resetIdleTimer();
    }
  }, IDLE_LIMIT_MS + 200); // small buffer
}

function bindActivityListeners() {
  EVENTS.forEach(ev => {
    window.addEventListener(ev, resetIdleTimer, { passive: true });
  });

  // If user switches tabs and comes back, count it as activity
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resetIdleTimer();
  });

  // If another tab updates lastActiveAt, reset timer here too
  window.addEventListener("storage", (e) => {
    if (e.key === LAST_ACTIVE_KEY) resetIdleTimer();
  });
}

// Start only when logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Set initial
    if (!getLastActive()) setLastActive(nowMs());
    bindActivityListeners();
    resetIdleTimer();
  }
});

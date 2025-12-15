// session-lock.js
// Watches admin session token in Firestore and logs out if another device takes over.

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

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

const DEVICE_ID_KEY = "acs:deviceId";
const SESSION_TOKEN_KEY = "acs:sessionToken";

function genId() {
  // simple random id (good enough for session token/device id)
  return "id_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
}

function getOrCreateDeviceId() {
  let id = "";
  try { id = localStorage.getItem(DEVICE_ID_KEY) || ""; } catch {}
  if (!id) {
    id = genId();
    try { localStorage.setItem(DEVICE_ID_KEY, id); } catch {}
  }
  return id;
}

function getLocalSessionToken() {
  try { return localStorage.getItem(SESSION_TOKEN_KEY) || ""; } catch { return ""; }
}

function setLocalSessionToken(token) {
  try { localStorage.setItem(SESSION_TOKEN_KEY, token); } catch {}
}

let unsub = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    if (unsub) { unsub(); unsub = null; }
    return;
  }

  const uid = user.uid;
  const deviceId = getOrCreateDeviceId();

  // Watch session doc
  const ref = doc(db, "admins", uid, "meta", "session");

  if (unsub) { unsub(); unsub = null; }

  unsub = onSnapshot(ref, async (snap) => {
    const data = snap.exists() ? snap.data() : null;

    // If no session doc yet, do nothing (we'll create it in next step on login)
    if (!data || !data.token) return;

    const cloudToken = String(data.token);
    const localToken = getLocalSessionToken();

    // If local token not set yet, accept cloud token as current (first-time)
    if (!localToken) {
      setLocalSessionToken(cloudToken);
      return;
    }

    // If token changed, another device took over -> logout this device
    if (cloudToken !== localToken) {
      try { await signOut(auth); } catch {}
      alert("You were logged out because this account was opened on another device.");
      window.location.replace("login.html");
    }
  });
});

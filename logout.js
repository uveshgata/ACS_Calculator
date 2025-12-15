// logout.js
// Manual logout + clears Firestore session doc

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

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

// Local keys
const SESSION_TOKEN_KEY = "acs:sessionToken";

window.acsLogout = async function () {
  const ok = confirm("Do you want to logout?");
  if (!ok) return;

  const user = auth.currentUser;

  try {
    // Clear Firestore session doc (so it doesn't show false active login)
    if (user && user.uid) {
      const sessionRef = doc(db, "admins", user.uid, "meta", "session");
      await deleteDoc(sessionRef);
    }
  } catch (e) {
    // If delete fails, still logout (no blocking)
    console.error("Failed to clear session doc", e);
  }

  try {
    // Clear local session token
    try { localStorage.removeItem(SESSION_TOKEN_KEY); } catch {}

    await signOut(auth);
    window.location.replace("login.html");
  } catch (err) {
    alert("Logout failed. Try again.");
    console.error(err);
  }
};

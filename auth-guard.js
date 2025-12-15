// auth-guard.js
// Protects pages: if user is not logged in → redirect to login.html

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQMidBylxAZGuQvBmhyAoI2uYLIma9CNU",
  authDomain: "acs-calculator-a4f89.firebaseapp.com",
  projectId: "acs-calculator-a4f89",
  storageBucket: "acs-calculator-a4f89.firebasestorage.app",
  messagingSenderId: "546157095238",
  appId: "1:546157095238:web:17d8c408126cd4ed759d47"
};

// Avoid duplicate initializeApp (important when multiple pages/scripts load)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Global helper (we'll use later for per-admin cloud data)
window.getAdminUid = () => auth.currentUser?.uid || null;

// ✅ Auth guard
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // replace() prevents back button going to protected page
    window.location.replace("login.html");
  }
});

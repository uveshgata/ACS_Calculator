// logout.js
// Manual logout handler for ACS Calculator

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

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

// Expose global logout function
window.acsLogout = async function () {
  const ok = confirm("Do you want to logout?");
  if (!ok) return;

  try {
    await signOut(auth);
    window.location.replace("login.html");
  } catch (err) {
    alert("Logout failed. Try again.");
    console.error(err);
  }
};

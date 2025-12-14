// firebase.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQMidBylxAZGuQvBmhyAoI2uYLIma9CNU",
  authDomain: "acs-calculator-a4f89.firebaseapp.com",
  projectId: "acs-calculator-a4f89",
  storageBucket: "acs-calculator-a4f89.firebasestorage.app",
  messagingSenderId: "546157095238",
  appId: "1:546157095238:web:17d8c408126cd4ed759d47"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

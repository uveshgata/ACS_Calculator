// db-customers.js
// Firestore CRUD for customers (per admin)

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

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

function requireUser() {
  const u = auth.currentUser;
  if (!u) throw new Error("Not logged in");
  return u;
}

// Path: admins/{uid}/customers/{customerId}
function customersCol(uid) {
  return collection(db, "admins", uid, "customers");
}

export async function listCustomers() {
  const u = requireUser();
  const snap = await getDocs(customersCol(u.uid));
  const arr = [];
  snap.forEach(d => arr.push(d.data()));
  // latest first
  arr.sort((a,b) => (b.createdAtMs||0) - (a.createdAtMs||0));
  return arr;
}

export async function getCustomer(customerId) {
  const u = requireUser();
  const ref = doc(db, "admins", u.uid, "customers", customerId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function upsertCustomer(customer) {
  const u = requireUser();
  if (!customer || !customer.customerId) throw new Error("customerId required");

  const ref = doc(db, "admins", u.uid, "customers", customer.customerId);
  const payload = {
    ...customer,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  };

  if (!customer.createdAtMs) {
    payload.createdAt = serverTimestamp();
    payload.createdAtMs = Date.now();
  }

  await setDoc(ref, payload, { merge: true });
  return true;
}

export async function removeCustomer(customerId) {
  const u = requireUser();
  const ref = doc(db, "admins", u.uid, "customers", customerId);
  await deleteDoc(ref);
  return true;
}

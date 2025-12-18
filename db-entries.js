// db-entries.js
// Cloud storage for DAILY ENTRIES (per admin + per customer)
// Path: admins/{uid}/customers/{customerId}/entries/{dateIso}

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// ✅ Your Firebase config (same one you used everywhere)
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

// ---------- helpers ----------
function requireCustomerId(customerId) {
  const id = String(customerId || "").trim();
  if (!id) throw new Error("Missing customerId");
  return id;
}

function requireDateIso(dateIso) {
  const d = String(dateIso || "").trim();
  // basic check: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Invalid dateIso");
  return d;
}

async function getUidOrThrow() {
  const u = auth.currentUser;
  if (u && u.uid) return u.uid;

  // Wait briefly for auth state if called very early
  const uid = await new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user && user.uid) resolve(user.uid);
      else reject(new Error("Not logged in"));
    });
  });
  return uid;
}

function entryDocRef(uid, customerId, dateIso) {
  return doc(db, "admins", uid, "customers", customerId, "entries", dateIso);
}

function entriesColRef(uid, customerId) {
  return collection(db, "admins", uid, "customers", customerId, "entries");
}

// ---------- public API ----------

/**
 * Save or update one entry for a date.
 * data: { kg:number, rate:number }
 */
export async function upsertEntry(customerId, dateIso, data) {
  const cid = requireCustomerId(customerId);
  const d = requireDateIso(dateIso);
  const uid = await getUidOrThrow();

  const kg = Number(data?.kg);
  const rate = Number(data?.rate);

  if (!Number.isFinite(kg) || !Number.isFinite(rate)) {
    throw new Error("Invalid kg/rate");
  }

  await setDoc(
    entryDocRef(uid, cid, d),
    {
      dateIso: d,
      kg,
      rate,
      total: kg * rate,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return true;
}

/**
 * Read one entry by date.
 * Returns: {dateIso, kg, rate, total} or null
 */
export async function getEntry(customerId, dateIso) {
  const cid = requireCustomerId(customerId);
  const d = requireDateIso(dateIso);
  const uid = await getUidOrThrow();

  const snap = await getDoc(entryDocRef(uid, cid, d));
  return snap.exists() ? snap.data() : null;
}

/**
 * Delete one entry by date.
 */
export async function deleteEntry(customerId, dateIso) {
  const cid = requireCustomerId(customerId);
  const d = requireDateIso(dateIso);
  const uid = await getUidOrThrow();

  await deleteDoc(entryDocRef(uid, cid, d));
  return true;
}

/**
 * Get latest N entries (default 15), newest first.
 */
export async function listLatestEntries(customerId, take = 15) {
  const cid = requireCustomerId(customerId);
  const uid = await getUidOrThrow();

  const qy = query(
    entriesColRef(uid, cid),
    orderBy("dateIso", "desc"),
    limit(Math.max(1, Math.min(200, Number(take) || 15)))
  );

  const snap = await getDocs(qy);
  return snap.docs.map(d => d.data());
}

/**
 * Get entries for a date range (inclusive).
 * Returns a map: { "YYYY-MM-DD": {kg, rate, total, ...}, ... }
 */
export async function getEntriesRange(customerId, fromIso, toIso) {
  const cid = requireCustomerId(customerId);
  const uid = await getUidOrThrow();

  const from = requireDateIso(fromIso);
  const to = requireDateIso(toIso);
  if (from > to) throw new Error("fromIso > toIso");

  const qy = query(
    entriesColRef(uid, cid),
    orderBy("dateIso", "asc"),
    where("dateIso", ">=", from),
    where("dateIso", "<=", to)
  );

  const snap = await getDocs(qy);
  const map = {};
  snap.docs.forEach(docu => {
    const data = docu.data();
    if (data?.dateIso) map[data.dateIso] = data;
  });
  return map;
}

/* ============================================================
   ✅ COMPATIBILITY EXPORTS (Fixes your index.html import issue)
   Some pages expect: listEntriesInRange(...)
   We provide it here without breaking your existing functions.
   ============================================================ */

/**
 * listEntriesInRange(customerId, fromIso, toIso)
 * Returns ARRAY sorted by dateIso asc.
 */
export async function listEntriesInRange(customerId, fromIso, toIso) {
  const map = await getEntriesRange(customerId, fromIso, toIso);
  return Object.keys(map).sort().map(k => map[k]);
}

/**
 * If your index wants a MAP but named differently, use this.
 */
export async function listEntriesInRangeMap(customerId, fromIso, toIso) {
  return getEntriesRange(customerId, fromIso, toIso);
}

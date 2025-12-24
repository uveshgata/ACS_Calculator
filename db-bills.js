// db-bills.js
// Cloud storage for BILLS (per admin + per customer)
// Path: admins/{uid}/customers/{customerId}/bills/{billId}

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  writeBatch,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// ✅ Same config as your project
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

function requireBillId(billId) {
  const id = String(billId || "").trim();
  if (!id) throw new Error("Missing billId");
  return id;
}

function requireIsoDate(s) {
  const v = String(s || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("Invalid date");
  return v;
}

async function getUidOrThrow() {
  const u = auth.currentUser;
  if (u && u.uid) return u.uid;

  const uid = await new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user && user.uid) resolve(user.uid);
      else reject(new Error("Not logged in"));
    });
  });
  return uid;
}

function billsColRef(uid, customerId) {
  return collection(db, "admins", uid, "customers", customerId, "bills");
}

function billDocRef(uid, customerId, billId) {
  return doc(db, "admins", uid, "customers", customerId, "bills", billId);
}

function statusFromAmounts(total, paid) {
  const t = Number(total || 0);
  const p = Number(paid || 0);
  if (t <= 0) return "pending";
  if (p <= 0) return "pending";
  if (p < t) return "loading";
  return "success";
}

// Stable bill id for same range (so same range updates same bill)
function rangeBillId(fromIso, toIso) {
  return `RANGE-${fromIso}_to_${toIso}`;
}

// ---------- exports used by INDEX ----------

/**
 * Create/Update bill for current range coming from index.html report.
 * - Uses stable id RANGE-YYYY-MM-DD_to_YYYY-MM-DD so it doesn't create duplicates
 * - If bill exists and status is NOT pending => do NOT change total (keep locked)
 * - If bill exists and pending => update total
 * - paid is preserved always (unless doc doesn't exist)
 */
export async function upsertBillFromReport(customerId, { from, to, total }) {
  const cid = requireCustomerId(customerId);
  const uid = await getUidOrThrow();

  const fromIso = requireIsoDate(from);
  const toIso = requireIsoDate(to);
  if (fromIso > toIso) throw new Error("from > to");

  const t = Number(total || 0);
  if (!Number.isFinite(t) || t < 0) throw new Error("Invalid total");

  const billId = rangeBillId(fromIso, toIso);
  const ref = billDocRef(uid, cid, billId);

  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // create new bill
    const paid = 0;
    const status = statusFromAmounts(t, paid);

    await setDoc(ref, {
      id: billId,
      billId,
      from: fromIso,
      to: toIso,
      total: t,
      paid,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    return true;
  }

  const existing = snap.data() || {};
  const existingPaid = Number(existing.paid || 0);
  const existingStatus = String(existing.status || statusFromAmounts(existing.total, existingPaid));

  // If already locked, keep total untouched
  if (existingStatus === "loading" || existingStatus === "success") {
    await updateDoc(ref, { updatedAt: serverTimestamp() });
    return true;
  }

  // pending => allow total update
  const newStatus = statusFromAmounts(t, existingPaid);

  await updateDoc(ref, {
    from: fromIso,
    to: toIso,
    total: t,
    status: newStatus,
    updatedAt: serverTimestamp()
  });

  return true;
}

/**
 * Helper for index.html to check locking using cached bills list.
 * ✅ UPDATED: once date is part of ANY bill (pending/loading/success) => lock
 */
export function isDateLockedByBills(billsArray, dateIso) {
  const d = String(dateIso || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;

  const bills = Array.isArray(billsArray) ? billsArray : [];

  // ✅ any bill covering the date locks it (no matter status)
  return bills.some(b => {
    if (!b?.from || !b?.to) return false;
    return (b.from <= d && d <= b.to);
  });
}

// ---------- existing public API (kept) ----------

/**
 * Create/Update bill by explicit billId (still useful if bills page uses it).
 * Data required: {from, to, total}
 * Optional: {paid, createdAt}
 */
export async function upsertBill(customerId, billId, data) {
  const cid = requireCustomerId(customerId);
  const bid = requireBillId(billId);
  const uid = await getUidOrThrow();

  const from = requireIsoDate(data?.from);
  const to = requireIsoDate(data?.to);
  const total = Number(data?.total || 0);
  const paid = Number(data?.paid || 0);

  const status = statusFromAmounts(total, paid);

  await setDoc(
    billDocRef(uid, cid, bid),
    {
      id: bid,
      billId: bid,
      from,
      to,
      total,
      paid,
      status,
      updatedAt: serverTimestamp(),
      createdAt: data?.createdAt || new Date().toISOString()
    },
    { merge: true }
  );

  return true;
}

/**
 * List latest bills (newest first)
 */
export async function listBills(customerId, take = 200) {
  const cid = requireCustomerId(customerId);
  const uid = await getUidOrThrow();

  const qy = query(
    billsColRef(uid, cid),
    orderBy("createdAt", "desc"),
    limit(Math.max(1, Math.min(500, Number(take) || 200)))
  );

  const snap = await getDocs(qy);
  return snap.docs.map(d => d.data());
}

/**
 * Add payment to a bill (increments paid).
 * ✅ UPDATED: hard restriction: cannot pay more than remaining
 */
export async function addPayment(customerId, billId, amount) {
  const cid = requireCustomerId(customerId);
  const bid = requireBillId(billId);
  const uid = await getUidOrThrow();

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("Invalid payment amount");

  const ref = billDocRef(uid, cid, bid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Bill not found");

  const bill = snap.data() || {};
  const total = Number(bill.total || 0);
  const currentPaid = Number(bill.paid || 0);

  const remaining = Math.max(total - currentPaid, 0);

  // ✅ hard restriction
  if (amt > remaining) {
    throw new Error(`Payment exceeds remaining amount (₹${Math.round(remaining)}).`);
  }

  const newPaid = currentPaid + amt;
  const status = statusFromAmounts(total, newPaid);

  await updateDoc(ref, {
    paid: increment(amt),
    status,
    updatedAt: serverTimestamp()
  });

  return true;
}

/**
 * ✅ NEW: Set paid amount directly (for corrections)
 * Only modifies paid (0..total) and recalculates status.
 */
export async function setPaidAmount(customerId, billId, newPaid) {
  const cid = requireCustomerId(customerId);
  const bid = requireBillId(billId);
  const uid = await getUidOrThrow();

  const ref = billDocRef(uid, cid, bid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Bill not found");

  const bill = snap.data() || {};
  const total = Number(bill.total || 0);

  const p = Number(newPaid);
  if (!Number.isFinite(p) || p < 0) throw new Error("Invalid paid amount");
  if (p > total) throw new Error(`Paid cannot be more than total (₹${Math.round(total)}).`);

  const status = statusFromAmounts(total, p);

  await updateDoc(ref, {
    paid: p,
    status,
    updatedAt: serverTimestamp()
  });

  return true;
}

/**
 * ✅ NEW: Delete one bill
 */
export async function deleteBill(customerId, billId) {
  const cid = requireCustomerId(customerId);
  const bid = requireBillId(billId);
  const uid = await getUidOrThrow();

  const ref = billDocRef(uid, cid, bid);
  await deleteDoc(ref);
  return true;
}

/**
 * Clear ALL bills for a customer.
 */
export async function clearBills(customerId) {
  const cid = requireCustomerId(customerId);
  const uid = await getUidOrThrow();

  const snap = await getDocs(billsColRef(uid, cid));
  const batch = writeBatch(db);

  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  return true;
}

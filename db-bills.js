// db-bills.js
// Cloud storage for BILLS (per admin + per customer)
// Path: admins/{uid}/customers/{customerId}/bills/{billId}

import { auth } from "./firebase.js";

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
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const db = getFirestore();

function requireCustomerId(customerId) {
  const id = String(customerId || "").trim();
  if (!id) throw new Error("Missing customerId");
  return id;
}

function requireIso(d) {
  const s = String(d || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Invalid date ISO");
  return s;
}

function requireBillId(billId) {
  const id = String(billId || "").trim();
  if (!id) throw new Error("Missing billId");
  return id;
}

function statusFromAmounts(total, paid) {
  const t = Number(total || 0);
  const p = Number(paid || 0);
  if (t <= 0) return "pending";
  if (p <= 0) return "pending";
  if (p < t) return "loading";
  return "success";
}

function billsColRef(uid, customerId) {
  return collection(db, "admins", uid, "customers", customerId, "bills");
}

function billDocRef(uid, customerId, billId) {
  return doc(db, "admins", uid, "customers", customerId, "bills", billId);
}

/**
 * Create/Update bill for a range (from-to).
 * If bill exists for same range -> updates total only when status is pending.
 * Returns billId.
 */
export async function upsertBillForRange(customerId, fromIso, toIso, total) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const cid = requireCustomerId(customerId);
  const from = requireIso(fromIso);
  const to = requireIso(toIso);
  if (from > to) throw new Error("fromIso > toIso");

  const t = Number(total || 0);

  // Find existing bill for same range (limit 1)
  const qy = query(
    billsColRef(user.uid, cid),
    where("from", "==", from),
    where("to", "==", to),
    limit(1)
  );

  const snap = await getDocs(qy);

  if (snap.docs.length === 0) {
    if (t <= 0) return null;

    const billId = "BILL-" + Date.now();
    await setDoc(billDocRef(user.uid, cid, billId), {
      billId,
      from,
      to,
      total: t,
      paid: 0,
      status: statusFromAmounts(t, 0),
      createdAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    return billId;
  }

  // Exists -> update only if pending
  const d0 = snap.docs[0];
  const data = d0.data() || {};
  const paid = Number(data.paid || 0);
  const status = statusFromAmounts(Number(data.total || 0), paid);

  if (status !== "pending") {
    // do not modify totals if payment started/paid
    return d0.id;
  }

  await setDoc(billDocRef(user.uid, cid, d0.id), {
    total: t,
    status: statusFromAmounts(t, paid),
    updatedAt: serverTimestamp()
  }, { merge: true });

  return d0.id;
}

/**
 * Add payment (atomic increment).
 * Returns nothing.
 */
export async function addPayment(customerId, billId, amount) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const cid = requireCustomerId(customerId);
  const id = requireBillId(billId);
  const amt = Number(amount || 0);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("Invalid amount");

  const ref = billDocRef(user.uid, cid, id);

  await setDoc(ref, { updatedAt: serverTimestamp() }, { merge: true });
  await (await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js")).updateDoc(ref, {
    paid: increment(amt),
    updatedAt: serverTimestamp()
  });
}

/**
 * List bills (latest first).
 */
export async function listBills(customerId, take = 200) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const cid = requireCustomerId(customerId);

  const qy = query(
    billsColRef(user.uid, cid),
    orderBy("createdAt", "desc"),
    limit(Math.max(1, Math.min(500, Number(take) || 200)))
  );

  const snap = await getDocs(qy);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Delete all bills for customer.
 */
export async function clearBills(customerId) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const cid = requireCustomerId(customerId);
  const snap = await getDocs(billsColRef(user.uid, cid));
  const ops = snap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(ops);
}

/**
 * Helper for locking: returns true if ANY bill covering date is loading/success.
 */
export async function isDateLockedByBills(customerId, dateIso) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const cid = requireCustomerId(customerId);
  const date = requireIso(dateIso);

  // Bills that cover this date: from <= date <= to
  const qy = query(
    billsColRef(user.uid, cid),
    where("from", "<=", date),
    where("to", ">=", date)
  );

  const snap = await getDocs(qy);

  return snap.docs.some(d => {
    const b = d.data() || {};
    const status = statusFromAmounts(Number(b.total || 0), Number(b.paid || 0));
    return status === "loading" || status === "success";
  });
}

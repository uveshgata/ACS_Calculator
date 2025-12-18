
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
  writeBatch
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

async function getUidOrThrow() {
  const u = auth.currentUser;
  if (u && u.uid) return u.uid;

  // Wait for auth
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

// ---------- public API ----------

/**
 * Create/Update bill for range (from-to).
 * If billId is missing, you can generate one outside, or use "BILL-<timestamp>".
 * Data required: {from, to, total}
 * Optional: {paid}
 */
export async function upsertBill(customerId, billId, data) {
  const cid = requireCustomerId(customerId);
  const bid = requireBillId(billId);
  const uid = await getUidOrThrow();

  const from = String(data?.from || "").trim();
  const to = String(data?.to || "").trim();
  const total = Number(data?.total || 0);
  const paid = Number(data?.paid || 0);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("Invalid from/to");
  }

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
 * billId is required.
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

  const bill = snap.data();
  const newPaid = Number(bill.paid || 0) + amt;
  const total = Number(bill.total || 0);
  const status = statusFromAmounts(total, newPaid);

  await updateDoc(ref, {
    paid: increment(amt),
    status,
    updatedAt: serverTimestamp()
  });

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

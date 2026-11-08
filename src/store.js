// Data layer for bookings. Talks to Firestore, or to localStorage in demo mode.
//
// Firestore layout (see firestore.rules):
//   slots/{YYYY-MM-DD_HHMM}     public, only { date, time }. Create-only => no double booking.
//   bookings/{YYYY-MM-DD_HHMM}  private to the admin. Full customer + business details.

import {
  collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch
} from "firebase/firestore";
import { db } from "./firebase.js";
import { DEMO } from "./config.js";

export const slotId = (date, time) => `${date}_${time.replace(":", "")}`;

/* ------------------------------ demo storage ------------------------------ */
const KEY = "bc_demo_bookings";
const readDemo = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const writeDemo = list => { localStorage.setItem(KEY, JSON.stringify(list)); window.dispatchEvent(new Event("bc-demo-change")); };
const normDemo = b => ({ ...b, createdAt: b.createdAt ? new Date(b.createdAt) : null });

/* -------------------------------- public API ------------------------------ */

/** Set of "HH:MM" times already booked on a given date. */
export async function getTaken(date) {
  if (DEMO) {
    return new Set(readDemo().filter(b => b.date === date && b.status !== "cancelled").map(b => b.time));
  }
  const snap = await getDocs(query(collection(db, "slots"), where("date", "==", date)));
  return new Set(snap.docs.map(d => d.data().time));
}

/** Save a booking. Throws an error with code "slot-taken" (demo) or "permission-denied" (Firestore) if the slot is gone. */
export async function saveBooking(b) {
  if (DEMO) {
    const list = readDemo();
    if (list.some(x => x.date === b.date && x.time === b.time && x.status !== "cancelled")) {
      throw Object.assign(new Error("taken"), { code: "slot-taken" });
    }
    list.push({ ...b, id: `${slotId(b.date, b.time)}_${Date.now()}`, createdAt: new Date().toISOString() });
    writeDemo(list);
    return;
  }
  const id = slotId(b.date, b.time);
  const batch = writeBatch(db);
  // The slot doc is create-only in the rules. If someone already holds it, the whole batch is rejected.
  batch.set(doc(db, "slots", id), { date: b.date, time: b.time, createdAt: serverTimestamp() });
  batch.set(doc(db, "bookings", id), { ...b, createdAt: serverTimestamp() });
  await batch.commit();
}

/* -------------------------------- admin API ------------------------------- */

/** Live list of all bookings. Returns an unsubscribe function. */
export function subscribeBookings(onData, onError) {
  if (DEMO) {
    const push = () => onData(readDemo().map(normDemo));
    window.addEventListener("bc-demo-change", push);
    window.addEventListener("storage", push);
    push();
    return () => { window.removeEventListener("bc-demo-change", push); window.removeEventListener("storage", push); };
  }
  return onSnapshot(
    query(collection(db, "bookings"), orderBy("date", "desc")),
    snap => onData(snap.docs.map(d => {
      const x = d.data();
      return { id: d.id, ...x, createdAt: x.createdAt?.toDate?.() ?? null };
    })),
    onError
  );
}

/** Change status and/or notes. */
export async function updateBooking(id, patch) {
  if (DEMO) {
    writeDemo(readDemo().map(b => (b.id === id ? { ...b, ...patch } : b)));
    return;
  }
  await updateDoc(doc(db, "bookings", id), { ...patch, updatedAt: serverTimestamp() });
}

/** Cancel a booking and free its time slot so someone else can book it. */
export async function cancelBooking(id) {
  if (DEMO) {
    writeDemo(readDemo().map(b => (b.id === id ? { ...b, status: "cancelled" } : b)));
    return;
  }
  const batch = writeBatch(db);
  batch.update(doc(db, "bookings", id), { status: "cancelled", updatedAt: serverTimestamp() });
  batch.delete(doc(db, "slots", id));
  await batch.commit();
}

// Security-rules tests. Run with `npm run test:rules` (starts the emulators
// with a demo-* project, so nothing touches the live Firebase project).
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";

const DENTIST_UID = "nXfM7K8iYYaMcYgviUUO6sTdxyi1";
const DAY = 24 * 60 * 60 * 1000;
const rules = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-njn",
    firestore: { rules: rules("firestore.rules"), host: "127.0.0.1", port: 18960 },
    storage: { rules: rules("storage.rules"), host: "127.0.0.1", port: 18961 }
  });
});

after(() => env.cleanup());

// Slot times are whole hours so they match what the website generates.
function slotAt(offsetMs) {
  const d = new Date(Date.now() + offsetMs);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

const slotId = (date) => `slot_${date.getTime()}`;

// Fake test data only, never real patient details.
function appointment(date, extra = {}) {
  return {
    patientName: "Test Patient",
    patientAge: 30,
    patientPhone: "01700000000",
    description: "Rules test",
    fileURL: null,
    slotStart: Timestamp.fromDate(date),
    status: "pending",
    createdAt: serverTimestamp(),
    ...extra
  };
}

// Same writes the website's bookSlot() makes.
function book(db, date, { appt = appointment(date), slotStatus = true, id = slotId(date) } = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, "appointments", id), appt);
  if (slotStatus) batch.set(doc(db, "slotStatus", id), { slotStart: Timestamp.fromDate(date), status: "pending" });
  return batch.commit();
}

async function seed(path, data) {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));
}

const anon = () => env.unauthenticatedContext().firestore();
const stranger = () => env.authenticatedContext("someone-else").firestore();
const dentist = () => env.authenticatedContext(DENTIST_UID).firestore();

describe("firestore", () => {
  beforeEach(() => env.clearFirestore());

  test("anonymous booking with appointment + slotStatus is allowed", async () => {
    await assertSucceeds(book(anon(), slotAt(2 * DAY)));
  });

  test("the website's transaction is allowed", async () => {
    const db = anon();
    const date = slotAt(3 * DAY);
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const s = doc(db, "slotStatus", slotId(date));
        await tx.get(s);
        tx.set(doc(db, "appointments", slotId(date)), appointment(date));
        tx.set(s, { slotStart: Timestamp.fromDate(date), status: "pending" });
      })
    );
  });

  test("slotStatus create without an appointment is denied", async () => {
    const date = slotAt(2 * DAY);
    await assertFails(
      setDoc(doc(anon(), "slotStatus", slotId(date)), { slotStart: Timestamp.fromDate(date), status: "pending" })
    );
  });

  test("appointment create without slotStatus is denied", async () => {
    await assertFails(book(anon(), slotAt(2 * DAY), { slotStatus: false }));
  });

  test("slotStatus create next to an older pending appointment is denied", async () => {
    const date = slotAt(2 * DAY);
    await seed(`appointments/${slotId(date)}`, { ...appointment(date), createdAt: Timestamp.fromDate(new Date(Date.now() - DAY)) });
    await assertFails(
      setDoc(doc(anon(), "slotStatus", slotId(date)), { slotStart: Timestamp.fromDate(date), status: "pending" })
    );
  });

  test("past slot is denied", async () => {
    await assertFails(book(anon(), slotAt(-DAY)));
  });

  test("slot more than 60 days out is denied", async () => {
    await assertFails(book(anon(), slotAt(61 * DAY)));
  });

  test("doc id that does not match slotStart is denied", async () => {
    const date = slotAt(2 * DAY);
    await assertFails(book(anon(), date, { id: slotId(slotAt(5 * DAY)) }));
  });

  test("patient cannot mark a slot booked", async () => {
    const date = slotAt(2 * DAY);
    const db = anon();
    const batch = writeBatch(db);
    batch.set(doc(db, "appointments", slotId(date)), appointment(date));
    batch.set(doc(db, "slotStatus", slotId(date)), { slotStart: Timestamp.fromDate(date), status: "booked" });
    await assertFails(batch.commit());
  });

  test("re-booking a cancelled (declined) slot is allowed", async () => {
    const date = slotAt(2 * DAY);
    const id = slotId(date);
    await seed(`appointments/${id}`, { ...appointment(date), status: "cancelled", createdAt: Timestamp.now() });
    await seed(`slotStatus/${id}`, { slotStart: Timestamp.fromDate(date), status: "cancelled" });
    await assertSucceeds(book(anon(), date));
  });

  test("re-opening a cancelled slotStatus alone is denied", async () => {
    const date = slotAt(2 * DAY);
    const id = slotId(date);
    await seed(`appointments/${id}`, { ...appointment(date), status: "cancelled", createdAt: Timestamp.now() });
    await seed(`slotStatus/${id}`, { slotStart: Timestamp.fromDate(date), status: "cancelled" });
    await assertFails(setDoc(doc(anon(), "slotStatus", id), { slotStart: Timestamp.fromDate(date), status: "pending" }));
  });

  test("overwriting a cancelled appointment alone is denied", async () => {
    const date = slotAt(2 * DAY);
    const id = slotId(date);
    await seed(`appointments/${id}`, { ...appointment(date), status: "cancelled", createdAt: Timestamp.now() });
    await seed(`slotStatus/${id}`, { slotStart: Timestamp.fromDate(date), status: "cancelled" });
    await assertFails(book(anon(), date, { slotStatus: false }));
  });

  for (const status of ["pending", "booked"]) {
    test(`overwriting a ${status} slot is denied`, async () => {
      const date = slotAt(2 * DAY);
      const id = slotId(date);
      await seed(`appointments/${id}`, { ...appointment(date), status, createdAt: Timestamp.now() });
      await seed(`slotStatus/${id}`, { slotStart: Timestamp.fromDate(date), status });
      await assertFails(book(stranger(), date));
    });
  }

  test("dentist can accept, decline and move", async () => {
    const date = slotAt(2 * DAY);
    const id = slotId(date);
    await seed(`appointments/${id}`, { ...appointment(date), createdAt: Timestamp.now() });
    await seed(`slotStatus/${id}`, { slotStart: Timestamp.fromDate(date), status: "pending" });
    const db = dentist();
    await assertSucceeds(updateDoc(doc(db, "appointments", id), { status: "booked" }));
    await assertSucceeds(setDoc(doc(db, "slotStatus", id), { slotStart: Timestamp.fromDate(date), status: "booked" }));
    await assertSucceeds(updateDoc(doc(db, "appointments", id), { status: "cancelled" }));
    await assertSucceeds(setDoc(doc(db, "slotStatus", id), { slotStart: Timestamp.fromDate(date), status: "cancelled" }));
    const moved = slotAt(4 * DAY);
    await assertSucceeds(setDoc(doc(db, "slotStatus", slotId(moved)), { slotStart: Timestamp.fromDate(moved), status: "booked" }));
  });

  test("only the dentist reads appointments; anyone reads slotStatus and config", async () => {
    const date = slotAt(2 * DAY);
    await seed(`appointments/${slotId(date)}`, { ...appointment(date), createdAt: Timestamp.now() });
    await seed(`slotStatus/${slotId(date)}`, { slotStart: Timestamp.fromDate(date), status: "pending" });
    await assertFails(getDoc(doc(anon(), "appointments", slotId(date))));
    await assertSucceeds(getDoc(doc(dentist(), "appointments", slotId(date))));
    await assertSucceeds(getDoc(doc(anon(), "slotStatus", slotId(date))));
    await assertSucceeds(getDoc(doc(anon(), "config", "businessHours")));
    await assertFails(setDoc(doc(anon(), "config", "businessHours"), { workStart: "00:00" }));
  });
});

describe("storage", () => {
  const png = new Uint8Array([137, 80, 78, 71]);
  const path = "appointment-images/slot_1-1.png";

  before(() =>
    env.withSecurityRulesDisabled((ctx) => uploadBytes(ref(ctx.storage(), path), png, { contentType: "image/png" }))
  );

  test("strangers cannot read uploaded images", async () => {
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), path)));
    await assertFails(getBytes(ref(env.authenticatedContext("someone-else").storage(), path)));
  });

  test("the dentist can read uploaded images", async () => {
    await assertSucceeds(getBytes(ref(env.authenticatedContext(DENTIST_UID).storage(), path)));
  });

  test("patients can still upload a small image", async () => {
    await assertSucceeds(
      uploadBytes(ref(env.unauthenticatedContext().storage(), "appointment-images/slot_2-2.png"), png, { contentType: "image/png" })
    );
  });
});

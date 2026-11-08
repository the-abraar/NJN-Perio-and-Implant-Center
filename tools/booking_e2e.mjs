// End-to-end check of the website booking flow against the Firebase emulators.
// Never touches the live project: it serves a temp copy of public/ with a demo
// config (projectId demo-njn) pointed at a local Firestore emulator.
//
// Needs Java, Chrome, and two npm packages outside the repo:
//   npm i --prefix /tmp/njn-e2e puppeteer-core@23 firebase-tools
//   NODE_PATH=/tmp/njn-e2e/node_modules PATH=/tmp/njn-e2e/node_modules/.bin:$PATH \
//     node tools/booking_e2e.mjs
// Env: CHROME (Chrome binary), E2E_PORT (first of five free ports, default 18940).
import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(join(process.cwd(), "noop.js"));
const puppeteer = require("puppeteer-core");

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = Number(process.env.E2E_PORT || 18940);
const ports = { firestore: base, hub: base + 1, logging: base + 2, hosting: base + 3, ws: base + 4 };
const projectId = "demo-njn";
const chrome = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const fsUrl = `http://127.0.0.1:${ports.firestore}/v1/projects/${projectId}/databases/(default)/documents`;

const dir = mkdtempSync(join(tmpdir(), "njn-e2e-"));
cpSync(join(repo, "public"), join(dir, "public"), { recursive: true });
cpSync(join(repo, "firestore.rules"), join(dir, "firestore.rules"));
writeFileSync(join(dir, "public/firebase-config.js"),
  `export const firebaseConfig = { apiKey: "demo", projectId: "${projectId}", appId: "demo" };\n`);
const scriptPath = join(dir, "public/script.js");
const script = readFileSync(scriptPath, "utf8");
const hook = "const db = firestoreSdk.getFirestore(app);";
assert.ok(script.includes(hook), "script.js no longer creates db the expected way; update this check");
writeFileSync(scriptPath, script.replace(hook,
  `${hook}\n    firestoreSdk.connectFirestoreEmulator(db, "127.0.0.1", ${ports.firestore});`));
writeFileSync(join(dir, "firebase.json"), JSON.stringify({
  hosting: { public: "public" },
  firestore: { rules: "firestore.rules" },
  emulators: {
    firestore: { port: ports.firestore, websocketPort: ports.ws },
    hosting: { port: ports.hosting },
    hub: { port: ports.hub },
    logging: { port: ports.logging },
    ui: { enabled: false }
  }
}));

const emu = spawn("firebase", ["emulators:start", "--only", "firestore,hosting", "--project", projectId],
  { cwd: dir, stdio: ["ignore", "pipe", "pipe"], detached: true });
let browser;
try {
  await new Promise((resolve, reject) => {
    let log = "";
    const onData = chunk => {
      log += chunk;
      if (log.includes("All emulators ready")) resolve();
    };
    emu.stdout.on("data", onData);
    emu.stderr.on("data", onData);
    emu.on("exit", code => reject(new Error(`emulators exited (${code}):\n${log}`)));
    setTimeout(() => reject(new Error(`emulators did not start:\n${log}`)), 90000);
  });

  browser = await puppeteer.launch({ executablePath: chrome, headless: true });
  const page = await browser.newPage();
  const requested = [];
  page.on("request", request => requested.push(request.url()));
  await page.goto(`http://127.0.0.1:${ports.hosting}/`, { waitUntil: "load" });
  await page.waitForFunction(() => window.NJNAppointmentUtils && document.querySelector("#slot-status").textContent);

  // Two days out, skipping Fridays, so slots are never in the past.
  const slotStarts = await page.evaluate(() => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + 2);
    if (day.getDay() === 5) day.setDate(day.getDate() + 1);
    const input = document.querySelector("#appointment-date");
    input.value = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    document.querySelector("#slot-status").textContent = "";
    input.dispatchEvent(new Event("change"));
    return window.NJNAppointmentUtils.generateSlots(day, "17:00", "22:00", 45).map(slot => slot.start.getTime());
  });
  await page.waitForFunction(() => document.querySelector("#slot-status").textContent.startsWith("Updated slots"));

  async function book(slotIndex, name) {
    const buttons = await page.$$("#slot-grid .slot-button");
    await buttons[slotIndex].click();
    await page.type("input[name=patientName]", name);
    await page.type("input[name=patientAge]", "30");
    await page.type("input[name=patientPhone]", "01700000000");
    await page.click(".submit-button");
    await page.waitForFunction(() => {
      const text = document.querySelector("#form-status").textContent;
      return text && !text.startsWith("Submitting");
    }, { timeout: 15000 });
    return page.evaluate(() => ({
      status: document.querySelector("#form-status").textContent,
      hasFileInput: !!document.querySelector("#booking-form input[type=file]"),
      whatsapp: (() => {
        const link = document.querySelector("#whatsapp-handoff");
        return link && !link.hidden ? { href: link.href, text: link.textContent.trim() } : null;
      })()
    }));
  }

  async function getDoc(path) {
    const response = await fetch(`${fsUrl}/${path}`, { headers: { Authorization: "Bearer owner" } });
    return response.ok ? response.json() : null;
  }

  // 1. A booking with no photo creates both docs and offers the WhatsApp handoff.
  const ok = await book(0, "Test Person");
  assert.equal(ok.hasFileInput, false, "photo upload field should be gone");
  assert.match(ok.status, /request sent/i, ok.status);
  const docId = `slot_${slotStarts[0]}`;
  const appointment = await getDoc(`appointments/${docId}`);
  assert.ok(appointment, "appointments doc missing");
  assert.ok(await getDoc(`slotStatus/${docId}`), "slotStatus doc missing");
  assert.ok("nullValue" in appointment.fields.fileURL, "fileURL should be null");
  assert.ok(ok.whatsapp, "WhatsApp handoff link should show after booking");
  assert.match(ok.whatsapp.text, /also tell the clinic on whatsapp/i);
  const message = decodeURIComponent(new URL(ok.whatsapp.href).searchParams.get("text"));
  assert.match(ok.whatsapp.href, /^https:\/\/wa\.me\/8801779172808\?/);
  assert.match(message, /Test\b/);
  assert.doesNotMatch(message, /Person|01700000000/, "only the first name goes in the message");
  assert.match(message, /5:00\s?PM/i, message);

  // Enter in a field after success must not resubmit the same slot.
  await page.focus("input[name=patientName]");
  await page.keyboard.press("Enter");
  await new Promise(resolve => setTimeout(resolve, 1500));
  const afterEnter = await page.$eval("#form-status", el => el.textContent);
  assert.match(afterEnter, /request sent/i, afterEnter);

  // On a reopened modal, Tab from the last visible control wraps to the first one.
  await page.click("#close-modal");
  await (await page.$$("#slot-grid .slot-button"))[1].click();
  await page.focus(".submit-button");
  await page.keyboard.press("Tab");
  const focusedId = await page.evaluate(() => document.activeElement.id);
  assert.equal(focusedId, "close-modal", "focus trap should wrap past the hidden WhatsApp link");

  // 2. A slot the rules refuse (e.g. a cancelled one) shows a friendly message, not a raw Firebase error.
  await page.click("#close-modal");
  await fetch(`${fsUrl}/slotStatus/slot_${slotStarts[2]}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: {
      slotStart: { timestampValue: new Date(slotStarts[2]).toISOString() },
      status: { stringValue: "cancelled" }
    } })
  });
  await page.waitForFunction(() => document.querySelectorAll("#slot-grid .slot-button")[2]?.classList.contains("free"));
  const denied = await book(2, "Other Person");
  assert.match(denied.status, /can't be booked online\. Please call the clinic/i, denied.status);
  assert.match(denied.status, /1779[- ]?172808/, denied.status);
  assert.doesNotMatch(denied.status, /permission|insufficient/i, denied.status);
  assert.match(denied.whatsapp?.text || "", /^tell the clinic on whatsapp/i, "WhatsApp fallback should show when booking fails");

  // 3. Nothing talks to Firebase Storage.
  const storageHits = requested.filter(url => /storage/i.test(url));
  assert.deepEqual(storageHits, [], "requests should not reference Storage");

  console.log("booking e2e: all checks passed");
} finally {
  await browser?.close();
  try { process.kill(-emu.pid, "SIGINT"); } catch {}
  await new Promise(resolve => setTimeout(resolve, 2000));
  rmSync(dir, { recursive: true, force: true });
}

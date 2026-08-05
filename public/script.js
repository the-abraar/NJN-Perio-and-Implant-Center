const clinicWhatsAppNumber = "8801779172808";
const doctorPhone = "+8801779172808";
const assistantPhone = "+8801327045005";
const defaultConfig = {
  workStart: "09:00",
  workEnd: "17:00",
  slotMinutes: 45,
  offDays: [5]
};

const firebaseModules = {
  app: "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js",
  firestore: "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js",
  storage: "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js"
};

const state = {
  selectedSlot: null,
  appointments: new Map(),
  unsubscribe: null,
  firebase: null
};

const els = {
  date: document.querySelector("#appointment-date"),
  slotGrid: document.querySelector("#slot-grid"),
  slotStatus: document.querySelector("#slot-status"),
  queryForm: document.querySelector("#query-form"),
  question: document.querySelector("#patient-question"),
  modal: document.querySelector("#booking-modal"),
  modalPanel: document.querySelector(".modal"),
  closeModal: document.querySelector("#close-modal"),
  selectedSlotCopy: document.querySelector("#selected-slot-copy"),
  bookingForm: document.querySelector("#booking-form"),
  formStatus: document.querySelector("#form-status")
};

init();

async function init() {
  setupDateInput();
  setupEvents();
  setupPriceCarousel();
  state.firebase = await initFirebase();
  await loadBusinessConfig();
  renderSlots();
  subscribeToDate(els.date.value);
}

function setupPriceCarousel() {
  const track = document.querySelector("#deal-carousel-track");
  if (!track) return;

  const prevButton = document.querySelector(".deal-scroll-prev");
  const nextButton = document.querySelector(".deal-scroll-next");

  function cardStep() {
    const card = track.querySelector(".deal-popup");
    if (!card) return track.clientWidth;
    const gap = parseFloat(getComputedStyle(track).columnGap || "0");
    return card.getBoundingClientRect().width + gap;
  }

  function scrollByCards(direction) {
    track.scrollBy({ left: direction * cardStep(), behavior: "smooth" });
  }

  prevButton?.addEventListener("click", () => scrollByCards(-1));
  nextButton?.addEventListener("click", () => scrollByCards(1));

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let autoScrollTimer = null;

  function startAutoScroll() {
    stopAutoScroll();
    autoScrollTimer = setInterval(() => {
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (track.scrollLeft >= maxScroll - 4) {
        track.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scrollByCards(1);
      }
    }, 2500);
  }

  function stopAutoScroll() {
    if (autoScrollTimer) clearInterval(autoScrollTimer);
    autoScrollTimer = null;
  }

  track.addEventListener("mouseenter", stopAutoScroll);
  track.addEventListener("mouseleave", startAutoScroll);
  track.addEventListener("focusin", stopAutoScroll);
  track.addEventListener("focusout", startAutoScroll);
  track.addEventListener("touchstart", stopAutoScroll, { passive: true });
  track.addEventListener("touchend", () => setTimeout(startAutoScroll, 3000), { passive: true });

  startAutoScroll();
}

function setupDateInput() {
  const today = startOfLocalDay(new Date());
  const maxDate = addDays(today, 30);
  els.date.min = toDateInputValue(today);
  els.date.max = toDateInputValue(maxDate);
  els.date.value = toDateInputValue(nextOpenDay(today));
}

function setupEvents() {
  els.queryForm.addEventListener("submit", event => {
    event.preventDefault();
    const question = els.question.value.trim() || "Hello, I have a dental question for NJN Perio and Implant Center.";
    window.open(`https://wa.me/${clinicWhatsAppNumber}?text=${encodeURIComponent(question)}`, "_blank", "noopener");
  });

  els.date.addEventListener("change", () => {
    const selected = parseDateInput(els.date.value);
    if (!selected || isOffDay(selected)) {
      const replacement = nextOpenDay(selected || new Date());
      els.date.value = toDateInputValue(replacement);
      announce(`Fridays are unavailable. Showing ${formatDate(replacement)} instead.`);
    }
    renderSlots();
    subscribeToDate(els.date.value);
  });

  els.closeModal.addEventListener("click", closeBookingModal);
  els.modal.addEventListener("click", event => {
    if (event.target === els.modal) closeBookingModal();
  });
  document.addEventListener("keydown", handleGlobalKeydown);
  els.bookingForm.addEventListener("submit", submitBooking);
}

async function initFirebase() {
  try {
    const [{ firebaseConfig }, appSdk, firestoreSdk, storageSdk] = await Promise.all([
      import("./firebase-config.js"),
      import(firebaseModules.app),
      import(firebaseModules.firestore),
      import(firebaseModules.storage)
    ]);

    const app = appSdk.initializeApp(firebaseConfig);
    const db = firestoreSdk.getFirestore(app);
    const storage = storageSdk.getStorage(app);
    return { db, storage, firestoreSdk, storageSdk };
  } catch (error) {
    announce("Firebase is not configured yet. Slots are shown in demo mode.");
    return null;
  }
}

async function loadBusinessConfig() {
  if (!state.firebase) return;
  try {
    const { db, firestoreSdk } = state.firebase;
    const configRef = firestoreSdk.doc(db, "config", "businessHours");
    const snapshot = await firestoreSdk.getDoc(configRef);
    if (snapshot.exists()) {
      Object.assign(defaultConfig, snapshot.data());
    }
  } catch (error) {
    announce("Could not load clinic hours. Using default 9:00 AM-5:00 PM schedule.");
  }
}

function subscribeToDate(dateValue) {
  if (state.unsubscribe) state.unsubscribe();
  state.appointments.clear();

  if (!state.firebase) {
    renderSlots();
    return;
  }

  const date = parseDateInput(dateValue);
  const dayStart = startOfLocalDay(date);
  const dayEnd = addDays(dayStart, 1);
  const { db, firestoreSdk } = state.firebase;
  const appointmentsQuery = firestoreSdk.query(
    firestoreSdk.collection(db, "slotStatus"),
    firestoreSdk.where("slotStart", ">=", firestoreSdk.Timestamp.fromDate(dayStart)),
    firestoreSdk.where("slotStart", "<", firestoreSdk.Timestamp.fromDate(dayEnd))
  );

  state.unsubscribe = firestoreSdk.onSnapshot(
    appointmentsQuery,
    snapshot => {
      state.appointments.clear();
      snapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        if (data.slotStart && data.status !== "cancelled") {
          state.appointments.set(data.slotStart.toDate().getTime(), data.status);
        }
      });
      renderSlots();
      announce(`Updated slots for ${formatDate(date)}.`);
    },
    () => announce("Could not load real-time slot status. Please refresh or call the clinic.")
  );
}

function generateSlots(date, workStart, workEnd, slotMinutes) {
  if (isOffDay(date)) return [];
  const slots = [];
  let cursor = setTimeOnDate(date, workStart);
  const end = setTimeOnDate(date, workEnd);

  while (addMinutes(cursor, slotMinutes) <= end) {
    const slotStart = new Date(cursor);
    const slotEnd = addMinutes(slotStart, slotMinutes);
    slots.push({ start: slotStart, end: slotEnd });
    cursor = slotEnd;
  }

  return slots;
}

function renderSlots() {
  const date = parseDateInput(els.date.value);
  const slots = generateSlots(date, defaultConfig.workStart, defaultConfig.workEnd, defaultConfig.slotMinutes);
  els.slotGrid.innerHTML = "";

  if (!slots.length) {
    els.slotGrid.innerHTML = `<p class="live-message">The clinic is closed on this date.</p>`;
    return;
  }

  const now = new Date();
  slots.forEach((slot, index) => {
    const status = determineSlotStatus(slot.start);
    const isPast = slot.start <= now;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `slot-button ${status}`;
    button.style.animationDelay = `${Math.min(index * 20, 180)}ms`;
    button.disabled = status !== "free" || isPast;
    button.setAttribute("aria-label", `${formatTime(slot.start)} to ${formatTime(slot.end)}, ${isPast ? "Unavailable" : status}`);
    button.innerHTML = `
      <strong>${formatTime(slot.start)}-${formatTime(slot.end)}</strong>
      <span>${isPast ? "Unavailable" : capitalize(status)}</span>
    `;
    button.addEventListener("click", () => openBookingModal(slot));
    els.slotGrid.append(button);
  });
}

function determineSlotStatus(slotStart) {
  return state.appointments.get(slotStart.getTime()) || "free";
}

async function submitBooking(event) {
  event.preventDefault();
  if (!state.selectedSlot) return;

  const formData = new FormData(els.bookingForm);
  const image = formData.get("problemImage");
  const patientName = String(formData.get("patientName") || "").trim();
  const patientAge = Number(formData.get("patientAge"));
  const patientPhone = String(formData.get("patientPhone") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!patientName || !patientAge || !patientPhone) {
    setFormStatus("Please fill in name, age, and phone.");
    return;
  }

  if (image && image.size) {
    if (!image.type.startsWith("image/")) {
      setFormStatus("Please upload an image file only.");
      return;
    }
    if (image.size > 5 * 1024 * 1024) {
      setFormStatus("Please keep the image under 5 MB.");
      return;
    }
  }

  if (!state.firebase) {
    setFormStatus("Firebase is not configured yet. Please call the clinic to book.");
    return;
  }

  const submitButton = els.bookingForm.querySelector(".submit-button");
  submitButton.disabled = true;
  submitButton.classList.add("is-submitting");
  setFormStatus("Submitting your request...");

  try {
    const docId = slotDocId(state.selectedSlot.start);
    const fileURL = image && image.size ? await uploadProblemImage(docId, image) : null;
    await bookSlot(docId, {
      patientName,
      patientAge,
      patientPhone,
      description,
      fileURL,
      slotStart: state.selectedSlot.start
    });
    setFormStatus("Appointment request sent. The slot is pending until the doctor confirms by SMS.");
    setTimeout(closeBookingModal, 900);
  } catch (error) {
    setFormStatus(error.message || "Could not submit the request. Please try again.");
  } finally {
    submitButton.disabled = false;
    submitButton.classList.remove("is-submitting");
  }
}

async function uploadProblemImage(docId, image) {
  const { storage, storageSdk } = state.firebase;
  const extension = image.name.split(".").pop() || "jpg";
  const imageRef = storageSdk.ref(storage, `appointment-images/${docId}-${Date.now()}.${extension}`);
  const snapshot = await storageSdk.uploadBytes(imageRef, image, { contentType: image.type });
  return storageSdk.getDownloadURL(snapshot.ref);
}

async function bookSlot(docId, payload) {
  const { db, firestoreSdk } = state.firebase;
  const appointmentRef = firestoreSdk.doc(db, "appointments", docId);
  const slotStatusRef = firestoreSdk.doc(db, "slotStatus", docId);

  await firestoreSdk.runTransaction(db, async transaction => {
    const existing = await transaction.get(slotStatusRef);
    if (existing.exists() && ["pending", "booked"].includes(existing.data().status)) {
      throw new Error("That slot was just taken. Please choose another free slot.");
    }

    const slotStart = firestoreSdk.Timestamp.fromDate(payload.slotStart);

    transaction.set(appointmentRef, {
      ...payload,
      slotStart,
      status: "pending",
      createdAt: firestoreSdk.serverTimestamp()
    });

    transaction.set(slotStatusRef, {
      slotStart,
      status: "pending"
    });
  });
}

function openBookingModal(slot) {
  state.selectedSlot = slot;
  els.selectedSlotCopy.textContent = `${formatDate(slot.start)} at ${formatTime(slot.start)}-${formatTime(slot.end)}`;
  els.formStatus.textContent = "";
  els.bookingForm.reset();
  els.modal.hidden = false;
  document.body.classList.add("modal-open");
  els.modalPanel.focus();
}

function closeBookingModal() {
  els.modal.hidden = true;
  document.body.classList.remove("modal-open");
  state.selectedSlot = null;
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape" && !els.modal.hidden) closeBookingModal();
  if (event.key === "Tab" && !els.modal.hidden) trapModalFocus(event);
}

function trapModalFocus(event) {
  const focusable = els.modal.querySelectorAll("a[href], button, input, textarea, select, [tabindex]:not([tabindex='-1'])");
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function setFormStatus(message) {
  els.formStatus.textContent = message;
}

function announce(message) {
  els.slotStatus.textContent = message;
}

function slotDocId(date) {
  return `slot_${date.getTime()}`;
}

function parseDateInput(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setTimeOnDate(date, time) {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfLocalDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function isOffDay(date) {
  return defaultConfig.offDays.includes(date.getDay());
}

function nextOpenDay(date) {
  let cursor = startOfLocalDay(date);
  while (isOffDay(cursor)) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-BD", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-BD", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

window.NJNAppointmentUtils = {
  generateSlots,
  determineSlotStatus,
  doctorPhone,
  assistantPhone
};

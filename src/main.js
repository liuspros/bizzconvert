import { SITE, BOOKING, SERVICES, DEMO } from "./config.js";
import { getTaken, saveBooking, slotId } from "./store.js";
import "./fx.js";
import { TZ, lagosNow, addDays, dow, fmtDay, t12, cleanPhone, esc } from "./utils.js";

const $ = s => document.querySelector(s);
if (DEMO) console.warn("[BizzConvert] Demo mode: Firebase keys not found in .env. Bookings are saved in this browser only.");

/* ---------- state ---------- */
const state = { service: SERVICES[0].id, date: null, time: null };
const svc = () => SERVICES.find(s => s.id === state.service);

/* ---------- services ---------- */
function renderServices() {
  $("#svcOpts").innerHTML = SERVICES.map(s => `
    <label class="opt"><input type="radio" name="service" value="${esc(s.id)}" ${s.id === state.service ? "checked" : ""}>
      <div class="box"><div><strong>${esc(s.title)}</strong><small>${esc(s.meta)}</small></div><span class="p">${esc(s.price)}</span></div></label>`).join("");
  document.querySelectorAll('input[name="service"]').forEach(r =>
    r.addEventListener("change", () => { state.service = r.value; updateSummary(); }));
}
function pickService(id) {
  state.service = id;
  const r = document.querySelector(`input[name="service"][value="${id}"]`);
  if (r) r.checked = true;
  updateSummary();
}

/* ---------- dates ---------- */
function renderDates() {
  const today = lagosNow().date, out = [];
  for (let i = 0; i <= BOOKING.daysAhead; i++) {
    const d = addDays(today, i);
    if (BOOKING.workDays.includes(dow(d))) out.push(d);
  }
  $("#dates").innerHTML = out.map(d => {
    const dt = new Date(d + "T12:00:00Z");
    return `<button type="button" class="dchip" data-d="${d}" aria-pressed="false"><small>${dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</small><b>${dt.getUTCDate()}</b><small>${dt.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</small></button>`;
  }).join("");
  document.querySelectorAll(".dchip").forEach(b => b.addEventListener("click", () => selectDate(b.dataset.d)));
}

async function selectDate(d) {
  state.date = d; state.time = null;
  document.querySelectorAll(".dchip").forEach(b => b.setAttribute("aria-pressed", b.dataset.d === d));
  $("#timeHint").textContent = "Loading available times…";
  $("#times").innerHTML = "";
  updateSummary();
  let taken;
  try { taken = await getTaken(d); }
  catch (e) { console.error(e); $("#timeHint").textContent = "Couldn't load times. Check your connection and try again."; return; }
  if (state.date !== d) return;   // user clicked another day while this was loading
  const now = lagosNow();
  const minMins = now.mins + BOOKING.minNoticeHours * 60;
  $("#times").innerHTML = BOOKING.slotTimes.map(t => {
    const [h, m] = t.split(":").map(Number);
    const past = d === now.date && (h * 60 + m) < minMins;
    const off = past || taken.has(t);
    return `<button type="button" class="tchip" data-t="${t}" aria-pressed="false" ${off ? "disabled" : ""}>${t12(t)}</button>`;
  }).join("");
  const free = [...document.querySelectorAll(".tchip")].filter(b => !b.disabled).length;
  $("#timeHint").textContent = free
    ? `${free} slot${free > 1 ? "s" : ""} open on ${fmtDay(d)} (${BOOKING.tzLabel}).`
    : "No slots left this day. Please try another day.";
  document.querySelectorAll(".tchip").forEach(b => b.addEventListener("click", () => {
    state.time = b.dataset.t;
    document.querySelectorAll(".tchip").forEach(x => x.setAttribute("aria-pressed", x === b));
    updateSummary();
  }));
}

function updateSummary() {
  const s = svc();
  $("#summary").innerHTML = state.date && state.time
    ? `<b>${esc(s.title)}</b> · ${esc(fmtDay(state.date))} at <b>${t12(state.time)}</b> ${BOOKING.tzLabel}`
    : `<b>${esc(s.title)}</b>${state.date ? ` · ${esc(fmtDay(state.date))}` : ""}. ${state.date ? "Now pick a time." : "Pick a day and time to continue."}`;
}

/* ---------- submit ---------- */
const setStatus = (msg, err = false) => { const el = $("#status"); el.textContent = msg; el.className = "status" + (err ? " err" : ""); };

$("#bookForm").addEventListener("submit", async e => {
  e.preventDefault();
  if ($("#website").value) return;   // honeypot: bots fill this, people never see it
  const name = $("#name").value.trim(), wa = cleanPhone($("#whatsapp").value), niche = $("#niche").value;
  ["name", "whatsapp", "niche"].forEach(i => $("#" + i).removeAttribute("aria-invalid"));
  if (!state.date || !state.time) return setStatus("Please pick a day and a time first.", true);
  if (name.length < 2) { $("#name").setAttribute("aria-invalid", "true"); $("#name").focus(); return setStatus("Please enter your name.", true); }
  if (!/^\d{10,15}$/.test(wa)) { $("#whatsapp").setAttribute("aria-invalid", "true"); $("#whatsapp").focus(); return setStatus("Please enter a valid WhatsApp number.", true); }
  if (!niche) { $("#niche").setAttribute("aria-invalid", "true"); $("#niche").focus(); return setStatus("Please tell us what you sell.", true); }

  const booking = {
    service: state.service, date: state.date, time: state.time,
    name, whatsapp: wa,
    businessName: $("#business").value.trim().slice(0, 80),
    instagram: $("#instagram").value.trim().slice(0, 60),
    niche, problem: $("#issue").value.trim().slice(0, 600),
    status: "new"
  };
  const btn = $("#submitBtn"); btn.disabled = true; btn.textContent = "Booking…"; setStatus("");
  try {
    await saveBooking(booking);
    showDone(booking);
  } catch (err) {
    console.error(err);
    let taken = err.code === "slot-taken";
    if (!taken && err.code === "permission-denied") {
      // Firestore rejects with permission-denied both for a taken slot and for bad data: check which one it is
      try { taken = (await getTaken(booking.date)).has(booking.time); } catch { /* ignore */ }
    }
    if (taken) { setStatus("Sorry, that slot was just taken. Please pick another time.", true); selectDate(state.date); }
    else setStatus("Something went wrong. Please try again or message us on WhatsApp.", true);
    btn.disabled = false; btn.textContent = "Confirm booking";
  }
});

function showDone(b) {
  const s = SERVICES.find(x => x.id === b.service);
  $("#recap").innerHTML =
    `<div><span>Service</span><b>${esc(s.title)}</b></div>` +
    `<div><span>Day</span><b>${esc(fmtDay(b.date))}</b></div>` +
    `<div><span>Time</span><b>${t12(b.time)} ${BOOKING.tzLabel}</b></div>` +
    `<div><span>Name</span><b>${esc(b.name)}</b></div>`;
  const msg = `Hi ${SITE.brand}! I just booked: ${s.title} on ${fmtDay(b.date)} at ${t12(b.time)}. My name is ${b.name}.`;
  $("#waConfirm").href = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(msg)}`;
  $("#icsBtn").onclick = () => downloadIcs(b, s);
  $("#bookForm").hidden = true; $("#done").hidden = false;
  $("#book").scrollIntoView({ behavior: "smooth" });
}

function downloadIcs(b, s) {
  const dt = (d, t) => d.replace(/-/g, "") + "T" + t.replace(":", "") + "00";
  const [h, m] = b.time.split(":").map(Number), end = h * 60 + m + s.mins;
  const endT = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BizzConvert//Booking//EN", "BEGIN:VEVENT",
    `UID:${slotId(b.date, b.time)}@bizzconvert`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;TZID=${TZ}:${dt(b.date, b.time)}`, `DTEND;TZID=${TZ}:${dt(b.date, endT)}`,
    `SUMMARY:${s.title} with ${SITE.brand}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = "bizzconvert-booking.ics"; a.click();
}

/* ---------- page wiring ---------- */
const waLink = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent("Hi BizzConvert! I'd like to know more.")}`;
$("#waFloat").href = waLink; $("#footWa").href = waLink;
if (SITE.instagram) { $("#footIg").href = SITE.instagram; $("#footIg").hidden = false; }
if (SITE.phone) { $("#footPhone").href = `tel:${SITE.phone.replace(/\s/g, "")}`; $("#footPhone .t").textContent = SITE.phone; $("#footPhone").hidden = false; }
if (SITE.email) { $("#footEmail").href = `mailto:${SITE.email}`; $("#footEmail .t").textContent = SITE.email; $("#footEmail").hidden = false; }
$("#yr").textContent = new Date().getFullYear();
document.querySelectorAll("[data-service]").forEach(a => a.addEventListener("click", () => pickService(a.dataset.service)));

renderServices(); renderDates(); updateSummary();

import "./admin.css";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { app } from "./firebase.js";
import { DEMO, SITE, SERVICES, STATUSES } from "./config.js";
import { subscribeBookings, updateBooking, cancelBooking } from "./store.js";
import { TZ, lagosNow, addDays, fmtDay, fmtDayShort, t12, esc } from "./utils.js";

const $ = s => document.querySelector(s);
const OWNER = "Leah";

/* =============================== auth ====================================== */
// Real mode: Firebase Auth (email + password). Demo mode (no keys in .env): any login works, for previewing the UI.
const DEMO_KEY = "bc_demo_admin";
const auth = DEMO ? null : getAuth(app);
const authApi = DEMO
  ? {
      onChange(cb) {
        const cur = () => cb(sessionStorage.getItem(DEMO_KEY) ? { email: sessionStorage.getItem(DEMO_KEY) } : null);
        window.addEventListener("bc-demo-auth", cur); cur();
      },
      async signIn(email) { sessionStorage.setItem(DEMO_KEY, email); window.dispatchEvent(new Event("bc-demo-auth")); },
      async signOut() { sessionStorage.removeItem(DEMO_KEY); window.dispatchEvent(new Event("bc-demo-auth")); },
      async reset() {}
    }
  : {
      onChange: cb => onAuthStateChanged(auth, cb),
      signIn: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
      signOut: () => signOut(auth),
      reset: email => sendPasswordResetEmail(auth, email)
    };

function authMessage(e) {
  switch (e.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email": return "Wrong email or password.";
    case "auth/too-many-requests": return "Too many attempts. Wait a few minutes, or reset your password.";
    case "auth/network-request-failed": return "No connection. Check your internet and try again.";
    case "auth/operation-not-allowed": return "Email/password sign-in is not switched on in Firebase yet.";
    default: return "Could not sign in. Please try again.";
  }
}

const loginStatus = (msg, kind = "err") => { const el = $("#loginStatus"); el.textContent = msg; el.className = "status " + kind; };

$("#togglePw").addEventListener("click", () => {
  const i = $("#password"), show = i.type === "password";
  i.type = show ? "text" : "password";
  $("#togglePw").textContent = show ? "Hide" : "Show";
  $("#togglePw").setAttribute("aria-label", show ? "Hide password" : "Show password");
});

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#email").value.trim(), pw = $("#password").value;
  if (!email || !pw) return loginStatus("Enter your email and password.");
  const btn = $("#loginBtn"); btn.disabled = true; btn.textContent = "Signing in…"; loginStatus("");
  try { await authApi.signIn(email, pw); $("#password").value = ""; }
  catch (err) { console.error(err); loginStatus(authMessage(err)); }
  btn.disabled = false; btn.textContent = "Sign in";
});

$("#forgotBtn").addEventListener("click", async () => {
  const email = $("#email").value.trim();
  if (!email) { $("#email").focus(); return loginStatus("Type your email above first, then tap Forgot password."); }
  try { await authApi.reset(email); loginStatus("If that email has an account, a reset link is on its way. Check your inbox and spam.", "ok"); }
  catch (err) { console.error(err); loginStatus(authMessage(err)); }
});

$("#logoutBtn").addEventListener("click", () => authApi.signOut());

/* ============================== dashboard ================================== */
let bookings = [];
let tab = "upcoming";
let query = "";
let unsub = null;
let dirty = false;
const open = new Set();
const flash = new Set();   // booking ids whose note was just saved (shows "Saved ✓" briefly)

const today = () => lagosNow().date;
const isLive = s => s === "new" || s === "confirmed";

const TABS = [
  ["upcoming",  "Upcoming",  b => isLive(b.status) && b.date >= today()],
  ["new",       "New",       b => b.status === "new"],
  ["past",      "Past",      b => b.status !== "cancelled" && (b.date < today() || b.status === "completed" || b.status === "no_show")],
  ["cancelled", "Cancelled", b => b.status === "cancelled"],
  ["all",       "All",       () => true]
];
const key = b => `${b.date} ${b.time}`;

function matches(b) {
  if (!query) return true;
  const hay = [b.name, b.businessName, b.whatsapp, b.instagram, b.niche, b.problem, b.notes].join(" ").toLowerCase();
  return query.toLowerCase().split(/\s+/).every(w => hay.includes(w));
}

function visible() {
  const filter = TABS.find(t => t[0] === tab)[2];
  const asc = tab === "upcoming" || tab === "new";
  return bookings.filter(b => filter(b) && matches(b)).sort((a, b) => (asc ? 1 : -1) * key(a).localeCompare(key(b)));
}

function dayLabel(d) {
  const t = today();
  return d === t ? "Today" : d === addDays(t, 1) ? "Tomorrow" : fmtDayShort(d);
}

function igInfo(raw) {
  const u = String(raw || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?].*$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(u) ? { user: u, url: `https://instagram.com/${u}` } : null;
}

/* ---- render ---- */
function renderStats() {
  const t = today();
  const items = [
    ["Sessions today", bookings.filter(b => b.date === t && isLive(b.status)).length, false],
    ["Needs confirming", bookings.filter(b => b.status === "new").length, true],
    ["Upcoming", bookings.filter(TABS[0][2]).length, false],
    ["All bookings", bookings.length, false]
  ];
  $("#stats").innerHTML = items.map(([l, n, hot]) => `<div class="stat ${hot && n ? "hot" : ""}"><b>${n}</b><span>${l}</span></div>`).join("");
}

function renderTabs() {
  $("#tabs").innerHTML = TABS.map(([id, label, f]) =>
    `<button class="tab" role="tab" data-tab="${id}" aria-selected="${id === tab}">${label}<i>${bookings.filter(f).length}</i></button>`).join("");
}

function card(b) {
  const s = SERVICES.find(x => x.id === b.service);
  const svcName = s ? s.title : b.service;
  const isOpen = open.has(b.id);
  const when = dayLabel(b.date);
  const ig = igInfo(b.instagram);
  const msg = `Hi ${b.name}, this is ${OWNER} from ${SITE.brand} 👋 Confirming your ${svcName} on ${fmtDay(b.date)} at ${t12(b.time)} (WAT). Please reply YES to confirm.`;
  const wa = `https://wa.me/${b.whatsapp}?text=${encodeURIComponent(msg)}`;
  const cancelled = b.status === "cancelled";
  const booked = b.createdAt ? b.createdAt.toLocaleString("en-GB", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }) : "Just now";
  const statusOpts = ["new", "confirmed", "completed", "no_show"]
    .map(k => `<option value="${k}" ${b.status === k ? "selected" : ""}>${STATUSES[k]}</option>`).join("");

  return `
  <article class="bk is-${esc(b.status)}" data-id="${esc(b.id)}">
    <button class="bk-head" type="button" data-head aria-expanded="${isOpen}">
      <div class="when ${b.date === today() ? "today" : ""}"><b>${esc(when)}</b><span>${t12(b.time)}</span></div>
      <div class="who2"><strong>${esc(b.name)}</strong><small>${esc(b.businessName || b.niche)} · ${esc(svcName)}</small></div>
      <span class="badge s-${esc(b.status)}">${esc(STATUSES[b.status] || b.status)}</span>
    </button>
    <div class="bk-body" ${isOpen ? "" : "hidden"}>
      <div class="cols">
        <div class="col"><h4>Customer</h4><div class="kv">
          <div><span>Name</span><b>${esc(b.name)}</b></div>
          <div><span>WhatsApp</span><b><a href="tel:+${esc(b.whatsapp)}">+${esc(b.whatsapp)}</a></b></div>
          <div><span>Instagram</span><b>${ig ? `<a href="${esc(ig.url)}" target="_blank" rel="noopener">@${esc(ig.user)}</a>` : (b.instagram ? esc(b.instagram) : "Not given")}</b></div>
        </div></div>
        <div class="col"><h4>Business</h4><div class="kv">
          <div><span>Business name</span><b>${esc(b.businessName || "Not given")}</b></div>
          <div><span>What they sell</span><b>${esc(b.niche)}</b></div>
          <div><span>Biggest problem</span><b>${esc(b.problem || "Not given")}</b></div>
        </div></div>
        <div class="col"><h4>Booking</h4><div class="kv">
          <div><span>Service</span><b>${esc(svcName)}</b></div>
          <div><span>Date and time</span><b>${esc(fmtDay(b.date))}, ${t12(b.time)} WAT</b></div>
          <div><span>Booked on</span><b>${esc(booked)}</b></div>
        </div></div>
      </div>

      <div class="manage">
        <div>
          <label for="st-${esc(b.id)}">Status</label>
          ${cancelled ? `<span class="badge s-cancelled">Cancelled</span>` : `<select id="st-${esc(b.id)}" data-status>${statusOpts}</select>`}
        </div>
        <div>
          <label for="nt-${esc(b.id)}">Private notes</label>
          <textarea id="nt-${esc(b.id)}" maxlength="1000" placeholder="Only you can see this">${esc(b.notes || "")}</textarea>
          <div class="saveRow"><button class="btn-sm" type="button" data-act="note">Save note</button><small ${flash.has(b.id) ? "" : "hidden"}>Saved ✓</small></div>
        </div>
      </div>

      <div class="actions">
        ${b.status === "new"
          ? `<a class="btn btn-primary" href="${esc(wa)}" target="_blank" rel="noopener" data-act="confirm">Confirm and message on WhatsApp</a>`
          : `<a class="btn btn-primary" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp ${esc(b.name.split(" ")[0])}</a>`}
        <a class="btn btn-ghost" href="tel:+${esc(b.whatsapp)}">Call</a>
        ${cancelled ? "" : `<button class="btn btn-danger" type="button" data-act="cancel">Cancel booking</button>`}
      </div>
    </div>
  </article>`;
}

function renderList() {
  dirty = false;
  const rows = visible();
  $("#list").innerHTML = rows.length
    ? rows.map(card).join("")
    : `<div class="empty">${query ? "No bookings match your search." : bookings.length ? "Nothing in this tab yet." : "No bookings yet. When someone books on the site, it appears here instantly."}</div>`;
}

const render = () => { renderStats(); renderTabs(); renderList(); };

const isEditing = () => {
  const a = document.activeElement;
  return a && $("#list").contains(a) && /^(TEXTAREA|SELECT|INPUT)$/.test(a.tagName);
};

/* ---- data ---- */
function start(user) {
  $("#login").hidden = true; $("#dash").hidden = false;
  $("#who").textContent = user.email || "";
  $("#notice").hidden = true;
  unsub?.();
  unsub = subscribeBookings(
    data => {
      bookings = data;
      if (isEditing()) { dirty = true; renderStats(); renderTabs(); return; }   // don't wipe what she's typing
      render();
    },
    err => {
      console.error(err);
      const n = $("#notice"); n.hidden = false;
      n.innerHTML = err.code === "permission-denied"
        ? `<b>This account isn't set up as admin.</b><br>You're signed in, but the database refuses to show bookings to this account. Make sure the account's UID is listed in <code>firestore.rules</code> and the rules are published.`
        : `<b>Couldn't load bookings.</b><br>${esc(err.message || "Check your connection.")}`;
    }
  );
}

function stop() {
  unsub?.(); unsub = null; bookings = [];
  $("#dash").hidden = true; $("#login").hidden = false;
}

/* ---- interactions ---- */
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("[data-tab]"); if (!b) return;
  tab = b.dataset.tab; render();
});
$("#search").addEventListener("input", e => { query = e.target.value.trim(); renderList(); });

$("#list").addEventListener("click", async e => {
  const head = e.target.closest("[data-head]");
  const art = e.target.closest(".bk"); if (!art) return;
  const id = art.dataset.id;

  if (head) {
    const body = art.querySelector(".bk-body");
    const willOpen = body.hidden;
    body.hidden = !willOpen;
    head.setAttribute("aria-expanded", willOpen);
    willOpen ? open.add(id) : open.delete(id);
    return;
  }

  const actEl = e.target.closest("[data-act]"); if (!actEl) return;
  const act = actEl.dataset.act;

  try {
    if (act === "confirm") {
      // the link itself opens WhatsApp; here we just mark the booking confirmed
      await updateBooking(id, { status: "confirmed" });
    } else if (act === "note") {
      const notes = art.querySelector("textarea").value.trim().slice(0, 1000);
      actEl.disabled = true;
      await updateBooking(id, { notes });
      actEl.disabled = false;
      flash.add(id);
      const show = hidden => { const ok = document.querySelector(`.bk[data-id="${CSS.escape(id)}"] .saveRow small`); if (ok) ok.hidden = hidden; };
      show(false);
      setTimeout(() => { flash.delete(id); show(true); }, 2000);
    } else if (act === "cancel") {
      if (confirm("Cancel this booking? The time slot will open up again for other customers.")) await cancelBooking(id);
    }
  } catch (err) {
    console.error(err);
    actEl.disabled = false;
    alert("Couldn't save that change. Check your connection and try again.");
  }
});

$("#list").addEventListener("change", async e => {
  if (!e.target.matches("[data-status]")) return;
  const id = e.target.closest(".bk").dataset.id;
  try { await updateBooking(id, { status: e.target.value }); }
  catch (err) { console.error(err); alert("Couldn't update the status. Please try again."); }
});

// after she finishes typing/selecting, apply any updates that arrived meanwhile
$("#list").addEventListener("focusout", () => setTimeout(() => { if (dirty && !isEditing()) renderList(); }, 250));

/* ---- CSV export ---- */
const cell = v => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
$("#csvBtn").addEventListener("click", () => {
  const rows = visible();
  const head = ["Date", "Time", "Service", "Status", "Name", "WhatsApp", "Instagram", "Business", "What they sell", "Biggest problem", "Notes", "Booked on"];
  const lines = [head, ...rows.map(b => [
    b.date, b.time, (SERVICES.find(s => s.id === b.service) || {}).title || b.service, STATUSES[b.status] || b.status,
    b.name, "+" + b.whatsapp, b.instagram, b.businessName, b.niche, b.problem, b.notes,
    b.createdAt ? b.createdAt.toISOString() : ""
  ])].map(r => r.map(cell).join(","));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  a.download = `bizzconvert-bookings-${today()}.csv`; a.click();
});

/* ---- boot ---- */
if (DEMO) $("#demoBar").hidden = false;
authApi.onChange(user => (user ? start(user) : stop()));

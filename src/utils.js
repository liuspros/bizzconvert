// Small helpers shared by the public site and the admin page.

export const TZ = "Africa/Lagos";

/** Current date (YYYY-MM-DD) and minutes-since-midnight in Nigeria time. */
export function lagosNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, mins: (+p.hour % 24) * 60 + +p.minute };
}

export function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const dow = iso => new Date(iso + "T12:00:00Z").getUTCDay();

export const fmtDay = iso =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export const fmtDayShort = iso =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export const t12 = t => {
  const [h, m] = t.split(":").map(Number);
  return `${(h % 12) || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** "0801 234 5678", "+234 801 234 5678" -> "2348012345678" */
export const cleanPhone = p => {
  let d = String(p).replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0")) d = "234" + d.slice(1);
  return d;
};

/** Escape text before putting it into innerHTML. Always use this for anything a customer typed. */
export const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Page motion for the public site. Everything here is progressive: the page works without it.

const $ = s => document.querySelector(s);
const all = s => [...document.querySelectorAll(s)];
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* scroll progress bar + floating nav that turns darker once you leave the top */
const bar = $("#progress"), hdr = $("#hdr");
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    hdr.classList.toggle("scrolled", scrollY > 24);
    ticking = false;
  });
}
addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* mobile menu */
const btn = $("#menuBtn"), nav = $("#mNav"), ico = $("#menuIco use");
function setMenu(open) {
  nav.hidden = !open;
  btn.setAttribute("aria-expanded", open);
  btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  ico.setAttribute("href", open ? "#i-close" : "#i-menu");
}
btn.addEventListener("click", () => setMenu(nav.hidden));
nav.addEventListener("click", e => { if (e.target.closest("a")) setMenu(false); });
addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
addEventListener("resize", () => { if (innerWidth >= 900) setMenu(false); });

/* soft fade-in for sections, and the process line drawing itself */
const watch = all(".rv, #rail");
if (calm || !("IntersectionObserver" in window)) {
  watch.forEach(el => el.classList.add("in"));
} else {
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  watch.forEach(el => io.observe(el));
}

/* light that follows the pointer across glass cards */
if (!calm && matchMedia("(hover: hover)").matches) {
  all(".spot").forEach(el => el.addEventListener("pointermove", e => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }));
}

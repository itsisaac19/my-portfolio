import "./styles/main.css";
import Lenis from "lenis";
import { animate, createTimeline, splitText, stagger } from "animejs";
import { mountDither } from "./dither";

const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const $ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => el.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => [...el.querySelectorAll<T>(s)];

/* ---------------------------------------------------------------- Scroll */

const lenis = reduce ? null : new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
let velocity = 0;
if (lenis) {
  lenis.on("scroll", (l: Lenis) => (velocity = l.velocity));
  const raf = (t: number) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

// In-page anchors go through Lenis.
$$<HTMLAnchorElement>('a[href^="#"], a[href*=".html#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const url = new URL(a.href);
    if (url.pathname !== location.pathname) return;
    const target = url.hash && $(url.hash);
    if (!target) return;
    e.preventDefault();
    lenis ? lenis.scrollTo(target as HTMLElement, { offset: 0, duration: 1.6 }) : target.scrollIntoView();
    history.replaceState(null, "", url.hash);
  });
});

/* ---------------------------------------------------------------- Header */

const header = $(".header");
let lastY = scrollY;
addEventListener(
  "scroll",
  () => {
    const y = scrollY;
    header?.classList.toggle("is-hidden", y > lastY && y > 240);
    lastY = y;
  },
  { passive: true },
);

// Mark current nav item.
const here = location.pathname.split("/").pop() || "index.html";
$$<HTMLAnchorElement>(".nav a").forEach((a) => {
  const page = new URL(a.href).pathname.split("/").pop() || "index.html";
  if (page === here && !a.hash) a.setAttribute("aria-current", "page");
});

/* ---------------------------------------------------------------- Clock */

const clocks = $$("[data-clock]");
if (clocks.length) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const tick = () => clocks.forEach((c) => (c.textContent = `${fmt.format(new Date())} PT`));
  tick();
  setInterval(tick, 1000);
}

/* ---------------------------------------------------------------- Cursor */

if (finePointer && !reduce) {
  const cursor = document.createElement("div");
  cursor.className = "cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = "<span></span>";
  document.body.append(cursor);
  const label = cursor.firstElementChild as HTMLElement;

  let x = innerWidth / 2;
  let y = innerHeight / 2;
  let cx = x;
  let cy = y;
  addEventListener("pointermove", (e) => {
    x = e.clientX;
    y = e.clientY;
    cursor.classList.add("is-on");
  });
  document.addEventListener("pointerleave", () => cursor.classList.remove("is-on"));
  const loop = () => {
    cx += (x - cx) * 0.22;
    cy += (y - cy) * 0.22;
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(loop);
  };
  loop();

  document.addEventListener("pointerover", (e) => {
    const t = e.target as HTMLElement;
    const labelled = t.closest<HTMLElement>("[data-cursor]");
    if (labelled) {
      label.textContent = labelled.dataset.cursor!;
      cursor.className = "cursor is-on is-label";
      return;
    }
    cursor.className = t.closest("a, button") ? "cursor is-on is-link" : "cursor is-on";
  });
}

/* ---------------------------------------------------------------- Page transitions */

const wipe = $(".wipe");
const wipeBars = wipe ? $$("span", wipe) : [];

const isInternalPage = (a: HTMLAnchorElement) => {
  if (a.target === "_blank" || a.hasAttribute("download")) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  if (url.pathname === location.pathname) return false;
  return /\.html$|\/$/.test(url.pathname);
};

if (!reduce && wipeBars.length) {
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || !isInternalPage(a)) return;
    e.preventDefault();
    lenis?.stop();
    animate(wipeBars, {
      scaleY: [0, 1],
      transformOrigin: ["50% 100%", "50% 100%"],
      duration: 650,
      ease: "inOutQuart",
      delay: stagger(45),
      onComplete: () => {
        try {
          sessionStorage.setItem("it-wipe", "1");
        } catch {}
        location.href = a.href;
      },
    });
  });

  // Back/forward cache: make sure the curtain isn't left closed.
  addEventListener("pageshow", (e) => {
    if (e.persisted) {
      wipeBars.forEach((b) => (b.style.transform = "scaleY(0)"));
      lenis?.start();
    }
  });
}

const leaveWipe = () =>
  root.classList.contains("is-arriving") && wipeBars.length
    ? new Promise<void>((done) => {
        animate(wipeBars, {
          scaleY: [1, 0],
          transformOrigin: ["50% 0%", "50% 0%"],
          duration: 800,
          ease: "inOutQuart",
          delay: stagger(45, { from: "last" }),
          onComplete: () => {
            root.classList.remove("is-arriving");
            done();
          },
        });
      })
    : Promise.resolve();

/* ---------------------------------------------------------------- Preloader */

async function preload() {
  const loader = $(".loader");
  if (!root.classList.contains("first-visit") || !loader) return;
  try {
    sessionStorage.setItem("it-seen", "1");
  } catch {}
  if (reduce) {
    loader.remove();
    return;
  }
  lenis?.stop();
  const count = $(".loader-count", loader)!;
  const bar = $(".loader-bar", loader)!;
  const state = { n: 0 };
  const fontsReady = document.fonts?.ready ?? Promise.resolve();

  await new Promise<void>((done) =>
    animate(state, {
      n: 100,
      duration: 1500,
      ease: "inOutQuart",
      modifier: (v: number) => Math.round(v),
      onUpdate: () => {
        count.textContent = String(state.n).padStart(3, "0");
        bar.style.transform = `scaleX(${state.n / 100})`;
      },
      onComplete: () => done(),
    }),
  );
  await fontsReady;
  await new Promise<void>((done) =>
    animate(loader, {
      clipPath: ["inset(0% 0% 0% 0%)", "inset(0% 0% 100% 0%)"],
      duration: 900,
      ease: "inOutQuart",
      onComplete: () => done(),
    }),
  );
  loader.remove();
  lenis?.start();
}

/* ---------------------------------------------------------------- Split text */

type Splitter = ReturnType<typeof splitText>;
const splitLines = (el: HTMLElement): Splitter =>
  splitText(el, { lines: { wrap: "clip" }, accessible: true });

function introHero() {
  const lines = $$("[data-hero-line]");
  const fades = $$("[data-hero-fade]");
  const blocks = $$("[data-hero-block]");
  if (!lines.length) return;
  if (reduce) return;

  const chars = lines.flatMap((l) => splitText(l, { chars: { wrap: "clip" }, accessible: true }).chars);
  const tl = createTimeline({ defaults: { ease: "outExpo" } });
  tl.add(chars, { translateY: ["105%", "0%"], duration: 1300, delay: stagger(38) }, 0)
    .add(blocks, { clipPath: ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"], duration: 1200, delay: stagger(120) }, 250)
    .add(fades, { opacity: [0, 1], translateY: [16, 0], duration: 1000, delay: stagger(70) }, 500);
}

// Pre-hide hero bits so there is no flash before intro runs.
if (!reduce) $$("[data-hero-fade]").forEach((el) => (el.style.opacity = "0"));
if (!reduce) $$("[data-hero-block]").forEach((el) => (el.style.clipPath = "inset(100% 0% 0% 0%)"));

function revealOnScroll() {
  if (reduce) return;

  // Line-by-line masked reveal for big type.
  $$("[data-split]").forEach((el) => {
    const { lines } = splitLines(el);
    lines.forEach((l: HTMLElement) => (l.style.transform = "translateY(105%)"));
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        animate(lines, { translateY: ["105%", "0%"], duration: 1200, ease: "outExpo", delay: stagger(90) });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
  });

  // Generic fade-up.
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }),
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
  );
  // Plates/images wipe open via CSS when [data-unclip] gets .is-in.
  $$("[data-reveal], [data-unclip]").forEach((el) => io.observe(el));
}

/* ---------------------------------------------------------------- Statement scrub */

function statementScrub() {
  $$("[data-scrub]").forEach((el) => {
    // Wrap each word while preserving inline marks.
    const walk = (node: Node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent!.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.append(part);
            const s = document.createElement("span");
            s.className = "w";
            s.textContent = part;
            frag.append(s);
          });
          child.replaceWith(frag);
        } else walk(child);
      });
    };
    walk(el);
    if (reduce) return;
    const words = $$(".w", el);
    const update = () => {
      const r = el.getBoundingClientRect();
      const start = innerHeight * 0.85;
      const end = innerHeight * 0.3;
      const p = Math.min(1, Math.max(0, (start - r.top) / (start - end + r.height * 0.6)));
      const lit = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle("on", i < lit));
    };
    addEventListener("scroll", update, { passive: true });
    update();
  });
}

/* ---------------------------------------------------------------- Marquee */

function marquees() {
  $$(".marquee").forEach((m) => {
    const track = $(".marquee-track", m)!;
    // Duplicate content until wide enough to loop seamlessly.
    const original = track.innerHTML;
    while (track.scrollWidth < innerWidth * 2.2) track.insertAdjacentHTML("beforeend", original);
    track.insertAdjacentHTML("beforeend", track.innerHTML);
    if (reduce) return;

    const dir = Number(m.dataset.dir ?? -1);
    let x = 0;
    let boost = 0;
    const loop = () => {
      boost += (Math.abs(velocity) * 0.6 - boost) * 0.08;
      x += dir * (0.6 + boost);
      const half = track.scrollWidth / 2;
      if (x <= -half) x += half;
      if (x > 0) x -= half;
      track.style.transform = `translate3d(${x}px,0,0)`;
      requestAnimationFrame(loop);
    };
    loop();
  });
}

/* ---------------------------------------------------------------- Work preview */

function workPreview() {
  const list = $("[data-preview-list]");
  const preview = $(".preview");
  if (!list || !preview || !finePointer) return;
  const items = $$("[data-preview]", preview);
  let x = 0;
  let y = 0;
  let px = 0;
  let py = 0;
  let running = false;
  const loop = () => {
    px += (x - px) * 0.12;
    py += (y - py) * 0.12;
    const rot = Math.max(-8, Math.min(8, (x - px) * 0.04));
    preview.style.transform = `translate3d(${px + 28}px, ${py - preview.offsetHeight / 2}px, 0) rotate(${rot}deg)`;
    if (running) requestAnimationFrame(loop);
  };
  list.addEventListener("pointermove", (e) => {
    x = e.clientX;
    y = e.clientY;
  });
  $$<HTMLElement>("[data-preview-key]", list).forEach((row) => {
    row.addEventListener("pointerenter", (e) => {
      const key = row.dataset.previewKey;
      items.forEach((it) => it.classList.toggle("is-active", it.dataset.preview === key));
      if (!running) {
        x = px = e.clientX;
        y = py = e.clientY;
        running = true;
        loop();
      }
      preview.classList.add("is-on");
    });
  });
  list.addEventListener("pointerleave", () => {
    preview.classList.remove("is-on");
    setTimeout(() => (running = preview.classList.contains("is-on")), 600);
  });
}

/* ---------------------------------------------------------------- Scramble */

const GLYPHS = "▖▘▝▗▚▞█▓▒░/\\_<>#%&@$01";
function scramble(el: HTMLElement) {
  const final = el.dataset.text ?? el.textContent ?? "";
  el.dataset.text = final;
  let frame = 0;
  const total = 18;
  const tick = () => {
    const revealed = Math.floor((frame / total) * final.length);
    el.textContent = [...final]
      .map((ch, i) => (i < revealed || ch === " " ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
      .join("");
    if (frame++ < total) requestAnimationFrame(tick);
    else el.textContent = final;
  };
  tick();
}
function scrambles() {
  if (reduce) return;
  $$("[data-scramble]").forEach((el) => {
    const host = el.closest<HTMLElement>("a, button, [data-scramble-host]") ?? el;
    host.addEventListener("pointerenter", () => scramble(el));
  });
}

/* ---------------------------------------------------------------- Counters */

function counters() {
  $$("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count);
    const decimals = (el.dataset.count!.split(".")[1] ?? "").length;
    const prefix = el.dataset.prefix ?? "";
    const suffix = el.dataset.suffix ?? "";
    const fmt = (n: number) =>
      prefix + n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (reduce) return void (el.textContent = fmt(target));
    el.textContent = fmt(0);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const s = { v: 0 };
        animate(s, {
          v: target,
          duration: 1800,
          ease: "outExpo",
          onUpdate: () => (el.textContent = fmt(s.v)),
        });
      },
      { threshold: 0.5 },
    );
    io.observe(el);
  });
}

/* ---------------------------------------------------------------- Magnetic */

function magnetic() {
  if (!finePointer || reduce) return;
  $$("[data-magnetic]").forEach((el) => {
    const strength = Number(el.dataset.magnetic || 0.3);
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transition = "transform 0.15s linear";
      el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
    });
    el.addEventListener("pointerleave", () => {
      el.style.transition = "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)";
      el.style.transform = "";
    });
  });
}

/* ---------------------------------------------------------------- Spotlight on capability cells */

function spotlights() {
  $$(".cap").forEach((el) =>
    el.addEventListener("pointerenter", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    }),
  );
}

/* ---------------------------------------------------------------- Copy email */

function copyEmail() {
  $$<HTMLAnchorElement>("[data-copy]").forEach((a) => {
    a.addEventListener("click", async (e) => {
      if (!navigator.clipboard) return;
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(a.dataset.copy!);
        a.classList.add("is-copied");
        setTimeout(() => a.classList.remove("is-copied"), 1800);
      } catch {
        location.href = a.href;
      }
    });
  });
}

/* ---------------------------------------------------------------- Plate parallax */

function parallax() {
  if (reduce) return;
  const els = $$("[data-parallax]");
  if (!els.length) return;
  const update = () => {
    els.forEach((el) => {
      const r = el.parentElement!.getBoundingClientRect();
      const amt = Number(el.dataset.parallax || 0.12);
      const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      el.style.transform = `translate3d(0, ${p * amt * 100}px, 0) scale(${1 + amt})`;
    });
  };
  addEventListener("scroll", update, { passive: true });
  update();
}

/* ---------------------------------------------------------------- Boot */

$$<HTMLCanvasElement>("canvas[data-dither]").forEach((c) => mountDither(c).catch(() => {}));
statementScrub();
marquees();
workPreview();
scrambles();
counters();
magnetic();
spotlights();
copyEmail();
parallax();

(async () => {
  await Promise.all([preload(), leaveWipe()]);
  introHero();
  revealOnScroll();
})();

/**
 * Ordered (Bayer 8×8) dither of an image into a two-tone canvas.
 * Renders at low resolution and is upscaled with `image-rendering: pixelated`
 * for a printed/industrial halftone look. Light tone swaps to the signal colour on hover.
 */

const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30,
  54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23,
  61, 29, 53, 21,
];

type RGB = [number, number, number];

const hex = (h: string): RGB => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

export async function mountDither(canvas: HTMLCanvasElement) {
  const src = canvas.dataset.dither!;
  const cols = Number(canvas.dataset.cols ?? 150);
  const css = getComputedStyle(document.documentElement);
  const dark = hex(css.getPropertyValue("--ink").trim() || "#0b0b0a");
  const light = hex(css.getPropertyValue("--bone").trim() || "#ecebe6");
  const signal = hex(css.getPropertyValue("--signal").trim() || "#ff4f00");

  const img = await loadImage(src);
  const box = canvas.getBoundingClientRect();
  const aspect = box.height / box.width || 1.25;
  const w = cols;
  const h = Math.round(cols * aspect);
  canvas.width = w;
  canvas.height = h;

  // Cover-fit the source into w×h, biased toward the top (faces).
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = Math.max(0, (img.height - sh) * 0.25);

  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const src_px = ctx.getImageData(0, 0, w, h);

  // Luminance with contrast + gamma lift so skin/hair separate cleanly.
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = src_px.data[i * 4];
    const g = src_px.data[i * 4 + 1];
    const b = src_px.data[i * 4 + 2];
    let l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    l = Math.pow(l, 3);
    l = (l - 0.5) * 1.4 + 0.45;
    lum[i] = Math.min(1, Math.max(0, l));
  }

  const out = ctx.createImageData(w, h);
  const paint = (lightTone: RGB, rows = h) => {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const t = (BAYER8[(y & 7) * 8 + (x & 7)] + 0.5) / 64;
        const c = lum[i] > t ? lightTone : dark;
        out.data[i * 4] = c[0];
        out.data[i * 4 + 1] = c[1];
        out.data[i * 4 + 2] = c[2];
        out.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  };

  // Scan in row by row when it enters the viewport.
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  ctx.fillStyle = `rgb(${dark.join(",")})`;
  ctx.fillRect(0, 0, w, h);

  const scan = () => {
    if (reduce) return paint(light);
    const start = performance.now();
    const dur = 1100;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      paint(light, Math.ceil(eased * h));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        scan();
      }
    },
    { threshold: 0.2 },
  );
  io.observe(canvas);

  const host = canvas.closest<HTMLElement>("[data-dither-host]") ?? canvas;
  host.addEventListener("pointerenter", () => paint(signal));
  host.addEventListener("pointerleave", () => paint(light));
}

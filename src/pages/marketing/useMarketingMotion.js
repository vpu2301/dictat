/* useMarketingMotion — the public site's motion layer.
 *
 * SITE ONLY. This hook is called from MarketingShell and nowhere else, so it
 * cannot run inside the logged-in platform: a clinician mid-dictation does not
 * need cards that tilt towards the pointer. Everything it does is scoped to
 * the `.lp` wrapper the shell renders.
 *
 * Four effects, all of them progressive enhancement — the page is complete and
 * readable with this file deleted:
 *
 *   1. reveal      sections fade + rise as they enter the viewport, staggered
 *                  across the cards of a row
 *   2. count-up    a stat's leading number counts to its value the first time
 *                  it is seen
 *   3. spotlight   cards carry a soft light that follows the pointer
 *   4. progress    a hairline read-progress bar under the sticky nav
 *
 * The reveal deliberately hides nothing in CSS on its own: the "start
 * invisible" rule keys off the `data-reveal` attribute, which only ever
 * appears because THIS FILE put it there. If the bundle fails, the JS throws,
 * or the browser has no IntersectionObserver, no element is ever marked and
 * the whole page renders at full opacity. A reveal animation that can hide a
 * page's copy when it half-loads is not worth having.
 *
 * `prefers-reduced-motion` is honoured at the top: the hook marks nothing,
 * counts nothing and attaches no pointer listener. That is stricter than
 * turning the animations off in CSS — with the attribute absent there is
 * nothing left to animate.
 */

import { useEffect } from "react";

/* Blocks that get the reveal. Chosen as "things that are a unit of reading" —
 * a heading group, a card, a step, a band. Deliberately NOT the hero: the
 * first screen animates on load from CSS instead, because an element that is
 * already in the viewport should not wait for an observer callback. */
const REVEAL = [
  ".lp-head",
  ".lp-feature",
  ".lp-pillar",
  ".lp-step",
  ".lp-stat",
  ".lp-usp",
  ".lp-cta",
  ".mk-faq-item",
  ".mk-price-card",
  ".mk-price-table-wrap",
  ".mk-prose > h2",
  ".mk-prose > h3",
].join(",");

/* Cards that take the pointer spotlight. A subset of REVEAL: only the ones
 * that are actually card-shaped, so the light has an edge to sit inside. */
const SPOTLIGHT = ".lp-feature, .lp-pillar, .lp-step, .lp-stat, .mk-price-card";

const REDUCED = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion() {
  try {
    return window.matchMedia(REDUCED).matches;
  } catch {
    return false;   /* no matchMedia — assume motion is fine */
  }
}

/* ── Stat count-up ─────────────────────────────────────────────────────────
 * The stat values are authored strings in eleven languages: "98%", "3×",
 * "11 мов", "24/7", "₴790". Only the LEADING run of digits is animated and
 * everything around it is preserved verbatim, so a suffix in Ukrainian
 * survives untouched and a currency prefix stays put.
 *
 * "24/7" is skipped on purpose. Counting 0→24 in front of a fixed "/7" reads
 * as a broken clock rather than as a statistic, and it is the one shape in the
 * copy where the number is not a quantity.
 *
 * A space belongs to the number only when a DIGIT follows it: ₴1 990 is
 * one value carrying a thousands separator, “11 мов” is a value and then a
 * word. Getting that boundary wrong eats the space and the stat counts up as
 * “10мов”. The separator is kept rather than stripped so the running count
 * can be rendered with it — a stat that reads 1990 for 900ms and then snaps to
 * 1 990 looks like a rounding bug rather than like a count. */
const NUM = /^(\D*?)(\d+(?:[\s\u00a0\u202f]\d+)*)([\s\S]*)$/;
const SEP = /[\s\u00a0\u202f]/;

function splitNumber(text) {
  if (text.includes("/")) return null;
  const m = NUM.exec(text);
  if (!m) return null;
  const raw = m[2];
  const sep = SEP.exec(raw)?.[0] || "";
  const value = Number(raw.replace(new RegExp(SEP.source, "g"), ""));
  if (!Number.isFinite(value) || value === 0) return null;
  return { pre: m[1], value, post: m[3], sep };
}

/* Re-group from the right in threes, with whatever separator the copy used. */
function group(n, sep) {
  const s = String(n);
  return sep ? s.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : s;
}

function countUp(el) {
  if (el.dataset.counted) return;
  const parts = splitNumber((el.textContent || "").trim());
  if (!parts) { el.dataset.counted = "skip"; return; }
  el.dataset.counted = "1";

  /* The final string is what the element already says — reserve its width up
   * front so the row does not reflow while the digits change width. */
  const width = el.getBoundingClientRect().width;
  if (width) el.style.minWidth = `${Math.ceil(width)}px`;

  const DURATION = 900;
  let start = null;
  const step = (now) => {
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / DURATION);
    /* ease-out cubic: fast first, so the number is legible for most of the
     * animation rather than blurring past and stopping abruptly. */
    const eased = 1 - Math.pow(1 - t, 3);
    const n = Math.round(parts.value * eased);
    el.textContent = `${parts.pre}${group(n, parts.sep)}${parts.post}`;
    if (t < 1) requestAnimationFrame(step);
    else el.style.minWidth = "";
  };
  el.textContent = `${parts.pre}0${parts.post}`;
  requestAnimationFrame(step);
}

export function useMarketingMotion(deps) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (prefersReducedMotion()) return undefined;
    if (typeof IntersectionObserver !== "function") return undefined;

    const root = document.querySelector(".lp");
    if (!root) return undefined;

    const cleanups = [];

    /* ── 1 + 2. Reveal, and count up on the way in ───────────────────── */
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        el.classList.add("is-inview");
        io.unobserve(el);            /* one-way: it does not fade back out */
        if (el.classList.contains("lp-stat")) {
          const v = el.querySelector(".lp-stat-v");
          if (v) countUp(v);
        }
      }
    }, {
      /* Fire a little before the block reaches the fold, so the motion has
       * finished by the time the reader's eye gets there. */
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.08,
    });

    const mark = () => {
      /* Stagger index is the element's position among its REVEAL siblings, so
       * a four-card row cascades left-to-right while a lone heading does not
       * wait for anything. */
      const seen = new Map();
      for (const el of root.querySelectorAll(REVEAL)) {
        if (el.dataset.reveal) continue;
        const parent = el.parentElement;
        const i = seen.get(parent) || 0;
        seen.set(parent, i + 1);
        el.dataset.reveal = "";
        el.style.setProperty("--reveal-i", String(Math.min(i, 7)));
        io.observe(el);
      }
    };
    mark();
    cleanups.push(() => io.disconnect());

    /* ── 3. Pointer spotlight ────────────────────────────────────────────
     * One delegated listener on the wrapper rather than two per card: the
     * grids run to a few dozen cards on the longer content pages. */
    const onMove = (e) => {
      const card = e.target.closest?.(SPOTLIGHT);
      if (!card || !root.contains(card)) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--lp-mx", `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty("--lp-my", `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    root.addEventListener("pointermove", onMove, { passive: true });
    cleanups.push(() => root.removeEventListener("pointermove", onMove));

    /* ── 4. Read progress ────────────────────────────────────────────────
     * Written to a custom property on the wrapper and drawn by CSS with a
     * scaleX, so the paint stays on the compositor. rAF-coalesced: scroll
     * fires far more often than the screen refreshes. */
    const bar = root.querySelector(".lp-progress");
    if (bar) {
      let queued = false;
      const paint = () => {
        queued = false;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        bar.style.setProperty("--lp-progress", String(p));
      };
      const onScroll = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(paint);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      paint();
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      });
    }

    return () => { for (const fn of cleanups) fn(); };
    /* `deps` is the page's children: the shell is re-rendered with new content
     * on navigation, and the new blocks need marking. Elements already carrying
     * `data-reveal` are skipped, so a re-run is cheap. */
  }, [deps]);
}

export const __test = { splitNumber, group };

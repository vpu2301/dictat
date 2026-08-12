// WorkflowGraph.jsx — the closed loop, running.
//
// The dark band under the hero. A record travels the whole pipeline in front
// of the reader: spoken → structured → checked against evidence → coded →
// signed → delivered, and round again. One stage is live at a time, its
// artefacts light up, and the readout underneath prints what just happened at
// that step.
//
// ── One continuous cycle, not six states ──────────────────────────────────
// The first version switched: a step went dark, another lit, and nothing
// crossed the gap. On a page whose entire claim is that NOTHING is exported or
// re-keyed between steps, that cut is the worst thing the animation could
// show — it is exactly where a reader assumes a hand-off to another system
// happens. So there is a packet, and it never teleports: it holds at a step
// while its artefacts are read, then eases along the pipeline into the next.
// The loop closes back to 01 and keeps going.
//
// Everything runs off ONE clock in the rAF loop — the drift, the packet and
// the step index — because a setInterval for the step and a rAF for the packet
// drift apart within a minute and the caption starts naming the wrong step.
//
// It began as an evidence constellation — six clinical questions and their
// sources. That showed the hardest single step, but the product's actual claim
// is the LOOP: that nothing is exported, re-keyed or copied between systems
// between the first spoken word and the signed record. A picture of one step
// cannot make that argument; a ring that runs can.
//
// ── Why a ring ────────────────────────────────────────────────────────────
// The positioning calls this "Замкнений цикл" / "the closed loop"
// (positioning.js), so the shape is not decoration — the pipeline edges ARE
// the story, and the loop closing back to Listen is the point. A left-to-right
// pipeline would have said "assembly line" and left no room in the middle for
// the statement.
//
// ── The content is real ───────────────────────────────────────────────────
// Every citation in the Verify stage is a real guideline or trial with its
// real provenance; every code is a real ICD-10 code; the signing artefacts are
// what КЕП/Дія actually produces. Nothing is invented. A product whose whole
// pitch is traceability cannot put a plausible-looking fake trial name on its
// front page — a clinician spots it instantly and the claim dies with it.
//
// UNBUILT WORK IS MARKED. The Billing stage carries `soon`, because
// positioning.js keeps every one of its claims in `soon` rather than `points`:
// none of it ships yet. It is in the loop because it belongs to the loop, and
// it is badged so nobody reads the animation as a shipped feature.
//
// ── Motion ────────────────────────────────────────────────────────────────
// One rAF loop drifts the nodes; the edges are lines between two moving
// endpoints, which is why this is JS and not CSS — a transform on a node
// cannot tell the line attached to it where it went. It does not run unless
// the section is on screen, and not at all under prefers-reduced-motion.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/UI.jsx";
import { tr } from "../../i18n.js";
import { DICTATIONS } from "./dictations.js";
import { VoiceReadout } from "./VoiceReadout.jsx";

/* ── The pipeline ──────────────────────────────────────────────────────────
   Six stages. The four marketing pillars (Scribe / Evidentia / Signing /
   Billing, positioning.js) are what the loop is SOLD as; these are what a
   record actually passes through, which is two steps more — structuring and
   delivery are where "no re-keying" is either true or a slogan.

   `kind` on an artefact is what sort of thing it is, and drives its colour:
     signal   — audio and the voice itself
     model    — something the platform computes
     evidence — a named external source
     code     — a classification
     crypto   — signature material
     transport— how it leaves */
const STAGES = [
  {
    key: "listen", n: "01", brand: "Scribe",
    verb: ["Слухає", "Listens"],
    /* The readout line for this stage is a real dictation — the same six the
       hero cycles through, so the two readouts are the same clinic. */
    said: DICTATIONS.bp,
    artefacts: [
      { kind: "signal", label: ["Амбієнтний запис", "Ambient capture"], meta: ["16 кГц · діаризація", "16 kHz · diarisation"] },
      { kind: "model", label: ["ASR", "ASR"], meta: ["укр · англ · нім", "UK · EN · DE"] },
      { kind: "signal", label: ["Голосові команди", "Voice commands"], meta: ["«новий абзац»", "“new paragraph”"] },
    ],
  },
  {
    key: "structure", n: "02", brand: "Scribe",
    verb: ["Структурує", "Structures"],
    said: [
      "Скарги · Анамнез · Обстеження · План — секції заповнено.",
      "Subjective · Objective · Assessment · Plan — sections filled.",
    ],
    artefacts: [
      { kind: "model", label: ["Шаблон", "Template"], meta: ["Первинний огляд", "Consultation note"] },
      { kind: "model", label: ["Секції", "Sections"], meta: ["Скарги · Огляд · План", "S · O · A · P"] },
      { kind: "model", label: ["Типізовані поля", "Typed fields"], meta: ["числові · дата · вибір", "numeric · date · choice"] },
    ],
  },
  {
    key: "verify", n: "03", brand: "Evidentia",
    verb: ["Перевіряє", "Verifies"],
    said: [
      "Звірено з трьома джерелами · ESC 2024, NICE NG136, SPRINT.",
      "Checked against three sources · ESC 2024, NICE NG136, SPRINT.",
    ],
    artefacts: [
      { kind: "evidence", label: ["ESC 2024", "ESC 2024"], meta: ["Артеріальна гіпертензія", "Hypertension"] },
      { kind: "evidence", label: ["NICE NG136", "NICE NG136"], meta: ["Гіпертензія у дорослих", "Hypertension in adults"] },
      { kind: "evidence", label: ["SPRINT", "SPRINT"], meta: ["NEJM 2015 · n=9 361", "NEJM 2015 · n=9,361"] },
      { kind: "evidence", label: ["Взаємодії ліків", "Drug interactions"], meta: ["до підписання", "flagged before signing"] },
    ],
  },
  {
    key: "code", n: "04", brand: "Billing", soon: true,
    verb: ["Кодує", "Codes"],
    said: [
      "I10 · Есенціальна гіпертензія — код запропоновано до запису.",
      "I10 · Essential hypertension — code proposed against the record.",
    ],
    artefacts: [
      { kind: "code", label: ["МКХ-10 I10", "ICD-10 I10"], meta: ["Есенціальна гіпертензія", "Essential hypertension"] },
      { kind: "code", label: ["МКХ-10 E11.9", "ICD-10 E11.9"], meta: ["Цукровий діабет 2 типу", "Type 2 diabetes"] },
      /* Not `code`: a claim is something the platform ASSEMBLES from the
         record, not a classification it assigns to it. The distinction is
         what the dot colour tells a reader, and it is also what the test
         guarding the ICD-10 labels keys off. */
      { kind: "model", label: ["Рахунок", "Claim"], meta: ["будується із запису", "built from the record"] },
    ],
  },
  {
    key: "sign", n: "05", brand: "Signing",
    verb: ["Засвідчує", "Signs"],
    said: [
      "Підписано кваліфікованим електронним підписом через Дію.",
      "Signed with a qualified electronic signature through Diia.",
    ],
    artefacts: [
      { kind: "crypto", label: ["КЕП · Дія", "QES · Diia"], meta: ["кваліфікований підпис", "qualified signature"] },
      { kind: "crypto", label: ["Посилання перевірки", "Verification link"], meta: ["відкриє будь-хто", "opens for any recipient"] },
      { kind: "crypto", label: ["Амендмент", "Amendment"], meta: ["правка без перезапису", "edits, never overwrites"] },
    ],
  },
  {
    key: "deliver", n: "06", brand: "Klarnote",
    verb: ["Передає", "Delivers"],
    said: [
      "Надіслано в МІС · HL7 FHIR. Запис не залишав вашого розгортання.",
      "Delivered to the EHR · HL7 FHIR. The record never left your deployment.",
    ],
    artefacts: [
      { kind: "transport", label: ["HL7 FHIR", "HL7 FHIR"], meta: ["обмін із МІС", "exchange with the EHR"] },
      { kind: "transport", label: ["Журнал аудиту", "Audit log"], meta: ["хто, коли, що", "who, when, what"] },
      { kind: "transport", label: ["Self-hosted", "Self-hosted"], meta: ["дані не залишають", "data never leaves"] },
    ],
  },
];

/* The drawing surface. Everything below is in these coordinates and the SVG
   scales as one piece, so nothing has to be recomputed on resize.

   900 tall, not 760: the centred block is eyebrow, headline, lead, CTA and the
   readout under them — ~470px — and at 760 the readout's bottom edge landed on
   the two lower stages. Occluding them would have hidden two real steps behind
   a caption; the surface grows instead and the ring opens with it. */
const VB = { w: 1440, h: 900 };
const CENTRE = { x: VB.w / 2, y: VB.h / 2 };

/* Wide and flat because the band is: a circle would put a stage directly above
   and below the copy, where there is no room. */
const RING = { rx: 470, ry: 320 };

/* Artefacts sit on a small arc OUTSIDE their stage, pushed away from the
   centre so the ring of verbs stays legible and the tiles fan into the margin.
   `stagger` alternates the radius: neighbouring artefacts are only ~35° apart
   and at a shared distance their boxes overlap — two citations sitting on top
   of each other, which is the one thing this must not look like. */
const SPUR = { near: 112, far: 146, spread: 0.9, stagger: 80 };

/* Tiles are clamped inside this inset. Edges and stage labels may run off the
   frame — they are lines and centred text and crop gracefully. A TILE cropped
   at the frame is a citation cut mid-word, which reads as a bug. */
const SAFE = { x: 104, y: 62 };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function buildGraph() {
  const nodes = [];
  const edges = [];
  const stageIds = [];

  STAGES.forEach((stage, h) => {
    /* -Math.PI/2 starts the ring at the top; the half-step offset keeps a
       stage off the vertical axis, where it would collide with the headline.
       Index order IS pipeline order, so the ring runs clockwise. */
    const a = -Math.PI / 2 + ((h + 0.5) / STAGES.length) * Math.PI * 2;
    const hx = CENTRE.x + Math.cos(a) * RING.rx;
    const hy = CENTRE.y + Math.sin(a) * RING.ry;

    const stageId = nodes.length;
    stageIds.push(stageId);
    nodes.push({
      id: stageId, type: "stage", stage: stage.key, n: stage.n,
      verb: stage.verb, brand: stage.brand, soon: !!stage.soon,
      x: hx, y: hy,
      /* Where this step sits on the ring, in radians. The packet and the arcs
         are both drawn from angles rather than from the points, so the record
         travels the CURVE between two steps instead of the chord across it. */
      angle: a,
      /* Each node drifts on its own sine; the phase comes from the index so no
         two neighbours move together — a graph where everything breathes in
         unison reads as one object sliding, not as a constellation. */
      phase: h * 1.7, speed: 0.23 + (h % 3) * 0.04, amp: 12,
    });

    const n = stage.artefacts.length;
    stage.artefacts.forEach((art, i) => {
      const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;        // -1 … +1
      /* The arc widens with the number of artefacts. A fixed spread is tuned
         for three; Verify carries four, and the extra pair landed inside each
         other's boxes — SPRINT on top of NICE NG136, which on a page arguing
         for traceable citations is the worst possible collision. */
      const spread = SPUR.spread * (1 + Math.max(0, n - 3) * 0.26);
      const ea = a + t * spread;
      const r = SPUR.near + (i % 2 ? SPUR.stagger : 0) + Math.abs(t) * (SPUR.far - SPUR.near);
      const id = nodes.length;
      /* 1.14 / 0.78: the surface is wider than it is tall, so the spur is
         stretched the same way the ring is and the fan stays even. */
      const ex = hx + Math.cos(ea) * r * 1.14;
      const ey = hy + Math.sin(ea) * r * 0.78;
      nodes.push({
        id, type: "art", stage: stage.key, kind: art.kind,
        label: art.label, meta: art.meta,
        /* The drift amplitude has to fit inside the safe area too, or a tile
           clamped exactly to the inset drifts back out of it. */
        x: clamp(ex, SAFE.x + 12, VB.w - SAFE.x - 12),
        y: clamp(ey, SAFE.y + 12, VB.h - SAFE.y - 12),
        phase: h * 1.7 + i * 0.9, speed: 0.28 + (i % 4) * 0.035, amp: 9,
      });
      edges.push({ a: stageId, b: id, kind: "spur", stage: stage.key });
    });
  });

  /* The pipeline itself. Stage n → stage n+1, closing back to the first: this
     is the "closed loop" the positioning is named for, and unlike the earlier
     version's decorative ring these edges carry the actual sequence. `into` is
     the stage the segment feeds, so the live stage can pulse its inbound leg. */
  stageIds.forEach((id, i) => {
    const next = (i + 1) % stageIds.length;
    edges.push({
      a: id, b: stageIds[next], kind: "flow",
      into: STAGES[next].key, from: STAGES[i].key,
    });
  });
  /* Six straight legs between six points draw a HEXAGON, and that is what the
     band looked like — an angular diagram with corners, when the thing being
     described is a cycle. The legs below are elliptical arcs instead, so the
     six of them close into one continuous ring and the record curves round it
     rather than cornering at every step. */

  return { nodes, edges, stageNodeIds: stageIds, step: (Math.PI * 2) / STAGES.length };
}

const GRAPH = buildGraph();

/* ── Tile geometry ─────────────────────────────────────────────────────────
   SVG boxes do not size themselves to the text inside them, so the width is
   estimated from glyph counts — one multiplication per node beats a getBBox(),
   which forces a layout flush on every mount. Both lines are measured, not
   just the label: "Community-acquired pneumonia" is more than twice the width
   of the acronym above it, and sizing on the label alone runs the caption
   straight out of its box. */
const TILE_H = 38;
const LABEL_CH = 7.0;    /* ≈ advance of Geist 11px semibold */
const META_CH = 5.1;     /* ≈ advance of Geist 9.5px         */
const TILE_GUTTER = 20;  /* the dot's column                 */
const TILE_PAD_R = 14;

/* The ring's legs. `A rx ry 0 0 1` sweeps the short way round, clockwise in
   screen coordinates — six of these close into the ellipse. The radii stay at
   the ring's nominal size even while the endpoints drift: an arc command only
   needs radii large enough to reach, and holding them fixed keeps all six legs
   on one curve instead of each bulging by its own amount. */
function arcPath(a, b) {
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${RING.rx} ${RING.ry} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

function tileWidth(label, meta) {
  const inner = Math.max(label.length * LABEL_CH, meta.length * META_CH);
  return Math.max(84, Math.round(TILE_GUTTER + inner + TILE_PAD_R));
}

/* One step's worth of the cycle, and the share of it the record spends sitting
   at the step rather than travelling to the next. 5.2s × 0.62 leaves ~3.2s to
   read three artefacts and a caption, and ~2s of visible transit — long enough
   to see the hand-off, short enough that the loop closes in half a minute. */
const CYCLE = 5.2;
const DWELL = 0.62;

export function WorkflowGraph({ lang = "en", navigate }) {
  const svgRef = useRef(null);
  const nodeRefs = useRef([]);
  const edgeRefs = useRef([]);
  const packetRef = useRef(null);

  const nodes = GRAPH.nodes;
  const edges = GRAPH.edges;
  const stageNodeIds = GRAPH.stageNodeIds;
  const uk = lang === "uk";
  const pick = (pair) => (uk ? pair[0] : pair[1]);

  /* ── Which stage is running ───────────────────────────────────────────────
     The loop walks itself, one step at a time. Hovering any node takes the
     wheel — a reader interrogating the diagram outranks the diagram running
     itself — and letting go hands it back where the walk had got to, rather
     than restarting from step one. */
  const [probed, setProbed] = useState(null);
  /* `walk` is where the record currently is: which step it is sitting at, and
     whether it is in transit to the next one. Both come from the rAF clock
     below rather than from a setInterval — see the comment on CYCLE. */
  const [walk, setWalk] = useState({ at: 0, leg: -1 });
  const at = probed ? STAGES.findIndex((s) => s.key === probed) : walk.at;
  const live = STAGES[at];
  /* Hover freezes the record where it is. Pinning the highlight while the
     packet kept sailing round would have the diagram describing one step and
     animating another. */
  const pausedRef = useRef(false);
  pausedRef.current = !!probed;

  const label = useMemo(() => ({
    eyebrow: tr(lang, "Замкнений цикл", "The closed loop"),
    title: tr(lang, "Від сказаного слова до підписаного запису.",
                    "From the spoken word to a signed record."),
    sub: tr(lang,
      "Один запис проходить шість кроків без жодного експорту, повторного введення чи копіювання між системами.",
      "One record moves through six steps with no export, no re-keying and no copy-paste between systems."),
    cta: tr(lang, "Як працює платформа", "How the platform works"),
    graph: tr(lang,
      "Схема замкненого циклу: запис проходить шість кроків — від амбієнтного запису до передачі в МІС.",
      "The closed loop: a record moving through six steps, from ambient capture to delivery into the EHR."),
    soon: tr(lang, "В інтеграції", "In integration"),
  }), [lang]);

  /* ── The drift ──────────────────────────────────────────────────────────
     Positions are written straight to the DOM rather than to React state:
     this runs at 60fps and a setState per frame would re-render the whole
     section sixty times a second to move numbers React never reads. */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch { /* no matchMedia — assume motion is fine */ }
    if (reduced) return undefined;

    let raf = 0;
    let animating = false;
    const start = performance.now();
    /* Two clocks, deliberately. `t` never stops — the constellation keeps
       breathing even while a reader holds a step open. `cycle` is the record's
       own clock and stops when they do, so nothing moves out from under the
       step they are reading. */
    let cycle = 0;
    let last = performance.now();
    let shown = -1;
    let onLeg = -2;

    const frame = (now) => {
      const t = (now - start) / 1000;
      const dt = Math.min(now - last, 100) / 1000;   /* a backgrounded tab can
                                                        hand back a 30s delta */
      last = now;
      if (!pausedRef.current) cycle += dt;

      const px = new Float64Array(nodes.length);
      const py = new Float64Array(nodes.length);

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        /* Two sines of different frequency on each axis: a single sine is a
           straight line back and forth, which reads as a mechanism. */
        px[i] = n.x + Math.sin(t * n.speed + n.phase) * n.amp;
        py[i] = n.y + Math.cos(t * n.speed * 0.73 + n.phase * 1.3) * n.amp * 0.8;
        const g = nodeRefs.current[i];
        if (g) g.setAttribute("transform", `translate(${px[i].toFixed(2)} ${py[i].toFixed(2)})`);
      }
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const el = edgeRefs.current[i];
        if (!el) continue;
        if (e.kind === "flow") {
          el.setAttribute("d", arcPath(
            { x: px[e.a], y: py[e.a] }, { x: px[e.b], y: py[e.b] },
          ));
        } else {
          el.setAttribute("x1", px[e.a].toFixed(2));
          el.setAttribute("y1", py[e.a].toFixed(2));
          el.setAttribute("x2", px[e.b].toFixed(2));
          el.setAttribute("y2", py[e.b].toFixed(2));
        }
      }

      /* ── The record, travelling ────────────────────────────────────────
         The band used to jump: a step went dark, another lit, and nothing
         crossed the gap between them. A pipeline whose whole claim is that
         NOTHING is re-keyed between steps cannot afford to teleport its record
         from one to the next — the cut is exactly where a reader assumes an
         export happens.

         So the cycle is continuous. Each step gets one CYCLE: it holds while
         the record sits there and its artefacts are read, then the record
         eases along the pipeline into the next one. Interpolated between the
         two stages' CURRENT drifted positions, so the packet rides the
         constellation rather than sliding over a diagram that has moved. */
      const span = cycle / CYCLE;
      const idx = Math.floor(span) % STAGES.length;
      const frac = span - Math.floor(span);
      const nextIdx = (idx + 1) % STAGES.length;
      const a = stageNodeIds[idx];
      const bId = stageNodeIds[nextIdx];

      let k = 0;                       /* 0 at this step, 1 at the next */
      if (frac > DWELL) {
        const u = (frac - DWELL) / (1 - DWELL);
        /* ease-in-out cubic: it leaves slowly, crosses fast, arrives slowly —
           which is how a hand-off reads as deliberate rather than as a slide. */
        k = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      }
      const packet = packetRef.current;
      if (packet) {
        /* ON THE CURVE, not across it. Interpolating the two stages' points
           would cut the chord — six chords is the hexagon this replaced. The
           angle is interpolated instead and the position read off the ellipse,
           so the record follows the same arc the leg is drawn along.

           The endpoints' drift is carried along with it (lerped between the
           two stages' offsets from their nominal seats), so the packet stays
           welded to the steps it is travelling between rather than sliding
           over a ring that has breathed out from under it. */
        const ang = nodes[a].angle + GRAPH.step * k;
        const ox = (px[a] - nodes[a].x) * (1 - k) + (px[bId] - nodes[bId].x) * k;
        const oy = (py[a] - nodes[a].y) * (1 - k) + (py[bId] - nodes[bId].y) * k;
        const x = CENTRE.x + Math.cos(ang) * RING.rx + ox;
        const y = CENTRE.y + Math.sin(ang) * RING.ry + oy;
        packet.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      }

      /* React only hears about it when something actually changes — six times
         a lap, not sixty times a second. */
      const leg = frac > DWELL ? idx : -1;
      if (idx !== shown || leg !== onLeg) {
        shown = idx;
        onLeg = leg;
        setWalk({ at: idx, leg });
      }

      raf = requestAnimationFrame(frame);
    };

    /* Off-screen it does nothing at all. This band sits high on a very long
       page; without the gate the loop would keep running behind ten thousand
       pixels of scroll for the whole visit. */
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !animating) {
        animating = true;
        raf = requestAnimationFrame(frame);
      } else if (!entry.isIntersecting && animating) {
        animating = false;
        cancelAnimationFrame(raf);
      }
    }, { rootMargin: "120px" });
    io.observe(svg);

    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [nodes, edges, stageNodeIds]);

  const go = (path) => (e) => { e.preventDefault(); if (navigate) navigate(path); };

  return (
    <section className="lp-ev">
      <div className="lp-ev-stage">
        <svg
          ref={svgRef}
          className="lp-ev-svg"
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          preserveAspectRatio="xMidYMid meet"
          focusable="false"
        >
          <title>{label.graph}</title>

          <g className="lp-ev-edges">
            {edges.map((e, i) => {
              /* A spur lights with its step. A pipeline leg lights only while
                 the record is ON it — the diagram shows transit happening, not
                 transit having happened. Hovering pins the incoming leg
                 instead, so a held step still reads as "arrived here". */
              const on = e.kind === "flow"
                ? (probed ? e.into === live.key : walk.leg >= 0 && e.from === STAGES[walk.leg].key)
                : e.stage === live.key;
              const cls = `lp-ev-edge is-${e.kind}${on ? " is-live" : ""}`;
              /* A pipeline leg is an arc of the ring; a spur is a straight
                 tether from a step to one of its artefacts. Two element types,
                 because an SVG line cannot curve and a path cannot be given
                 endpoints as cheaply as x1/y1/x2/y2. */
              return e.kind === "flow" ? (
                <path
                  key={i}
                  ref={(el) => { edgeRefs.current[i] = el; }}
                  className={cls}
                  fill="none"
                  d={arcPath(nodes[e.a], nodes[e.b])}
                />
              ) : (
                <line
                  key={i}
                  ref={(el) => { edgeRefs.current[i] = el; }}
                  className={cls}
                  x1={nodes[e.a].x} y1={nodes[e.a].y}
                  x2={nodes[e.b].x} y2={nodes[e.b].y}
                />
              );
            })}
          </g>

          {nodes.map((n, i) => (
            <g
              key={n.id}
              ref={(el) => { nodeRefs.current[i] = el; }}
              className={[
                n.type === "stage" ? "lp-ev-hub" : `lp-ev-tile is-${n.kind}`,
                n.stage === live.key ? "is-live" : "",
              ].join(" ").trim()}
              transform={`translate(${n.x} ${n.y})`}
              /* Pointer, not click: the diagram is something you interrogate,
                 not a menu. onFocus/onBlur mirror it so a keyboard walking the
                 stages gets the same behaviour. */
              tabIndex={n.type === "stage" ? 0 : undefined}
              onMouseEnter={() => setProbed(n.stage)}
              onMouseLeave={() => setProbed(null)}
              onFocus={() => setProbed(n.stage)}
              onBlur={() => setProbed(null)}
            >
              {n.type === "stage" ? (
                <>
                  <text className="lp-ev-n" textAnchor="middle" y="-30">{n.n}</text>
                  <text className="lp-ev-q" textAnchor="middle">{pick(n.verb)}</text>
                  <text className="lp-ev-brand" textAnchor="middle" y="26">
                    {n.brand}
                    {/* Marked, not hidden. Billing is in the loop because it
                        belongs to the loop; none of it ships yet. */}
                    {n.soon ? ` · ${label.soon}` : ""}
                  </text>
                </>
              ) : (
                (() => {
                  const lab = pick(n.label);
                  const meta = pick(n.meta);
                  const w = tileWidth(lab, meta);
                  const left = -w / 2;
                  return (
                    <>
                      <rect className="lp-ev-tile-box"
                        x={left} y={-TILE_H / 2} width={w} height={TILE_H} rx="8" />
                      <circle className="lp-ev-dot" cx={left + 11} cy="0" r="3" />
                      <text className="lp-ev-label" x={left + TILE_GUTTER} y="-1">{lab}</text>
                      <text className="lp-ev-meta" x={left + TILE_GUTTER} y="11">{meta}</text>
                    </>
                  );
                })()
              )}
            </g>
          ))}
          {/* The record. Drawn last so it rides over the pipeline rather
              than under it; positioned every frame by the rAF loop. */}
          <g ref={packetRef} className="lp-ev-packet" aria-hidden="true"
             transform={`translate(${nodes[GRAPH.stageNodeIds[0]].x} ${nodes[GRAPH.stageNodeIds[0]].y})`}>
            <circle className="lp-ev-packet-halo" r="15" />
            <circle className="lp-ev-packet-core" r="4.5" />
          </g>
        </svg>

        <div className="lp-ev-copy">
          <span className="lp-ev-eyebrow"><Icon name="sparkle" size={13} /> {label.eyebrow}</span>
          <h2 className="lp-ev-title">{label.title}</h2>
          <p className="lp-ev-sub">{label.sub}</p>
          <a className="btn lp-ev-cta" href="#/platform" onClick={go("/platform")}>
            {label.cta} <Icon name="arrowRight" size={15} />
          </a>

          {/* What just happened at this step. Step 01 prints a real dictation;
              the rest print the artefact that step produced. Same component as
              the hero's readout — see marketing/VoiceReadout.jsx. */}
          <VoiceReadout
            lines={STAGES.map((s) => s.said)}
            index={at}
            tone="dark"
            label={`${live.n} · ${pick(live.verb)}`}
            lang={lang}
          />
        </div>
      </div>
    </section>
  );
}

export const __test = { STAGES, buildGraph, VB, CENTRE };

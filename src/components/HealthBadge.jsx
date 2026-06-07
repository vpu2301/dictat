// HealthBadge.jsx — Polls /readyz on every backend service every 30s.
//
// Backend convention (spec §A sprint 01): /healthz returns 200 always (liveness),
// /readyz returns 200 {status:"ready"} or 503 {status:"not_ready", ...}. We do
// not gate on /healthz; readiness is what the UI cares about.

import React, { useEffect, useState } from "react";
import { readyz } from "../api/endpoints.js";
import { SERVICES } from "../api/services.js";

export function HealthBadge({ intervalMs = 30000, lang = "en" }) {
  const [overall, setOverall] = useState("checking"); // ready | starting | down | checking
  const [byService, setByService] = useState({});      // { auth: "ready", ... }

  useEffect(() => {
    let cancelled = false;
    let timer;
    const tick = async () => {
      const entries = await Promise.all(
        Object.entries(SERVICES).map(async ([name, base]) => {
          try {
            const r = await readyz(base);
            return [name, r && r.status === "ready" ? "ready" : "starting"];
          } catch {
            return [name, "down"];
          }
        })
      );
      if (cancelled) return;
      const map = Object.fromEntries(entries);
      setByService(map);
      const states = Object.values(map);
      if (states.every((s) => s === "ready")) setOverall("ready");
      else if (states.some((s) => s === "down")) setOverall("down");
      else setOverall("starting");
      timer = setTimeout(tick, intervalMs);
    };
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [intervalMs]);

  const palette = {
    ready:    { bg: "rgba(4,120,87,.12)",    fg: "#047857", dot: "#10b981", labelUk: "Готово",     labelEn: "Ready" },
    starting: { bg: "rgba(180,83,9,.12)",    fg: "#b45309", dot: "#f59e0b", labelUk: "Запуск…",    labelEn: "Starting" },
    down:     { bg: "rgba(220,38,38,.12)",   fg: "#dc2626", dot: "#dc2626", labelUk: "Недоступно", labelEn: "Down" },
    checking: { bg: "rgba(107,116,128,.12)", fg: "#6b7480", dot: "#9ca3af", labelUk: "Перевірка",  labelEn: "Checking" },
  }[overall];

  // The tooltip carries the per-service breakdown so users on slow networks
  // can tell which microservice is degrading the overall pill.
  const tooltip = Object.entries(byService)
    .map(([k, v]) => `${k}: ${v}`).join("\n") || overall;

  return (
    <div
      title={tooltip}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "3px 8px", borderRadius: 999, background: palette.bg, color: palette.fg,
        fontSize: 11, fontWeight: 500, lineHeight: 1.3,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: palette.dot }} />
      <span>{lang === "uk" ? palette.labelUk : palette.labelEn}</span>
    </div>
  );
}

// CapabilitiesPanel.jsx — config-driven "what we've built" grid. Each card shows
// a capability, its description, a live readiness dot (probe of the backing
// service's /readyz), and a cheap data proof where available.
import React, { useEffect, useState, useMemo } from "react";
import { useAsync } from "../../api/useAsync.js";
import {
  CAPABILITIES, probeService, fetchCapabilityProofs,
} from "../../api/dashboard.js";
import { Icon } from "../UI.jsx";
import { Panel } from "./Panel.jsx";
import { tr } from "../../i18n.js";

export function CapabilitiesPanel({ lang }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [health, setHealth] = useState({}); // serviceKey → ready|starting|down|unknown
  const proofsReq = useAsync(() => fetchCapabilityProofs(), []);

  // Probe each distinct backing service once on mount; "unknown" until resolved.
  useEffect(() => {
    let cancelled = false;
    const services = [...new Set(CAPABILITIES.map((c) => c.service))];
    Promise.all(
      services.map(async (s) => [s, await probeService(s)]),
    ).then((entries) => {
      if (!cancelled) setHealth(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, []);

  const proofs = proofsReq.data || {};
  const proofText = (cap) => {
    if (cap.key === "templates") {
      return proofs.templates != null
        ? `${proofs.templates} ${T("шаблонів", "templates")}`
        : T("шаблони доступні", "templates available");
    }
    if (cap.key === "identity") {
      return proofs.roles != null
        ? `${proofs.roles} ${T("ролей", "roles")}`
        : T("ролі активні", "roles active");
    }
    return null;
  };

  const dotState = (s) => health[s] || "unknown";
  const dotTitle = (s) => ({
    ready: T("Готово", "Ready"), starting: T("Запуск…", "Starting"),
    down: T("Недоступно", "Down"), unknown: T("Невідомо", "Unknown"),
  }[dotState(s)]);

  return (
    <Panel title={T("Можливості продукту", "Product capabilities")} icon="sparkle"
           sub={T("жива перевірка стану", "live status probe")}>
      <div className="dash-caps">
        {CAPABILITIES.map((cap) => (
          <div className="dash-cap" key={cap.key}>
            <div className="dash-cap-h">
              <span className="dash-cap-icon"><Icon name={cap.icon} size={15} /></span>
              <span className="dash-cap-name">{lang === "uk" ? cap.nameUk : cap.nameEn}</span>
              <span className={"dash-cap-dot " + dotState(cap.service)} title={dotTitle(cap.service)} />
            </div>
            <div className="dash-cap-desc">{lang === "uk" ? cap.descUk : cap.descEn}</div>
            {proofText(cap) && <div className="dash-cap-proof">{proofText(cap)}</div>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

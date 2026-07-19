// ConsentFlow.jsx — Sprint 14: Consent screens, recording indicator, withdrawal
import React, { useState, useEffect, useRef } from 'react';
import { Icon, Modal } from './UI.jsx';
import { useAsync } from '../api/useAsync.js';
import { getPatient } from '../api/patients.js';
import { recordConsent } from '../api/consents.js';
import { requestMic, startCapture } from '../dictation/audioPipeline.js';
import { tr } from "../i18n.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loc(v, lang) {
  if (v == null) return "";
  if (typeof v === "object") return v[lang] ?? v.en ?? Object.values(v)[0] ?? "";
  return v;
}
function patientName(p, lang) { return loc(p?.name, lang); }

function fmtDur(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── VerbalConsentRecorder ────────────────────────────────────────────────────
// Captures the patient's spoken consent through the real microphone. The audio
// level drives the waveform; the clinician stops the recording when done.

function VerbalConsentRecorder({ lang, onGrant, onCancel }) {
  const [state, setState] = useState("idle"); // idle | recording | done | error
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);
  const capRef = useRef(null);
  const streamRef = useRef(null);

  const teardown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (capRef.current) { capRef.current.stop(); capRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const startRecording = async () => {
    setElapsed(0);
    try {
      const stream = await requestMic();
      streamRef.current = stream;
      capRef.current = startCapture({ stream, onLevel: (lvl) => setLevel(lvl) });
      setState("recording");
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch {
      setState("error");
    }
  };

  const stopRecording = () => {
    teardown();
    setState("done");
  };

  useEffect(() => () => teardown(), []);

  const grant = async () => {
    setBusy(true);
    try { await onGrant(); }
    finally { setBusy(false); }
  };

  // 12-bar meter derived from the live RMS level.
  const bars = Array.from({ length: 12 }, (_, i) => {
    const center = 1 - Math.abs(i - 5.5) / 6;
    return Math.max(4, Math.round(6 + level * 34 * center));
  });

  return (
    <div className="verbal-recorder">
      <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-1)" }}>
        {tr(lang, "Вербальна згода", "Verbal consent")}
      </div>

      {state === "idle" && (
        <>
          <div className="vr-status">
            {tr(lang, "Натисніть кнопку та зафіксуйте усну згоду пацієнта", "Press the button to record the patient's verbal consent")}
          </div>
          <button className="btn accent" style={{ padding: "10px 24px" }} onClick={startRecording}>
            <Icon name="mic" size={15} /> {tr(lang, "Почати запис", "Start recording")}
          </button>
        </>
      )}

      {state === "error" && (
        <div className="vr-status" style={{ color: "var(--rec)" }}>
          {tr(lang, "Немає доступу до мікрофона.", "Microphone access denied.")}
          <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => setState("idle")}>
            {tr(lang, "Спробувати ще", "Try again")}
          </button>
        </div>
      )}

      {state === "recording" && (
        <>
          <div className="vr-wave">
            {bars.map((h, i) => <span key={i} style={{ height: `${h}px` }} />)}
          </div>
          <div className="vr-status" style={{ color: "var(--rec)" }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--rec)", marginRight: 6, animation: "recPulse 1.4s ease-in-out infinite" }} />
            {tr(lang, "Запис…", "Recording…")} {fmtDur(elapsed)}
          </div>
          <div className="vr-actions">
            <button className="btn sm" onClick={stopRecording}>
              <Icon name="stop" size={12} /> {tr(lang, "Зупинити", "Stop")}
            </button>
          </div>
        </>
      )}

      {state === "done" && (
        <>
          <div style={{ color: "var(--ok,#047857)", display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500 }}>
            <Icon name="check" size={16} /> {tr(lang, "Вербальна згода зафіксована", "Verbal consent recorded")}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {fmtDur(elapsed)} {tr(lang, "тривалість запису", "recording length")}
          </div>
          <div className="vr-actions">
            <button className="btn ghost sm" onClick={() => { setState("idle"); setElapsed(0); }}>
              {tr(lang, "Повторити", "Re-record")}
            </button>
            <button className="btn accent" disabled={busy} onClick={grant}>
              <Icon name="check" size={13} /> {tr(lang, "Підтвердити згоду", "Confirm consent")}
            </button>
          </div>
        </>
      )}

      <button className="btn ghost sm" style={{ alignSelf: "flex-end" }} onClick={onCancel}>
        {tr(lang, "Скасувати", "Cancel")}
      </button>
    </div>
  );
}

// ─── KioskTapConsent ──────────────────────────────────────────────────────────

function KioskTapConsent({ lang, onGrant, onCancel }) {
  const [tapped, setTapped] = useState(false);

  const handleTap = async () => {
    setTapped(true);
    try { await onGrant(); }
    catch { setTapped(false); }
  };

  return (
    <div className="kiosk-consent">
      <div className="kiosk-icon"><Icon name="user" size={28} /></div>
      <div className="kiosk-title">
        {tr(lang, "Пацієнт, торкніться кнопки", "Patient, tap the button below")}
      </div>
      <div className="kiosk-body">
        {tr(lang, "Торкаючись кнопки, ви підтверджуєте, що прочитали та зрозуміли інформацію вище і надаєте згоду на AI-асистований запис консультації.", "By tapping, you confirm you have read and understood the information above and consent to AI-assisted recording of this consultation.")}
      </div>
      <button className="kiosk-tap-btn" onClick={handleTap}
        style={tapped ? { background: "var(--ok,#047857)", transform: "scale(0.97)" } : undefined}>
        <Icon name="check" size={28} />
        <span style={{ fontSize: 13 }}>{tapped ? (tr(lang, "Дякуємо", "Thank you")) : (tr(lang, "Я погоджуюсь", "I agree"))}</span>
      </button>
      <button className="btn ghost sm" onClick={onCancel}>{tr(lang, "Скасувати", "Cancel")}</button>
    </div>
  );
}

// ─── ConsentScreen ────────────────────────────────────────────────────────────

export function ConsentScreen({ patientId, lang, navigate }) {
  const patientReq = useAsync(() => (patientId ? getPatient(patientId) : Promise.resolve(null)), [patientId]);
  const patient = patientReq.data;
  const [mode, setMode] = useState(null); // null | "verbal" | "kiosk"
  const [granted, setGranted] = useState(null); // method once recorded
  const [error, setError] = useState(null);

  const pName = patient ? patientName(patient, lang) : patientId;

  const grant = async (method) => {
    setError(null);
    try {
      await recordConsent(patientId, { type: "ai_scribe", method, status: "granted" });
      // Confirm in place. There is no live ambient-scribe recorder wired to
      // "/scribe/consult/new" (it only reads finalized sessions), so landing
      // there showed a dead "no session" screen; a success card that states
      // the consent is on record and offers the real next steps is correct.
      setGranted(method);
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  const handleDecline = () => {
    navigate(patientId ? `/scribe/patients/${patientId}` : "/scribe");
  };

  if (granted) {
    return (
      <div className="consent-screen">
        <div className="consent-card" role="status">
          <div className="consent-header">
            <div className="consent-granted-mark">
              <Icon name="check" size={28} />
            </div>
            <div className="consent-patient-name">{pName}</div>
            <div className="consent-subtitle">
              {tr(lang, "Згоду на AI-запис зафіксовано", "Consent to AI recording is on record")}
            </div>
          </div>
          <p className="consent-granted-note">
            {granted === "verbal"
              ? tr(lang, "Спосіб: усна згода. Запис збережено в картці пацієнта та може бути відкликаний у будь-який момент.",
                        "Method: verbal consent. It is saved to the patient record and can be withdrawn at any time.")
              : tr(lang, "Спосіб: підтвердження на екрані. Запис збережено в картці пацієнта та може бути відкликаний у будь-який момент.",
                        "Method: on-screen confirmation. It is saved to the patient record and can be withdrawn at any time.")}
          </p>
          <div className="consent-granted-actions">
            <button className="btn accent" onClick={() => navigate(`/dictate/studio?patient=${patientId}`)}>
              <Icon name="mic" size={14} /> {tr(lang, "Розпочати диктування", "Start dictation")}
            </button>
            <button className="btn" onClick={() => navigate(patientId ? `/scribe/patients/${patientId}` : "/scribe")}>
              {tr(lang, "До картки пацієнта", "To patient record")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const consentText = lang === "uk"
    ? `Ваш лікар використовує систему Klarnote для допомоги в документуванні консультації. Під час розмови буде створено автоматичний транскрипт. На його основі AI сформує проект медичної нотатки, яку лікар перевірить і підпише.

Ваші дані захищені відповідно до GDPR. Ви можете відкликати згоду в будь-який момент, звернувшись до адміністратора.`
    : `Your doctor uses the Klarnote system to help document this consultation. An automated transcript will be created during the conversation. Based on this, AI will generate a draft medical note which your doctor will review and sign.

Your data is protected in accordance with GDPR. You may withdraw this consent at any time by contacting the administrator.`;

  return (
    <div className="consent-screen">
      <div className="consent-card">
        <div className="consent-header">
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "var(--accent)" }}>
            <Icon name="shield" size={26} />
          </div>
          <div className="consent-patient-name">{pName}</div>
          <div className="consent-subtitle">
            {tr(lang, "Запит згоди на AI-асистований запис консультації", "Consent request for AI-assisted consultation recording")}
          </div>
        </div>

        <div className="consent-text-body" style={{ whiteSpace: "pre-line" }}>{consentText}</div>

        {error && (
          <div style={{ color: "var(--rec,#dc2626)", fontSize: 13, textAlign: "center", marginBottom: 8 }}>
            {error.message || (tr(lang, "Не вдалося зберегти згоду", "Could not record consent"))}
          </div>
        )}

        {mode === null && (
          <>
            <div className="consent-actions">
              <div className="consent-action-card" onClick={() => setMode("verbal")}>
                <div className="ca-icon"><Icon name="mic" size={22} /></div>
                <div className="ca-title">{tr(lang, "Вербальна згода", "Verbal consent")}</div>
                <div className="ca-desc">{tr(lang, "Зафіксуйте усну згоду пацієнта", "Record patient's spoken consent")}</div>
              </div>
              <div className="consent-action-card" onClick={() => setMode("kiosk")}>
                <div className="ca-icon"><Icon name="user" size={22} /></div>
                <div className="ca-title">{tr(lang, "Торкнутись екрану", "Tap to consent")}</div>
                <div className="ca-desc">{tr(lang, "Пацієнт самостійно підтверджує згоду", "Patient taps to confirm consent")}</div>
              </div>
            </div>
            <div className="consent-decline">
              <button className="btn" onClick={handleDecline}>
                {tr(lang, "Відмовитись від запису", "Decline recording")}
              </button>
            </div>
          </>
        )}

        {mode === "verbal" && (
          <VerbalConsentRecorder lang={lang} onGrant={() => grant("verbal")} onCancel={() => setMode(null)} />
        )}
        {mode === "kiosk" && (
          <KioskTapConsent lang={lang} onGrant={() => grant("kiosk")} onCancel={() => setMode(null)} />
        )}
      </div>
    </div>
  );
}

// ─── RecordingIndicator ───────────────────────────────────────────────────────

export function RecordingIndicator({ session, lang, onPause, onStop, navigate }) {
  const [elapsed, setElapsed] = useState(0);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!session || session.paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const startMs = new Date(session.startedAt).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current);
  }, [session]);

  if (!session) return null;

  const pName = session.patientName || patientName(session.patient, lang) || session.patientId;

  const handleStop = () => { setShowStopConfirm(false); onStop && onStop(); };

  return (
    <>
      <div className="recording-banner">
        {session.paused
          ? <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--muted)", flexShrink: 0 }} />
          : <div className="rec-dot" />}
        <div className="rec-info">
          <span className="rec-label">
            {session.paused ? (tr(lang, "Пауза", "Paused")) : (tr(lang, "Запис", "Recording"))}
          </span>
          <span style={{ fontSize: 13, color: "var(--text-2)", marginLeft: 8 }}>— {pName}</span>
          <span className="rec-timer">{fmtDur(elapsed)}</span>
        </div>
        <div className="rec-actions">
          <button className="btn sm" onClick={() => onPause && onPause()}>
            <Icon name={session.paused ? "play" : "pause"} size={12} />
            {session.paused ? (tr(lang, "Продовжити", "Resume")) : (tr(lang, "Пауза", "Pause"))}
          </button>
          <button className="btn sm" style={{ color: "var(--rec)", borderColor: "color-mix(in srgb, var(--rec) 30%, transparent)" }} onClick={() => setShowStopConfirm(true)}>
            <Icon name="stop" size={12} /> {tr(lang, "Стоп", "Stop")}
          </button>
          {session.patientId && (
            <button className="btn ghost sm" onClick={() => navigate(`/scribe/patients/${session.patientId}`)}>
              <Icon name="user" size={12} /> {tr(lang, "Профіль", "Profile")}
            </button>
          )}
        </div>
      </div>

      {showStopConfirm && (
        <Modal onClose={() => setShowStopConfirm(false)}>
          <div className="modal-h">
            <h2>{tr(lang, "Зупинити запис?", "Stop recording?")}</h2>
            <p>{tr(lang, "Запис буде збережено. Ви зможете продовжити пізніше.", "Recording will be saved. You can continue later.")}</p>
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setShowStopConfirm(false)}>{tr(lang, "Скасувати", "Cancel")}</button>
            <button className="btn" style={{ background: "var(--rec)", color: "white", borderColor: "var(--rec)" }} onClick={handleStop}>
              <Icon name="stop" size={13} /> {tr(lang, "Зупинити", "Stop")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── WithdrawalModal ──────────────────────────────────────────────────────────

export function WithdrawalModal({ consent, lang, onClose, onConfirm }) {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const slaText = tr(lang, "протягом 30 днів", "within 30 days");

  const confirm = async () => {
    setBusy(true); setError(null);
    try { if (onConfirm) await onConfirm({ reason }); setConfirmed(true); }
    catch (e) { setError(e); }
    finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{tr(lang, "Відкликати згоду", "Withdraw consent")}</h2>
        {consent && <p>{consent.type === "ai_scribe" ? (tr(lang, "AI-скрайб", "AI Scribe")) : consent.type}</p>}
      </div>

      <div className="withdrawal-modal">
        {!confirmed && step === 1 && (
          <div className="wm-step">
            <div className="wm-icon"><Icon name="flag" size={22} /></div>
            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-1)", marginBottom: 10 }}>
              {tr(lang, "Що означає відкликання згоди?", "What does withdrawing consent mean?")}
            </div>
            <div style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.7 }}>
              {tr(lang, "Відкликання згоди означає, що AI-система більше не буде обробляти ваші голосові дані. Записи, зроблені до відкликання, залишаться у системі відповідно до вимог медичної документації.", "Withdrawing consent means the AI system will no longer process your voice data. Records already made will be retained in the system as required for medical documentation purposes.")}
            </div>
            <div className="wm-sla">
              <Icon name="clock" size={14} />{" "}
              {lang === "uk"
                ? `Обробка нових записів буде зупинена негайно. Видалення існуючих даних — ${slaText}.`
                : `Processing of new recordings will stop immediately. Existing data will be erased ${slaText}.`}
            </div>
          </div>
        )}

        {!confirmed && step === 2 && (
          <div className="wm-step">
            <div style={{ fontSize: 13.5, color: "var(--text-2)", marginBottom: 12 }}>
              {tr(lang, "Причина відкликання (необов'язково):", "Reason for withdrawal (optional):")}
            </div>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4}
              placeholder={tr(lang, "Вкажіть причину…", "Enter reason…")}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "var(--radius)", fontFamily: "var(--sans)", fontSize: 13, background: "var(--surface)", color: "var(--text-1)", resize: "vertical" }} />
            {error && <div style={{ color: "var(--rec,#dc2626)", fontSize: 13, marginTop: 8 }}>{error.message || (tr(lang, "Помилка", "Error"))}</div>}
          </div>
        )}

        {confirmed && (
          <div style={{ padding: "24px", textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", margin: "0 auto 16px" }}>
              <Icon name="check" size={24} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 16, color: "var(--text-1)", marginBottom: 8 }}>
              {tr(lang, "Згоду відкликано", "Consent withdrawn")}
            </div>
            <div style={{ fontSize: 13.5, color: "var(--text-2)" }}>
              {tr(lang, "Обробку нових записів зупинено. Наявні дані будуть видалені відповідно до SLA.", "Processing of new recordings has stopped. Existing data will be erased per the SLA.")}
            </div>
          </div>
        )}
      </div>

      <div className="modal-foot">
        {confirmed ? (
          <button className="btn accent" onClick={onClose}>{tr(lang, "Закрити", "Close")}</button>
        ) : (
          <>
            <button className="btn" onClick={step === 1 ? onClose : () => setStep(1)}>
              {step === 1 ? (tr(lang, "Скасувати", "Cancel")) : (tr(lang, "Назад", "Back"))}
            </button>
            {step === 1 && (
              <button className="btn" style={{ borderColor: "var(--warn)", color: "var(--warn)" }} onClick={() => setStep(2)}>
                {tr(lang, "Продовжити", "Continue")}
              </button>
            )}
            {step === 2 && (
              <button className="btn" style={{ background: "var(--warn)", color: "white", borderColor: "var(--warn)" }} disabled={busy} onClick={confirm}>
                <Icon name="check" size={13} />
                {busy ? (tr(lang, "Обробка…", "Working…")) : (tr(lang, "Підтвердити відкликання", "Confirm withdrawal"))}
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

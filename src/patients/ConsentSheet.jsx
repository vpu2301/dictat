// ConsentSheet.jsx — sprint 11 step 05: consent capture in front of
// recording, plus the КЕП sign dialog for method="digital".
//
// Legal copy in this file is flagged for clinical/legal review — see
// todo.md ("S11 legal copy review").

import React, { lazy, Suspense, useState } from "react";
import { Icon, Modal } from "../components/UI.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { recordConsent, signConsent } from "../api/consents.js";
import { APPROVED_CONSENT_VERSIONS } from "./consentTexts.js";
import { tr } from "../i18n.js";
import { canSign } from "../components/SignGate.jsx";

// Approved consent-text versions — the registry lives in ./consentTexts.js so
// it stays assertable under node --test; re-exported here for the S11 callers.
export { APPROVED_CONSENT_VERSIONS };

// Per-type sheet copy. The conversation wording states plainly that BOTH
// voices are recorded — the mode-choice screen says the same thing, so the
// clinician reads the same promise they are about to make to the patient.
const CONSENT_COPY = {
  ai_scribe: {
    title: { uk: "Згода пацієнта на AI-запис", en: "Patient consent to AI recording" },
    intro: {
      uk: "Запис голосу обробляється AI-сервісом для створення медичної документації.",
      en: "The voice recording is processed by an AI service to produce clinical documentation.",
    },
  },
  recording: {
    title: { uk: "Згода на запис розмови", en: "Consent to record the consultation" },
    intro: {
      uk: "Записується вся розмова — голос лікаря І голос пацієнта. Запис обробляється AI-сервісом для створення медичної документації; система розділяє голоси, а лікар перевіряє, кому належить кожна репліка.",
      en: "The whole consultation is recorded — the clinician's voice AND the patient's. The recording is processed by an AI service to produce clinical documentation; the system separates the voices and the clinician reviews who said what.",
    },
  },
};

const METHOD_LABEL = {
  verbal:  { uk: "Усно (засвідчено лікарем)", en: "Verbal (attested by the clinician)" },
  written: { uk: "Письмово (паперова форма)", en: "Written (paper form)" },
  digital: { uk: "КЕП (цифровий підпис пацієнта)", en: "КЕП (patient's digital signature)" },
};

// ── КЕП sign dialog (consent flavour of the S09 stack) ──────────────────
// Providers are the as-built consent-sign proxy's:
//   file_key     — the patient's key container file + password (Дія-issued
//                  or bank КЕП container)
//   dev_password — DEV-ONLY scaffold (envelopes level='dev'), used by the
//                  e2e/mock-provider VERIFY. Sprint 16: the field and the
//                  provider id live in components/DevPasswordSign.jsx and are
//                  reached only through a DEV-guarded dynamic import, so a
//                  production build contains neither. The local token for the
//                  choice is "dev", never the wire value — a string in a live
//                  ternary survives minification, and `npm run verify:bundle`
//                  looks for exactly that.
// Signing abandoned → the consent stays granted-but-unsigned (attestation
// happened); the list shows "не підписано" with re-initiate.
const DEV_SIGNING = !!(import.meta.env && import.meta.env.DEV);

const ConsentDevPasswordField = DEV_SIGNING
  ? lazy(() => import("../components/DevPasswordSign.jsx").then((m) => ({ default: m.ConsentDevPasswordField })))
  : null;

// `import.meta.env.DEV` is the constant `false` in a build, so this collapses
// to `return null` and the module it would have loaded is never emitted.
async function devConsentBody(password) {
  if (import.meta.env.DEV) {
    const m = await import("../components/DevPasswordSign.jsx");
    return m.devConsentBody(password);
  }
  return null;
}

export function ConsentSignDialog({ lang, patientId, consent, onClose, onSigned }) {
  const devProvider = DEV_SIGNING;
  const [provider, setProvider] = useState("file_key");
  const [keyB64, setKeyB64] = useState(null);
  const [keyName, setKeyName] = useState("");
  const [keyPassword, setKeyPassword] = useState("");
  const [devPassword, setDevPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [signed, setSigned] = useState(null);

  const onFile = (file) => {
    if (!file) { setKeyB64(null); setKeyName(""); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = String(reader.result).split(",")[1] || "";
      setKeyB64(b64);
      setKeyName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const canSign = provider === "file_key" ? (keyB64 && keyPassword) : !!devPassword;

  const sign = async () => {
    if (!canSign || busy) return;
    setBusy(true); setError(null);
    try {
      const body = provider === "file_key"
        ? { provider, key_container_b64: keyB64, key_password: keyPassword }
        : await devConsentBody(devPassword);
      if (!body) throw new Error("dev signing is not available in this build");
      const res = await signConsent(patientId, consent.id, body);
      setSigned(res);
      onSigned?.(res);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const problemCopy = (e) => {
    const code = e?.problem?.code;
    if (code === "consent_already_signed") return tr(lang, "Цю згоду вже підписано.", "This consent is already signed.");
    if (code === "consent_canonical_changed") return tr(lang, "Дані пацієнта змінилися після фіксації згоди — оформіть згоду заново.", "The patient record changed since capture — re-capture the consent.");
    return e?.problem?.detail || e?.message || (tr(lang, "Не вдалося підписати", "Signing failed"));
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{tr(lang, "Підписати згоду (КЕП)", "Sign the consent (КЕП)")}</h2>
        <p>{tr(lang, "Підпис привʼязує точний текст затвердженої згоди до ключа пацієнта.", "The signature binds the exact approved wording to the patient's key.")}</p>
      </div>
      <div className="modal-body consent-sign-body">
        {signed ? (
          <div className="consent-signed-ok" data-testid="consent-signed-ok">
            <Icon name="check" size={22} />
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-1)" }}>
                {tr(lang, "Згоду підписано", "Consent signed")}
              </div>
              <div className="pmono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                {tr(lang, "Конверт", "Envelope")}: {signed.envelope_id}
                {" · "}{signed.is_qualified ? (tr(lang, "кваліфікований", "qualified")) : signed.signature_level}
              </div>
            </div>
          </div>
        ) : (
          <>
            {devProvider && (
              <div className="np-sex-toggle" style={{ marginBottom: 12 }}>
                <button type="button" className={provider === "file_key" ? "on" : ""} onClick={() => setProvider("file_key")}>
                  {tr(lang, "Файловий ключ", "Key file")}
                </button>
                <button type="button" className={provider === "dev" ? "on" : ""} onClick={() => setProvider("dev")}>
                  {tr(lang, "Тест-підпис (dev)", "Dev signature")}
                </button>
              </div>
            )}
            {provider === "file_key" ? (
              <>
                <label className="consent-key-file">
                  <span>{tr(lang, "Файл ключа (*.dat, *.jks, *.pfx)", "Key container (*.dat, *.jks, *.pfx)")}</span>
                  <input type="file" accept=".dat,.jks,.pfx,.zs2,.p12" onChange={(e) => onFile(e.target.files?.[0])} />
                  {keyName && <em className="pmono">{keyName}</em>}
                </label>
                <label>
                  <span>{tr(lang, "Пароль ключа", "Key password")}</span>
                  <input className="ti" type="password" value={keyPassword} onChange={(e) => setKeyPassword(e.target.value)} />
                </label>
              </>
            ) : ConsentDevPasswordField ? (
              <Suspense fallback={null}>
                <ConsentDevPasswordField lang={lang} value={devPassword} onChange={setDevPassword} />
              </Suspense>
            ) : null}
            {error && <div className="consent-sign-error" role="alert">{problemCopy(error)}</div>}
          </>
        )}
      </div>
      <div className="modal-foot">
        {signed ? (
          <button className="btn accent" onClick={onClose}>{tr(lang, "Готово", "Done")}</button>
        ) : (
          <>
            <button className="btn" onClick={onClose}>
              {tr(lang, "Пізніше (залишити без підпису)", "Later (leave unsigned)")}
            </button>
            <button className="btn accent" disabled={!canSign || busy} onClick={sign}>
              <Icon name="sign" size={13} />
              {busy ? (tr(lang, "Підписання…", "Signing…")) : (tr(lang, "Підписати", "Sign"))}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Capture sheet ────────────────────────────────────────────────────────
// One POST for verbal/written; digital chains into ConsentSignDialog using
// the create response's `signing` hint. onGranted(consent, {autoStart})
// fires as soon as the consent EXISTS (as-built: created granted) — for
// digital that is before/independent of the signature.
export function ConsentSheet({ lang, patient, encounterId, onClose, onGranted, type: consentType = "ai_scribe" }) {
  const { state: auth } = useAuth();
  const attester = auth?.dbUser?.display_name || auth?.claims?.sub || "—";
  const patientLabel =
    (patient?.name && (patient.name[lang] || patient.name.uk || patient.name.en)) || patient?.label || "";

  // The gate's subject: "ai_scribe" for dictation, "recording" for a
  // conversation (the patient's own voice) — see APPROVED_CONSENT_VERSIONS.
  const type = APPROVED_CONSENT_VERSIONS[consentType] ? consentType : "ai_scribe";
  const versions = APPROVED_CONSENT_VERSIONS[type];
  const copy = CONSENT_COPY[type] || CONSENT_COPY.ai_scribe;
  // A nurse may RECORD that a consent exists — verbal or written, which is
  // the bulk of consent-taking — but «digital» means the patient signs with a
  // КЕП inside a dialog the clinician conducts, and that is a physician's act
  // (2026-08-09 hotfix). Absent from the radio group, not disabled: a greyed
  // option invites a support ticket about a permission that is working.
  const maySign = canSign(auth?.claims);
  const METHODS = maySign ? ["verbal", "written", "digital"] : ["verbal", "written"];
  const [method, setMethod] = useState("verbal");
  const [version, setVersion] = useState(versions[versions.length - 1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [signTarget, setSignTarget] = useState(null); // created digital consent

  const capture = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const created = await recordConsent(patient.id, {
        type, method, version,
        encounter_id: encounterId || undefined,
      });
      if (method === "digital") {
        setSignTarget(created);
        onGranted?.(created, { autoStart: false });
      } else {
        onGranted?.(created, { autoStart: true });
        onClose();
      }
    } catch (e) {
      if (e?.problem?.code === "consent_text_version_unknown") {
        setError({ message: lang === "uk"
          ? `Версія тексту згоди "${version}" не затверджена — зверніться до адміністратора.`
          : `Consent text version "${version}" is not approved — contact your administrator.` });
      } else {
        setError(e);
      }
      setBusy(false);
    }
  };

  if (signTarget) {
    return (
      <ConsentSignDialog lang={lang} patientId={patient.id} consent={signTarget}
        onClose={onClose} onSigned={() => {}} />
    );
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{copy.title[lang] || copy.title.en}</h2>
        <p>{copy.intro[lang] || copy.intro.en}</p>
      </div>
      <div className="modal-body consent-sheet-body" data-testid="consent-sheet" data-consent-type={type}>
        <div className="consent-scope">
          <div><span className="consent-scope-k">{tr(lang, "Пацієнт", "Patient")}:</span> <strong>{patientLabel}</strong></div>
          <div><span className="consent-scope-k">{tr(lang, "Засвідчує", "Attested by")}:</span> {attester}</div>
          {encounterId && (
            <div><span className="consent-scope-k">{tr(lang, "Прийом", "Encounter")}:</span> {tr(lang, "поточний", "current")}</div>
          )}
        </div>

        <div className="consent-methods" role="radiogroup" aria-label={tr(lang, "Спосіб надання згоди", "Consent method")}>
          {METHODS.map((m) => (
            <label key={m} className={"consent-method" + (method === m ? " on" : "")}>
              <input type="radio" name="consent-method" value={m}
                checked={method === m} onChange={() => setMethod(m)} />
              <span>{METHOD_LABEL[m][lang] || METHOD_LABEL[m].en}</span>
            </label>
          ))}
        </div>

        <label className="consent-version">
          <span>{tr(lang, "Версія тексту згоди", "Consent text version")}</span>
          <select value={version} onChange={(e) => setVersion(e.target.value)}>
            {versions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>

        {error && (
          <div className="consent-sign-error" role="alert">
            {error.message || (tr(lang, "Не вдалося зберегти згоду", "Could not record the consent"))}
          </div>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{tr(lang, "Скасувати", "Cancel")}</button>
        <button className="btn accent" disabled={busy} onClick={capture}>
          <Icon name="shield" size={13} />
          {busy
            ? (tr(lang, "Збереження…", "Saving…"))
            : method === "digital"
              ? (tr(lang, "Зафіксувати та підписати", "Record & sign"))
              : (tr(lang, "Зафіксувати згоду", "Record consent"))}
        </button>
      </div>
    </Modal>
  );
}

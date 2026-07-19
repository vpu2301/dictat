// AudioDrop.jsx — File picker + drag-drop for audio. Opaque bytes only;
// no validation of the encrypted envelope (that's a backend concern, ADR-0011).
import React, { useRef, useState } from "react";
import { Icon } from "./UI.jsx";
import { tr } from "../i18n.js";

const ACCEPT = "audio/*";

function fmtBytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AudioDrop({ file, onFile, disabled, lang = "en" }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = () => { if (!disabled) inputRef.current?.click(); };
  const handleFiles = (list) => {
    if (!list || !list.length) return;
    onFile(list[0]);
  };

  return (
    <div
      className={"audio-drop" + (dragOver ? " is-over" : "") + (file ? " has-file" : "")}
      onClick={pick}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        if (disabled) return;
        handleFiles(e.dataTransfer.files);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } }}
      aria-disabled={disabled || undefined}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />
      <Icon name={file ? "audio" : "download"} size={26} />
      {file ? (
        <>
          <div className="audio-drop-name">{file.name}</div>
          <div className="audio-drop-meta">
            {fmtBytes(file.size)} · {file.type || (tr(lang, "невідомий тип", "unknown type"))}
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={(e) => { e.stopPropagation(); onFile(null); }}
            disabled={disabled}
          >
            {tr(lang, "Прибрати", "Remove")}
          </button>
        </>
      ) : (
        <>
          <div className="audio-drop-title">
            {tr(lang, "Перетягніть аудіо або натисніть", "Drop audio here or click to pick")}
          </div>
          <div className="audio-drop-meta">
            {tr(lang, "WAV, FLAC, MP3, OGG, WebM …", "WAV, FLAC, MP3, OGG, WebM …")}
          </div>
        </>
      )}
    </div>
  );
}

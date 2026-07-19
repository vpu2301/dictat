// DocsPage.jsx — Public developer documentation (/docs, /docs/:slug).
//
// An interactive docs reader inside the marketing shell: a sticky section
// menu on the left, the article on the right, prev/next footer navigation.
// Content lives in docs.js (typed blocks, bilingual); this file only renders.
import React from "react";
import { Icon } from "../../components/UI.jsx";
import { MarketingShell } from "./MarketingShell.jsx";
import { DOC_SECTIONS, getDoc } from "./docs.js";

const t = (v, lang) => (typeof v === "object" && v !== null ? (v[lang] ?? v.en) : v);

function DocBlock({ block, lang }) {
  switch (block.type) {
    case "p":
      return <p className="docs-p">{t(block, lang)}</p>;
    case "h2":
      return <h2 className="docs-h2">{t(block, lang)}</h2>;
    case "bullets":
      return (
        <ul className="docs-bullets">
          {block.items.map((it, i) => (
            <li key={i}><Icon name="check" size={14} /> <span>{t(it, lang)}</span></li>
          ))}
        </ul>
      );
    case "code":
      return (
        <figure className="docs-code">
          {block.title && <figcaption>{block.title}</figcaption>}
          <pre><code>{block.body}</code></pre>
        </figure>
      );
    case "table":
      return (
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>{(block.cols[lang] ?? block.cols.en).map((c, i) => <th key={i}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={j < row.length - 1 ? "docs-td-mono" : ""}>{t(cell, lang)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "note":
      return (
        <aside className="docs-note">
          <Icon name="help" size={14} />
          <span>{t(block, lang)}</span>
        </aside>
      );
    default:
      return null;
  }
}

export function DocsPage({ slug, navigate, lang = "en", tweaks, setTweak }) {
  const uk = lang === "uk";
  const active = getDoc(slug) || DOC_SECTIONS[0];
  const idx = DOC_SECTIONS.indexOf(active);
  const prev = idx > 0 ? DOC_SECTIONS[idx - 1] : null;
  const next = idx < DOC_SECTIONS.length - 1 ? DOC_SECTIONS[idx + 1] : null;
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };

  return (
    <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
      <header className="mk-hero docs-hero">
        <span className="lp-eyebrow"><Icon name="book" size={13} /> {uk ? "Документація" : "Documentation"}</span>
        <h1 className="mk-hero-title">{uk ? "Документація для розробників" : "Developer documentation"}</h1>
        <p className="mk-hero-sub">
          {uk
            ? "Як платформа працює насправді: автентифікація, транскрипція, звіти, модель помилок і безпека."
            : "How the platform really works: authentication, transcription, reports, the error model and security."}
        </p>
      </header>

      <div className="docs-layout">
        <nav className="docs-nav" aria-label={uk ? "Розділи документації" : "Documentation sections"}>
          {DOC_SECTIONS.map((s) => (
            <a
              key={s.slug}
              className={`docs-nav-item${s.slug === active.slug ? " is-active" : ""}`}
              href={`#/docs/${s.slug}`}
              onClick={go(`/docs/${s.slug}`)}
              aria-current={s.slug === active.slug ? "page" : undefined}
            >
              <Icon name={s.icon} size={15} />
              <span>{t(s.title, lang)}</span>
            </a>
          ))}
          <div className="docs-nav-sep" />
          <a className="docs-nav-item" href="#/developers/api" onClick={go("/developers/api")}>
            <Icon name="layers" size={15} />
            <span>{uk ? "API Docs (Swagger)" : "API Docs (Swagger)"}</span>
          </a>
          <a className="docs-nav-item" href="#/developers" onClick={go("/developers")}>
            <Icon name="sign" size={15} />
            <span>{uk ? "Доступ до API" : "API access"}</span>
          </a>
        </nav>

        <article className="docs-article">
          <h1 className="docs-title">{t(active.title, lang)}</h1>
          {active.lead && <p className="docs-lead">{t(active.lead, lang)}</p>}
          {active.blocks.map((b, i) => <DocBlock block={b} lang={lang} key={i} />)}

          <div className="docs-pager">
            {prev ? (
              <a className="docs-pager-link" href={`#/docs/${prev.slug}`} onClick={go(`/docs/${prev.slug}`)}>
                <Icon name="arrowLeft" size={14} />
                <span>{t(prev.title, lang)}</span>
              </a>
            ) : <span />}
            {next ? (
              <a className="docs-pager-link docs-pager-next" href={`#/docs/${next.slug}`} onClick={go(`/docs/${next.slug}`)}>
                <span>{t(next.title, lang)}</span>
                <Icon name="arrowRight" size={14} />
              </a>
            ) : <span />}
          </div>
        </article>
      </div>
    </MarketingShell>
  );
}

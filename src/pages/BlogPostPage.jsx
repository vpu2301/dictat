// BlogPostPage.jsx — /blog/<slug>. A single article, inside the marketing shell.
// Renders the ordered content blocks from the shared blog registry. Unknown
// slugs fall back to a small "not found" state that links back to the index.
import React from "react";
import { Icon } from "../components/UI.jsx";
import { MarketingShell } from "./marketing/MarketingShell.jsx";
import { getPost, listPosts } from "./marketing/blog.js";

export function BlogPostPage({ slug, navigate, lang = "en", tweaks, setTweak }) {
  const L = (m) => m[lang] ?? m.en;
  const post = getPost(slug, lang);
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };

  if (!post) {
    return (
      <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
        <section className="mk-hero">
          <h1 className="mk-hero-title">{L({ uk: "Статтю не знайдено", en: "Article not found", pl: "Nie znaleziono artykułu", de: "Artikel nicht gefunden", ro: "Articolul nu a fost găsit", cs: "Článek nenalezen", sr: "Članak nije pronađen", hu: "A cikk nem található" })}</h1>
          <p className="mk-hero-sub">
            <a className="mk-auth-link" href="#/blog" onClick={go("/blog")}>{L({ uk: "← До блогу", en: "← Back to blog", pl: "← Wróć do bloga", de: "← Zurück zum Blog", ro: "← Înapoi la blog", cs: "← Zpět na blog", sr: "← Nazad na blog", hu: "← Vissza a bloghoz" })}</a>
          </p>
        </section>
      </MarketingShell>
    );
  }

  // Up to two "read next" cards (the following posts in the registry).
  const others = listPosts(lang).filter((p) => p.slug !== slug).slice(0, 2);

  return (
    <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
      <article className="mk-article">
        <a className="mk-auth-back is-top mk-article-back" href="#/blog" onClick={go("/blog")}>
          <Icon name="arrowLeft" size={16} /> {L({ uk: "Блог", en: "Blog", pl: "Blog", de: "Blog", ro: "Blog", cs: "Blog", sr: "Blog", hu: "Blog" })}
        </a>

        <header className="mk-article-head">
          <span className="mk-post-tag">{post.tag}</span>
          <h1 className="mk-article-title">{post.title}</h1>
          <div className="mk-article-meta"><span>{post.date}</span><span>·</span><span>{post.read}</span></div>
        </header>

        <div className="mk-article-body">
          {post.body.map((b, i) => {
            if (b.h2) return <h2 key={i}>{b.h2}</h2>;
            if (b.ul) return <ul key={i}>{b.ul.map((li, j) => <li key={j}>{li}</li>)}</ul>;
            if (b.quote) return <blockquote key={i}>{b.quote}</blockquote>;
            return <p key={i}>{b.p}</p>;
          })}
        </div>
      </article>

      <section className="mk-section">
        <div className="lp-head"><h2 className="lp-h2">{L({ uk: "Читати далі", en: "Read next", pl: "Czytaj dalej", de: "Weiterlesen", ro: "Citiți în continuare", cs: "Čtěte dále", sr: "Čitajte dalje", hu: "Olvasson tovább" })}</h2></div>
        <div className="mk-posts">
          {others.map((p) => (
            <a className="mk-post mk-post-link" href={`#/blog/${p.slug}`} onClick={go(`/blog/${p.slug}`)} key={p.slug}>
              <div className="mk-post-top">
                <span className="mk-post-tag">{p.tag}</span>
                <h3 className="mk-post-title">{p.title}</h3>
                <p className="mk-post-excerpt">{p.excerpt}</p>
              </div>
              <div className="mk-post-meta">
                <span>{p.date}</span><span>·</span><span>{p.read}</span>
                <span className="mk-post-arrow">{L({ uk: "Читати", en: "Read", pl: "Czytaj", de: "Lesen", ro: "Citește", cs: "Číst", sr: "Pročitaj", hu: "Olvasás" })} <Icon name="arrowRight" size={14} /></span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}

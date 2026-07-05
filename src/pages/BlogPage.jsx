// BlogPage.jsx — /blog. Article index, inside the marketing shell.
// Cards are sourced from the shared blog registry and link to /blog/<slug>.
import React from "react";
import { Icon } from "../components/UI.jsx";
import { MarketingShell } from "./marketing/MarketingShell.jsx";
import { listPosts } from "./marketing/blog.js";

export function BlogPage({ navigate, lang = "en", tweaks, setTweak }) {
  const uk = lang === "uk";
  const posts = listPosts(lang);
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };

  return (
    <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
      <section className="mk-hero">
        <span className="lp-eyebrow">{uk ? "Блог" : "Blog"}</span>
        <h1 className="mk-hero-title">{uk ? "Ідеї, оновлення та дослідження" : "Ideas, updates and research"}</h1>
        <p className="mk-hero-sub">
          {uk ? "Як ми будуємо голосову документацію для медицини — без води." : "How we build voice documentation for healthcare — no fluff."}
        </p>
      </section>

      <section className="mk-section">
        <div className="mk-posts">
          {posts.map((p) => (
            <a className="mk-post mk-post-link" href={`#/blog/${p.slug}`} onClick={go(`/blog/${p.slug}`)} key={p.slug}>
              <div className="mk-post-top">
                <span className="mk-post-tag">{p.tag}</span>
                <h3 className="mk-post-title">{p.title}</h3>
                <p className="mk-post-excerpt">{p.excerpt}</p>
              </div>
              <div className="mk-post-meta">
                <span>{p.date}</span><span>·</span><span>{p.read}</span>
                <span className="mk-post-arrow">{uk ? "Читати" : "Read"} <Icon name="arrowRight" size={14} /></span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}

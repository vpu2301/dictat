// BlogPage.jsx — /blog. Article index, inside the marketing shell.
// Cards are sourced from the shared blog registry and link to /blog/<slug>.
import React from "react";
import { Icon } from "../components/UI.jsx";
import { MarketingShell } from "./marketing/MarketingShell.jsx";
import { listPosts } from "./marketing/blog.js";

export function BlogPage({ navigate, lang = "en", tweaks, setTweak }) {
  const L = (m) => m[lang] ?? m.en;
  const posts = listPosts(lang);
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };

  return (
    <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
      <section className="mk-hero">
        <span className="lp-eyebrow">{L({ uk: "Блог", en: "Blog", pl: "Blog", de: "Blog", ro: "Blog", cs: "Blog", sr: "Blog", hu: "Blog", ar: "المدونة", es: "Blog", pt: "Blogue" })}</span>
        <h1 className="mk-hero-title">{L({ uk: "Ідеї, оновлення та дослідження", en: "Ideas, updates and research", pl: "Pomysły, aktualności i badania", de: "Ideen, Updates und Forschung", ro: "Idei, noutăți și cercetare", cs: "Nápady, novinky a výzkum", sr: "Ideje, novosti i istraživanja", hu: "Ötletek, hírek és kutatás", ar: "أفكار وتحديثات وأبحاث", es: "Ideas, novedades e investigación", pt: "Ideias, novidades e investigação" })}</h1>
        <p className="mk-hero-sub">
          {L({ uk: "Як ми будуємо голосову документацію для медицини — без води.", en: "How we build voice documentation for healthcare — no fluff.", pl: "Jak budujemy głosową dokumentację dla medycyny — bez lania wody.", de: "Wie wir Sprachdokumentation für das Gesundheitswesen bauen — ohne Floskeln.", ro: "Cum construim documentația vocală pentru medicină — fără vorbe goale.", cs: "Jak stavíme hlasovou dokumentaci pro zdravotnictví — bez omáčky.", sr: "Kako gradimo glasovnu dokumentaciju za zdravstvo — bez praznih priča.", hu: "Így építünk hangalapú dokumentációt az egészségügynek — üres szavak nélkül.", ar: "كيف نبني التوثيق الصوتي للرعاية الصحية — دون حشو.", es: "Cómo construimos la documentación por voz para la sanidad, sin rodeos.", pt: "Como construímos a documentação por voz para a saúde — sem rodeios." })}
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
                <span className="mk-post-arrow">{L({ uk: "Читати", en: "Read", pl: "Czytaj", de: "Lesen", ro: "Citește", cs: "Číst", sr: "Pročitaj", hu: "Olvasás", ar: "قراءة", es: "Leer", pt: "Ler" })} <Icon name="arrowRight" size={14} /></span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}

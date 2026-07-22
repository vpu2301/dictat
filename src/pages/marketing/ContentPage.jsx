// ContentPage.jsx — One renderer for every public marketing sub-page.
//
// Given a route `slug`, it looks the content up in the registry and renders a
// hero plus a list of typed blocks inside the shared MarketingShell. New pages
// are added by editing content.js — no new component is needed.
import React, { useState } from "react";
import { Icon, Empty } from "../../components/UI.jsx";
import { MarketingShell } from "./MarketingShell.jsx";
import { getContent } from "./content.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Contact form — UI-only mock (no backend yet), mirroring SignupPage. */
function ContactForm({ lang }) {
  const L = (m) => m[lang] ?? m.en;
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = L({ uk: "Вкажіть ім'я.", en: "Enter your name.", pl: "Podaj imię.", de: "Geben Sie Ihren Namen ein.", ro: "Introduceți numele.", cs: "Zadejte své jméno.", sr: "Unesite svoje ime.", hu: "Adja meg a nevét.", ar: "أدخل اسمك." });
    if (!EMAIL_RE.test(form.email)) next.email = L({ uk: "Невірна пошта.", en: "Enter a valid email.", pl: "Podaj poprawny adres e-mail.", de: "Geben Sie eine gültige E-Mail-Adresse ein.", ro: "Introduceți un e-mail valid.", cs: "Zadejte platný e-mail.", sr: "Unesite ispravnu e-adresu.", hu: "Adjon meg érvényes e-mail-címet.", ar: "أدخل بريدًا إلكترونيًا صالحًا." });
    if (!form.message.trim()) next.message = L({ uk: "Напишіть повідомлення.", en: "Write a message.", pl: "Napisz wiadomość.", de: "Schreiben Sie eine Nachricht.", ro: "Scrieți un mesaj.", cs: "Napište zprávu.", sr: "Napišite poruku.", hu: "Írjon üzenetet.", ar: "اكتب رسالة." });
    setErrors(next);
    if (Object.keys(next).length) return;
    setSent(true); // TODO(backend): wire to a real contact endpoint.
  };

  if (sent) {
    return (
      <div className="mk-form mk-form-done" role="status">
        <span className="mk-form-mark"><Icon name="check" size={22} /></span>
        <h3>{L({ uk: "Повідомлення надіслано", en: "Message sent", pl: "Wiadomość wysłana", de: "Nachricht gesendet", ro: "Mesaj trimis", cs: "Zpráva odeslána", sr: "Poruka je poslata", hu: "Üzenet elküldve", ar: "تم إرسال الرسالة" })}</h3>
        <p>{L({ uk: "Дякуємо! Ми відповімо найближчим часом.", en: "Thanks! We'll get back to you shortly.", pl: "Dziękujemy! Wkrótce się odezwiemy.", de: "Danke! Wir melden uns in Kürze.", ro: "Mulțumim! Vă vom răspunde în curând.", cs: "Děkujeme! Brzy se vám ozveme.", sr: "Hvala! Javićemo vam se uskoro.", hu: "Köszönjük! Hamarosan jelentkezünk.", ar: "شكرًا! سنعاود التواصل معك قريبًا." })}</p>
      </div>
    );
  }

  return (
    <form className="mk-form" onSubmit={onSubmit} noValidate>
      <h3 className="mk-form-title">{L({ uk: "Напишіть нам", en: "Send us a message", pl: "Napisz do nas", de: "Schreiben Sie uns", ro: "Trimiteți-ne un mesaj", cs: "Napište nám", sr: "Pošaljite nam poruku", hu: "Írjon nekünk", ar: "أرسل لنا رسالة" })}</h3>
      <div className="mk-form-row">
        <label className="login-field">
          <span>{L({ uk: "Ім'я", en: "Name", pl: "Imię", de: "Name", ro: "Nume", cs: "Jméno", sr: "Ime", hu: "Név", ar: "الاسم" })}</span>
          <input value={form.name} onChange={set("name")} aria-invalid={errors.name ? "true" : undefined} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <label className="login-field">
          <span>{L({ uk: "Електронна пошта", en: "Email", pl: "E-mail", de: "E-Mail", ro: "E-mail", cs: "E-mail", sr: "E-adresa", hu: "E-mail", ar: "البريد الإلكتروني" })}</span>
          <input type="email" value={form.email} onChange={set("email")} placeholder="you@clinic.example" aria-invalid={errors.email ? "true" : undefined} />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
      </div>
      <label className="login-field">
        <span>{L({ uk: "Повідомлення", en: "Message", pl: "Wiadomość", de: "Nachricht", ro: "Mesaj", cs: "Zpráva", sr: "Poruka", hu: "Üzenet", ar: "الرسالة" })}</span>
        <textarea rows={5} value={form.message} onChange={set("message")} aria-invalid={errors.message ? "true" : undefined} />
        {errors.message && <span className="field-error">{errors.message}</span>}
      </label>
      <button type="submit" className="btn btn-primary lp-cta-lg">{L({ uk: "Надіслати", en: "Send", pl: "Wyślij", de: "Senden", ro: "Trimite", cs: "Odeslat", sr: "Pošalji", hu: "Küldés", ar: "إرسال" })}</button>
    </form>
  );
}

function Block({ block, lang, navigate }) {
  const L = (m) => m[lang] ?? m.en;
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };

  switch (block.type) {
    case "prose":
      return (
        <div className="mk-prose">
          {block.heading && <h2 className="mk-prose-h">{block.heading}</h2>}
          {block.lead && <p className="mk-prose-lead">{block.lead}</p>}
          {block.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
          {block.bullets && (
            <ul className="mk-prose-list">
              {block.bullets.map((b, i) => <li key={i}><Icon name="check" size={15} /> {b}</li>)}
            </ul>
          )}
        </div>
      );

    case "stats":
      return (
        <div className="lp-stats mk-stats">
          {block.items.map((s, i) => (
            <div className="lp-stat" key={i}>
              <div className="lp-stat-v">{s.v}</div>
              <div className="lp-stat-l">{s.l}</div>
            </div>
          ))}
        </div>
      );

    case "grid": {
      const Card = ({ it }) => (
        <>
          <div className="lp-feature-icon"><Icon name={it.icon} size={18} /></div>
          <h3 className="lp-feature-t">{it.title}</h3>
          <p className="lp-feature-d">{it.desc}</p>
          {it.path && <span className="mk-card-more">{L({ uk: "Докладніше", en: "Learn more", pl: "Dowiedz się więcej", de: "Mehr erfahren", ro: "Aflați mai multe", cs: "Zjistit více", sr: "Saznajte više", hu: "Tudjon meg többet", ar: "اعرف المزيد" })} <Icon name="arrowRight" size={14} /></span>}
        </>
      );
      return (
        <section className="mk-section">
          {block.heading && (
            <div className="lp-head">
              <h2 className="lp-h2">{block.heading}</h2>
              {block.sub && <p className="lp-sub">{block.sub}</p>}
            </div>
          )}
          <div className={`lp-grid${block.cols === 2 ? " mk-grid-2" : ""}`}>
            {block.items.map((it, i) =>
              it.path ? (
                <a className="lp-feature mk-feature-link" href={`#${it.path}`} onClick={go(it.path)} key={i}><Card it={it} /></a>
              ) : (
                <div className="lp-feature" key={i}><Card it={it} /></div>
              )
            )}
          </div>
        </section>
      );
    }

    case "steps":
      return (
        <section className="mk-section">
          {block.heading && <div className="lp-head"><h2 className="lp-h2">{block.heading}</h2></div>}
          <div className="lp-steps mk-steps">
            {block.items.map((s, i) => (
              <div className="lp-step" key={i}>
                <div className="lp-step-n">{s.n}</div>
                <h3 className="lp-step-t">{s.title}</h3>
                <p className="lp-step-d">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>
      );

    case "faq":
      return (
        <section className="mk-section mk-faq">
          {block.heading && <div className="lp-head"><h2 className="lp-h2">{block.heading}</h2></div>}
          <div className="mk-faq-list">
            {block.items.map((it, i) => (
              <details className="mk-faq-item" key={i}>
                <summary>{it.q}<Icon name="chevDown" size={18} /></summary>
                <p>{it.a}</p>
              </details>
            ))}
          </div>
        </section>
      );

    case "roles":
      return (
        <section className="mk-section">
          {block.heading && <div className="lp-head"><h2 className="lp-h2">{block.heading}</h2>{block.sub && <p className="lp-sub">{block.sub}</p>}</div>}
          <div className="mk-roles">
            {block.items.map((r, i) => (
              <a className="mk-role" href="#/contact" onClick={go("/contact")} key={i}>
                <div className="mk-role-main">
                  <h3>{r.title}</h3>
                  <div className="mk-role-meta">
                    <span><Icon name="users" size={13} /> {r.team}</span>
                    <span><Icon name="home" size={13} /> {r.location}</span>
                    <span><Icon name="clock" size={13} /> {r.type}</span>
                  </div>
                </div>
                <span className="mk-role-apply">{L({ uk: "Відгукнутися", en: "Apply", pl: "Aplikuj", de: "Bewerben", ro: "Aplică", cs: "Odpovědět", sr: "Prijavi se", hu: "Jelentkezés", ar: "التقديم" })} <Icon name="arrowRight" size={15} /></span>
              </a>
            ))}
          </div>
        </section>
      );

    case "posts":
      return (
        <section className="mk-section">
          {block.heading && <div className="lp-head"><h2 className="lp-h2">{block.heading}</h2></div>}
          <div className="mk-posts">
            {block.items.map((p, i) => (
              <article className="mk-post" key={i}>
                <div className="mk-post-top">
                  <span className="mk-post-tag">{p.tag}</span>
                  <h3 className="mk-post-title">{p.title}</h3>
                  <p className="mk-post-excerpt">{p.excerpt}</p>
                </div>
                <div className="mk-post-meta"><span>{p.date}</span><span>·</span><span>{p.read}</span></div>
              </article>
            ))}
          </div>
        </section>
      );

    case "contact":
      return (
        <section className="mk-section">
          <div className="mk-contacts">
            {block.items.map((it, i) => (
              <div className="mk-contact" key={i}>
                <div className="lp-feature-icon"><Icon name={it.icon} size={18} /></div>
                <h3>{it.title}</h3>
                <a className="mk-contact-value" href={`mailto:${it.value}`}>{it.value}</a>
                <p>{it.note}</p>
              </div>
            ))}
          </div>
        </section>
      );

    case "form":
      return <section className="mk-section"><ContactForm lang={lang} /></section>;

    case "backlink":
      return (
        <div className="mk-backlink">
          <a href={`#${block.path}`} onClick={go(block.path)}><Icon name="arrowLeft" size={15} /> {block.label}</a>
        </div>
      );

    case "cta":
      return (
        <section className="lp-cta mk-cta">
          <h2 className="lp-cta-title">{block.title}</h2>
          <p className="lp-cta-sub">{block.sub}</p>
          <div className="lp-cta-actions">
            <a className="btn btn-primary lp-cta-lg" href={`#${block.primary.path}`} onClick={go(block.primary.path)}>{block.primary.label}</a>
            {block.secondary && <a className="btn lp-cta-lg" href={`#${block.secondary.path}`} onClick={go(block.secondary.path)}>{block.secondary.label}</a>}
          </div>
        </section>
      );

    default:
      return null;
  }
}

export function ContentPage({ slug, navigate, lang = "en", tweaks, setTweak }) {
  const L = (m) => m[lang] ?? m.en;
  const content = getContent(slug, lang);

  if (!content) {
    return (
      <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
        <div className="mk-page">
          <Empty icon="search" title={L({ uk: "Сторінку не знайдено", en: "Page not found", pl: "Nie znaleziono strony", de: "Seite nicht gefunden", ro: "Pagina nu a fost găsită", cs: "Stránka nenalezena", sr: "Stranica nije pronađena", hu: "Az oldal nem található", ar: "الصفحة غير موجودة" })} body={slug}
            action={<button className="btn btn-primary" onClick={() => navigate("/welcome")}>{L({ uk: "На головну", en: "Go home", pl: "Strona główna", de: "Zur Startseite", ro: "Pagina principală", cs: "Na hlavní stránku", sr: "Na početnu", hu: "Vissza a főoldalra", ar: "الذهاب إلى الرئيسية" })}</button>} />
        </div>
      </MarketingShell>
    );
  }

  const h = content.hero;
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };

  return (
    <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
      <header className={`mk-hero${h.icon ? " mk-hero-feature" : ""}`}>
        {h.icon && <div className="mk-hero-icon"><Icon name={h.icon} size={26} /></div>}
        {h.eyebrow && <span className="lp-eyebrow"><Icon name="sparkle" size={13} /> {h.eyebrow}</span>}
        <h1 className="mk-hero-title">{h.title}</h1>
        {h.sub && <p className="mk-hero-sub">{h.sub}</p>}
        {h.updated && <p className="mk-hero-updated">{h.updated}</p>}
        {h.points && (
          <ul className="mk-hero-points">
            {h.points.map((p, i) => <li key={i}><Icon name="check" size={15} /> {p}</li>)}
          </ul>
        )}
        {h.cta && (
          <div className="mk-hero-cta">
            <a className="btn btn-primary lp-cta-lg" href={`#${h.cta.path}`} onClick={go(h.cta.path)}>{h.cta.label}</a>
          </div>
        )}
      </header>

      <div className="mk-blocks">
        {content.blocks.map((b, i) => <Block block={b} lang={lang} navigate={navigate} key={i} />)}
      </div>
    </MarketingShell>
  );
}

// ContentPage.jsx — One renderer for every public marketing sub-page.
//
// Given a route `slug`, it looks the content up in the registry and renders a
// hero plus a list of typed blocks inside the shared MarketingShell. New pages
// are added by editing content.js — no new component is needed.
import React, { useState } from "react";
import { Icon, Empty } from "../../components/UI.jsx";
import { MarketingShell } from "./MarketingShell.jsx";
import { getContent } from "./content.js";
import { submitLead } from "../../api/leads.js";
import { submitDemoRequest, DEMO_BOOKING_URL } from "../../api/demo.js";
import { AuthSelect } from "../SignupFlow.jsx";
import { CONTACT_REASONS, options as pickOptions, labelOf } from "../signupOptions.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The notice printed under the Send button AND stored as the HubSpot consent
// artefact — those must be the same string, in the language the visitor read,
// or the record says they agreed to something they never saw. A notice rather
// than a checkbox is right for this form: answering a question someone asked
// us is not marketing consent, it is the thing they came for.
const CONTACT_CONSENT = {
  uk: "Надсилаючи, ви погоджуєтеся, що ми опрацюємо ці дані, щоб вам відповісти — див. Політику приватності.",
  en: "By sending this you agree that we process these details in order to reply — see the Privacy Policy.",
  pl: "Wysyłając, zgadzasz się na przetwarzanie tych danych w celu udzielenia odpowiedzi — zobacz Politykę prywatności.",
  de: "Mit dem Senden stimmen Sie zu, dass wir diese Angaben verarbeiten, um zu antworten — siehe Datenschutzerklärung.",
  ro: "Prin trimitere, acceptați că prelucrăm aceste date pentru a vă răspunde — vedeți Politica de confidențialitate.",
  cs: "Odesláním souhlasíte s tím, že tyto údaje zpracujeme, abychom vám odpověděli — viz Zásady ochrany osobních údajů.",
  sr: "Slanjem prihvatate da ove podatke obradimo kako bismo vam odgovorili — vidite Politiku privatnosti.",
  hu: "Az elküldéssel hozzájárul, hogy ezeket az adatokat a válaszadás céljából kezeljük — lásd az Adatvédelmi szabályzatot.",
  ar: "بإرسال هذه الرسالة توافق على معالجة هذه البيانات للرد عليك — راجع سياسة الخصوصية.",
  es: "Al enviarlo, acepta que tratemos estos datos para responderle — consulte la Política de privacidad.",
  pt: "Ao enviar, concorda que tratemos estes dados para lhe responder — consulte a Política de Privacidade.",
  lt: "Išsiųsdami sutinkate, kad šiuos duomenis tvarkytume tam, kad jums atsakytume — žr. Privatumo politiką.",
};

/* Contact form.
 *
 * Sends down the SAME pathway a demo request does (SignupFlow.finish), for the
 * same reason: neither half should be able to delay or fail the other.
 *
 *   submitLead        → HubSpot. The CRM record, and the only one of the two
 *                       that can carry the message itself (leads.js: `message`
 *                       is a HubSpot built-in).
 *   submitDemoRequest → marketing-service. The acknowledgement email, in the
 *                       language of the page they wrote it on.
 *
 * Both resolve rather than throw, so a marketing endpoint having a bad minute
 * is a console entry and not an error page for someone who just asked us a
 * question. They are thanked either way — which is honest here, because the
 * message is recorded before either call returns... with one exception worth
 * knowing: with no HubSpot portal configured (`hubspotConfig` → null) the lead
 * call SKIPS, and then the message text is not stored anywhere. The visitor
 * still gets their reply-to address acknowledged, and the operator sees
 * `lead.submit_skipped` reasoning in leads.js. Carrying the text without
 * HubSpot needs a `message` field on marketing-service's DemoRequestIn, which
 * is extra="forbid" today.
 */
function ContactForm({ lang, navigate }) {
  const L = (m) => m[lang] ?? m.en;
  const [form, setForm] = useState({ name: "", email: "", reason: "", message: "" });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = L({ uk: "Вкажіть ім'я.", en: "Enter your name.", pl: "Podaj imię.", de: "Geben Sie Ihren Namen ein.", ro: "Introduceți numele.", cs: "Zadejte své jméno.", sr: "Unesite svoje ime.", hu: "Adja meg a nevét.", ar: "أدخل اسمك.", es: "Introduzca su nombre.", pt: "Indique o seu nome." });
    if (!EMAIL_RE.test(form.email)) next.email = L({ uk: "Невірна пошта.", en: "Enter a valid email.", pl: "Podaj poprawny adres e-mail.", de: "Geben Sie eine gültige E-Mail-Adresse ein.", ro: "Introduceți un e-mail valid.", cs: "Zadejte platný e-mail.", sr: "Unesite ispravnu e-adresu.", hu: "Adjon meg érvényes e-mail-címet.", ar: "أدخل بريدًا إلكترونيًا صالحًا.", es: "Introduzca un correo válido.", pt: "Indique um e-mail válido." });
    if (!form.reason) next.reason = L({ uk: "Оберіть причину.", en: "Choose a reason.", pl: "Wybierz powód.", de: "Wählen Sie einen Grund.", ro: "Alegeți un motiv.", cs: "Vyberte důvod.", sr: "Izaberite razlog.", hu: "Válasszon okot.", ar: "اختر سببًا.", es: "Elija un motivo.", pt: "Escolha um motivo.", lt: "Pasirinkite priežastį." });
    if (!form.message.trim()) next.message = L({ uk: "Напишіть повідомлення.", en: "Write a message.", pl: "Napisz wiadomość.", de: "Schreiben Sie eine Nachricht.", ro: "Scrieți un mesaj.", cs: "Napište zprávu.", sr: "Napišite poruku.", hu: "Írjon üzenetet.", ar: "اكتب رسالة.", es: "Escriba un mensaje.", pt: "Escreva uma mensagem." });
    setErrors(next);
    if (Object.keys(next).length) return;

    // Thank them first: the two calls below cannot fail in a way the visitor
    // could act on, and making them watch a spinner for a CRM write is a cost
    // with no benefit. Errors go to the console for the operator.
    setSent(true);
    const pageUri = typeof window !== "undefined" ? window.location.href : "";
    // The name arrives as one field. HubSpot wants it split, and the first
    // token is the only part that can be assigned with any confidence.
    const [firstName, ...rest] = form.name.trim().split(/\s+/);
    Promise.all([
      submitLead(
        {
          firstName,
          lastName: rest.join(" "),
          email: form.email,
          // The reason leads the message rather than riding a separate CRM
          // property: adding a fourth to CUSTOM_PROPERTIES would reject every
          // submission until someone creates it in the portal (leads.js). The
          // ENGLISH value, not the label, so the same reason reads the same in
          // HubSpot whichever language the form was in.
          message: `${form.reason}\n\n${form.message}`.trim(),
          // `consent: true` is what makes leadSubmission attach the artefact,
          // and the text is the notice printed under the button — it has to be
          // the wording they actually saw.
          consent: true,
        },
        { consentText: L(CONTACT_CONSENT), pageName: "Klarnote — contact", pageUri },
      ),
      // `kind: "contact"` is what makes marketing-service send the CONTACT
      // acknowledgement rather than the demo one, in `lang`. It also carries
      // the message and reason, which the service forwards to the sales
      // mailbox — the CRM write above is a record, not an inbox, and the
      // acknowledgement promises a person will read what they wrote.
      submitDemoRequest(
        { email: form.email, firstName, message: form.message, reason: form.reason },
        { lang, pageUri, kind: "contact" },
      ),
    ]).catch((e) => console.error("contact.submit_error", e));
  };

  if (sent) {
    return <ContactSent lang={lang} email={form.email} navigate={navigate} />;
  }

  return (
    <form className="mk-form" onSubmit={onSubmit} noValidate>
      <h3 className="mk-form-title">{L({ uk: "Напишіть нам", en: "Send us a message", pl: "Napisz do nas", de: "Schreiben Sie uns", ro: "Trimiteți-ne un mesaj", cs: "Napište nám", sr: "Pošaljite nam poruku", hu: "Írjon nekünk", ar: "أرسل لنا رسالة", es: "Envíenos un mensaje", pt: "Envie-nos uma mensagem" })}</h3>
      <p className="mk-form-sub">{L({
        uk: "Заповніть форму — менеджер відповість протягом одного робочого дня.",
        en: "Fill this in and a manager will reply within one business day.",
        pl: "Wypełnij formularz — menedżer odpowie w ciągu jednego dnia roboczego.",
        de: "Füllen Sie das Formular aus — ein Mitarbeiter antwortet innerhalb eines Werktages.",
        ro: "Completați formularul — un manager vă va răspunde într-o zi lucrătoare.",
        cs: "Vyplňte formulář — manažer odpoví do jednoho pracovního dne.",
        sr: "Popunite formu — menadžer će odgovoriti u roku od jednog radnog dana.",
        hu: "Töltse ki az űrlapot — munkatársunk egy munkanapon belül válaszol.",
        ar: "املأ النموذج وسيردّ عليك أحد المسؤولين خلال يوم عمل واحد.",
        es: "Rellene el formulario y un responsable le contestará en un día laborable.",
        pt: "Preencha o formulário e um gestor responderá no prazo de um dia útil.",
        lt: "Užpildykite formą — vadybininkas atsakys per vieną darbo dieną.",
      })}</p>
      <div className="mk-form-row">
        <label className="login-field">
          <span>{L({ uk: "Ім'я", en: "Name", pl: "Imię", de: "Name", ro: "Nume", cs: "Jméno", sr: "Ime", hu: "Név", ar: "الاسم", es: "Nombre", pt: "Nome" })}</span>
          <input value={form.name} onChange={set("name")} aria-invalid={errors.name ? "true" : undefined} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <label className="login-field">
          <span>{L({ uk: "Електронна пошта", en: "Email", pl: "E-mail", de: "E-Mail", ro: "E-mail", cs: "E-mail", sr: "E-adresa", hu: "E-mail", ar: "البريد الإلكتروني", es: "Correo electrónico", pt: "E-mail" })}</span>
          <input type="email" value={form.email} onChange={set("email")} placeholder="you@clinic.example" aria-invalid={errors.email ? "true" : undefined} />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
      </div>
      <label className="login-field">
        <span>{L({ uk: "Причина звернення", en: "Reason for contact", pl: "Powód kontaktu", de: "Anliegen", ro: "Motivul contactului", cs: "Důvod kontaktu", sr: "Razlog kontakta", hu: "A megkeresés oka", ar: "سبب التواصل", es: "Motivo del contacto", pt: "Motivo do contacto", lt: "Kreipimosi priežastis" })}</span>
        <AuthSelect
          value={form.reason}
          onChange={(v) => { setForm((f) => ({ ...f, reason: v })); setErrors((e) => ({ ...e, reason: undefined })); }}
          opts={pickOptions(CONTACT_REASONS, lang)}
          label={L({ uk: "Причина звернення", en: "Reason for contact", pl: "Powód kontaktu", de: "Anliegen", ro: "Motivul contactului", cs: "Důvod kontaktu", sr: "Razlog kontakta", hu: "A megkeresés oka", ar: "سبب التواصل", es: "Motivo del contacto", pt: "Motivo do contacto", lt: "Kreipimosi priežastis" })}
          placeholder={L({ uk: "Оберіть…", en: "Choose…", pl: "Wybierz…", de: "Auswählen…", ro: "Alegeți…", cs: "Vyberte…", sr: "Izaberite…", hu: "Válasszon…", ar: "اختر…", es: "Elija…", pt: "Escolha…", lt: "Pasirinkite…" })}
          invalid={!!errors.reason}
        />
        {errors.reason && <span className="field-error">{errors.reason}</span>}
      </label>
      <label className="login-field">
        <span>{L({ uk: "Повідомлення", en: "Message", pl: "Wiadomość", de: "Nachricht", ro: "Mesaj", cs: "Zpráva", sr: "Poruka", hu: "Üzenet", ar: "الرسالة", es: "Mensaje", pt: "Mensagem" })}</span>
        <textarea rows={5} value={form.message} onChange={set("message")} aria-invalid={errors.message ? "true" : undefined} />
        {errors.message && <span className="field-error">{errors.message}</span>}
      </label>
      <button type="submit" className="btn btn-primary lp-cta-lg">{L({ uk: "Надіслати", en: "Send", pl: "Wyślij", de: "Senden", ro: "Trimite", cs: "Odeslat", sr: "Pošalji", hu: "Küldés", ar: "إرسال", es: "Enviar", pt: "Enviar", lt: "Siųsti" })}</button>
      <p className="mk-form-note">{L(CONTACT_CONSENT)}</p>
    </form>
  );
}

/* The confirmation the contact form lands on.
 *
 * Its own template rather than the generic "sent" block, because this moment
 * carries two things and the old one carried neither: WHO will answer and WHAT
 * to do while waiting. A message sent into a marketing inbox has an unknown
 * reply time; a demo is bookable in the next click. So the page says thank you,
 * names the address the reply will come to — the one field they could have
 * mistyped, shown back to them while it is still fixable — and then offers the
 * demo as a genuine second path, not as a nag.
 *
 * The demo link is `?intent=demo`, which opens the booking form directly
 * instead of the sign-up chooser (App.jsx / SignupFlow).
 */
function ContactSent({ lang, email, navigate }) {
  const L = (m) => m[lang] ?? m.en;
  return (
    <div className="mk-sent" role="status">
      <span className="mk-sent-mark" aria-hidden="true"><Icon name="check" size={20} /></span>

      <h3 className="mk-sent-title">
        {L({
          uk: "Дякуємо за звернення",
          en: "Thank you for getting in touch",
          pl: "Dziękujemy za kontakt",
          de: "Danke für Ihre Nachricht",
          ro: "Vă mulțumim pentru mesaj",
          cs: "Děkujeme, že jste se nám ozvali",
          sr: "Hvala što ste nam se obratili",
          hu: "Köszönjük, hogy felvette velünk a kapcsolatot",
          ar: "شكرًا لتواصلك معنا",
          es: "Gracias por ponerse en contacto",
          pt: "Obrigado pelo seu contacto",
          lt: "Dėkojame, kad susisiekėte",
        })}
      </h3>

      <p className="mk-sent-lead">
        {L({
          uk: "Ваше повідомлення в нас. Менеджер звʼяжеться з вами — відповідь надійде на ",
          en: "Your message is with us. A manager will get in touch — the reply goes to ",
          pl: "Mamy Twoją wiadomość. Menedżer skontaktuje się z Tobą — odpowiedź otrzymasz na ",
          de: "Ihre Nachricht ist bei uns. Ein Mitarbeiter meldet sich — die Antwort geht an ",
          ro: "Mesajul dumneavoastră a ajuns la noi. Un manager vă va contacta — răspunsul va fi trimis la ",
          cs: "Vaši zprávu máme. Ozve se vám náš manažer — odpověď přijde na ",
          sr: "Vaša poruka je kod nas. Menadžer će vam se javiti — odgovor ide na ",
          hu: "Megkaptuk az üzenetét. Munkatársunk hamarosan jelentkezik — a válasz ide érkezik: ",
          ar: "وصلتنا رسالتك. سيتواصل معك أحد المسؤولين — وسيصل الرد إلى ",
          es: "Hemos recibido su mensaje. Un responsable se pondrá en contacto — la respuesta irá a ",
          pt: "Recebemos a sua mensagem. Um gestor entrará em contacto — a resposta será enviada para ",
          lt: "Jūsų žinutę gavome. Su jumis susisieks vadybininkas — atsakymas ateis adresu ",
        })}
        <b className="mk-sent-email">{email}</b>
      </p>

      {/* The second path. Bordered off rather than run on, so it reads as an
          offer and not as a condition of the reply. */}
      <div className="mk-sent-alt">
        <p>
          {L({
            uk: "Не хочете чекати? Забронюйте демо й оберіть зручний час.",
            en: "Don't want to wait? Book a demo and pick a time that suits you.",
            pl: "Nie chcesz czekać? Umów prezentację i wybierz dogodny termin.",
            de: "Sie möchten nicht warten? Buchen Sie eine Demo und wählen Sie einen passenden Termin.",
            ro: "Nu doriți să așteptați? Programați o demonstrație și alegeți ora care vi se potrivește.",
            cs: "Nechcete čekat? Objednejte si ukázku a vyberte si vyhovující čas.",
            sr: "Ne želite da čekate? Zakažite demo i izaberite vreme koje vam odgovara.",
            hu: "Nem szeretne várni? Foglaljon bemutatót, és válasszon Önnek megfelelő időpontot.",
            ar: "لا ترغب في الانتظار؟ احجز عرضًا توضيحيًا واختر الوقت المناسب لك.",
            es: "¿No quiere esperar? Reserve una demo y elija la hora que le convenga.",
            pt: "Não quer esperar? Marque uma demonstração e escolha a hora que lhe convém.",
            lt: "Nenorite laukti? Užsisakykite demonstraciją ir pasirinkite jums patogų laiką.",
          })}
        </p>
        {/* Straight to the Google appointment page — the same calendar the
            acknowledgement email links to. Not our own /signup?intent=demo:
            that would ask for the email address they have just given us before
            handing them the calendar anyway. New tab, because losing this
            confirmation to a navigation would lose the address it echoes. */}
        <a
          className="btn btn-primary lp-cta-lg"
          href={DEMO_BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="calendar" size={14} />
          {L({
            uk: "Замовити демо", en: "Book a demo", pl: "Umów prezentację",
            de: "Demo buchen", ro: "Programați o demonstrație", cs: "Objednat ukázku",
            sr: "Zakažite demo", hu: "Bemutató foglalása", ar: "احجز عرضًا توضيحيًا",
            es: "Reservar una demo", pt: "Marcar uma demonstração", lt: "Užsisakyti demonstraciją",
          })}
        </a>
      </div>
    </div>
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
          {it.path && <span className="mk-card-more">{L({ uk: "Докладніше", en: "Learn more", pl: "Dowiedz się więcej", de: "Mehr erfahren", ro: "Aflați mai multe", cs: "Zjistit více", sr: "Saznajte više", hu: "Tudjon meg többet", ar: "اعرف المزيد", es: "Más información", pt: "Saber mais" })} <Icon name="arrowRight" size={14} /></span>}
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

    /* A label/value table plus the sources it was built from. Added for the
       /rcm country pages: a coding stack is read by scanning down the left
       column for "Procedure coding" and across — a bullet list destroys
       exactly that, and an unsourced claim about a national tariff is worth
       nothing to the coder who has to defend it. */
    case "spec":
      return (
        <section className="mk-section mk-spec-wrap">
          {block.heading && <div className="lp-head"><h2 className="lp-h2">{block.heading}</h2>{block.sub && <p className="lp-sub">{block.sub}</p>}</div>}
          <dl className="mk-spec">
            {block.rows.filter((r) => r.value).map((r) => (
              <div className="mk-spec-row" key={r.key ?? r.label}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
          {block.sources?.length > 0 && (
            <p className="mk-spec-src">
              <Icon name="link" size={13} /> <span>{block.sourcesLabel}:</span>
              {block.sources.map((s, i) => (
                <a href={s.url} key={i} target="_blank" rel="noopener noreferrer">{s.label}</a>
              ))}
            </p>
          )}
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
                <span className="mk-role-apply">{L({ uk: "Відгукнутися", en: "Apply", pl: "Aplikuj", de: "Bewerben", ro: "Aplică", cs: "Odpovědět", sr: "Prijavi se", hu: "Jelentkezés", ar: "التقديم", es: "Inscribirse", pt: "Candidatar-se" })} <Icon name="arrowRight" size={15} /></span>
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
      return <section className="mk-section"><ContactForm lang={lang} navigate={navigate} /></section>;

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

/* ── /platform's hero ornament ─────────────────────────────────────────────
 * The landing hero has a waveform behind it because what happens there is
 * listening. /platform is about the CLOSED LOOP — its headline is literally
 * the three verbs, and its bullets are the four pillars — so its ornament is
 * an orbit: concentric rings turning slowly, with one mark per pillar riding
 * the outer one.
 *
 * Grey, like the hero waveform, and for the same reason: the page's own hue
 * budget is spent on the CTA, and a second coloured layer in the first screen
 * would be two things competing to be the background. `--line` is the
 * hairline token, so it follows the theme with no dark-mode override.
 *
 * PURE CSS. Circles are rotationally symmetric — the motion is only visible
 * because the rings are dashed and the marks sit on them — so this needs no
 * rAF and no measurement, unlike the workflow band where lines have to track
 * moving endpoints. Four marks nest a static offset outside an animated
 * rotation: rotations about the same origin commute, so each mark keeps its
 * quarter-turn spacing while all four share one animation.
 *
 * THE VIEWBOX STARTS AT 0 0 ON PURPOSE. A `-260 -260 520 520` box with circles
 * at the origin is the natural way to write this, and it is a trap: CSS
 * `transform-origin: center` under `transform-box: view-box` computes to 50%
 * of the box SIZE — 260px 260px — which in that coordinate system is not the
 * centre but a point 260 units down and right of it. Each ring then orbits its
 * own off-centre pivot at its own speed and the three stop being concentric.
 * Keeping the box at 0 0 makes CSS's idea of the centre and the drawing's idea
 * of the centre the same point.
 *
 * Only /platform gets it. Every other content page (/about, /security, the
 * feature and product pages) renders the same header, and an orbit behind a
 * legal notice is decoration with nothing to say.
 */
const ORBIT_MARKS = [0, 1, 2, 3];

function HeroOrbit() {
  return (
    <div className="mk-hero-orbit" aria-hidden="true">
      <svg viewBox="0 0 520 520" focusable="false">
        <circle className="mk-orbit-ring is-inner" cx="260" cy="260" r="112" />
        <circle className="mk-orbit-ring is-mid" cx="260" cy="260" r="170" />
        <circle className="mk-orbit-ring is-outer" cx="260" cy="260" r="234" />
        {ORBIT_MARKS.map((i) => (
          <g key={i} transform={`rotate(${i * 90} 260 260)`}>
            <g className="mk-orbit-arm">
              <circle className="mk-orbit-mark" cx="494" cy="260" r="4.5" />
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function ContentPage({ slug, navigate, lang = "en", tweaks, setTweak }) {
  const L = (m) => m[lang] ?? m.en;
  const content = getContent(slug, lang);

  if (!content) {
    return (
      <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
        <div className="mk-page">
          <Empty icon="search" title={L({ uk: "Сторінку не знайдено", en: "Page not found", pl: "Nie znaleziono strony", de: "Seite nicht gefunden", ro: "Pagina nu a fost găsită", cs: "Stránka nenalezena", sr: "Stranica nije pronađena", hu: "Az oldal nem található", ar: "الصفحة غير موجودة", es: "Página no encontrada", pt: "Página não encontrada" })} body={slug}
            action={<button className="btn btn-primary" onClick={() => navigate("/welcome")}>{L({ uk: "На головну", en: "Go home", pl: "Strona główna", de: "Zur Startseite", ro: "Pagina principală", cs: "Na hlavní stránku", sr: "Na početnu", hu: "Vissza a főoldalra", ar: "الذهاب إلى الرئيسية", es: "Ir al inicio", pt: "Ir para o início" })}</button>} />
        </div>
      </MarketingShell>
    );
  }

  const h = content.hero;
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };

  return (
    <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}
      /* The contact page is the one page whose whole job must be reachable
         WITHOUT scrolling — a form below the fold is a form that half the
         visitors never see the bottom of. `mk-contact` turns the stacked
         hero-then-block layout into two columns that share the height. */
      className={slug === "contact" ? "mk-contact" : undefined}>
      <header className={`mk-hero${h.icon ? " mk-hero-feature" : ""}${slug === "platform" ? " has-orbit" : ""}`}>
        {slug === "platform" && <HeroOrbit />}
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

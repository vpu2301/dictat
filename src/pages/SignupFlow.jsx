// SignupFlow.jsx — /signup. Heidi-style entry flow.
//
// A single self-contained wizard (no routing churn) with an internal step
// machine. "Sign up" in the marketing nav lands here on a chooser with two
// options — Create account or Book a demo — modelled on heidihealth.com:
//   choose ─┬─▶ acct1 ─▶ acct2 ─▶ done (create account)
//           └─▶ demo  ─────────▶ done (book a demo)
// Styled in the marketing Heidi palette (wrapped in `.lp`, `.mk-auth-*`), so
// the logged-in platform is untouched. This platform is admin-invite-only, so
// nothing is persisted — the flow captures intent and confirms receipt.
import React, { useState } from "react";
import { Icon, Logo } from "../components/UI.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Provider marks — small inline SVGs (no icon-map entries needed). */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2 5.1-4.4 6.7v5.6h7.1c4.2-3.8 6.6-9.5 6.6-16.3z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.6c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.6 27.9c-.4-1.3-.7-2.6-.7-4s.2-2.7.7-4v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.7l7.3-5.8z" />
      <path fill="#EA4335" d="M24 10.9c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.5 30 2 24 2 15.4 2 7.9 6.9 4.3 14.3l7.3 5.7C13.3 14.8 18.2 10.9 24 10.9z" />
    </svg>
  );
}
function AppleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor">
      <path d="M318.7 268c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-92.6zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

/* Designed dropdown — a styled trigger + a custom options panel (the native
   <select> can't have its open list styled). Matches the form's look, with
   hover + selected states, outside-click / Escape to close. */
function AuthSelect({ value, onChange, options, label }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className={`mk-auth-select${open ? " is-open" : ""}`} ref={ref}>
      <button type="button" className="mk-auth-select-btn" aria-haspopup="listbox"
        aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <span>{value}</span>
        <Icon name="chevDown" size={16} />
      </button>
      {open && (
        <div className="mk-auth-select-panel" role="listbox">
          {options.map((o) => (
            <button type="button" key={o} role="option" aria-selected={o === value}
              className={`mk-auth-select-opt${o === value ? " is-sel" : ""}`}
              onClick={() => { onChange(o); setOpen(false); }}>
              <span>{o}</span>
              {o === value && <Icon name="check" size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SignupFlow({ navigate, lang = "en" }) {
  const L = (m) => m[lang] ?? m.en;
  const [step, setStep] = useState("choose");

  const SPECIALTIES = [
    L({ uk: "Загальна практика", en: "General practice", pl: "Medycyna rodzinna", de: "Allgemeinmedizin", ro: "Medicină de familie", cs: "Všeobecné lékařství", sr: "Opšta medicina", hu: "Háziorvoslás" }),
    L({ uk: "Радіологія", en: "Radiology", pl: "Radiologia", de: "Radiologie", ro: "Radiologie", cs: "Radiologie", sr: "Radiologija", hu: "Radiológia" }),
    L({ uk: "Психічне здоров'я", en: "Mental health", pl: "Zdrowie psychiczne", de: "Psychische Gesundheit", ro: "Sănătate mintală", cs: "Duševní zdraví", sr: "Mentalno zdravlje", hu: "Mentális egészség" }),
    L({ uk: "Хірургія", en: "Surgery", pl: "Chirurgia", de: "Chirurgie", ro: "Chirurgie", cs: "Chirurgie", sr: "Hirurgija", hu: "Sebészet" }),
    L({ uk: "Педіатрія", en: "Pediatrics", pl: "Pediatria", de: "Pädiatrie", ro: "Pediatrie", cs: "Pediatrie", sr: "Pedijatrija", hu: "Gyermekgyógyászat" }),
    L({ uk: "Кардіологія", en: "Cardiology", pl: "Kardiologia", de: "Kardiologie", ro: "Cardiologie", cs: "Kardiologie", sr: "Kardiologija", hu: "Kardiológia" }),
    L({ uk: "Неврологія", en: "Neurology", pl: "Neurologia", de: "Neurologie", ro: "Neurologie", cs: "Neurologie", sr: "Neurologija", hu: "Neurológia" }),
    L({ uk: "Інша", en: "Other", pl: "Inna", de: "Andere", ro: "Alta", cs: "Jiná", sr: "Druga", hu: "Egyéb" }),
  ];
  const ROLES = [
    L({ uk: "Окремий лікар", en: "Individual practitioner", pl: "Lekarz indywidualny", de: "Einzelpraktiker", ro: "Medic individual", cs: "Samostatný lékař", sr: "Samostalni lekar", hu: "Egyéni orvos" }),
    L({ uk: "Керівник практики", en: "Practice lead", pl: "Kierownik praktyki", de: "Praxisleitung", ro: "Manager de cabinet", cs: "Vedoucí praxe", sr: "Rukovodilac prakse", hu: "Praxisvezető" }),
    L({ uk: "Адміністратор", en: "Administrator", pl: "Administrator", de: "Administrator", ro: "Administrator", cs: "Administrátor", sr: "Administrator", hu: "Adminisztrátor" }),
    L({ uk: "Медсестра / медбрат", en: "Nurse", pl: "Pielęgniarka / pielęgniarz", de: "Pflegekraft", ro: "Asistent medical", cs: "Zdravotní sestra / bratr", sr: "Medicinska sestra / tehničar", hu: "Ápoló" }),
    L({ uk: "Інше", en: "Other", pl: "Inne", de: "Sonstiges", ro: "Altele", cs: "Jiné", sr: "Drugo", hu: "Egyéb" }),
  ];
  const COUNTRIES = [
    { flag: "🇺🇦", name: L({ uk: "Україна", en: "Ukraine", pl: "Ukraina", de: "Ukraine", ro: "Ucraina", cs: "Ukrajina", sr: "Ukrajina", hu: "Ukrajna" }) },
    { flag: "🇵🇱", name: L({ uk: "Польща", en: "Poland", pl: "Polska", de: "Polen", ro: "Polonia", cs: "Polsko", sr: "Poljska", hu: "Lengyelország" }) },
    { flag: "🇩🇪", name: L({ uk: "Німеччина", en: "Germany", pl: "Niemcy", de: "Deutschland", ro: "Germania", cs: "Německo", sr: "Nemačka", hu: "Németország" }) },
    { flag: "🇬🇧", name: L({ uk: "Велика Британія", en: "United Kingdom", pl: "Wielka Brytania", de: "Vereinigtes Königreich", ro: "Regatul Unit", cs: "Spojené království", sr: "Ujedinjeno Kraljevstvo", hu: "Egyesült Királyság" }) },
    { flag: "🇺🇸", name: L({ uk: "США", en: "United States", pl: "Stany Zjednoczone", de: "USA", ro: "Statele Unite", cs: "Spojené státy", sr: "Sjedinjene Američke Države", hu: "Egyesült Államok" }) },
  ].map((c) => `${c.flag}  ${c.name}`);
  const SIZES = [
    L({ uk: "Тільки я", en: "Just me", pl: "Tylko ja", de: "Nur ich", ro: "Doar eu", cs: "Jen já", sr: "Samo ja", hu: "Csak én" }),
    "2–5", "6–20", "21–50", "51+",
  ];

  const [form, setForm] = useState({
    email: "", firstName: "", lastName: "",
    specialty: SPECIALTIES[0], role: ROLES[0], country: COUNTRIES[0],
    phone: "", consent: false, org: "", size: SIZES[0],
  });
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setV = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));   // for AuthSelect

  const emailOk = EMAIL_RE.test(form.email);
  const acct1Ok = form.firstName.trim() && form.lastName.trim() && form.consent;
  const acct2Ok = form.org.trim();

  const back = () => navigate("/welcome");

  /* ── Shared chrome ────────────────────────────────────────── */
  const Shell = ({ children, onBack, topBack }) => (
    <div className="lp mk-auth-shell">
      <div className="mk-auth">
        {topBack && (
          <button className="mk-auth-back is-top" onClick={onBack}>
            <Icon name="arrowLeft" size={16} /> {L({ uk: "Назад", en: "Back", pl: "Wstecz", de: "Zurück", ro: "Înapoi", cs: "Zpět", sr: "Nazad", hu: "Vissza" })}
          </button>
        )}
        <a className="mk-auth-logo" href="#/welcome" onClick={(e) => { e.preventDefault(); back(); }}>
          <Logo size={34} />
        </a>
        {children}
        {!topBack && (
          <button className="mk-auth-back" onClick={onBack}>
            <Icon name="arrowLeft" size={16} /> {L({ uk: "Назад", en: "Back", pl: "Wstecz", de: "Zurück", ro: "Înapoi", cs: "Zpět", sr: "Nazad", hu: "Vissza" })}
          </button>
        )}
      </div>
    </div>
  );

  /* ── Confirmation ─────────────────────────────────────────── */
  if (step === "done-acct" || step === "done-demo") {
    const demo = step === "done-demo";
    return (
      <Shell onBack={back}>
        <div className="mk-auth-done">
          <span className="mk-auth-done-mark"><Icon name="check" size={24} /></span>
          <h1 className="mk-auth-title">{L({ uk: "Готово!", en: "You're all set!", pl: "Wszystko gotowe!", de: "Alles erledigt!", ro: "Totul este gata!", cs: "Vše je hotovo!", sr: "Sve je spremno!", hu: "Minden készen áll!" })}</h1>
          <p className="mk-auth-sub">
            {demo
              ? L({
                  uk: "Дякуємо! Наша команда зв'яжеться, щоб узгодити демо.",
                  en: "Thanks! Our team will reach out to schedule your demo.",
                  pl: "Dziękujemy! Nasz zespół skontaktuje się z Tobą, aby umówić prezentację.",
                  de: "Vielen Dank! Unser Team meldet sich, um Ihre Demo zu vereinbaren.",
                  ro: "Mulțumim! Echipa noastră vă va contacta pentru a programa demonstrația.",
                  cs: "Děkujeme! Náš tým se vám ozve a domluví termín ukázky.",
                  sr: "Hvala! Naš tim će vas kontaktirati da zakaže demo.",
                  hu: "Köszönjük! Csapatunk hamarosan jelentkezik a bemutató egyeztetéséhez.",
                })
              : L({
                  uk: "Дякуємо за реєстрацію. Ми надішлемо запрошення на вашу пошту.",
                  en: "Thanks for signing up. We'll send an invite to your email.",
                  pl: "Dziękujemy za rejestrację. Wyślemy zaproszenie na Twój adres e-mail.",
                  de: "Vielen Dank für Ihre Registrierung. Wir senden Ihnen eine Einladung per E-Mail.",
                  ro: "Mulțumim pentru înregistrare. Vă vom trimite o invitație pe e-mail.",
                  cs: "Děkujeme za registraci. Pozvánku vám zašleme na e-mail.",
                  sr: "Hvala na registraciji. Pozivnicu ćemo poslati na vašu e-adresu.",
                  hu: "Köszönjük a regisztrációt. A meghívót e-mailben küldjük el.",
                })}
          </p>
        </div>
        <button className="mk-auth-btn primary" onClick={() => navigate("/login")}>
          {L({ uk: "До входу", en: "Go to sign in", pl: "Przejdź do logowania", de: "Zur Anmeldung", ro: "Mergi la autentificare", cs: "Přejít na přihlášení", sr: "Idi na prijavu", hu: "Tovább a bejelentkezéshez" })}
        </button>
      </Shell>
    );
  }

  /* ── Chooser ──────────────────────────────────────────────── */
  if (step === "choose") {
    return (
      <Shell onBack={back}>
        <h1 className="mk-auth-title">{L({ uk: "Реєстрація", en: "Sign up", pl: "Rejestracja", de: "Registrieren", ro: "Înregistrare", cs: "Registrace", sr: "Registracija", hu: "Regisztráció" })}</h1>
        <p className="mk-auth-sub">{L({ uk: "Оберіть, з чого почати.", en: "Choose how you'd like to start.", pl: "Wybierz, jak chcesz zacząć.", de: "Wählen Sie, wie Sie beginnen möchten.", ro: "Alegeți cum doriți să începeți.", cs: "Vyberte, jak chcete začít.", sr: "Izaberite kako želite da počnete.", hu: "Válassza ki, hogyan szeretne kezdeni." })}</p>
        <div className="mk-auth-choose">
          <button className="mk-auth-opt" onClick={() => setStep("acct1")}>
            <span className="mk-auth-opt-ic"><Icon name="user" size={20} /></span>
            <span className="mk-auth-opt-txt">
              <span className="mk-auth-opt-t">{L({ uk: "Створити акаунт", en: "Create account", pl: "Utwórz konto", de: "Konto erstellen", ro: "Creați cont", cs: "Vytvořit účet", sr: "Napravite nalog", hu: "Fiók létrehozása" })}</span>
              <span className="mk-auth-opt-d">{L({ uk: "Налаштуйте акаунт Klarnote для вашої практики.", en: "Set up your Klarnote account.", pl: "Skonfiguruj swoje konto Klarnote.", de: "Richten Sie Ihr Klarnote-Konto ein.", ro: "Configurați-vă contul Klarnote.", cs: "Nastavte si svůj účet Klarnote.", sr: "Podesite svoj Klarnote nalog.", hu: "Állítsa be Klarnote-fiókját." })}</span>
            </span>
            <Icon name="arrowRight" size={17} />
          </button>
          <button className="mk-auth-opt" onClick={() => setStep("demo")}>
            <span className="mk-auth-opt-ic"><Icon name="calendar" size={20} /></span>
            <span className="mk-auth-opt-txt">
              <span className="mk-auth-opt-t">{L({ uk: "Замовити демо", en: "Book a demo", pl: "Umów prezentację", de: "Demo buchen", ro: "Programați o demonstrație", cs: "Objednat ukázku", sr: "Zakažite demo", hu: "Bemutató foglalása" })}</span>
              <span className="mk-auth-opt-d">{L({ uk: "Подивіться Klarnote разом із нашою командою.", en: "See Klarnote with our team.", pl: "Zobacz Klarnote z naszym zespołem.", de: "Erleben Sie Klarnote mit unserem Team.", ro: "Descoperiți Klarnote împreună cu echipa noastră.", cs: "Prohlédněte si Klarnote s naším týmem.", sr: "Pogledajte Klarnote sa našim timom.", hu: "Ismerje meg a Klarnote-ot csapatunkkal." })}</span>
            </span>
            <Icon name="arrowRight" size={17} />
          </button>
        </div>
      </Shell>
    );
  }

  /* ── Book a demo ──────────────────────────────────────────── */
  if (step === "demo") {
    return (
      <Shell onBack={() => setStep("choose")}>
        <h1 className="mk-auth-title">{L({ uk: "Замовити демо", en: "Book a demo", pl: "Umów prezentację", de: "Demo buchen", ro: "Programați o demonstrație", cs: "Objednat ukázku", sr: "Zakažite demo", hu: "Bemutató foglalása" })}</h1>
        <p className="mk-auth-sub">{L({ uk: "Демо з нашою командою.", en: "Book a demo with our team.", pl: "Umów prezentację z naszym zespołem.", de: "Buchen Sie eine Demo mit unserem Team.", ro: "Programați o demonstrație cu echipa noastră.", cs: "Objednejte si ukázku s naším týmem.", sr: "Zakažite demo sa našim timom.", hu: "Foglaljon bemutatót csapatunkkal." })}</p>
        <form className="mk-auth-form" onSubmit={(e) => { e.preventDefault(); setStep("done-demo"); }}>
          <label className="mk-auth-field">
            <span>{L({ uk: "Робоча електронна пошта", en: "Work email", pl: "Służbowy adres e-mail", de: "Geschäftliche E-Mail", ro: "E-mail de serviciu", cs: "Pracovní e-mail", sr: "Poslovna e-adresa", hu: "Munkahelyi e-mail" })}</span>
            <span className="mk-auth-input-wrap">
              <Icon name="inbox" size={16} />
              <input type="email" value={form.email} onChange={set("email")}
                placeholder="name@organisation.com" autoComplete="email" />
            </span>
          </label>
          <div className="mk-auth-or"><span>{L({ uk: "або", en: "or", pl: "lub", de: "oder", ro: "sau", cs: "nebo", sr: "ili", hu: "vagy" })}</span></div>
          <button type="button" className="mk-auth-btn soft" onClick={() => setStep("acct1")}>
            <GoogleMark /> {L({ uk: "Продовжити з Google", en: "Continue with Google", pl: "Kontynuuj przez Google", de: "Mit Google fortfahren", ro: "Continuați cu Google", cs: "Pokračovat přes Google", sr: "Nastavite preko Google-a", hu: "Folytatás a Google-lal" })}
          </button>
          <button type="button" className="mk-auth-btn soft" onClick={() => setStep("acct1")}>
            <AppleMark /> {L({ uk: "Продовжити з Apple", en: "Continue with Apple", pl: "Kontynuuj przez Apple", de: "Mit Apple fortfahren", ro: "Continuați cu Apple", cs: "Pokračovat přes Apple", sr: "Nastavite preko Apple-a", hu: "Folytatás az Apple-lel" })}
          </button>
          <button type="submit" className="mk-auth-btn primary" disabled={!emailOk}>
            {L({ uk: "Далі", en: "Continue", pl: "Dalej", de: "Weiter", ro: "Continuați", cs: "Pokračovat", sr: "Dalje", hu: "Tovább" })}
          </button>
        </form>
      </Shell>
    );
  }

  /* ── Create account · step 1 (about you) ──────────────────── */
  if (step === "acct1") {
    return (
      <Shell onBack={() => setStep("choose")}>
        <h1 className="mk-auth-title">{L({ uk: "Розкажіть трохи про себе.", en: "Tell us a bit about yourself.", pl: "Opowiedz nam trochę o sobie.", de: "Erzählen Sie uns etwas über sich.", ro: "Spuneți-ne câteva lucruri despre dumneavoastră.", cs: "Řekněte nám něco o sobě.", sr: "Recite nam nešto o sebi.", hu: "Meséljen egy kicsit magáról." })}</h1>
        <p className="mk-auth-sub">{L({ uk: "Налаштуймо ваш акаунт.", en: "Let's set up your account.", pl: "Skonfigurujmy Twoje konto.", de: "Richten wir Ihr Konto ein.", ro: "Să vă configurăm contul.", cs: "Pojďme nastavit váš účet.", sr: "Hajde da podesimo vaš nalog.", hu: "Állítsuk be a fiókját." })}</p>
        <form className="mk-auth-form" onSubmit={(e) => { e.preventDefault(); if (acct1Ok) setStep("acct2"); }}>
          <div className="mk-auth-row">
            <label className="mk-auth-field">
              <span>{L({ uk: "Ім'я", en: "First name", pl: "Imię", de: "Vorname", ro: "Prenume", cs: "Jméno", sr: "Ime", hu: "Keresztnév" })} <em>*</em></span>
              <input value={form.firstName} onChange={set("firstName")} autoComplete="given-name" />
            </label>
            <label className="mk-auth-field">
              <span>{L({ uk: "Прізвище", en: "Last name", pl: "Nazwisko", de: "Nachname", ro: "Nume", cs: "Příjmení", sr: "Prezime", hu: "Vezetéknév" })} <em>*</em></span>
              <input value={form.lastName} onChange={set("lastName")} autoComplete="family-name" />
            </label>
          </div>
          <div className="mk-auth-field">
            <span>{L({ uk: "Спеціальність", en: "Specialty", pl: "Specjalizacja", de: "Fachrichtung", ro: "Specialitate", cs: "Specializace", sr: "Specijalnost", hu: "Szakterület" })} <em>*</em></span>
            <AuthSelect value={form.specialty} onChange={setV("specialty")} options={SPECIALTIES}
              label={L({ uk: "Спеціальність", en: "Specialty", pl: "Specjalizacja", de: "Fachrichtung", ro: "Specialitate", cs: "Specializace", sr: "Specijalnost", hu: "Szakterület" })} />
          </div>
          <div className="mk-auth-field">
            <span>{L({ uk: "Ваша роль в організації", en: "Your role within the organisation", pl: "Twoja rola w organizacji", de: "Ihre Rolle in der Organisation", ro: "Rolul dumneavoastră în organizație", cs: "Vaše role v organizaci", sr: "Vaša uloga u organizaciji", hu: "Az Ön szerepe a szervezetben" })}</span>
            <AuthSelect value={form.role} onChange={setV("role")} options={ROLES}
              label={L({ uk: "Ваша роль", en: "Your role", pl: "Twoja rola", de: "Ihre Rolle", ro: "Rolul dumneavoastră", cs: "Vaše role", sr: "Vaša uloga", hu: "Az Ön szerepe" })} />
          </div>
          <div className="mk-auth-field">
            <span>{L({ uk: "Країна", en: "Country", pl: "Kraj", de: "Land", ro: "Țara", cs: "Země", sr: "Država", hu: "Ország" })} <em>*</em></span>
            <AuthSelect value={form.country} onChange={setV("country")} options={COUNTRIES}
              label={L({ uk: "Країна", en: "Country", pl: "Kraj", de: "Land", ro: "Țara", cs: "Země", sr: "Država", hu: "Ország" })} />
          </div>
          <label className="mk-auth-field">
            <span>{L({ uk: "Телефон (необов'язково)", en: "Phone number (optional)", pl: "Numer telefonu (opcjonalnie)", de: "Telefonnummer (optional)", ro: "Număr de telefon (opțional)", cs: "Telefonní číslo (nepovinné)", sr: "Broj telefona (opciono)", hu: "Telefonszám (nem kötelező)" })}</span>
            <input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel"
              placeholder="+380 …" />
          </label>
          <label className="mk-auth-consent">
            <input type="checkbox" checked={form.consent} onChange={set("consent")} />
            <span>
              {L({ uk: "Я прочитав(ла) ", en: "I have read the ", pl: "Zapoznałem(-am) się z ", de: "Ich habe die ", ro: "Am citit ", cs: "Přečetl(a) jsem si ", sr: "Pročitao/la sam ", hu: "Elolvastam a " })}
              <a href="#/legal/terms" onClick={(e) => e.stopPropagation()}>{L({ uk: "Умови", en: "Terms", pl: "Regulaminem", de: "Nutzungsbedingungen", ro: "Termenii", cs: "Podmínky", sr: "Uslove korišćenja", hu: "Felhasználási feltételeket" })}</a>
              {L({ uk: " та ", en: " and ", pl: " oraz ", de: " und die ", ro: " și ", cs: " a ", sr: " i ", hu: " és az " })}
              <a href="#/legal/privacy" onClick={(e) => e.stopPropagation()}>{L({ uk: "Політику конфіденційності", en: "Privacy Policy", pl: "Polityką prywatności", de: "Datenschutzerklärung", ro: "Politica de confidențialitate", cs: "Zásady ochrany osobních údajů", sr: "Politiku privatnosti", hu: "Adatvédelmi szabályzatot" })}</a>
              {L({ uk: " і погоджуюсь із ними.", en: " and agree to them.", pl: " i akceptuję je.", de: " gelesen und stimme ihnen zu.", ro: " și sunt de acord cu acestea.", cs: " a souhlasím s nimi.", sr: " i prihvatam ih.", hu: ", és elfogadom őket." })}
            </span>
          </label>
          <button type="submit" className="mk-auth-btn primary" disabled={!acct1Ok}>
            {L({ uk: "Далі", en: "Continue", pl: "Dalej", de: "Weiter", ro: "Continuați", cs: "Pokračovat", sr: "Dalje", hu: "Tovább" })}
          </button>
        </form>
      </Shell>
    );
  }

  /* ── Create account · step 2 (organisation) ───────────────── */
  return (
    <Shell topBack onBack={() => setStep("acct1")}>
      <h1 className="mk-auth-title">{L({ uk: "Розкажіть трохи про себе.", en: "Tell us a bit about yourself.", pl: "Opowiedz nam trochę o sobie.", de: "Erzählen Sie uns etwas über sich.", ro: "Spuneți-ne câteva lucruri despre dumneavoastră.", cs: "Řekněte nám něco o sobě.", sr: "Recite nam nešto o sebi.", hu: "Meséljen egy kicsit magáról." })}</h1>
      <p className="mk-auth-sub">{L({ uk: "Налаштуймо ваш акаунт.", en: "Let's set up your account.", pl: "Skonfigurujmy Twoje konto.", de: "Richten wir Ihr Konto ein.", ro: "Să vă configurăm contul.", cs: "Pojďme nastavit váš účet.", sr: "Hajde da podesimo vaš nalog.", hu: "Állítsuk be a fiókját." })}</p>
      <form className="mk-auth-form" onSubmit={(e) => { e.preventDefault(); if (acct2Ok) setStep("done-acct"); }}>
        <label className="mk-auth-field">
          <span>{L({ uk: "Назва організації", en: "Organisation name", pl: "Nazwa organizacji", de: "Name der Organisation", ro: "Numele organizației", cs: "Název organizace", sr: "Naziv organizacije", hu: "Szervezet neve" })} <em>*</em></span>
          <input value={form.org} onChange={set("org")} autoComplete="organization"
            placeholder={L({ uk: "Міська лікарня №1", en: "City Hospital No. 1", pl: "Szpital Miejski nr 1", de: "Städtisches Krankenhaus Nr. 1", ro: "Spitalul Municipal nr. 1", cs: "Městská nemocnice č. 1", sr: "Gradska bolnica br. 1", hu: "1. sz. Városi Kórház" })} />
        </label>
        <div className="mk-auth-field">
          <span>{L({ uk: "Кількість лікарів у закладі", en: "Number of clinicians in your practice", pl: "Liczba lekarzy w Twojej placówce", de: "Anzahl der Ärzte in Ihrer Einrichtung", ro: "Numărul de medici din unitatea dumneavoastră", cs: "Počet lékařů ve vašem zařízení", sr: "Broj lekara u vašoj ustanovi", hu: "Az intézményében dolgozó orvosok száma" })}</span>
          <div className="mk-auth-pills">
            {SIZES.map((s) => (
              <button type="button" key={s}
                className={`mk-auth-pill${form.size === s ? " is-on" : ""}`}
                onClick={() => setForm((f) => ({ ...f, size: s }))}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="mk-auth-btn primary" disabled={!acct2Ok}>
          {L({ uk: "Далі", en: "Continue", pl: "Dalej", de: "Weiter", ro: "Continuați", cs: "Pokračovat", sr: "Dalje", hu: "Tovább" })}
        </button>
      </form>
    </Shell>
  );
}

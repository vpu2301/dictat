// SignupFlow.jsx — /signup. Heidi-style entry flow.
//
// A single self-contained wizard (no routing churn) with an internal step
// machine. "Sign up" in the marketing nav lands here on a chooser with two
// options — Create account or Book a demo — modelled on heidihealth.com:
//   choose ─┬─▶ acct1 ─▶ acct2 ─▶ done (create account)
//           └─▶ demo  ─────────▶ done (book a demo)
// Styled in the marketing Heidi palette (wrapped in `.lp`, `.mk-auth-*`), so
// the logged-in platform is untouched. This platform is admin-invite-only, so
// this creates no login — it captures a LEAD (api/leads.js → HubSpot) and
// confirms receipt; the account itself arrives as an emailed invite.
//
// What the form asks is therefore a commercial question, not a technical one.
// Two halves, because a lead is two CRM objects:
//
//   step 1 — the PERSON  (Contact): name, email, specialty, role, phone
//   step 2 — the PLACE   (Company): organisation, type, city, size
//
// The organisation is the field this form exists for. Without it, twenty
// doctors signing up from one hospital arrive as twenty unrelated strangers
// instead of one account with twenty people on it — so it is required, and so
// is the type and the city that qualify and territory-map it.
//
// Country is NOT asked. Every lead today is Ukraine; a select with one real
// answer is a row of the form spent on nothing. It is a constant in leads.js,
// which is also where it goes back to being a question when a second market
// opens.
import React, { useState } from "react";
import { Icon } from "../components/UI.jsx";
import { SocialAuthButtons } from "../components/SocialAuth.jsx";
import { submitLead } from "../api/leads.js";
import { submitDemoRequest } from "../api/demo.js";
import { SPECIALTIES, ROLES, ORG_TYPES, SIZES, options } from "./signupOptions.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BACK = { uk: "Назад", en: "Back", pl: "Wstecz", de: "Zurück", ro: "Înapoi", cs: "Zpět", sr: "Nazad", hu: "Vissza", ar: "رجوع", es: "Atrás", pt: "Voltar" };

/* Page chrome — logo, the step's content, a back link above or below it.

   This MUST stay at module scope. It used to be declared inside SignupFlow,
   which gave it a fresh component identity on every render: React saw a
   different type in the same slot, tore the whole subtree down and rebuilt
   it, and the focused input was replaced mid-keystroke. The visible symptom
   was that no field on any step accepted more than one character. */
function Shell({ children, onBack, topBack, lang, onHome }) {
  const L = (m) => m[lang] ?? m.en;
  return (
    <div className="lp mk-auth-shell">
      <div className="mk-auth">
        {topBack && (
          <button className="mk-auth-back is-top" onClick={onBack}>
            <Icon name="arrowLeft" size={16} /> {L(BACK)}
          </button>
        )}
        <a className="mk-auth-logo" href="#/welcome" onClick={(e) => { e.preventDefault(); onHome(); }}>
          <span className="lp-brand-name">Klarnote</span>
        </a>
        {children}
        {!topBack && (
          <button className="mk-auth-back" onClick={onBack}>
            <Icon name="arrowLeft" size={16} /> {L(BACK)}
          </button>
        )}
      </div>
    </div>
  );
}

/* The provider marks and the two buttons moved to components/SocialAuth.jsx.
   The copies that lived here rendered a Google and an Apple button whose
   onClick was `setStep("acct1")` — they advanced this wizard and contacted no
   provider at all. A control that looks like federated sign-in and is not is
   worse than no control: it teaches a user their Google identity is attached
   to an account when nothing of the sort happened. */

/* Designed dropdown — a styled trigger + a custom options panel (the native
   <select> can't have its open list styled). Matches the form's look, with
   hover + selected states, outside-click / Escape to close.

   Options are { value, label } pairs, and `value` is what leaves for the CRM.
   They used to be plain strings, which meant the LABEL was stored — so the same
   cardiologist was filed as "Кардіологія" or "Kardiologie" depending on which
   language they read the form in, and no HubSpot list could find them all.

   There is deliberately no pre-selected option. A required field that arrives
   pre-answered is not a required field: it is a default nobody chose, and it
   was making every untouched form say "General practice · Individual
   practitioner" — the two answers we most need to be true. */
/* Exported so the contact form uses the SAME dropdown (ContentPage.jsx). Two
   public forms with two different select designs is a seam a visitor notices
   even when they cannot name it. */
export function AuthSelect({ value, onChange, opts, label, placeholder, invalid }) {
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
  const current = opts.find((o) => o.value === value);
  return (
    <div className={`mk-auth-select${open ? " is-open" : ""}${invalid ? " is-bad" : ""}`} ref={ref}>
      <button type="button" className="mk-auth-select-btn" aria-haspopup="listbox"
        aria-expanded={open} aria-label={label} aria-invalid={invalid ? "true" : undefined}
        onClick={() => setOpen((o) => !o)}>
        <span className={current ? undefined : "is-ph"}>{current ? current.label : placeholder}</span>
        <Icon name="chevDown" size={16} />
      </button>
      {open && (
        <div className="mk-auth-select-panel" role="listbox">
          {opts.map((o) => (
            <button type="button" key={o.value} role="option" aria-selected={o.value === value}
              className={`mk-auth-select-opt${o.value === value ? " is-sel" : ""}`}
              onClick={() => { onChange(o.value); setOpen(false); }}>
              <span>{o.label}</span>
              {o.value === value && <Icon name="check" size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SignupFlow({ navigate, lang = "en", intent = "" }) {
  const L = (m) => m[lang] ?? m.en;
  // `?intent=demo` starts on the demo form instead of the two-way chooser —
  // for links that have already said which one they mean (the contact form's
  // confirmation). Anything else falls through to the chooser, so a stale or
  // mistyped intent costs nothing.
  const [step, setStep] = useState(intent === "demo" ? "demo" : "choose");

  // Localised picklists. The registries (stable value + eleven labels) live in
  // signupOptions.js so the CRM values can be asserted by a test that never
  // touches React.
  const specialtyOpts = options(SPECIALTIES, lang);
  const roleOpts = options(ROLES, lang);
  const orgTypeOpts = options(ORG_TYPES, lang);
  const sizeOpts = options(SIZES, lang);

  const [form, setForm] = useState({
    // Contact
    firstName: "", lastName: "", email: "", phone: "",
    specialty: "", role: "",
    // Company
    org: "", orgType: "", city: "", size: "",
    // Consent
    consent: false,
  });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  // AuthSelect and the size pills hand back a value, not an event. Clearing the
  // field's error on change is deliberate: an error that survives the fix reads
  // as "still wrong" and sends people hunting for a second mistake.
  const setV = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => (x[k] ? { ...x, [k]: undefined } : x));
  };

  const REQUIRED = L({ uk: "Обов'язкове поле", en: "Required", pl: "Pole wymagane", de: "Pflichtfeld", ro: "Câmp obligatoriu", cs: "Povinné pole", sr: "Obavezno polje", hu: "Kötelező mező", ar: "حقل مطلوب", es: "Campo obligatorio", pt: "Campo obrigatório" });
  const BAD_EMAIL = L({ uk: "Невірна електронна пошта", en: "Enter a valid email", pl: "Podaj prawidłowy adres e-mail", de: "Gültige E-Mail-Adresse eingeben", ro: "Introduceți un e-mail valid", cs: "Zadejte platný e-mail", sr: "Unesite ispravnu e-adresu", hu: "Adjon meg érvényes e-mail-címet", ar: "أدخل بريدًا إلكترونيًا صالحًا", es: "Introduzca un correo válido", pt: "Introduza um e-mail válido" });
  const NEED_CONSENT = L({ uk: "Потрібна згода, щоб продовжити", en: "Consent is required to continue", pl: "Zgoda jest wymagana, aby kontynuować", de: "Zum Fortfahren ist die Zustimmung erforderlich", ro: "Consimțământul este necesar pentru a continua", cs: "Pro pokračování je nutný souhlas", sr: "Saglasnost je obavezna za nastavak", hu: "A folytatáshoz hozzájárulás szükséges", ar: "الموافقة مطلوبة للمتابعة", es: "Se requiere el consentimiento para continuar", pt: "É necessário o consentimento para continuar" });

  // Validated on SUBMIT, not by disabling the button. With seven required
  // fields a dead Continue button is a puzzle — it says something is missing
  // without saying what, and a select the visitor never opened looks filled in.
  const checkPerson = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = REQUIRED;
    if (!form.lastName.trim()) e.lastName = REQUIRED;
    if (!EMAIL_RE.test(form.email.trim())) e.email = BAD_EMAIL;
    if (!form.specialty) e.specialty = REQUIRED;
    if (!form.role) e.role = REQUIRED;
    if (!form.consent) e.consent = NEED_CONSENT;
    return e;
  };
  const checkOrg = () => {
    const e = {};
    if (!form.org.trim()) e.org = REQUIRED;
    if (!form.orgType) e.orgType = REQUIRED;
    if (!form.city.trim()) e.city = REQUIRED;
    return e;
  };

  // The wording the visitor agreed to, stored verbatim in HubSpot's consent
  // record — in the language they actually read, because that is the artefact
  // a regulator asks for.
  const consentText = L({
    uk: "Я прочитав(ла) Умови та Політику конфіденційності і погоджуюсь із ними.",
    en: "I have read the Terms and the Privacy Policy and agree to them.",
    pl: "Zapoznałem(-am) się z Regulaminem i Polityką prywatności i akceptuję je.",
    de: "Ich habe die Nutzungsbedingungen und die Datenschutzerklärung gelesen und stimme ihnen zu.",
    ro: "Am citit Termenii și Politica de confidențialitate și sunt de acord cu acestea.",
    cs: "Přečetl(a) jsem si Podmínky a Zásady ochrany osobních údajů a souhlasím s nimi.",
    sr: "Pročitao/la sam Uslove korišćenja i Politiku privatnosti i prihvatam ih.",
    hu: "Elolvastam a Felhasználási feltételeket és az Adatvédelmi szabályzatot, és elfogadom őket.",
    ar: "لقد قرأت الشروط وسياسة الخصوصية وأوافق عليها.",
    es: "He leído los Términos y la Política de privacidad y los acepto.",
    pt: "Li os Termos e a Política de Privacidade e concordo com eles.",
  });

  // Hand the lead over, then confirm — in that order, but never blocking on the
  // result. A marketing endpoint having a bad minute must not turn a won lead
  // into an error page; `submitLead` reports the failure to the console and the
  // visitor is thanked either way.
  //
  // A demo submission goes to TWO places, in parallel, because they answer two
  // different needs and neither should be able to delay or fail the other:
  //
  //   submitLead        → HubSpot: the CRM record sales works from.
  //   submitDemoRequest → marketing-service: the acknowledgement email with
  //                       the "pick a time" button, and — after they book —
  //                       the confirmation with the slot and the Meet link.
  //
  // `Promise.all` over two calls that both resolve rather than throw: the
  // visitor waits for the slower of the two, not the sum, and a failure in
  // either is a console entry rather than a lost submission.
  //
  // `lang` is what decides which language the emails come back in, so it is
  // passed explicitly — the backend cannot recover the page's language from
  // anything else with the same confidence.
  const finish = async (kind) => {
    setSending(true);
    const pageUri = typeof window !== "undefined" ? window.location.href : "";
    const work = [
      submitLead(
        { ...form, specialty: form.specialty, role: form.role, orgType: form.orgType },
        {
          consentText,
          pageName: kind === "demo" ? "Klarnote — book a demo" : "Klarnote — sign up",
          pageUri,
        },
      ),
    ];
    if (kind === "demo") work.push(submitDemoRequest(form, { lang, pageUri }));
    await Promise.all(work);
    setSending(false);
    setStep(kind === "demo" ? "done-demo" : "done-acct");
  };

  const back = () => navigate("/welcome");

  /* Shared chrome lives at module scope (see Shell above); the two props that
     never change per step are bound once here. */
  const chrome = { lang, onHome: back };

  /* ── Confirmation ─────────────────────────────────────────── */
  if (step === "done-acct" || step === "done-demo") {
    const demo = step === "done-demo";
    return (
      <Shell {...chrome} onBack={back}>
        <div className="mk-auth-done">
          <span className="mk-auth-done-mark"><Icon name="check" size={24} /></span>
          <h1 className="mk-auth-title">{L({ uk: "Готово!", en: "You're all set!", pl: "Wszystko gotowe!", de: "Alles erledigt!", ro: "Totul este gata!", cs: "Vše je hotovo!", sr: "Sve je spremno!", hu: "Minden készen áll!", ar: "كل شيء جاهز!", es: "¡Todo listo!", pt: "Está tudo pronto!" })}</h1>
          <p className="mk-auth-sub">
            {/* The demo path no longer ends in "we'll be in touch" — the
                acknowledgement email is already on its way and it carries
                the button that books the slot. Telling them to wait for a
                call would leave that email unread in an inbox while the
                next step sat inside it. */}
            {demo
              ? L({
                  uk: "Перевірте пошту — ми надіслали лист із посиланням, щоб обрати зручний час для демо.",
                  en: "Check your inbox — we've sent you a link to pick a time for your demo.",
                  pl: "Sprawdź skrzynkę — wysłaliśmy link, aby wybrać termin prezentacji.",
                  de: "Sehen Sie in Ihr Postfach — wir haben Ihnen einen Link geschickt, um einen Termin für Ihre Demo zu wählen.",
                  ro: "Verificați-vă e-mailul — v-am trimis un link pentru a alege ora demonstrației.",
                  cs: "Zkontrolujte e-mail — poslali jsme vám odkaz pro výběr termínu ukázky.",
                  sr: "Proverite e-poštu — poslali smo vam link da izaberete termin za demo.",
                  hu: "Nézze meg a postaládáját — küldtünk egy linket, amellyel időpontot választhat a bemutatóhoz.", ar: "تحقّق من بريدك الإلكتروني — أرسلنا إليك رابطًا لاختيار موعد العرض التوضيحي.", es: "Revise su correo — le hemos enviado un enlace para elegir la hora de su demo.", pt: "Verifique o seu e-mail — enviámos-lhe uma ligação para escolher a hora da sua demonstração.",
                })
              : L({
                  uk: "Дякуємо за реєстрацію. Ми надішлемо запрошення на вашу пошту.",
                  en: "Thanks for signing up. We'll send an invite to your email.",
                  pl: "Dziękujemy za rejestrację. Wyślemy zaproszenie na Twój adres e-mail.",
                  de: "Vielen Dank für Ihre Registrierung. Wir senden Ihnen eine Einladung per E-Mail.",
                  ro: "Mulțumim pentru înregistrare. Vă vom trimite o invitație pe e-mail.",
                  cs: "Děkujeme za registraci. Pozvánku vám zašleme na e-mail.",
                  sr: "Hvala na registraciji. Pozivnicu ćemo poslati na vašu e-adresu.",
                  hu: "Köszönjük a regisztrációt. A meghívót e-mailben küldjük el.", ar: "شكرًا لتسجيلك. سنرسل دعوة إلى بريدك الإلكتروني.", es: "Gracias por registrarse. Le enviaremos una invitación a su correo.", pt: "Obrigado por se registar. Enviaremos um convite para o seu e-mail.",
                })}
          </p>
        </div>
        <button className="mk-auth-btn primary" onClick={() => navigate("/login")}>
          {L({ uk: "До входу", en: "Go to sign in", pl: "Przejdź do logowania", de: "Zur Anmeldung", ro: "Mergi la autentificare", cs: "Přejít na přihlášení", sr: "Idi na prijavu", hu: "Tovább a bejelentkezéshez", ar: "الذهاب إلى تسجيل الدخول", es: "Ir a iniciar sesión", pt: "Ir para o início de sessão" })}
        </button>
      </Shell>
    );
  }

  /* ── Chooser ──────────────────────────────────────────────── */
  if (step === "choose") {
    return (
      <Shell {...chrome} onBack={back}>
        <h1 className="mk-auth-title">{L({ uk: "Реєстрація", en: "Sign up", pl: "Rejestracja", de: "Registrieren", ro: "Înregistrare", cs: "Registrace", sr: "Registracija", hu: "Regisztráció", ar: "التسجيل", es: "Registrarse", pt: "Registar-se" })}</h1>
        <p className="mk-auth-sub">{L({ uk: "Оберіть, з чого почати.", en: "Choose how you'd like to start.", pl: "Wybierz, jak chcesz zacząć.", de: "Wählen Sie, wie Sie beginnen möchten.", ro: "Alegeți cum doriți să începeți.", cs: "Vyberte, jak chcete začít.", sr: "Izaberite kako želite da počnete.", hu: "Válassza ki, hogyan szeretne kezdeni.", ar: "اختر كيف تريد أن تبدأ.", es: "Elija cómo quiere empezar.", pt: "Escolha como quer começar." })}</p>
        <div className="mk-auth-choose">
          <button className="mk-auth-opt" onClick={() => setStep("acct1")}>
            <span className="mk-auth-opt-ic"><Icon name="user" size={20} /></span>
            <span className="mk-auth-opt-txt">
              <span className="mk-auth-opt-t">{L({ uk: "Створити акаунт", en: "Create account", pl: "Utwórz konto", de: "Konto erstellen", ro: "Creați cont", cs: "Vytvořit účet", sr: "Napravite nalog", hu: "Fiók létrehozása", ar: "إنشاء حساب", es: "Crear una cuenta", pt: "Criar conta" })}</span>
              <span className="mk-auth-opt-d">{L({ uk: "Налаштуйте акаунт Klarnote для вашої практики.", en: "Set up your Klarnote account.", pl: "Skonfiguruj swoje konto Klarnote.", de: "Richten Sie Ihr Klarnote-Konto ein.", ro: "Configurați-vă contul Klarnote.", cs: "Nastavte si svůj účet Klarnote.", sr: "Podesite svoj Klarnote nalog.", hu: "Állítsa be Klarnote-fiókját.", ar: "قم بإعداد حساب Klarnote الخاص بك.", es: "Configure su cuenta de Klarnote.", pt: "Configure a sua conta Klarnote." })}</span>
            </span>
            <Icon name="arrowRight" size={17} />
          </button>
          <button className="mk-auth-opt" onClick={() => setStep("demo")}>
            <span className="mk-auth-opt-ic"><Icon name="calendar" size={20} /></span>
            <span className="mk-auth-opt-txt">
              <span className="mk-auth-opt-t">{L({ uk: "Замовити демо", en: "Book a demo", pl: "Umów prezentację", de: "Demo buchen", ro: "Programați o demonstrație", cs: "Objednat ukázku", sr: "Zakažite demo", hu: "Bemutató foglalása", ar: "احجز عرضًا توضيحيًا", es: "Reservar una demo", pt: "Marcar uma demonstração" })}</span>
              <span className="mk-auth-opt-d">{L({ uk: "Подивіться Klarnote разом із нашою командою.", en: "See Klarnote with our team.", pl: "Zobacz Klarnote z naszym zespołem.", de: "Erleben Sie Klarnote mit unserem Team.", ro: "Descoperiți Klarnote împreună cu echipa noastră.", cs: "Prohlédněte si Klarnote s naším týmem.", sr: "Pogledajte Klarnote sa našim timom.", hu: "Ismerje meg a Klarnote-ot csapatunkkal.", ar: "استكشف Klarnote مع فريقنا.", es: "Conozca Klarnote con nuestro equipo.", pt: "Conheça o Klarnote com a nossa equipa." })}</span>
            </span>
            <Icon name="arrowRight" size={17} />
          </button>
        </div>

        {/* Federated sign-in, on the step a visitor actually lands on. It used
            to sit on the "book a demo" form, where two buttons offering to
            continue with Google stood beside a field asking for a work email so
            a salesperson could call — identity had nothing to do with it.

            "Continue with", not "Sign up with": this platform is invite-only
            (services.js, ACCESS_REQUEST_EMAIL), so the provider proves who you
            are and we look you up. Someone with no account comes back
            `no_account`, and /login offers them the request-access form. */}
        <SocialAuthButtons lang={lang} />
      </Shell>
    );
  }

  /* ── Book a demo ──────────────────────────────────────────── */
  if (step === "demo") {
    return (
      <Shell {...chrome} onBack={() => setStep("choose")}>
        <h1 className="mk-auth-title">{L({ uk: "Замовити демо", en: "Book a demo", pl: "Umów prezentację", de: "Demo buchen", ro: "Programați o demonstrație", cs: "Objednat ukázku", sr: "Zakažite demo", hu: "Bemutató foglalása", ar: "احجز عرضًا توضيحيًا", es: "Reservar una demo", pt: "Marcar uma demonstração" })}</h1>
        <p className="mk-auth-sub">{L({ uk: "Демо з нашою командою.", en: "Book a demo with our team.", pl: "Umów prezentację z naszym zespołem.", de: "Buchen Sie eine Demo mit unserem Team.", ro: "Programați o demonstrație cu echipa noastră.", cs: "Objednejte si ukázku s naším týmem.", sr: "Zakažite demo sa našim timom.", hu: "Foglaljon bemutatót csapatunkkal.", ar: "احجز عرضًا توضيحيًا مع فريقنا.", es: "Reserve una demo con nuestro equipo.", pt: "Marque uma demonstração com a nossa equipa." })}</p>
        <form className="mk-auth-form" noValidate onSubmit={(e) => {
          e.preventDefault();
          if (!EMAIL_RE.test(form.email.trim())) { setErrors({ email: BAD_EMAIL }); return; }
          finish("demo");
        }}>
          <label className="mk-auth-field">
            <span>{L({ uk: "Робоча електронна пошта", en: "Work email", pl: "Służbowy adres e-mail", de: "Geschäftliche E-Mail", ro: "E-mail de serviciu", cs: "Pracovní e-mail", sr: "Poslovna e-adresa", hu: "Munkahelyi e-mail", ar: "البريد الإلكتروني للعمل", es: "Correo profesional", pt: "E-mail profissional" })}</span>
            <span className="mk-auth-input-wrap">
              <Icon name="inbox" size={16} />
              <input type="email" value={form.email} onChange={set("email")}
                placeholder="name@organisation.com" autoComplete="email"
                aria-invalid={errors.email ? "true" : undefined} />
            </span>
            {errors.email && <em className="mk-auth-err">{errors.email}</em>}
          </label>
          <button type="submit" className="mk-auth-btn primary" disabled={sending}>
            {L({ uk: "Далі", en: "Continue", pl: "Dalej", de: "Weiter", ro: "Continuați", cs: "Pokračovat", sr: "Dalje", hu: "Tovább", ar: "متابعة", es: "Continuar", pt: "Continuar" })}
          </button>
        </form>
      </Shell>
    );
  }

  /* ── Create account · step 1 (about you) ──────────────────── */
  if (step === "acct1") {
    return (
      <Shell {...chrome} onBack={() => setStep("choose")}>
        <h1 className="mk-auth-title">{L({ uk: "Розкажіть трохи про себе.", en: "Tell us a bit about yourself.", pl: "Opowiedz nam trochę o sobie.", de: "Erzählen Sie uns etwas über sich.", ro: "Spuneți-ne câteva lucruri despre dumneavoastră.", cs: "Řekněte nám něco o sobě.", sr: "Recite nam nešto o sebi.", hu: "Meséljen egy kicsit magáról.", ar: "أخبرنا قليلاً عن نفسك.", es: "Cuéntenos un poco sobre usted.", pt: "Fale-nos um pouco sobre si." })}</h1>
        <p className="mk-auth-sub">{L({ uk: "Налаштуймо ваш акаунт.", en: "Let's set up your account.", pl: "Skonfigurujmy Twoje konto.", de: "Richten wir Ihr Konto ein.", ro: "Să vă configurăm contul.", cs: "Pojďme nastavit váš účet.", sr: "Hajde da podesimo vaš nalog.", hu: "Állítsuk be a fiókját.", ar: "لنقم بإعداد حسابك.", es: "Vamos a configurar su cuenta.", pt: "Vamos configurar a sua conta." })}</p>
        <form className="mk-auth-form" noValidate onSubmit={(e) => {
          e.preventDefault();
          const bad = checkPerson();
          setErrors(bad);
          if (!Object.keys(bad).length) setStep("acct2");
        }}>
          <div className="mk-auth-row">
            <label className="mk-auth-field">
              <span>{L({ uk: "Ім'я", en: "First name", pl: "Imię", de: "Vorname", ro: "Prenume", cs: "Jméno", sr: "Ime", hu: "Keresztnév", ar: "الاسم الأول", es: "Nombre", pt: "Nome próprio" })} <em>*</em></span>
              <input value={form.firstName} onChange={set("firstName")} autoComplete="given-name"
                aria-invalid={errors.firstName ? "true" : undefined} />
              {errors.firstName && <em className="mk-auth-err">{errors.firstName}</em>}
            </label>
            <label className="mk-auth-field">
              <span>{L({ uk: "Прізвище", en: "Last name", pl: "Nazwisko", de: "Nachname", ro: "Nume", cs: "Příjmení", sr: "Prezime", hu: "Vezetéknév", ar: "اسم العائلة", es: "Apellidos", pt: "Apelido" })} <em>*</em></span>
              <input value={form.lastName} onChange={set("lastName")} autoComplete="family-name"
                aria-invalid={errors.lastName ? "true" : undefined} />
              {errors.lastName && <em className="mk-auth-err">{errors.lastName}</em>}
            </label>
          </div>

          {/* The CRM key, and the address the invite is sent to. It was missing
              from this path entirely — the only email field lived on the demo
              branch — so a completed sign-up left us with a name and a hospital
              and no way to reach either. */}
          <label className="mk-auth-field">
            <span>{L({ uk: "Робоча електронна пошта", en: "Work email", pl: "Służbowy adres e-mail", de: "Geschäftliche E-Mail", ro: "E-mail de serviciu", cs: "Pracovní e-mail", sr: "Poslovna e-adresa", hu: "Munkahelyi e-mail", ar: "البريد الإلكتروني للعمل", es: "Correo profesional", pt: "E-mail profissional" })} <em>*</em></span>
            <span className="mk-auth-input-wrap">
              <Icon name="inbox" size={16} />
              <input type="email" value={form.email} onChange={set("email")} autoComplete="email"
                placeholder="name@organisation.com"
                aria-invalid={errors.email ? "true" : undefined} />
            </span>
            {errors.email && <em className="mk-auth-err">{errors.email}</em>}
          </label>

          <div className="mk-auth-field">
            <span>{L({ uk: "Спеціальність", en: "Specialty", pl: "Specjalizacja", de: "Fachrichtung", ro: "Specialitate", cs: "Specializace", sr: "Specijalnost", hu: "Szakterület", ar: "التخصص", es: "Especialidad", pt: "Especialidade" })} <em>*</em></span>
            <AuthSelect value={form.specialty} onChange={setV("specialty")} opts={specialtyOpts}
              label={L({ uk: "Спеціальність", en: "Specialty", pl: "Specjalizacja", de: "Fachrichtung", ro: "Specialitate", cs: "Specializace", sr: "Specijalnost", hu: "Szakterület", ar: "التخصص", es: "Especialidad", pt: "Especialidade" })} placeholder={L({ uk: "Оберіть…", en: "Select…", pl: "Wybierz…", de: "Auswählen…", ro: "Selectați…", cs: "Vyberte…", sr: "Izaberite…", hu: "Válasszon…", ar: "اختر…", es: "Seleccione…", pt: "Selecione…" })}
              invalid={!!errors.specialty} />
            {errors.specialty && <em className="mk-auth-err">{errors.specialty}</em>}
          </div>

          <div className="mk-auth-field">
            <span>{L({ uk: "Ваша роль в організації", en: "Your role within the organisation", pl: "Twoja rola w organizacji", de: "Ihre Rolle in der Organisation", ro: "Rolul dumneavoastră în organizație", cs: "Vaše role v organizaci", sr: "Vaša uloga u organizaciji", hu: "Az Ön szerepe a szervezetben", ar: "دورك داخل المؤسسة", es: "Su función dentro de la organización", pt: "A sua função dentro da organização" })} <em>*</em></span>
            <AuthSelect value={form.role} onChange={setV("role")} opts={roleOpts}
              label={L({ uk: "Ваша роль в організації", en: "Your role within the organisation", pl: "Twoja rola w organizacji", de: "Ihre Rolle in der Organisation", ro: "Rolul dumneavoastră în organizație", cs: "Vaše role v organizaci", sr: "Vaša uloga u organizaciji", hu: "Az Ön szerepe a szervezetben", ar: "دورك داخل المؤسسة", es: "Su función dentro de la organización", pt: "A sua função dentro da organização" })} placeholder={L({ uk: "Оберіть…", en: "Select…", pl: "Wybierz…", de: "Auswählen…", ro: "Selectați…", cs: "Vyberte…", sr: "Izaberite…", hu: "Válasszon…", ar: "اختر…", es: "Seleccione…", pt: "Selecione…" })}
              invalid={!!errors.role} />
            {errors.role && <em className="mk-auth-err">{errors.role}</em>}
          </div>

          {/* Country is not asked — see the file header. */}

          <label className="mk-auth-field">
            <span>{L({ uk: "Телефон (необов'язково)", en: "Phone number (optional)", pl: "Numer telefonu (opcjonalnie)", de: "Telefonnummer (optional)", ro: "Număr de telefon (opțional)", cs: "Telefonní číslo (nepovinné)", sr: "Broj telefona (opciono)", hu: "Telefonszám (nem kötelező)", ar: "رقم الهاتف (اختياري)", es: "Teléfono (opcional)", pt: "Telefone (opcional)" })}</span>
            <input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel"
              placeholder="+380 …" />
          </label>

          <label className="mk-auth-consent">
            <input type="checkbox" checked={form.consent} onChange={set("consent")}
              aria-invalid={errors.consent ? "true" : undefined} />
            <span>
              {L({ uk: "Я прочитав(ла) ", en: "I have read the ", pl: "Zapoznałem(-am) się z ", de: "Ich habe die ", ro: "Am citit ", cs: "Přečetl(a) jsem si ", sr: "Pročitao/la sam ", hu: "Elolvastam a ", ar: "لقد قرأت ", es: "He leído los ", pt: "Li os " })}
              <a href="#/legal/terms" onClick={(e) => e.stopPropagation()}>{L({ uk: "Умови", en: "Terms", pl: "Regulaminem", de: "Nutzungsbedingungen", ro: "Termenii", cs: "Podmínky", sr: "Uslove korišćenja", hu: "Felhasználási feltételeket", ar: "الشروط", es: "Términos", pt: "Termos" })}</a>
              {L({ uk: " та ", en: " and ", pl: " oraz ", de: " und die ", ro: " și ", cs: " a ", sr: " i ", hu: " és az ", ar: " و ", es: " y la ", pt: " e a " })}
              <a href="#/legal/privacy" onClick={(e) => e.stopPropagation()}>{L({ uk: "Політику конфіденційності", en: "Privacy Policy", pl: "Polityką prywatności", de: "Datenschutzerklärung", ro: "Politica de confidențialitate", cs: "Zásady ochrany osobních údajů", sr: "Politiku privatnosti", hu: "Adatvédelmi szabályzatot", ar: "سياسة الخصوصية", es: "Política de privacidad", pt: "Política de Privacidade" })}</a>
              {L({ uk: " і погоджуюсь із ними.", en: " and agree to them.", pl: " i akceptuję je.", de: " gelesen und stimme ihnen zu.", ro: " și sunt de acord cu acestea.", cs: " a souhlasím s nimi.", sr: " i prihvatam ih.", hu: ", és elfogadom őket.", ar: " وأوافق عليها.", es: " y los acepto.", pt: " e concordo com eles." })}
            </span>
          </label>
          {errors.consent && <em className="mk-auth-err">{errors.consent}</em>}

          <button type="submit" className="mk-auth-btn primary">
            {L({ uk: "Далі", en: "Continue", pl: "Dalej", de: "Weiter", ro: "Continuați", cs: "Pokračovat", sr: "Dalje", hu: "Tovább", ar: "متابعة", es: "Continuar", pt: "Continuar" })}
          </button>
        </form>
      </Shell>
    );
  }

  /* ── Create account · step 2 (organisation) ───────────────── */
  return (
    <Shell {...chrome} topBack onBack={() => setStep("acct1")}>
      {/* Step 2 is about the PLACE, not the person — asking "tell us about
          yourself" over a form that wants a hospital name reads as a page that
          did not advance. */}
      <h1 className="mk-auth-title">{L({ uk: "Де ви працюєте?", en: "Where do you work?", pl: "Gdzie pracujesz?", de: "Wo arbeiten Sie?", ro: "Unde lucrați?", cs: "Kde pracujete?", sr: "Gde radite?", hu: "Hol dolgozik?", ar: "أين تعمل؟", es: "¿Dónde trabaja?", pt: "Onde trabalha?" })}</h1>
      <p className="mk-auth-sub">{L({ uk: "Це зв'яже вас із колегами з вашого закладу.", en: "This links you to your colleagues at the same organisation.", pl: "To połączy Cię ze współpracownikami z tej samej placówki.", de: "Das verbindet Sie mit Ihren Kolleginnen und Kollegen derselben Einrichtung.", ro: "Astfel veți fi asociat cu colegii din aceeași unitate.", cs: "Tím vás propojíme s kolegy ze stejného zařízení.", sr: "Time vas povezujemo sa kolegama iz iste ustanove.", hu: "Így kapcsoljuk Önt ugyanazon intézmény kollégáihoz.", ar: "يربطك هذا بزملائك في المؤسسة نفسها.", es: "Así le vinculamos con sus colegas del mismo centro.", pt: "Assim ligamo-lo aos seus colegas da mesma instituição." })}</p>
      <form className="mk-auth-form" noValidate onSubmit={(e) => {
        e.preventDefault();
        const bad = checkOrg();
        setErrors(bad);
        if (!Object.keys(bad).length) finish("account");
      }}>
        {/* The field this form exists for. Everything else on this step
            qualifies the company it names. */}
        <label className="mk-auth-field">
          <span>{L({ uk: "Клініка / організація", en: "Clinic / organisation", pl: "Klinika / organizacja", de: "Klinik / Organisation", ro: "Clinică / organizație", cs: "Klinika / organizace", sr: "Klinika / organizacija", hu: "Klinika / szervezet", ar: "العيادة / المؤسسة", es: "Clínica / organización", pt: "Clínica / organização" })} <em>*</em></span>
          <input value={form.org} onChange={set("org")} autoComplete="organization"
            aria-invalid={errors.org ? "true" : undefined}
            placeholder={L({ uk: "Міська лікарня №1", en: "City Hospital No. 1", pl: "Szpital Miejski nr 1", de: "Städtisches Krankenhaus Nr. 1", ro: "Spitalul Municipal nr. 1", cs: "Městská nemocnice č. 1", sr: "Gradska bolnica br. 1", hu: "1. sz. Városi Kórház", ar: "مستشفى المدينة رقم 1", es: "Hospital Municipal n.º 1", pt: "Hospital Municipal n.º 1" })} />
          {errors.org && <em className="mk-auth-err">{errors.org}</em>}
        </label>

        <div className="mk-auth-field">
          <span>{L({ uk: "Тип закладу", en: "Organisation type", pl: "Typ placówki", de: "Art der Einrichtung", ro: "Tipul organizației", cs: "Typ zařízení", sr: "Tip ustanove", hu: "Intézmény típusa", ar: "نوع المؤسسة", es: "Tipo de organización", pt: "Tipo de organização" })} <em>*</em></span>
          <AuthSelect value={form.orgType} onChange={setV("orgType")} opts={orgTypeOpts}
            label={L({ uk: "Тип закладу", en: "Organisation type", pl: "Typ placówki", de: "Art der Einrichtung", ro: "Tipul organizației", cs: "Typ zařízení", sr: "Tip ustanove", hu: "Intézmény típusa", ar: "نوع المؤسسة", es: "Tipo de organización", pt: "Tipo de organização" })} placeholder={L({ uk: "Оберіть…", en: "Select…", pl: "Wybierz…", de: "Auswählen…", ro: "Selectați…", cs: "Vyberte…", sr: "Izaberite…", hu: "Válasszon…", ar: "اختر…", es: "Seleccione…", pt: "Selecione…" })}
            invalid={!!errors.orgType} />
          {errors.orgType && <em className="mk-auth-err">{errors.orgType}</em>}
        </div>

        {/* Territory, and the thing that tells two "Central Hospital"s apart. */}
        <label className="mk-auth-field">
          <span>{L({ uk: "Місто", en: "City", pl: "Miasto", de: "Stadt", ro: "Oraș", cs: "Město", sr: "Grad", hu: "Város", ar: "المدينة", es: "Ciudad", pt: "Cidade" })} <em>*</em></span>
          <input value={form.city} onChange={set("city")} autoComplete="address-level2"
            aria-invalid={errors.city ? "true" : undefined}
            placeholder={L({ uk: "Київ", en: "Kyiv", pl: "Kijów", de: "Kyjiw", ro: "Kiev", cs: "Kyjev", sr: "Kijev", hu: "Kijev", ar: "كييف", es: "Kiev", pt: "Kiev" })} />
          {errors.city && <em className="mk-auth-err">{errors.city}</em>}
        </label>

        <div className="mk-auth-field">
          <span>{L({ uk: "Кількість лікарів у закладі", en: "Number of clinicians in your practice", pl: "Liczba lekarzy w Twojej placówce", de: "Anzahl der Ärzte in Ihrer Einrichtung", ro: "Numărul de medici din unitatea dumneavoastră", cs: "Počet lékařů ve vašem zařízení", sr: "Broj lekara u vašoj ustanovi", hu: "Az intézményében dolgozó orvosok száma", ar: "عدد الأطباء في منشأتك", es: "Número de profesionales en su centro", pt: "Número de profissionais no seu centro" })}</span>
          <div className="mk-auth-pills">
            {sizeOpts.map((o) => (
              <button type="button" key={o.value}
                className={`mk-auth-pill${form.size === o.value ? " is-on" : ""}`}
                aria-pressed={form.size === o.value}
                onClick={() => setV("size")(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className="mk-auth-btn primary" disabled={sending}>
          {sending
            ? L({ uk: "Надсилання…", en: "Sending…", pl: "Wysyłanie…", de: "Senden…", ro: "Se trimite…", cs: "Odesílání…", sr: "Slanje…", hu: "Küldés…", ar: "جارٍ الإرسال…", es: "Enviando…", pt: "A enviar…" })
            : L({ uk: "Готово", en: "Finish", pl: "Zakończ", de: "Fertig", ro: "Finalizați", cs: "Dokončit", sr: "Završi", hu: "Befejezés", ar: "إنهاء", es: "Finalizar", pt: "Concluir" })}
        </button>
      </form>
    </Shell>
  );
}

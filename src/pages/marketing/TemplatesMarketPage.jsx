// TemplatesMarketPage.jsx — Public templates marketplace (/templates,
// /templates/:slug).
//
// Two views behind one component: a searchable, category-filtered gallery of
// medical note templates, and a detail page that shows the template's section
// structure with an example of what each section reads like once dictated.
//
// Marketing surface only — the catalogue is static content from templates.js.
// The signed-in template library (clone/edit/deprecate against the report
// service) is components/TemplatesPage.jsx and is unrelated to this file.
import React, { useMemo, useRef, useState } from "react";
import { Icon, Empty } from "../../components/UI.jsx";
import { TemplateSearchModal } from "./TemplateSearchModal.jsx";
import { MarketingShell } from "./MarketingShell.jsx";
import {
  TEMPLATES, TEMPLATE_CATEGORIES, getTemplate, categoryLabel,
  searchTemplates, relatedTemplates,
} from "./templates.js";

const S = {
  eyebrow:   { uk: "Шаблони", en: "Templates", pl: "Szablony", de: "Vorlagen", ro: "Șabloane", cs: "Šablony", sr: "Šabloni", hu: "Sablonok", ar: "القوالب", es: "Plantillas", pt: "Modelos" },
  title:     { uk: "Бібліотека медичних шаблонів", en: "The medical template library", pl: "Biblioteka szablonów medycznych", de: "Die medizinische Vorlagenbibliothek", ro: "Biblioteca de șabloane medicale", cs: "Knihovna lékařských šablon", sr: "Biblioteka medicinskih šablona", hu: "Orvosi sablonkönyvtár", ar: "مكتبة القوالب الطبية", es: "La biblioteca de plantillas médicas", pt: "A biblioteca de modelos médicos" },
  sub:       { uk: "Готові структури документів для десятків спеціальностей. Ви диктуєте — Klarnote розкладає сказане по розділах шаблону.", en: "Ready-made document structures for dozens of specialties. You dictate; Klarnote lays your words out into the template's sections.", pl: "Gotowe struktury dokumentów dla dziesiątek specjalności. Ty dyktujesz, Klarnote układa treść w sekcje szablonu.", de: "Fertige Dokumentstrukturen für Dutzende Fachrichtungen. Sie diktieren, Klarnote ordnet das Gesagte den Abschnitten zu.", ro: "Structuri de documente gata făcute pentru zeci de specialități. Dictați, iar Klarnote distribuie textul în secțiunile șablonului.", cs: "Hotové struktury dokumentů pro desítky odborností. Vy diktujete, Klarnote rozdělí řečené do sekcí šablony.", sr: "Gotove strukture dokumenata za desetine specijalnosti. Vi diktirate, Klarnote raspoređuje rečeno po sekcijama šablona.", hu: "Kész dokumentumszerkezetek tucatnyi szakterületre. Ön diktál, a Klarnote a sablon szakaszaiba rendezi a szöveget.", ar: "هياكل مستندات جاهزة لعشرات التخصصات. أنت تُملي، وKlarnote يوزّع كلماتك على أقسام القالب.", es: "Estructuras de documento listas para usar para decenas de especialidades. Usted dicta; Klarnote coloca sus palabras en las secciones de la plantilla.", pt: "Estruturas de documento prontas a usar para dezenas de especialidades. Você dita; o Klarnote coloca as suas palavras nas secções do modelo." },
  search:    { uk: "Пошук шаблонів…", en: "Search templates…", pl: "Szukaj szablonów…", de: "Vorlagen suchen…", ro: "Căutați șabloane…", cs: "Hledat šablony…", sr: "Pretraga šablona…", hu: "Sablonok keresése…", ar: "البحث في القوالب…", es: "Buscar plantillas…", pt: "Pesquisar modelos…" },
  all:       { uk: "Усі", en: "All", pl: "Wszystkie", de: "Alle", ro: "Toate", cs: "Vše", sr: "Sve", hu: "Összes", ar: "الكل", es: "Todas", pt: "Todos" },
  popular:   { uk: "Популярний", en: "Popular", pl: "Popularny", de: "Beliebt", ro: "Popular", cs: "Oblíbené", sr: "Popularno", hu: "Népszerű", ar: "شائع", es: "Populares", pt: "Populares" },
  sections:  { uk: "розділів", en: "sections", pl: "sekcji", de: "Abschnitte", ro: "secțiuni", cs: "sekcí", sr: "sekcija", hu: "szakasz", ar: "أقسام", es: "secciones", pt: "secções" },
  fields:    { uk: "полів", en: "fields", pl: "pól", de: "Felder", ro: "câmpuri", cs: "polí", sr: "polja", hu: "mező", ar: "حقول", es: "campos", pt: "campos" },
  saves:     { uk: "хв на запис", en: "min per note", pl: "min na notatkę", de: "Min. pro Notiz", ro: "min pe notă", cs: "min na záznam", sr: "min po zapisu", hu: "perc jegyzetenként", ar: "دقيقة لكل مذكرة", es: "min por nota", pt: "min por nota" },
  view:      { uk: "Переглянути шаблон", en: "View template", pl: "Zobacz szablon", de: "Vorlage ansehen", ro: "Vedeți șablonul", cs: "Zobrazit šablonu", sr: "Pogledaj šablon", hu: "Sablon megtekintése", ar: "عرض القالب", es: "Ver la plantilla", pt: "Ver o modelo" },
  back:      { uk: "Усі шаблони", en: "All templates", pl: "Wszystkie szablony", de: "Alle Vorlagen", ro: "Toate șabloanele", cs: "Všechny šablony", sr: "Svi šabloni", hu: "Összes sablon", ar: "جميع القوالب", es: "Todas las plantillas", pt: "Todos os modelos" },
  /* `count` labels the static hero stat; `found` labels the live result count. */
  count:     { uk: "шаблонів", en: "templates", pl: "szablonów", de: "Vorlagen", ro: "șabloane", cs: "šablon", sr: "šablona", hu: "sablon", ar: "قوالب", es: "plantillas", pt: "modelos" },
  found:     { uk: "шаблонів знайдено", en: "templates found", pl: "znalezionych szablonów", de: "Vorlagen gefunden", ro: "șabloane găsite", cs: "nalezených šablon", sr: "pronađenih šablona", hu: "találat", ar: "قوالب موجودة", es: "plantillas encontradas", pt: "modelos encontrados" },
  none:      { uk: "Нічого не знайдено", en: "No templates found", pl: "Nie znaleziono szablonów", de: "Keine Vorlagen gefunden", ro: "Niciun șablon găsit", cs: "Nenalezeny žádné šablony", sr: "Nema pronađenih šablona", hu: "Nincs találat", ar: "لم يتم العثور على قوالب", es: "No se encontraron plantillas", pt: "Não foram encontrados modelos" },
  noneBody:  { uk: "Спробуйте іншу спеціальність або інший запит. Потрібного шаблона немає — ми зберемо його під вашу практику.", en: "Try another specialty or a different term. If the template you need is missing, we'll build it around your practice.", pl: "Spróbuj innej specjalności lub innego hasła. Jeśli brakuje potrzebnego szablonu — zbudujemy go pod Twoją praktykę.", de: "Versuchen Sie eine andere Fachrichtung oder einen anderen Begriff. Fehlt Ihre Vorlage, bauen wir sie für Ihre Praxis.", ro: "Încercați altă specialitate sau alt termen. Dacă lipsește șablonul de care aveți nevoie, îl construim pentru practica dvs.", cs: "Zkuste jinou odbornost nebo jiný výraz. Pokud potřebná šablona chybí, sestavíme ji na míru vaší praxi.", sr: "Pokušajte drugu specijalnost ili drugi pojam. Ako nedostaje šablon koji vam treba, napravićemo ga za vašu praksu.", hu: "Próbáljon másik szakterületet vagy kifejezést. Ha hiányzik a szükséges sablon, megépítjük az Ön praxisára.", ar: "جرّب تخصصًا آخر أو مصطلحًا مختلفًا. إذا كان القالب الذي تحتاجه غير موجود، فسنبنيه ليناسب ممارستك.", es: "Pruebe con otra especialidad u otro término. Si falta la plantilla que necesita, la construimos a la medida de su práctica.", pt: "Experimente outra especialidade ou outro termo. Se faltar o modelo de que precisa, construímo-lo à medida da sua prática." },
  /* ── Search palette (TemplateSearchModal.jsx) ── */
  close:     { uk: "Закрити", en: "Close", pl: "Zamknij", de: "Schließen", ro: "Închideți", cs: "Zavřít", sr: "Zatvori", hu: "Bezárás", ar: "إغلاق", es: "Cerrar", pt: "Fechar" },
  suggested: { uk: "Популярні шаблони", en: "Popular templates", pl: "Popularne szablony", de: "Beliebte Vorlagen", ro: "Șabloane populare", cs: "Oblíbené šablony", sr: "Popularni šabloni", hu: "Népszerű sablonok", ar: "القوالب الشائعة", es: "Plantillas populares", pt: "Modelos populares" },
  hintMove:  { uk: "перехід", en: "to move", pl: "nawigacja", de: "navigieren", ro: "navigare", cs: "pohyb", sr: "kretanje", hu: "mozgás", ar: "للتنقل", es: "moverse", pt: "navegar" },
  hintOpen:  { uk: "відкрити", en: "to open", pl: "otwórz", de: "öffnen", ro: "deschideți", cs: "otevřít", sr: "otvori", hu: "megnyitás", ar: "للفتح", es: "abrir", pt: "abrir" },
  hintClose: { uk: "закрити", en: "to close", pl: "zamknij", de: "schließen", ro: "închideți", cs: "zavřít", sr: "zatvori", hu: "bezárás", ar: "للإغلاق", es: "cerrar", pt: "fechar" },
  clear:     { uk: "Скинути фільтри", en: "Clear filters", pl: "Wyczyść filtry", de: "Filter zurücksetzen", ro: "Resetați filtrele", cs: "Zrušit filtry", sr: "Poništi filtere", hu: "Szűrők törlése", ar: "مسح عوامل التصفية", es: "Borrar los filtros", pt: "Limpar os filtros" },
  about:     { uk: "Про шаблон", en: "About this template", pl: "O tym szablonie", de: "Über diese Vorlage", ro: "Despre acest șablon", cs: "O této šabloně", sr: "O ovom šablonu", hu: "A sablonról", ar: "حول هذا القالب", es: "Sobre esta plantilla", pt: "Sobre este modelo" },
  bestFor:   { uk: "Кому підходить", en: "Best for", pl: "Dla kogo", de: "Geeignet für", ro: "Potrivit pentru", cs: "Vhodné pro", sr: "Najbolje za", hu: "Kinek ajánljuk", ar: "الأنسب لـ", es: "Ideal para", pt: "Ideal para" },
  structure: { uk: "Структура документа", en: "What the note looks like", pl: "Jak wygląda notatka", de: "So sieht die Notiz aus", ro: "Cum arată nota", cs: "Jak záznam vypadá", sr: "Kako zapis izgleda", hu: "Így néz ki a jegyzet", ar: "كيف تبدو المذكرة", es: "Así queda la nota", pt: "Como fica a nota" },
  structSub: { uk: "Приклад того, як Klarnote розкладає продиктоване по розділах. Текст навчальний і не містить даних пацієнтів.", en: "An example of how Klarnote lays dictation out section by section. The text is illustrative and contains no patient data.", pl: "Przykład, jak Klarnote rozkłada dyktowanie na sekcje. Tekst jest poglądowy i nie zawiera danych pacjentów.", de: "Ein Beispiel, wie Klarnote das Diktat Abschnitt für Abschnitt gliedert. Der Text ist illustrativ und enthält keine Patientendaten.", ro: "Un exemplu despre cum Klarnote structurează dictarea pe secțiuni. Textul este ilustrativ și nu conține date ale pacienților.", cs: "Ukázka, jak Klarnote člení diktát po sekcích. Text je ilustrativní a neobsahuje data pacientů.", sr: "Primer kako Klarnote raspoređuje diktat po sekcijama. Tekst je ilustrativan i ne sadrži podatke pacijenata.", hu: "Példa arra, hogyan tagolja a Klarnote a diktálást szakaszokra. A szöveg illusztratív, betegadatot nem tartalmaz.", ar: "مثال على كيفية توزيع Klarnote للإملاء قسمًا تلو الآخر. النص توضيحي ولا يحتوي على بيانات المرضى.", es: "Un ejemplo de cómo Klarnote distribuye el dictado sección por sección. El texto es ilustrativo y no contiene datos de pacientes.", pt: "Um exemplo de como o Klarnote distribui o ditado secção a secção. O texto é ilustrativo e não contém dados de doentes." },
  sample:    { uk: "Приклад", en: "Example", pl: "Przykład", de: "Beispiel", ro: "Exemplu", cs: "Příklad", sr: "Primer", hu: "Példa", ar: "مثال", es: "Ejemplo", pt: "Exemplo" },
  related:   { uk: "Схожі шаблони", en: "Related templates", pl: "Podobne szablony", de: "Ähnliche Vorlagen", ro: "Șabloane similare", cs: "Podobné šablony", sr: "Slični šabloni", hu: "Kapcsolódó sablonok", ar: "قوالب ذات صلة", es: "Plantillas relacionadas", pt: "Modelos relacionados" },
  ctaTitle:  { uk: "Почніть з готового шаблона", en: "Start from a ready-made template", pl: "Zacznij od gotowego szablonu", de: "Starten Sie mit einer fertigen Vorlage", ro: "Începeți de la un șablon gata făcut", cs: "Začněte s hotovou šablonou", sr: "Počnite od gotovog šablona", hu: "Induljon kész sablonból", ar: "ابدأ من قالب جاهز", es: "Empiece con una plantilla lista para usar", pt: "Comece com um modelo pronto a usar" },
  ctaSub:    { uk: "Кожен шаблон можна скопіювати у свою клініку та змінити розділи під власний стиль ведення документації.", en: "Every template can be copied into your clinic and reshaped section by section to match how you document.", pl: "Każdy szablon możesz skopiować do swojej kliniki i dopasować sekcje do własnego stylu dokumentacji.", de: "Jede Vorlage lässt sich in Ihre Klinik kopieren und Abschnitt für Abschnitt an Ihre Dokumentation anpassen.", ro: "Fiecare șablon poate fi copiat în clinica dvs. și ajustat secțiune cu secțiune după stilul dvs. de documentare.", cs: "Každou šablonu lze zkopírovat do vaší kliniky a upravit sekci po sekci podle vašeho způsobu dokumentace.", sr: "Svaki šablon možete kopirati u svoju kliniku i prilagoditi sekcije svom načinu vođenja dokumentacije.", hu: "Minden sablon átmásolható a klinikájába, és szakaszonként az Ön dokumentálási stílusához igazítható.", ar: "يمكن نسخ كل قالب إلى عيادتك وإعادة تشكيله قسمًا تلو الآخر ليتناسب مع طريقتك في التوثيق.", es: "Cualquier plantilla puede copiarse a su clínica y remodelarse sección por sección para ajustarse a su forma de documentar.", pt: "Qualquer modelo pode ser copiado para a sua clínica e remodelado secção a secção para se ajustar à sua forma de documentar." },
  ctaPrim:   { uk: "Зареєструватися", en: "Sign up", pl: "Zarejestruj się", de: "Registrieren", ro: "Înregistrare", cs: "Registrovat se", sr: "Registrujte se", hu: "Regisztráció", ar: "التسجيل", es: "Registrarse", pt: "Registar-se" },
  ctaSec:    { uk: "Замовити шаблон", en: "Request a template", pl: "Zamów szablon", de: "Vorlage anfragen", ro: "Solicitați un șablon", cs: "Vyžádat šablonu", sr: "Zatražite šablon", hu: "Sablon igénylése", ar: "طلب قالب", es: "Solicitar una plantilla", pt: "Pedir um modelo" },
  notFound:  { uk: "Шаблон не знайдено", en: "Template not found", pl: "Nie znaleziono szablonu", de: "Vorlage nicht gefunden", ro: "Șablonul nu a fost găsit", cs: "Šablona nenalezena", sr: "Šablon nije pronađen", hu: "A sablon nem található", ar: "القالب غير موجود", es: "Plantilla no encontrada", pt: "Modelo não encontrado" },
};

const specialties = new Set(TEMPLATES.map((t) => t.cat)).size;

/* Closing band, shared by both views. */
function TemplatesCta({ L, go }) {
  return (
    <section className="lp-cta mk-cta">
      <h2 className="lp-cta-title">{L(S.ctaTitle)}</h2>
      <p className="lp-cta-sub">{L(S.ctaSub)}</p>
      <div className="lp-cta-actions">
        <a className="btn btn-primary lp-cta-lg" href="#/signup" onClick={go("/signup")}>{L(S.ctaPrim)}</a>
        <a className="btn lp-cta-lg" href="#/contact" onClick={go("/contact")}>{L(S.ctaSec)}</a>
      </div>
    </section>
  );
}

function TemplateCard({ tpl, lang, L, go }) {
  return (
    <a className="tpl-card" href={`#/templates/${tpl.slug}`} onClick={go(`/templates/${tpl.slug}`)}>
      <div className="tpl-card-top">
        <span className="lp-feature-icon"><Icon name={tpl.icon} size={18} /></span>
        {tpl.popular && <span className="tpl-badge"><Icon name="star" size={11} /> {L(S.popular)}</span>}
      </div>
      <span className="tpl-card-cat">{categoryLabel(tpl.cat, lang)}</span>
      <h3 className="tpl-card-title">{tpl.name[lang] ?? tpl.name.en}</h3>
      <p className="tpl-card-desc">{tpl.tag[lang] ?? tpl.tag.en}</p>
      <div className="tpl-card-meta">
        <span><Icon name="list" size={13} /> {tpl.sections.length} {L(S.sections)}</span>
        <span><Icon name="clock" size={13} /> ~{tpl.mins} {L(S.saves)}</span>
      </div>
      <span className="mk-card-more">{L(S.view)} <Icon name="arrowRight" size={14} /></span>
    </a>
  );
}

/* ── Gallery ─────────────────────────────────────────────────── */
function Gallery({ lang, L, go }) {
  const [cat, setCat] = useState("all");
  const [query, setQuery] = useState("");
  /* The toolbar field opens a palette instead of filtering as you type. See
     TemplateSearchModal.jsx — the field itself stays a real input holding the
     real query, so the page still reads correctly with the overlay closed. */
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);

  const results = useMemo(() => {
    const byCat = cat === "all" ? TEMPLATES : TEMPLATES.filter((t) => t.cat === cat);
    return searchTemplates(byCat, query, lang);
  }, [cat, query, lang]);

  const filtered = cat !== "all" || query.trim() !== "";

  return (
    <>
      <header className="mk-hero">
        <span className="lp-eyebrow"><Icon name="sparkle" size={13} /> {L(S.eyebrow)}</span>
        <h1 className="mk-hero-title">{L(S.title)}</h1>
        <p className="mk-hero-sub">{L(S.sub)}</p>
        <div className="lp-stats mk-stats tpl-stats">
          <div className="lp-stat"><div className="lp-stat-v">{TEMPLATES.length}</div><div className="lp-stat-l">{L(S.count)}</div></div>
          <div className="lp-stat">
            <div className="lp-stat-v">{specialties}</div>
            <div className="lp-stat-l">{L({ uk: "спеціальностей", en: "specialties", pl: "specjalności", de: "Fachrichtungen", ro: "specialități", cs: "odborností", sr: "specijalnosti", hu: "szakterület", ar: "تخصصات", es: "especialidades", pt: "especialidades" })}</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-v">11</div>
            <div className="lp-stat-l">{L({ uk: "мов інтерфейсу", en: "interface languages", pl: "języków interfejsu", de: "Oberflächensprachen", ro: "limbi de interfață", cs: "jazyků rozhraní", sr: "jezika interfejsa", hu: "felületi nyelv", ar: "لغات الواجهة", es: "idiomas de interfaz", pt: "idiomas da interface" })}</div>
          </div>
        </div>
      </header>

      <div className="tpl-toolbar">
        <label className="tpl-search">
          <Icon name="search" size={15} />
          <input
            ref={searchRef}
            type="search"
            value={query}
            /* Read-only rather than disabled: it still takes focus, still
               reads out to a screen reader, and still shows the active query —
               it just cannot be typed into, because the typing happens in the
               palette. `onFocus` covers the click, the Tab and the label. */
            readOnly
            onFocus={() => setSearching(true)}
            onClick={() => setSearching(true)}
            placeholder={L(S.search)}
            aria-label={L(S.search)}
            aria-haspopup="dialog"
            aria-expanded={searching}
          />
        </label>
        <div className="tpl-chips" role="tablist" aria-label={L(S.eyebrow)}>
          <button
            type="button"
            role="tab"
            aria-selected={cat === "all"}
            className={`tpl-chip${cat === "all" ? " is-active" : ""}`}
            onClick={() => setCat("all")}
          >
            {L(S.all)}
          </button>
          {TEMPLATE_CATEGORIES.map((c) => (
            <button
              type="button"
              role="tab"
              key={c.key}
              aria-selected={cat === c.key}
              className={`tpl-chip${cat === c.key ? " is-active" : ""}`}
              onClick={() => setCat(c.key)}
            >
              <Icon name={c.icon} size={13} /> {c.label[lang] ?? c.label.en}
            </button>
          ))}
        </div>
      </div>

      <section className="mk-section tpl-results">
        <p className="tpl-count" role="status">{results.length} {L(S.found)}</p>
        {results.length ? (
          <div className="tpl-grid">
            {results.map((t) => <TemplateCard tpl={t} lang={lang} L={L} go={go} key={t.slug} />)}
          </div>
        ) : (
          <Empty
            icon="search"
            title={L(S.none)}
            body={L(S.noneBody)}
            action={
              filtered
                ? <button className="btn btn-primary" onClick={() => { setCat("all"); setQuery(""); }}>{L(S.clear)}</button>
                : null
            }
          />
        )}
      </section>

      <TemplatesCta L={L} go={go} />

      {searching && (
        <TemplateSearchModal
          lang={lang}
          L={L}
          strings={S}
          initialQuery={query}
          onClose={(how) => {
            setSearching(false);
            /* The trigger is a focusable input: returning focus to it on a
               cancel would re-fire onFocus and reopen the dialog. Blur it. */
            if (how === "cancel") searchRef.current?.blur();
          }}
          onPick={(tpl) => {
            setSearching(false);
            go(`/templates/${tpl.slug}`)({ preventDefault() {} });
          }}
        />
      )}
    </>
  );
}

/* ── Detail ──────────────────────────────────────────────────── */
function Detail({ tpl, lang, L, go }) {
  const P = (m) => m[lang] ?? m.en;
  const related = relatedTemplates(tpl);

  return (
    <>
      <div className="mk-backlink">
        <a href="#/templates" onClick={go("/templates")}><Icon name="arrowLeft" size={15} /> {L(S.back)}</a>
      </div>

      <header className="mk-hero mk-hero-feature">
        <div className="mk-hero-icon"><Icon name={tpl.icon} size={26} /></div>
        <span className="lp-eyebrow"><Icon name="sparkle" size={13} /> {categoryLabel(tpl.cat, lang)}</span>
        <h1 className="mk-hero-title">{P(tpl.name)}</h1>
        <p className="mk-hero-sub">{P(tpl.tag)}</p>
        <div className="tpl-facts">
          <span><Icon name="list" size={14} /> {tpl.sections.length} {L(S.sections)}</span>
          <span><Icon name="grid" size={14} /> {tpl.fields} {L(S.fields)}</span>
          <span><Icon name="clock" size={14} /> ~{tpl.mins} {L(S.saves)}</span>
        </div>
        <div className="mk-hero-cta">
          <a className="btn btn-primary lp-cta-lg" href="#/signup" onClick={go("/signup")}>{L(S.ctaPrim)}</a>
        </div>
      </header>

      <div className="mk-blocks">
        <div className="mk-prose">
          <h2 className="mk-prose-h">{L(S.about)}</h2>
          <p>{P(tpl.about)}</p>
          <h3 className="tpl-sub-h">{L(S.bestFor)}</h3>
          <ul className="mk-prose-list">
            {P(tpl.bestFor).map((b, i) => <li key={i}><Icon name="check" size={15} /> {b}</li>)}
          </ul>
        </div>

        <section className="mk-section">
          <div className="lp-head">
            <h2 className="lp-h2">{L(S.structure)}</h2>
            <p className="lp-sub">{L(S.structSub)}</p>
          </div>
          <ol className="tpl-sections">
            {tpl.sections.map((s, i) => (
              <li className="tpl-section" key={i}>
                <span className="tpl-section-n">{i + 1}</span>
                <div className="tpl-section-body">
                  <h3 className="tpl-section-t">{P(s.name)}</h3>
                  <blockquote className="tpl-section-sample">
                    <span className="tpl-section-label">{L(S.sample)}</span>
                    {P(s.sample)}
                  </blockquote>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {related.length > 0 && (
          <section className="mk-section">
            <div className="lp-head"><h2 className="lp-h2">{L(S.related)}</h2></div>
            <div className="tpl-grid">
              {related.map((t) => <TemplateCard tpl={t} lang={lang} L={L} go={go} key={t.slug} />)}
            </div>
          </section>
        )}

        <TemplatesCta L={L} go={go} />
      </div>
    </>
  );
}

export function TemplatesMarketPage({ slug = "", navigate, lang = "en", tweaks, setTweak }) {
  const L = (m) => m[lang] ?? m.en;
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };
  const tpl = slug ? getTemplate(slug) : null;

  return (
    <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
      {!slug ? (
        <Gallery lang={lang} L={L} go={go} />
      ) : tpl ? (
        <Detail tpl={tpl} lang={lang} L={L} go={go} />
      ) : (
        <div className="mk-page">
          <Empty
            icon="search"
            title={L(S.notFound)}
            body={slug}
            action={<button className="btn btn-primary" onClick={() => navigate("/templates")}>{L(S.back)}</button>}
          />
        </div>
      )}
    </MarketingShell>
  );
}

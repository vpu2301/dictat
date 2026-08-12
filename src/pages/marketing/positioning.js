// positioning.js — the category story, in one place.
//
// Klarnote is not marketed as an AI scribe and not as a CDS tool. It is a
// SOVEREIGN AMBIENT TRUST PLATFORM: one closed loop that carries a single
// record from the spoken consultation to a legally binding signature.
//
//   Listen  (Scribe)     — multilingual speech structures the clinical template
//   Verify  (Evidentia)  — the structured note pulls localized evidence
//   Authorize (Signing)  — the clinician signs with a qualified signature
//   Bill    (Billing)    — the signed record becomes a coded, country-specific
//                          claim file. Not built; see BILL below and rcm.js.
//
// Every surface that tells this story reads from THIS file: the landing page's
// loop and moat sections, the /platform page, and the three pillar pages under
// /product. Positioning that is retyped per page drifts within a quarter —
// a claim edited on the landing page and left stale on the product page is how
// a sales deck ends up contradicting the site.
//
// ── On the roadmap markers ────────────────────────────────────────────────
// `soon` items are stated in the same breath as the shipped ones because they
// belong to the same narrative, and carried with a visible label because they
// are not built yet. As of 2026-08-10: capture, evidence retrieval, qualified
// signature and public verification are live; e-prescription, the direct commit
// to the national health registry, and the whole Bill pillar — coding and claim
// generation — are in integration. A prospect who discovers the gap in a demo
// has been misled by us; the label is what keeps an ambitious story honest.
//
// Note that the loop TITLE still names three verbs, not four. It is the
// headline claim of the company, and Bill has shipped nothing — it earns a
// place in the title the day it works, not the day we describe it.
//
// Translations: all eleven languages are written out. `positioning()` still
// falls back per key to English, so a language added later renders rather than
// crashes.

/* Shape, icons and routes — language-independent, written once. The `brand`
   is a product name and is never translated. */
export const PILLARS = [
  { key: "listen",    n: "01", icon: "waveform", brand: "Scribe",    path: "/product/scribe" },
  { key: "verify",    n: "02", icon: "book",     brand: "Evidentia", path: "/product/evidentia" },
  { key: "authorize", n: "03", icon: "sign",     brand: "Signing",   path: "/product/authorize" },
  /* The fourth move: the signed record is what a claim is built from. It is
     listed with the other three because it belongs to the same loop, and it
     carries every one of its claims in `soon` rather than `points` because
     none of it is built — see BILL below. */
  { key: "bill",      n: "04", icon: "card",     brand: "Billing",   path: "/rcm" },
];

/* Icons for the moat cards, in render order. */
export const MOAT_ICONS = ["home", "shield", "book", "sign", "globe", "layers"];

const TEXT = {
  uk: {
    category: "Суверенна платформа амбієнтної довіри",
    usp: "Єдина посилено-комплаєнсна багатомовна платформа клінічного інтелекту, яка перетворює амбієнтну розмову з пацієнтом на структурований, збагачений доказами та юридично підписаний медичний запис — в одному безперервному процесі.",
    soonLabel: "В інтеграції",
    loop: {
      eyebrow: "Замкнений цикл",
      title: "Слухає. Перевіряє. Засвідчує.",
      sub: "Більшість інструментів зупиняється на чернетці. Klarnote веде один запис від першого сказаного слова до юридично зобов'язувального підпису — нічого не передруковується, не експортується і не вводиться вдруге в іншу систему.",
      foot: "Цільовий показник: менше ніж 60 секунд від завершення прийому до підписаного запису.",
      more: "Як працює платформа",
      safety: "Klarnote пропонує — рішення ухвалює лікар. Жоден документ не стає остаточним без підпису людини.",
    },
    pillars: {
      listen: {
        verb: "Слухає",
        tagline: "Багатомовне розпізнавання мови в реальному часі структурує розмову у ваш клінічний шаблон просто під час прийому.",
        points: [
          "Амбієнтний запис у кабінеті — або класичне диктування прямо в шаблон звіту",
          "Розпізнавання клінічної мови кількома мовами з підсвічуванням сумнівних слів",
          "Нотатка лягає в секції вашого шаблону, а не в суцільну стіну тексту",
        ],
      },
      verify: {
        verb: "Перевіряє",
        tagline: "Структурована нотатка автоматично запускає безпечний локалізований пошук доказів: національні протоколи, клінічні настанови та рецензована література.",
        points: [
          "Діагностичні підказки — до нотатки, яку ви щойно продиктували",
          "Взаємодії ліків і протипоказання позначаються ще до підписання",
          "Кожна відповідь несе уривок джерела — ви перевіряєте джерело, а не модель",
        ],
      },
      authorize: {
        verb: "Засвідчує",
        tagline: "Лікар підписує готовий запис кваліфікованим електронним підписом — юридично зобов'язувальним, публічно перевірним і доказовим.",
        points: [
          "Кваліфікований електронний підпис (КЕП) через Дію",
          "Публічне посилання для перевірки — його відкриє будь-який отримувач",
          "Підписана версія незмінна; правки вносяться амендментами, а не перезаписом",
        ],
        soon: [
          "Електронний рецепт і пряма передача до національного реєстру здоров'я",
        ],
      },
    },
    moat: {
      title: "Чому це не можна зібрати з окремих частин",
      sub: "Кожен крок десь існує як окремий продукт. Захищеність — у циклі між ними та в тому, на чому цей цикл стоїть.",
      items: [
        { t: "Суверенність за побудовою", d: "Розпізнавання, генерація та пошук доказів працюють на self-hosted моделях з відкритою ліцензією всередині вашого розгортання. Жодне аудіо, транскрипт чи нотатка не потрапляють до стороннього API — немає транскордонної передачі, яку доведеться пояснювати регулятору." },
        { t: "Комплаєнс у коді, а не поруч із ним", d: "Ізоляція тенантів на рівні бази даних, доступ «розбити скло» з іменним обґрунтуванням, незмінний журнал аудиту та видалення в дві пари рук. Це забезпечує система, а не документ політики." },
        { t: "Докази з юрисдикцією", d: "Пошук прив'язаний до протоколів і національних настанов там, де ви реально практикуєте, і цитує використаний уривок. Універсальна модель не може процитувати те, чого їй ніколи не давали." },
        { t: "Завершується підписом, а не чернеткою", d: "Нотатка стає медичним записом тоді, коли за неї відповідає названий лікар. Інші скрайби віддають чернетку й зупиняються; цикл замикається лише на підписі." },
        { t: "Багатомовність там, де медицина багатомовна", d: "Одинадцять мов інтерфейсу та багатомовне клінічне диктування — бо розмова, настанова й запис часто трьома різними мовами." },
        { t: "Один запис — одне джерело правди", d: "Транскрипт, використані докази та підпис належать одному версіонованому запису. Без експорту, без другої системи, без подальших звірянь." },
      ],
    },
  },

  en: {
    category: "Sovereign Ambient Trust Platform",
    usp: "The only compliance-hardened, multilingual clinical intelligence platform that transforms ambient patient consultations into structured, evidence-enriched and legally signed medical records — in a single, continuous workflow.",
    soonLabel: "In integration",
    loop: {
      eyebrow: "The closed loop",
      title: "Listen. Verify. Authorize.",
      sub: "Most tools stop at a draft. Klarnote carries one record from the first spoken word to a legally binding signature — nothing is retyped, exported or re-keyed into a second system.",
      foot: "Design goal: under 60 seconds from the end of the consultation to a signed record.",
      more: "How the platform works",
      safety: "Klarnote suggests; the clinician decides. Nothing becomes final without a human signature.",
    },
    pillars: {
      listen: {
        verb: "Listen",
        tagline: "Real-time multilingual speech-to-text structures the consultation into your clinical template as it happens.",
        points: [
          "Ambient capture in the room — or dictation straight into a report template",
          "Multilingual recognition of clinical speech, with low-confidence words flagged",
          "The note lands in your template's sections, not in a wall of text",
        ],
      },
      verify: {
        verb: "Verify",
        tagline: "The structured note automatically triggers safe, localized evidence retrieval: national protocols, clinical guidelines and peer-reviewed literature.",
        points: [
          "Diagnostic suggestions raised against the note you just dictated",
          "Drug interactions and contraindications flagged before anything is signed",
          "Every answer carries the passage it came from — you check the source, not the model",
        ],
      },
      authorize: {
        verb: "Authorize",
        tagline: "The clinician signs the finished record with a qualified electronic signature — legally binding, publicly verifiable, and yours to prove.",
        points: [
          "Qualified electronic signature (QES / КЕП) via Diia",
          "A public verification link any recipient can open",
          "The signed version is immutable; corrections are amendments, never overwrites",
        ],
        soon: [
          "E-prescription and direct commit to the national health registry",
        ],
      },
    },
    moat: {
      title: "Why this cannot be assembled from parts",
      sub: "Each move exists somewhere as a separate product. The defensibility is the loop between them — and what the loop stands on.",
      items: [
        { t: "Sovereign by construction", d: "Recognition, generation and retrieval run on self-hosted, open-licensed models inside your own deployment. No audio, transcript or note reaches a third-party API — there is no cross-border transfer to justify to a regulator." },
        { t: "Compliance-hardened, not compliance-adjacent", d: "Tenant isolation enforced by the database, break-glass access that demands a named justification, an immutable audit trail and two-person erasure. The system enforces it; a policy document does not." },
        { t: "Evidence with a jurisdiction", d: "Retrieval is bound to the protocols and national guidelines where you actually practise, and cites the passage it used. A general-purpose model cannot cite what it was never given." },
        { t: "It ends in a signature, not a draft", d: "A note becomes a medical record when a named clinician is accountable for it. Other scribes hand you a draft and stop; the loop only closes at the signature." },
        { t: "Multilingual where care is multilingual", d: "Eleven interface languages and multilingual clinical dictation — because the consultation, the guideline and the record are often in three different languages." },
        { t: "One record, one source of truth", d: "The transcript, the evidence consulted and the signature belong to the same versioned record. No export step, no second system, nothing to reconcile afterwards." },
      ],
    },
  },

  pl: {
    category: "Suwerenna platforma zaufania ambientowego",
    usp: "Jedyna wzmocniona pod kątem zgodności, wielojęzyczna platforma inteligencji klinicznej, która zamienia ambientową rozmowę z pacjentem w ustrukturyzowany, wzbogacony dowodami i prawnie podpisany dokument medyczny — w jednym, ciągłym przepływie pracy.",
    soonLabel: "W integracji",
    loop: {
      eyebrow: "Zamknięta pętla",
      title: "Słucha. Weryfikuje. Poświadcza.",
      sub: "Większość narzędzi kończy na wersji roboczej. Klarnote prowadzi jeden dokument od pierwszego wypowiedzianego słowa do prawnie wiążącego podpisu — nic nie jest przepisywane, eksportowane ani wprowadzane po raz drugi do innego systemu.",
      foot: "Cel projektowy: poniżej 60 sekund od końca wizyty do podpisanego dokumentu.",
      more: "Jak działa platforma",
      safety: "Klarnote podpowiada, decyduje lekarz. Nic nie staje się ostateczne bez podpisu człowieka.",
    },
    pillars: {
      listen: {
        verb: "Słucha",
        tagline: "Wielojęzyczne rozpoznawanie mowy w czasie rzeczywistym układa rozmowę w Twój szablon kliniczny już w trakcie wizyty.",
        points: [
          "Ambientowe nagrywanie w gabinecie — albo dyktowanie wprost do szablonu raportu",
          "Wielojęzyczne rozpoznawanie mowy klinicznej z oznaczaniem niepewnych słów",
          "Notatka trafia do sekcji Twojego szablonu, a nie w ścianę tekstu",
        ],
      },
      verify: {
        verb: "Weryfikuje",
        tagline: "Ustrukturyzowana notatka automatycznie uruchamia bezpieczne, zlokalizowane wyszukiwanie dowodów: protokoły krajowe, wytyczne kliniczne i literaturę recenzowaną.",
        points: [
          "Sugestie diagnostyczne odniesione do notatki, którą właśnie podyktowano",
          "Interakcje leków i przeciwwskazania oznaczone przed podpisaniem",
          "Każda odpowiedź niesie ze sobą fragment źródła — sprawdzasz źródło, nie model",
        ],
      },
      authorize: {
        verb: "Poświadcza",
        tagline: "Lekarz podpisuje gotowy dokument kwalifikowanym podpisem elektronicznym — prawnie wiążącym, publicznie weryfikowalnym i możliwym do udowodnienia.",
        points: [
          "Kwalifikowany podpis elektroniczny (QES / КЕП) przez Diię",
          "Publiczny link weryfikacyjny, który otworzy każdy odbiorca",
          "Podpisana wersja jest niezmienna; poprawki to aneksy, nigdy nadpisania",
        ],
        soon: [
          "E-recepta i bezpośrednie przekazanie do krajowego rejestru zdrowia",
        ],
      },
    },
    moat: {
      title: "Dlaczego nie da się tego złożyć z części",
      sub: "Każdy krok istnieje gdzieś jako osobny produkt. Przewaga tkwi w pętli między nimi — i w tym, na czym ta pętla stoi.",
      items: [
        { t: "Suwerenność z założenia", d: "Rozpoznawanie, generowanie i wyszukiwanie działają na własnych modelach o otwartej licencji wewnątrz Twojego wdrożenia. Żadne audio, transkrypcja ani notatka nie trafia do zewnętrznego API — nie ma transferu transgranicznego, który trzeba uzasadniać regulatorowi." },
        { t: "Zgodność w kodzie, nie obok niego", d: "Izolacja najemców egzekwowana przez bazę danych, dostęp awaryjny wymagający imiennego uzasadnienia, niezmienny dziennik audytu i usuwanie na cztery oczy. Egzekwuje to system, a nie dokument polityki." },
        { t: "Dowody z jurysdykcją", d: "Wyszukiwanie jest związane z protokołami i wytycznymi krajowymi tam, gdzie faktycznie praktykujesz, i cytuje użyty fragment. Model ogólnego przeznaczenia nie zacytuje tego, czego nigdy nie dostał." },
        { t: "Kończy się podpisem, nie szkicem", d: "Notatka staje się dokumentacją medyczną, gdy odpowiada za nią imiennie wskazany lekarz. Inne skryby oddają szkic i kończą; pętla zamyka się dopiero na podpisie." },
        { t: "Wielojęzyczność tam, gdzie opieka jest wielojęzyczna", d: "Jedenaście języków interfejsu i wielojęzyczne dyktowanie kliniczne — bo rozmowa, wytyczna i dokument bywają w trzech różnych językach." },
        { t: "Jeden dokument, jedno źródło prawdy", d: "Transkrypcja, użyte dowody i podpis należą do tego samego wersjonowanego dokumentu. Bez eksportu, bez drugiego systemu, bez późniejszych uzgodnień." },
      ],
    },
  },

  de: {
    category: "Souveräne Ambient-Trust-Plattform",
    usp: "Die einzige compliance-gehärtete, mehrsprachige Plattform für klinische Intelligenz, die das Patientengespräch im Raum in eine strukturierte, evidenzgestützte und rechtsverbindlich signierte Krankenakte verwandelt — in einem einzigen, durchgehenden Arbeitsablauf.",
    soonLabel: "In Integration",
    loop: {
      eyebrow: "Der geschlossene Kreis",
      title: "Zuhören. Prüfen. Signieren.",
      sub: "Die meisten Werkzeuge enden beim Entwurf. Klarnote führt einen Datensatz vom ersten gesprochenen Wort bis zur rechtsverbindlichen Signatur — nichts wird abgetippt, exportiert oder ein zweites Mal in ein anderes System eingegeben.",
      foot: "Zielvorgabe: unter 60 Sekunden vom Ende der Sprechstunde bis zum signierten Dokument.",
      more: "So funktioniert die Plattform",
      safety: "Klarnote schlägt vor, entschieden wird ärztlich. Nichts wird endgültig ohne menschliche Signatur.",
    },
    pillars: {
      listen: {
        verb: "Zuhören",
        tagline: "Mehrsprachige Spracherkennung in Echtzeit strukturiert das Gespräch noch während der Sprechstunde in Ihre klinische Vorlage.",
        points: [
          "Ambiente Aufnahme im Sprechzimmer — oder Diktat direkt in eine Befundvorlage",
          "Mehrsprachige Erkennung klinischer Sprache, unsichere Wörter markiert",
          "Die Notiz landet in den Abschnitten Ihrer Vorlage, nicht in einer Textwand",
        ],
      },
      verify: {
        verb: "Prüfen",
        tagline: "Die strukturierte Notiz löst automatisch eine sichere, lokalisierte Evidenzsuche aus: nationale Protokolle, klinische Leitlinien und begutachtete Literatur.",
        points: [
          "Diagnosevorschläge, bezogen auf die soeben diktierte Notiz",
          "Wechselwirkungen und Kontraindikationen werden vor der Signatur markiert",
          "Jede Antwort trägt die Textstelle ihrer Quelle — Sie prüfen die Quelle, nicht das Modell",
        ],
      },
      authorize: {
        verb: "Signieren",
        tagline: "Die Ärztin oder der Arzt signiert den fertigen Datensatz mit einer qualifizierten elektronischen Signatur — rechtsverbindlich, öffentlich prüfbar und beweisbar.",
        points: [
          "Qualifizierte elektronische Signatur (QES / КЕП) über Diia",
          "Ein öffentlicher Prüflink, den jeder Empfänger öffnen kann",
          "Die signierte Fassung ist unveränderlich; Korrekturen sind Nachträge, keine Überschreibungen",
        ],
        soon: [
          "E-Rezept und direkte Übermittlung an das nationale Gesundheitsregister",
        ],
      },
    },
    moat: {
      title: "Warum sich das nicht aus Einzelteilen zusammensetzen lässt",
      sub: "Jeder Schritt existiert irgendwo als eigenes Produkt. Verteidigbar ist der Kreis dazwischen — und das Fundament, auf dem er steht.",
      items: [
        { t: "Souverän von Grund auf", d: "Erkennung, Generierung und Recherche laufen auf selbst gehosteten Modellen mit offener Lizenz in Ihrer eigenen Installation. Kein Audio, kein Transkript, keine Notiz erreicht eine fremde API — es gibt keinen grenzüberschreitenden Transfer, den Sie einer Aufsichtsbehörde erklären müssten." },
        { t: "Compliance im Code, nicht daneben", d: "Mandantentrennung durch die Datenbank, Break-Glass-Zugriff mit namentlicher Begründung, ein unveränderliches Audit-Protokoll und Löschung im Vier-Augen-Prinzip. Das System setzt es durch, nicht ein Richtliniendokument." },
        { t: "Evidenz mit Rechtsraum", d: "Die Recherche ist an die Protokolle und nationalen Leitlinien Ihres tatsächlichen Praxisorts gebunden und zitiert die verwendete Textstelle. Ein Allzweckmodell kann nicht zitieren, was es nie erhalten hat." },
        { t: "Am Ende steht eine Signatur, kein Entwurf", d: "Eine Notiz wird zur Krankenakte, wenn eine namentlich benannte Ärztin dafür einsteht. Andere Scribes übergeben einen Entwurf und hören auf; der Kreis schließt sich erst mit der Signatur." },
        { t: "Mehrsprachig, wo Versorgung mehrsprachig ist", d: "Elf Oberflächensprachen und mehrsprachiges klinisches Diktat — denn Gespräch, Leitlinie und Dokument sind oft in drei verschiedenen Sprachen." },
        { t: "Ein Datensatz, eine Wahrheit", d: "Transkript, herangezogene Evidenz und Signatur gehören zum selben versionierten Datensatz. Kein Exportschritt, kein zweites System, nichts nachträglich abzugleichen." },
      ],
    },
  },

  ro: {
    category: "Platformă suverană de încredere ambientală",
    usp: "Singura platformă de inteligență clinică multilingvă și securizată pentru conformitate care transformă consultațiile ambientale cu pacientul în documente medicale structurate, îmbogățite cu dovezi și semnate legal — într-un singur flux de lucru continuu.",
    soonLabel: "În integrare",
    loop: {
      eyebrow: "Bucla închisă",
      title: "Ascultă. Verifică. Semnează.",
      sub: "Majoritatea instrumentelor se opresc la o ciornă. Klarnote poartă un singur document de la primul cuvânt rostit până la o semnătură cu valoare juridică — nimic nu se retastează, nu se exportă și nu se introduce a doua oară într-un alt sistem.",
      foot: "Obiectiv de proiectare: sub 60 de secunde de la finalul consultației până la documentul semnat.",
      more: "Cum funcționează platforma",
      safety: "Klarnote sugerează; medicul decide. Nimic nu devine definitiv fără o semnătură umană.",
    },
    pillars: {
      listen: {
        verb: "Ascultă",
        tagline: "Recunoașterea vocală multilingvă în timp real structurează consultația în șablonul dumneavoastră clinic chiar în timp ce are loc.",
        points: [
          "Captare ambientală în cabinet — sau dictare direct într-un șablon de raport",
          "Recunoaștere multilingvă a vorbirii clinice, cu marcarea cuvintelor nesigure",
          "Nota ajunge în secțiunile șablonului, nu într-un bloc compact de text",
        ],
      },
      verify: {
        verb: "Verifică",
        tagline: "Nota structurată declanșează automat o căutare sigură și localizată de dovezi: protocoale naționale, ghiduri clinice și literatură evaluată de specialiști.",
        points: [
          "Sugestii de diagnostic raportate la nota tocmai dictată",
          "Interacțiuni medicamentoase și contraindicații semnalate înainte de semnare",
          "Fiecare răspuns poartă pasajul-sursă — verificați sursa, nu modelul",
        ],
      },
      authorize: {
        verb: "Semnează",
        tagline: "Medicul semnează documentul final cu o semnătură electronică calificată — cu valoare juridică, verificabilă public și demonstrabilă.",
        points: [
          "Semnătură electronică calificată (QES / КЕП) prin Diia",
          "Un link public de verificare pe care îl poate deschide orice destinatar",
          "Versiunea semnată este imuabilă; corecturile sunt amendamente, nu suprascrieri",
        ],
        soon: [
          "Rețetă electronică și transmitere directă către registrul național de sănătate",
        ],
      },
    },
    moat: {
      title: "De ce nu poate fi asamblat din piese",
      sub: "Fiecare pas există undeva ca produs separat. Avantajul stă în bucla dintre ele — și în fundația pe care se sprijină.",
      items: [
        { t: "Suveran prin construcție", d: "Recunoașterea, generarea și căutarea rulează pe modele găzduite local, cu licență deschisă, în propria dumneavoastră instalare. Niciun fișier audio, transcript sau notă nu ajunge la un API terț — nu există transfer transfrontalier de justificat în fața autorității." },
        { t: "Conformitate în cod, nu alături de el", d: "Izolarea chiriașilor impusă de baza de date, acces de urgență cu justificare nominală, jurnal de audit imuabil și ștergere în patru ochi. Sistemul le impune, nu un document de politică." },
        { t: "Dovezi cu jurisdicție", d: "Căutarea este legată de protocoalele și ghidurile naționale din locul în care practicați efectiv și citează pasajul folosit. Un model generalist nu poate cita ceea ce nu i s-a dat niciodată." },
        { t: "Se încheie cu o semnătură, nu cu o ciornă", d: "O notă devine document medical atunci când un medic nominalizat răspunde pentru ea. Alți scribi vă predau ciorna și se opresc; bucla se închide abia la semnătură." },
        { t: "Multilingv acolo unde îngrijirea este multilingvă", d: "Unsprezece limbi de interfață și dictare clinică multilingvă — pentru că discuția, ghidul și documentul sunt adesea în trei limbi diferite." },
        { t: "Un singur document, o singură sursă de adevăr", d: "Transcriptul, dovezile consultate și semnătura aparțin aceluiași document versionat. Fără pas de export, fără al doilea sistem, fără reconcilieri ulterioare." },
      ],
    },
  },

  cs: {
    category: "Suverénní platforma ambientní důvěry",
    usp: "Jediná bezpečnostně a compliance zpevněná vícejazyčná platforma klinické inteligence, která proměňuje ambientní rozhovor s pacientem ve strukturovaný, důkazy obohacený a právně podepsaný zdravotnický záznam — v jediném souvislém pracovním postupu.",
    soonLabel: "V integraci",
    loop: {
      eyebrow: "Uzavřená smyčka",
      title: "Naslouchá. Ověřuje. Stvrzuje.",
      sub: "Většina nástrojů končí u konceptu. Klarnote vede jeden záznam od prvního vysloveného slova až po právně závazný podpis — nic se nepřepisuje, neexportuje ani podruhé nezadává do jiného systému.",
      foot: "Cílový parametr: méně než 60 sekund od konce návštěvy k podepsanému záznamu.",
      more: "Jak platforma funguje",
      safety: "Klarnote navrhuje, rozhoduje lékař. Nic není konečné bez lidského podpisu.",
    },
    pillars: {
      listen: {
        verb: "Naslouchá",
        tagline: "Vícejazyčné rozpoznávání řeči v reálném čase strukturuje rozhovor do vaší klinické šablony už během návštěvy.",
        points: [
          "Ambientní záznam v ordinaci — nebo diktování přímo do šablony zprávy",
          "Vícejazyčné rozpoznávání klinické řeči s vyznačením nejistých slov",
          "Poznámka padne do sekcí vaší šablony, ne do zdi textu",
        ],
      },
      verify: {
        verb: "Ověřuje",
        tagline: "Strukturovaná poznámka automaticky spouští bezpečné, lokalizované vyhledávání důkazů: národní protokoly, klinická doporučení a recenzovanou literaturu.",
        points: [
          "Diagnostické návrhy vztažené k poznámce, kterou jste právě nadiktovali",
          "Lékové interakce a kontraindikace označené ještě před podpisem",
          "Každá odpověď nese pasáž zdroje — kontrolujete zdroj, ne model",
        ],
      },
      authorize: {
        verb: "Stvrzuje",
        tagline: "Lékař podepíše hotový záznam kvalifikovaným elektronickým podpisem — právně závazným, veřejně ověřitelným a doložitelným.",
        points: [
          "Kvalifikovaný elektronický podpis (QES / КЕП) přes Diiu",
          "Veřejný ověřovací odkaz, který otevře kterýkoli příjemce",
          "Podepsaná verze je neměnná; opravy jsou dodatky, nikoli přepisy",
        ],
        soon: [
          "Elektronický recept a přímé odeslání do národního zdravotního registru",
        ],
      },
    },
    moat: {
      title: "Proč to nejde poskládat z dílů",
      sub: "Každý krok někde existuje jako samostatný produkt. Obhajitelná je smyčka mezi nimi — a to, na čem stojí.",
      items: [
        { t: "Suverénní už z konstrukce", d: "Rozpoznávání, generování i vyhledávání běží na vlastních modelech s otevřenou licencí uvnitř vašeho nasazení. Žádné audio, přepis ani poznámka se nedostane do cizího API — není žádný přeshraniční přenos, který byste museli obhajovat před regulátorem." },
        { t: "Compliance v kódu, ne vedle něj", d: "Izolace nájemců vynucená databází, nouzový přístup s jmenovitým odůvodněním, neměnný auditní záznam a mazání ve dvou lidech. Vynucuje to systém, ne dokument politiky." },
        { t: "Důkazy s jurisdikcí", d: "Vyhledávání je vázané na protokoly a národní doporučení místa, kde skutečně praktikujete, a cituje použitou pasáž. Obecný model nemůže citovat to, co nikdy nedostal." },
        { t: "Končí podpisem, ne konceptem", d: "Z poznámky se stane zdravotnický záznam ve chvíli, kdy za ni jmenovitě odpovídá lékař. Jiné zapisovatele vám předají koncept a skončí; smyčka se uzavírá až podpisem." },
        { t: "Vícejazyčná tam, kde je péče vícejazyčná", d: "Jedenáct jazyků rozhraní a vícejazyčné klinické diktování — protože rozhovor, doporučení a záznam bývají ve třech různých jazycích." },
        { t: "Jeden záznam, jeden zdroj pravdy", d: "Přepis, použité důkazy i podpis patří k témuž verzovanému záznamu. Žádný export, žádný druhý systém, nic k dodatečnému srovnávání." },
      ],
    },
  },

  sr: {
    category: "Suverena platforma ambijentalnog poverenja",
    usp: "Jedina višejezična platforma kliničke inteligencije ojačana za usklađenost, koja ambijentalni razgovor sa pacijentom pretvara u strukturiran, dokazima obogaćen i pravno potpisan medicinski zapis — u jednom neprekidnom toku rada.",
    soonLabel: "U integraciji",
    loop: {
      eyebrow: "Zatvorena petlja",
      title: "Sluša. Proverava. Overava.",
      sub: "Većina alata staje na nacrtu. Klarnote vodi jedan zapis od prve izgovorene reči do pravno obavezujućeg potpisa — ništa se ne prekucava, ne izvozi niti po drugi put unosi u drugi sistem.",
      foot: "Projektni cilj: ispod 60 sekundi od kraja pregleda do potpisanog zapisa.",
      more: "Kako platforma radi",
      safety: "Klarnote predlaže, lekar odlučuje. Ništa nije konačno bez ljudskog potpisa.",
    },
    pillars: {
      listen: {
        verb: "Sluša",
        tagline: "Višejezično prepoznavanje govora u realnom vremenu struktuira razgovor u vaš klinički šablon dok pregled traje.",
        points: [
          "Ambijentalno snimanje u ordinaciji — ili diktiranje pravo u šablon izveštaja",
          "Višejezično prepoznavanje kliničkog govora, uz označavanje nesigurnih reči",
          "Beleška ulazi u sekcije vašeg šablona, a ne u zid teksta",
        ],
      },
      verify: {
        verb: "Proverava",
        tagline: "Strukturirana beleška automatski pokreće bezbedno, lokalizovano pretraživanje dokaza: nacionalne protokole, kliničke smernice i recenziranu literaturu.",
        points: [
          "Dijagnostički predlozi vezani za belešku koju ste upravo izdiktirali",
          "Interakcije lekova i kontraindikacije označene pre potpisivanja",
          "Svaki odgovor nosi pasus izvora — proveravate izvor, a ne model",
        ],
      },
      authorize: {
        verb: "Overava",
        tagline: "Lekar potpisuje gotov zapis kvalifikovanim elektronskim potpisom — pravno obavezujućim, javno proverljivim i dokazivim.",
        points: [
          "Kvalifikovani elektronski potpis (QES / КЕП) preko Diie",
          "Javni link za proveru koji može da otvori svaki primalac",
          "Potpisana verzija je nepromenljiva; ispravke su amandmani, nikada prepisivanje",
        ],
        soon: [
          "E-recept i direktno slanje u nacionalni zdravstveni registar",
        ],
      },
    },
    moat: {
      title: "Zašto se ovo ne može sastaviti od delova",
      sub: "Svaki korak negde postoji kao poseban proizvod. Odbranjiva je petlja između njih — i ono na čemu ta petlja stoji.",
      items: [
        { t: "Suveren po konstrukciji", d: "Prepoznavanje, generisanje i pretraga rade na sopstveno hostovanim modelima otvorene licence unutar vaše instalacije. Nijedan audio zapis, transkript ni beleška ne stižu do tuđeg API-ja — nema prekograničnog prenosa koji biste morali da opravdavate regulatoru." },
        { t: "Usklađenost u kodu, a ne pored njega", d: "Izolacija zakupaca koju sprovodi baza podataka, hitni pristup uz imenovano obrazloženje, nepromenljiv revizorski trag i brisanje u četiri oka. To sprovodi sistem, a ne dokument politike." },
        { t: "Dokazi sa jurisdikcijom", d: "Pretraga je vezana za protokole i nacionalne smernice mesta gde zaista radite i citira upotrebljeni pasus. Opšti model ne može da citira ono što nikada nije dobio." },
        { t: "Završava se potpisom, a ne nacrtom", d: "Beleška postaje medicinski zapis kada za nju imenovano odgovara lekar. Drugi zapisničari vam predaju nacrt i tu staju; petlja se zatvara tek na potpisu." },
        { t: "Višejezična tamo gde je i nega višejezična", d: "Jedanaest jezika interfejsa i višejezično kliničko diktiranje — jer razgovor, smernica i zapis često su na tri različita jezika." },
        { t: "Jedan zapis, jedan izvor istine", d: "Transkript, korišćeni dokazi i potpis pripadaju istom verzionisanom zapisu. Bez koraka izvoza, bez drugog sistema, bez naknadnog usaglašavanja." },
      ],
    },
  },

  hu: {
    category: "Szuverén ambiens bizalmi platform",
    usp: "Az egyetlen megfelelőségre keményített, többnyelvű klinikai intelligencia platform, amely az ambiens betegkonzultációt strukturált, bizonyítékokkal dúsított és jogilag aláírt orvosi dokumentummá alakítja — egyetlen, folyamatos munkafolyamatban.",
    soonLabel: "Integráció alatt",
    loop: {
      eyebrow: "A zárt hurok",
      title: "Hallgat. Ellenőriz. Hitelesít.",
      sub: "A legtöbb eszköz a piszkozatnál megáll. A Klarnote egyetlen dokumentumot visz végig az első kimondott szótól a jogilag kötelező aláírásig — semmit nem kell újragépelni, exportálni vagy másodszor is bevinni egy másik rendszerbe.",
      foot: "Tervezési cél: a vizit végétől az aláírt dokumentumig 60 másodperc alatt.",
      more: "Hogyan működik a platform",
      safety: "A Klarnote javasol, az orvos dönt. Semmi sem válik véglegessé emberi aláírás nélkül.",
    },
    pillars: {
      listen: {
        verb: "Hallgat",
        tagline: "A valós idejű, többnyelvű beszédfelismerés már a vizit közben a klinikai sablonjába rendezi a beszélgetést.",
        points: [
          "Ambiens rögzítés a rendelőben — vagy diktálás közvetlenül a leletsablonba",
          "Klinikai beszéd többnyelvű felismerése, a bizonytalan szavak megjelölésével",
          "A jegyzet a sablon szakaszaiba kerül, nem egy összefüggő szövegfalba",
        ],
      },
      verify: {
        verb: "Ellenőriz",
        tagline: "A strukturált jegyzet automatikusan biztonságos, lokalizált bizonyítékkeresést indít: nemzeti protokollok, klinikai irányelvek és lektorált szakirodalom.",
        points: [
          "Diagnosztikai javaslatok az imént diktált jegyzethez kötve",
          "Gyógyszerkölcsönhatások és ellenjavallatok jelzése még aláírás előtt",
          "Minden válasz hozza a forrás szövegrészletét — a forrást ellenőrzi, nem a modellt",
        ],
      },
      authorize: {
        verb: "Hitelesít",
        tagline: "Az orvos minősített elektronikus aláírással írja alá a kész dokumentumot — jogilag kötelező, nyilvánosan ellenőrizhető és bizonyítható.",
        points: [
          "Minősített elektronikus aláírás (QES / КЕП) a Diia rendszerén keresztül",
          "Nyilvános ellenőrző hivatkozás, amelyet bármelyik címzett megnyithat",
          "Az aláírt változat megváltoztathatatlan; a javítás kiegészítés, sosem felülírás",
        ],
        soon: [
          "E-recept és közvetlen beküldés a nemzeti egészségügyi nyilvántartásba",
        ],
      },
    },
    moat: {
      title: "Miért nem rakható össze alkatrészekből",
      sub: "Minden lépés létezik valahol külön termékként. A védhetőség a köztük lévő hurokban van — és abban, amin a hurok áll.",
      items: [
        { t: "Szuverén már a felépítésénél fogva", d: "A felismerés, a generálás és a keresés saját üzemeltetésű, nyílt licencű modelleken fut a saját telepítésén belül. Sem hang, sem átirat, sem jegyzet nem jut el harmadik fél API-jához — nincs határon átnyúló adattovábbítás, amit a hatóság előtt indokolni kellene." },
        { t: "Megfelelőség a kódban, nem mellette", d: "Az adatbázis által kikényszerített bérlői elkülönítés, névre szóló indokolást követelő vészhelyzeti hozzáférés, megváltoztathatatlan auditnapló és négy szem elvű törlés. A rendszer kényszeríti ki, nem egy szabályzat." },
        { t: "Bizonyíték joghatósággal", d: "A keresés annak a helynek a protokolljaihoz és nemzeti irányelveihez kötött, ahol valóban gyógyít, és idézi a felhasznált szövegrészt. Egy általános célú modell nem tud idézni olyat, amit sosem kapott meg." },
        { t: "Aláírással zárul, nem piszkozattal", d: "A jegyzetből akkor lesz orvosi dokumentum, amikor névvel megnevezett orvos felel érte. Más írnokok átadják a piszkozatot és megállnak; a hurok csak az aláírásnál zárul." },
        { t: "Többnyelvű ott, ahol az ellátás is az", d: "Tizenegy felületi nyelv és többnyelvű klinikai diktálás — mert a beszélgetés, az irányelv és a dokumentum gyakran három különböző nyelven van." },
        { t: "Egy dokumentum, egy igazságforrás", d: "Az átirat, a felhasznált bizonyíték és az aláírás ugyanahhoz a verziózott dokumentumhoz tartozik. Nincs exportlépés, nincs második rendszer, nincs utólagos egyeztetés." },
      ],
    },
  },

  ar: {
    category: "منصة الثقة المحيطية السيادية",
    usp: "المنصة الوحيدة للذكاء السريري، متعددة اللغات ومُحصَّنة للامتثال، التي تحوّل الاستشارة المحيطية مع المريض إلى سجل طبي مُهيكل ومُدعَّم بالأدلة ومُوقَّع قانونيًا — ضمن سير عمل واحد ومتصل.",
    soonLabel: "قيد التكامل",
    loop: {
      eyebrow: "الحلقة المغلقة",
      title: "يستمع. يتحقّق. يوثّق.",
      sub: "معظم الأدوات تتوقف عند المسودة. يحمل Klarnote سجلًا واحدًا من أول كلمة منطوقة حتى توقيع مُلزِم قانونًا — لا إعادة كتابة ولا تصدير ولا إدخال ثانٍ في نظام آخر.",
      foot: "الهدف التصميمي: أقل من 60 ثانية من نهاية الاستشارة حتى السجل الموقَّع.",
      more: "كيف تعمل المنصة",
      safety: "‏Klarnote يقترح، والطبيب يقرّر. لا شيء يصبح نهائيًا دون توقيع بشري.",
    },
    pillars: {
      listen: {
        verb: "يستمع",
        tagline: "تحويل الكلام إلى نص متعدد اللغات وفي الزمن الحقيقي يُهيكل الاستشارة داخل قالبك السريري أثناء حدوثها.",
        points: [
          "تسجيل محيطي داخل العيادة — أو إملاء مباشر في قالب التقرير",
          "تعرّف متعدد اللغات على الكلام السريري مع تمييز الكلمات غير المؤكدة",
          "تستقر الملاحظة في أقسام قالبك، لا في جدار من النص",
        ],
      },
      verify: {
        verb: "يتحقّق",
        tagline: "تُطلق الملاحظة المُهيكلة تلقائيًا بحثًا آمنًا ومحليًا في الأدلة: البروتوكولات الوطنية والإرشادات السريرية والأدبيات المُحكَّمة.",
        points: [
          "اقتراحات تشخيصية مرتبطة بالملاحظة التي أمليتها للتو",
          "تنبيهات لتداخلات الأدوية وموانع الاستعمال قبل التوقيع",
          "كل إجابة تحمل المقطع المصدري — تتحقق من المصدر لا من النموذج",
        ],
      },
      authorize: {
        verb: "يوثّق",
        tagline: "يوقّع الطبيب السجل النهائي بتوقيع إلكتروني مؤهل — مُلزِم قانونًا، وقابل للتحقق علنًا، ويمكن إثباته.",
        points: [
          "توقيع إلكتروني مؤهل (QES / КЕП) عبر Diia",
          "رابط تحقق عام يفتحه أي مستلم",
          "النسخة الموقَّعة غير قابلة للتغيير؛ التصحيحات ملاحق لا استبدال",
        ],
        soon: [
          "الوصفة الإلكترونية والإرسال المباشر إلى السجل الصحي الوطني",
        ],
      },
    },
    moat: {
      title: "لماذا لا يمكن تجميع هذا من قطع متفرقة",
      sub: "كل خطوة موجودة في مكان ما كمنتج منفصل. المنعة في الحلقة التي تربطها — وفي الأساس الذي تقوم عليه.",
      items: [
        { t: "سيادي بحكم البناء", d: "يعمل التعرّف والتوليد والاسترجاع على نماذج مفتوحة الترخيص مستضافة ذاتيًا داخل تثبيتك. لا يصل أي صوت أو نص أو ملاحظة إلى واجهة برمجية خارجية — فلا يوجد نقل عابر للحدود يستوجب تبريرًا أمام الجهة التنظيمية." },
        { t: "امتثال داخل الشيفرة لا بجوارها", d: "عزل المستأجرين تفرضه قاعدة البيانات، ووصول الطوارئ يتطلب تبريرًا باسم صاحبه، وسجل تدقيق غير قابل للتعديل، وحذف بموافقة شخصين. النظام هو من يفرض ذلك، لا وثيقة سياسات." },
        { t: "أدلة ذات اختصاص قضائي", d: "الاسترجاع مقيّد ببروتوكولات المكان الذي تمارس فيه فعلًا وإرشاداته الوطنية، ويستشهد بالمقطع المستخدَم. النموذج العام لا يستطيع الاستشهاد بما لم يُعطَ له قط." },
        { t: "ينتهي بتوقيع لا بمسودة", d: "تصبح الملاحظة سجلًا طبيًا حين يتحمل طبيب مُسمّى المسؤولية عنها. المدوّنون الآخرون يسلّمونك مسودة ويتوقفون؛ الحلقة لا تُغلق إلا عند التوقيع." },
        { t: "متعدد اللغات حيث الرعاية متعددة اللغات", d: "إحدى عشرة لغة للواجهة وإملاء سريري متعدد اللغات — لأن الحديث والإرشاد والسجل غالبًا بثلاث لغات مختلفة." },
        { t: "سجل واحد ومصدر حقيقة واحد", d: "النص المفرَّغ والأدلة المستخدَمة والتوقيع تنتمي جميعها إلى السجل ذاته المُدار بالإصدارات. بلا خطوة تصدير، وبلا نظام ثانٍ، وبلا مطابقة لاحقة." },
      ],
    },
  },

  es: {
    category: "Plataforma soberana de confianza ambiental",
    usp: "La única plataforma de inteligencia clínica multilingüe y reforzada para el cumplimiento que convierte la consulta ambiental con el paciente en un registro médico estructurado, enriquecido con evidencia y firmado legalmente — en un único flujo de trabajo continuo.",
    soonLabel: "En integración",
    loop: {
      eyebrow: "El ciclo cerrado",
      title: "Escucha. Verifica. Autoriza.",
      sub: "La mayoría de las herramientas se detiene en un borrador. Klarnote lleva un mismo registro desde la primera palabra dicha hasta una firma jurídicamente vinculante — nada se reescribe, se exporta ni se vuelve a teclear en un segundo sistema.",
      foot: "Objetivo de diseño: menos de 60 segundos desde el final de la consulta hasta el registro firmado.",
      more: "Cómo funciona la plataforma",
      safety: "Klarnote sugiere; el clínico decide. Nada es definitivo sin una firma humana.",
    },
    pillars: {
      listen: {
        verb: "Escucha",
        tagline: "El reconocimiento de voz multilingüe en tiempo real estructura la consulta en su plantilla clínica mientras ocurre.",
        points: [
          "Captura ambiental en la consulta — o dictado directo en una plantilla de informe",
          "Reconocimiento multilingüe del habla clínica, con las palabras dudosas señaladas",
          "La nota cae en las secciones de su plantilla, no en un muro de texto",
        ],
      },
      verify: {
        verb: "Verifica",
        tagline: "La nota estructurada activa automáticamente una búsqueda de evidencia segura y localizada: protocolos nacionales, guías clínicas y literatura revisada por pares.",
        points: [
          "Sugerencias diagnósticas referidas a la nota que acaba de dictar",
          "Interacciones farmacológicas y contraindicaciones señaladas antes de firmar",
          "Cada respuesta trae el pasaje de origen — usted comprueba la fuente, no el modelo",
        ],
      },
      authorize: {
        verb: "Autoriza",
        tagline: "El clínico firma el registro final con una firma electrónica cualificada — jurídicamente vinculante, verificable públicamente y demostrable.",
        points: [
          "Firma electrónica cualificada (QES / КЕП) a través de Diia",
          "Un enlace público de verificación que puede abrir cualquier destinatario",
          "La versión firmada es inmutable; las correcciones son adendas, nunca sobrescrituras",
        ],
        soon: [
          "Receta electrónica y envío directo al registro nacional de salud",
        ],
      },
    },
    moat: {
      title: "Por qué esto no se puede ensamblar por piezas",
      sub: "Cada paso existe en algún sitio como producto separado. Lo defendible es el ciclo entre ellos — y aquello sobre lo que se apoya.",
      items: [
        { t: "Soberana por construcción", d: "El reconocimiento, la generación y la recuperación se ejecutan sobre modelos autoalojados de licencia abierta dentro de su propio despliegue. Ningún audio, transcripción o nota llega a una API de terceros: no hay transferencia transfronteriza que justificar ante el regulador." },
        { t: "Cumplimiento en el código, no al lado", d: "Aislamiento de inquilinos impuesto por la base de datos, acceso de emergencia que exige una justificación nominal, registro de auditoría inmutable y borrado a cuatro ojos. Lo impone el sistema, no un documento de políticas." },
        { t: "Evidencia con jurisdicción", d: "La recuperación está ligada a los protocolos y guías nacionales del lugar donde ejerce realmente, y cita el pasaje empleado. Un modelo generalista no puede citar lo que nunca recibió." },
        { t: "Termina en una firma, no en un borrador", d: "Una nota se convierte en registro médico cuando un clínico con nombre responde por ella. Otros escribas le entregan el borrador y ahí paran; el ciclo solo se cierra con la firma." },
        { t: "Multilingüe donde la atención lo es", d: "Once idiomas de interfaz y dictado clínico multilingüe — porque la consulta, la guía y el registro suelen estar en tres idiomas distintos." },
        { t: "Un registro, una fuente de verdad", d: "La transcripción, la evidencia consultada y la firma pertenecen al mismo registro versionado. Sin paso de exportación, sin segundo sistema, sin nada que conciliar después." },
      ],
    },
  },

  pt: {
    category: "Plataforma soberana de confiança ambiental",
    usp: "A única plataforma de inteligência clínica multilingue e reforçada para conformidade que transforma a consulta ambiental com o doente num registo médico estruturado, enriquecido com evidência e assinado legalmente — num único fluxo de trabalho contínuo.",
    soonLabel: "Em integração",
    loop: {
      eyebrow: "O ciclo fechado",
      title: "Ouve. Verifica. Autoriza.",
      sub: "A maioria das ferramentas para no rascunho. O Klarnote leva um mesmo registo da primeira palavra dita até uma assinatura juridicamente vinculativa — nada é reescrito, exportado ou introduzido uma segunda vez noutro sistema.",
      foot: "Objetivo de desenho: menos de 60 segundos entre o fim da consulta e o registo assinado.",
      more: "Como funciona a plataforma",
      safety: "O Klarnote sugere; o clínico decide. Nada se torna definitivo sem uma assinatura humana.",
    },
    pillars: {
      listen: {
        verb: "Ouve",
        tagline: "O reconhecimento de fala multilingue em tempo real estrutura a consulta no seu modelo clínico enquanto ela decorre.",
        points: [
          "Captação ambiental no consultório — ou ditado diretamente num modelo de relatório",
          "Reconhecimento multilingue da fala clínica, com as palavras duvidosas assinaladas",
          "A nota assenta nas secções do seu modelo, e não numa parede de texto",
        ],
      },
      verify: {
        verb: "Verifica",
        tagline: "A nota estruturada aciona automaticamente uma pesquisa de evidência segura e localizada: protocolos nacionais, normas clínicas e literatura revista por pares.",
        points: [
          "Sugestões de diagnóstico referidas à nota que acabou de ditar",
          "Interações medicamentosas e contraindicações assinaladas antes de assinar",
          "Cada resposta traz a passagem de origem — verifica a fonte, não o modelo",
        ],
      },
      authorize: {
        verb: "Autoriza",
        tagline: "O clínico assina o registo final com uma assinatura eletrónica qualificada — juridicamente vinculativa, publicamente verificável e demonstrável.",
        points: [
          "Assinatura eletrónica qualificada (QES / КЕП) através da Diia",
          "Uma ligação pública de verificação que qualquer destinatário pode abrir",
          "A versão assinada é imutável; as correções são adendas, nunca substituições",
        ],
        soon: [
          "Receita eletrónica e envio direto para o registo nacional de saúde",
        ],
      },
    },
    moat: {
      title: "Porque isto não se monta a partir de peças",
      sub: "Cada passo existe algures como produto separado. O que é defensável é o ciclo entre eles — e aquilo em que o ciclo assenta.",
      items: [
        { t: "Soberana por construção", d: "Reconhecimento, geração e pesquisa correm em modelos auto-alojados de licença aberta dentro da sua própria instalação. Nenhum áudio, transcrição ou nota chega a uma API de terceiros — não há transferência transfronteiriça para justificar perante o regulador." },
        { t: "Conformidade no código, não ao lado dele", d: "Isolamento de inquilinos imposto pela base de dados, acesso de emergência que exige justificação nominal, registo de auditoria imutável e eliminação a quatro olhos. É o sistema que o impõe, não um documento de política." },
        { t: "Evidência com jurisdição", d: "A pesquisa está ligada aos protocolos e às normas nacionais do local onde exerce de facto, e cita a passagem utilizada. Um modelo generalista não consegue citar aquilo que nunca lhe foi dado." },
        { t: "Termina numa assinatura, não num rascunho", d: "Uma nota torna-se registo médico quando um clínico identificado responde por ela. Outros escribas entregam o rascunho e ficam por aí; o ciclo só fecha na assinatura." },
        { t: "Multilingue onde os cuidados o são", d: "Onze idiomas de interface e ditado clínico multilingue — porque a consulta, a norma e o registo estão muitas vezes em três línguas diferentes." },
        { t: "Um registo, uma fonte de verdade", d: "A transcrição, a evidência consultada e a assinatura pertencem ao mesmo registo versionado. Sem passo de exportação, sem segundo sistema, sem nada para reconciliar depois." },
      ],
    },
  },
  lt: {
    category: "Suvereni aplinkos pasitikėjimo platforma",
    usp: "Vienintelė daugiakalbė, atitikčiai sustiprinta klinikinio intelekto platforma, kuri aplinkos būdu užfiksuotą konsultaciją su pacientu paverčia struktūrizuotu, įrodymais praturtintu ir teisiškai pasirašytu medicininiu įrašu — viename vientisame darbo sraute.",
    soonLabel: "Integruojama",
    loop: {
      eyebrow: "Uždaras ciklas",
      title: "Klauso. Tikrina. Patvirtina.",
      sub: "Dauguma įrankių sustoja ties juodraščiu. Klarnote veda tą patį įrašą nuo pirmo ištarto žodžio iki teisiškai įpareigojančio parašo — niekas neperrašoma, neeksportuojama ir antrą kartą nesuvedinėjama į kitą sistemą.",
      foot: "Projektinis tikslas: mažiau nei 60 sekundžių nuo konsultacijos pabaigos iki pasirašyto įrašo.",
      more: "Kaip veikia platforma",
      safety: "Klarnote siūlo; sprendžia gydytojas. Niekas netampa galutiniu be žmogaus parašo.",
    },
    pillars: {
      listen: {
        verb: "Klauso",
        tagline: "Daugiakalbis kalbos atpažinimas realiuoju laiku struktūrizuoja konsultaciją pagal jūsų klinikinį šabloną jai dar vykstant.",
        points: [
          "Aplinkos garso fiksavimas kabinete — arba diktavimas tiesiai į protokolo šabloną",
          "Daugiakalbis klinikinės kalbos atpažinimas su pažymėtais abejotinais žodžiais",
          "Įrašas guldomas į jūsų šablono skyrius, o ne į ištisinę teksto sieną",
        ],
      },
      verify: {
        verb: "Tikrina",
        tagline: "Struktūrizuotas įrašas automatiškai paleidžia saugią lokalizuotą įrodymų paiešką: nacionalinius protokolus, klinikines gaires ir recenzuotą literatūrą.",
        points: [
          "Diagnozių pasiūlymai, susieti su ką tik padiktuotu įrašu",
          "Vaistų sąveikos ir kontraindikacijos pažymimos prieš pasirašant",
          "Kiekvienas atsakymas pateikia šaltinio ištrauką — tikrinate šaltinį, ne modelį",
        ],
      },
      authorize: {
        verb: "Patvirtina",
        tagline: "Gydytojas pasirašo galutinį įrašą kvalifikuotu elektroniniu parašu — teisiškai įpareigojančiu, viešai patikrinamu ir įrodomu.",
        points: [
          "Kvalifikuotas elektroninis parašas (QES / КЕП)",
          "Vieša patikros nuoroda, kurią gali atverti bet kuris gavėjas",
          "Pasirašyta versija nekeičiama; pataisos yra priedai, o ne pakeitimai",
        ],
        soon: [
          "Elektroninis receptas ir tiesioginis siuntimas į nacionalinį sveikatos registrą",
        ],
      },
    },
    moat: {
      title: "Kodėl to nesudėsi iš atskirų dalių",
      sub: "Kiekvienas žingsnis kažkur egzistuoja kaip atskiras produktas. Apginama yra ciklas tarp jų — ir tai, ant ko tas ciklas stovi.",
      items: [
        { t: "Suvereni iš prigimties", d: "Atpažinimas, generavimas ir paieška veikia savarankiškai talpinamuose atviros licencijos modeliuose jūsų pačių aplinkoje. Nei garsas, nei transkripcija, nei įrašas nepasiekia trečiųjų šalių API — nėra tarpvalstybinio duomenų perdavimo, kurį reikėtų pagrįsti prižiūrėtojui." },
        { t: "Atitiktis kode, o ne šalia jo", d: "Duomenų bazės lygmeniu užtikrinta nuomininkų izoliacija, skubi prieiga su vardiniu pagrindimu, nekeičiamas audito žurnalas ir ištrynimas keturiomis akimis. Tai užtikrina sistema, o ne politikos dokumentas." },
        { t: "Įrodymai su jurisdikcija", d: "Paieška susieta su tos šalies, kurioje iš tikrųjų dirbate, protokolais ir nacionalinėmis gairėmis, ir cituoja panaudotą ištrauką. Bendrosios paskirties modelis negali cituoti to, kas jam niekada nebuvo pateikta." },
        { t: "Baigiasi parašu, o ne juodraščiu", d: "Įrašas tampa medicininiu dokumentu tada, kai už jį atsako identifikuotas gydytojas. Kiti asistentai atiduoda juodraštį ir tuo baigia; ciklas užsidaro tik parašu." },
        { t: "Daugiakalbis ten, kur daugiakalbė ir pati pagalba", d: "Dvylika sąsajos kalbų ir daugiakalbis klinikinis diktavimas — nes konsultacija, gairės ir įrašas dažnai būna trimis skirtingomis kalbomis." },
        { t: "Vienas įrašas, vienas tiesos šaltinis", d: "Transkripcija, peržiūrėti įrodymai ir parašas priklauso tam pačiam versijuojamam įrašui. Jokio eksporto žingsnio, jokios antros sistemos, nieko, ką paskui reikėtų suderinti." },
      ],
    },
  },
};

/* Resolve the positioning for one language, falling back to English per key so
   a partially translated language renders instead of crashing. The merge is
   deliberately shallow-per-section: a section either exists in a language or
   comes from English whole, which keeps a half-translated pillar from mixing
   two languages inside one card. */
/* ── The Bill pillar ──────────────────────────────────────────────────────
   Kept out of the TEXT blocks above and merged in below, for one reason that
   is worth the irregularity: every other pillar has shipped capabilities and
   this one has none. `points` is empty and all three claims sit in `soon`, so
   the landing card renders the roadmap strip and no check marks — the renderer
   already handles both, and a reviewer adding a fourth bullet here has to
   notice they are moving it out of the roadmap to do it.

   The per-country detail — which classification, which tariff, which file
   format — is deliberately NOT here. It lives in rcm.js, because it is data
   that changes when a national tariff changes, not positioning. */
const BILL = {
  uk: {
    verb: "Виставляє",
    tagline: "Підписаний запис — це вже майже рахунок: у ньому є все, що потрібно кодувальнику. Klarnote пропонує коди за класифікатором вашої країни і формує файл рахунку.",
    points: [],
    soon: [
      "Пропозиція кодів діагнозів і втручань за національним класифікатором",
      "Перевірка нотатки на факти, без яких рахунок не пройде",
      "Формування файлу рахунку у форматі платника — 11 країн",
    ],
  },
  en: {
    verb: "Bill",
    tagline: "A signed record is most of a claim already: it holds everything a coder needs. Klarnote proposes codes against your country's classification and builds the claim file.",
    points: [],
    soon: [
      "Diagnosis and procedure codes proposed against the national classification",
      "The note checked for the facts a claim will be rejected without",
      "A claim file in the payer's own format — eleven countries",
    ],
  },
  pl: {
    verb: "Rozlicza",
    tagline: "Podpisany dokument to już prawie rozliczenie: zawiera wszystko, czego potrzebuje koder. Klarnote proponuje kody według klasyfikacji Twojego kraju i tworzy plik rozliczeniowy.",
    points: [],
    soon: [
      "Propozycje kodów rozpoznań i procedur według klasyfikacji krajowej",
      "Sprawdzenie notatki pod kątem faktów, bez których rozliczenie przepadnie",
      "Plik rozliczeniowy w formacie płatnika — jedenaście krajów",
    ],
  },
  de: {
    verb: "Abrechnen",
    tagline: "Eine signierte Dokumentation ist fast schon eine Abrechnung: sie enthält alles, was eine Kodierfachkraft braucht. Klarnote schlägt Kodes nach der Klassifikation Ihres Landes vor und erzeugt die Abrechnungsdatei.",
    points: [],
    soon: [
      "Diagnose- und Prozedurenkodes nach der nationalen Klassifikation vorgeschlagen",
      "Die Dokumentation auf die Angaben geprüft, ohne die abgewiesen wird",
      "Eine Abrechnungsdatei im Format des Kostenträgers — elf Länder",
    ],
  },
  ro: {
    verb: "Facturează",
    tagline: "O notă semnată este deja aproape o decontare: conține tot ce îi trebuie unui codificator. Klarnote propune coduri conform clasificării țării dumneavoastră și construiește fișierul de decontare.",
    points: [],
    soon: [
      "Coduri de diagnostic și de procedură propuse după clasificarea națională",
      "Nota verificată pentru faptele fără de care decontarea este respinsă",
      "Un fișier în formatul propriu al plătitorului — unsprezece țări",
    ],
  },
  cs: {
    verb: "Vyúčtuje",
    tagline: "Podepsaný záznam je už skoro vyúčtování: obsahuje vše, co kodér potřebuje. Klarnote navrhuje kódy podle klasifikace vaší země a vytváří dávku.",
    points: [],
    soon: [
      "Kódy diagnóz a výkonů navržené podle národní klasifikace",
      "Záznam zkontrolovaný na údaje, bez nichž bude dávka odmítnuta",
      "Dávka ve formátu plátce — jedenáct zemí",
    ],
  },
  sr: {
    verb: "Fakturiše",
    tagline: "Potpisan nalaz je već skoro faktura: sadrži sve što koderu treba. Klarnote predlaže šifre prema klasifikaciji vaše zemlje i pravi fakturu.",
    points: [],
    soon: [
      "Šifre dijagnoza i procedura predložene prema nacionalnoj klasifikaciji",
      "Nalaz proveren na činjenice bez kojih faktura biva odbijena",
      "Faktura u formatu platioca — jedanaest zemalja",
    ],
  },
  hu: {
    verb: "Elszámol",
    tagline: "Az aláírt dokumentáció már majdnem elszámolás: minden benne van, amire a kódolónak szüksége van. A Klarnote az Ön országának osztályozása szerint javasol kódokat, és elkészíti az elszámolási állományt.",
    points: [],
    soon: [
      "Diagnózis- és beavatkozáskódok javaslata a nemzeti osztályozás szerint",
      "A dokumentáció ellenőrzése azokra az adatokra, amelyek híján elutasítják",
      "Elszámolási állomány a finanszírozó formátumában — tizenegy ország",
    ],
  },
  ar: {
    verb: "يُطالِب",
    tagline: "السجل الموقَّع يكاد يكون مطالبة: فيه كل ما يحتاجه المرمِّز. يقترح Klarnote الرموز وفق تصنيف بلدك وينشئ ملف المطالبة.",
    points: [],
    soon: [
      "اقتراح رموز التشخيص والإجراءات وفق التصنيف الوطني",
      "فحص الملاحظة بحثًا عن الوقائع التي تُرفض المطالبة بدونها",
      "ملف مطالبة بصيغة الجهة الدافعة — أحد عشر بلدًا",
    ],
  },
  es: {
    verb: "Factura",
    tagline: "Un registro firmado es ya casi una reclamación: contiene todo lo que un codificador necesita. Klarnote propone códigos según la clasificación de su país y genera el fichero de facturación.",
    points: [],
    soon: [
      "Códigos de diagnóstico y procedimiento propuestos según la clasificación nacional",
      "La nota revisada en busca de los datos sin los cuales se rechaza",
      "Un fichero en el formato propio del pagador — once países",
    ],
  },
  pt: {
    verb: "Fatura",
    tagline: "Um registo assinado é já quase uma faturação: contém tudo o que um codificador precisa. O Klarnote propõe códigos segundo a classificação do seu país e gera o ficheiro.",
    points: [],
    soon: [
      "Códigos de diagnóstico e de procedimento propostos segundo a classificação nacional",
      "A nota verificada quanto aos factos sem os quais é rejeitada",
      "Um ficheiro no formato do pagador — onze países",
    ],
  },
};

for (const [code, pillar] of Object.entries(BILL)) TEXT[code].pillars.bill = pillar;

export function positioning(lang) {
  const en = TEXT.en;
  const t = TEXT[lang] || en;
  const pillars = {};
  for (const p of PILLARS) pillars[p.key] = t.pillars?.[p.key] || en.pillars[p.key];
  return {
    category: t.category || en.category,
    usp: t.usp || en.usp,
    soonLabel: t.soonLabel || en.soonLabel,
    loop: t.loop || en.loop,
    moat: t.moat || en.moat,
    pillars,
  };
}

/* The three pillars, resolved and joined with their shape — what every
   renderer actually iterates over. */
export function pillars(lang) {
  const p = positioning(lang);
  return PILLARS.map((shape) => ({ ...shape, ...p.pillars[shape.key] }));
}

/* The moat cards, resolved and joined with their icons. */
export function moatItems(lang) {
  const { moat } = positioning(lang);
  return moat.items.map((it, i) => ({ ...it, icon: MOAT_ICONS[i] || "check" }));
}

/* Languages this file is written out in — the parity test reads this. */
export const TRANSLATED = Object.keys(TEXT);

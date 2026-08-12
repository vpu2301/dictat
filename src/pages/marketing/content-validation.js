// content-validation.js — /validation. How the product is measured, and what
// has not been measured yet.
//
// Modelled on the "Validation comes first" section simile.com puts one click
// from its homepage: build → measure → gate → check it yourself, in four plain
// panels, ahead of any feature copy. The argument that page makes is the one
// this product needs to make even harder, because a simulation that is wrong
// costs a decision and a clinical record that is wrong costs a patient.
//
// ── THE ONE RULE IN THIS FILE ─────────────────────────────────────────────
// Not a single accuracy figure is invented. The eval harness, the corpus
// schema, the scoring decisions and the release gate below are all real and
// are described exactly as they are implemented (medical-dictation-backend:
// `scripts/eval/run_wer.py`, `eval/corpus/v1/`, `docs/eval/wer-methodology.md`,
// ADR-0019). What is NOT real yet is any measured number: corpus v1 currently
// ships placeholder fixtures rather than speech, so every stored run scores
// WER = 1.0, and the per-sprint result tables are still empty templates.
//
// So this page publishes the METHOD and states the absence of results in its
// own block, rather than quietly omitting it. That is the same rule the
// landing page's loop animation follows for Billing (WorkflowGraph.jsx) and
// positioning.js follows for every `soon` claim: a product whose whole pitch
// is traceability cannot put a plausible-looking number on its own website.
// The moment a gate run on the GPU rig produces real figures, they replace
// `notYet` below and the targets stop being the only numbers here.
//
// Languages: uk / en / de are written out; everything else falls back to en
// through `t()`, which is how the rest of the content registry behaves.

/* The targets are the ONLY numbers on this page, they were set before the
   runs, and they are labelled as targets everywhere they appear. From
   docs/eval/sprint-04-streaming-wer.md — batch figures are the sprint-03
   gate, streaming is allowed one absolute point of drift on top. */
const TARGETS = [
  { key: "uk-general",    lang: "uk", specialty: { uk: "загальна практика", en: "general practice", de: "Allgemeinmedizin" }, batch: "≤ 0.18", stream: "≤ 0.19" },
  { key: "uk-cardiology", lang: "uk", specialty: { uk: "кардіологія", en: "cardiology", de: "Kardiologie" }, batch: "≤ 0.14", stream: "≤ 0.15" },
  { key: "en-general",    lang: "en", specialty: { uk: "загальна практика", en: "general practice", de: "Allgemeinmedizin" }, batch: "≤ 0.10", stream: "≤ 0.11" },
  { key: "en-cardiology", lang: "en", specialty: { uk: "кардіологія", en: "cardiology", de: "Kardiologie" }, batch: "≤ 0.08", stream: "≤ 0.09" },
];

export function buildValidationPages(lang, cta) {
  const t = (m) => m[lang] ?? m.en;

  return {
    validation: {
      hero: {
        icon: "shield",
        eyebrow: t({ uk: "Валідація", en: "Validation", de: "Validierung" }),
        title: t({
          uk: "Спершу — перевірка.",
          en: "Validation comes first.",
          de: "Validierung zuerst.",
        }),
        sub: t({
          uk: "Медичний запис, який неможливо перевірити, — це не документ, а ризик. Ось як Klarnote вимірюється, що означає кожне число і які з них ми ще не опублікували.",
          en: "A clinical record you cannot check is not a document, it is a liability. This is how Klarnote is measured, what each number means, and which of them we have not published yet.",
          de: "Eine klinische Aufzeichnung, die sich nicht überprüfen lässt, ist kein Dokument, sondern ein Risiko. So wird Klarnote gemessen, das bedeutet jede Kennzahl — und diese haben wir noch nicht veröffentlicht.",
        }),
        points: [
          t({ uk: "Версійований корпус із задокументованим походженням", en: "A versioned corpus with documented provenance", de: "Ein versionierter Korpus mit dokumentierter Herkunft" }),
          t({ uk: "Цілі, встановлені до запуску, а не після", en: "Targets set before the run, not after it", de: "Zielwerte vor dem Lauf festgelegt, nicht danach" }),
          t({ uk: "Кожен підписаний запис можна перевірити без облікового запису", en: "Every signed record verifiable without an account", de: "Jede signierte Aufzeichnung ohne Konto überprüfbar" }),
        ],
      },
      blocks: [
        {
          type: "prose",
          heading: t({
            uk: "Чому ця сторінка існує",
            en: "Why this page exists",
            de: "Warum es diese Seite gibt",
          }),
          paragraphs: [
            t({
              uk: "Система, що розпізнає мовлення «на 95 %», помиляється в кожному двадцятому слові. У клінічній нотатці ці слова не розподілені рівномірно: найдорожчі з них — дози, тиски, латеральність і заперечення. «Здебільшого правильно» — не властивість медичного документа.",
              en: "A system that is “95% accurate” is wrong about one word in twenty. In a clinical note those words are not evenly distributed: the expensive ones are doses, blood pressures, laterality and negation. “Mostly right” is not a property a medical document can have.",
              de: "Ein System, das „zu 95 % genau“ ist, irrt sich bei jedem zwanzigsten Wort. In einer klinischen Notiz sind diese Wörter nicht gleich verteilt: Die teuren sind Dosierungen, Blutdruckwerte, Seitenangaben und Verneinungen. „Weitgehend richtig“ ist keine Eigenschaft, die ein medizinisches Dokument haben kann.",
            }),
            t({
              uk: "Тому вимірювання тут — не маркетинговий етап у кінці розробки, а ворота релізу, через які проходить кожна зміна моделі, промпту чи аудіотракту. Нижче — як саме, у тому самому порядку, у якому це відбувається.",
              en: "So measurement here is not a marketing step at the end of development. It is a release gate every change to a model, a prompt or the audio path has to pass. Below is how it works, in the order it happens.",
              de: "Messung ist hier deshalb kein Marketingschritt am Ende der Entwicklung, sondern ein Release-Gate, das jede Änderung an Modell, Prompt oder Audiopfad passieren muss. Unten steht, wie das abläuft — in der Reihenfolge, in der es geschieht.",
            }),
          ],
        },

        {
          type: "steps",
          heading: t({
            uk: "Як це вимірюється",
            en: "How it is measured",
            de: "Wie gemessen wird",
          }),
          items: [
            {
              n: "01",
              title: t({ uk: "Як будується корпус", en: "How the corpus is built", de: "Wie der Korpus entsteht" }),
              desc: t({
                uk: "Еталонний набір версійований: кожне висловлювання лежить окремо разом із золотою транскрипцією та метаданими — мова, спеціальність, тривалість і походження. Походження буває двох видів: знеособлений реальний запис, у якому імена, дати й ІПН замінено лінгвістом і перевірено клінічним редактором та DPO, або запис, авторськи створений лінгвістом. Третього не буває, і це записано в метаданих кожного файлу.",
                en: "The reference set is versioned. Every utterance sits on its own with a gold transcript and metadata: language, specialty, duration and provenance. Provenance has exactly two values — an anonymised real recording, whose names, dates and national ID numbers were replaced by a linguist and reviewed by the clinical content lead and the DPO, or a recording authored by a linguist outright. There is no third kind, and the file says which it is.",
                de: "Das Referenzset ist versioniert. Jede Äußerung steht für sich, mit Goldtranskript und Metadaten: Sprache, Fachgebiet, Dauer und Herkunft. Herkunft kennt genau zwei Werte — eine anonymisierte echte Aufnahme, deren Namen, Daten und Personenkennziffern von einer Linguistin ersetzt und von der klinischen Redaktion sowie der DSB geprüft wurden, oder eine von einer Linguistin verfasste Aufnahme. Ein Drittes gibt es nicht, und die Datei sagt, welches von beiden.",
              }),
            },
            {
              n: "02",
              title: t({ uk: "Що саме рахується", en: "What is actually counted", de: "Was tatsächlich gezählt wird" }),
              desc: t({
                uk: "Для кожного висловлювання — WER, CER і RTF, а поверх них окрема оцінка нормалізації чисел, розбита за категоріями: тиск і доза рахуються нарізно. Це навмисно: середній показник по нотатці ховає саме ту помилку, заради якої все це вимірюється.",
                en: "For each utterance: WER, CER and RTF, and on top of them a separate number-normalisation score broken out by category — blood pressures and doses counted apart from each other. That split is deliberate. An average across the note hides precisely the error the measurement exists to catch.",
                de: "Für jede Äußerung: WER, CER und RTF, dazu eine eigene Bewertung der Zahlennormalisierung, aufgeschlüsselt nach Kategorie — Blutdruckwerte und Dosierungen getrennt gezählt. Diese Trennung ist Absicht: Ein Mittelwert über die Notiz verdeckt genau den Fehler, dessentwegen gemessen wird.",
              }),
            },
            {
              n: "03",
              title: t({ uk: "Як рахується українська", en: "How Ukrainian is scored", de: "Wie Ukrainisch bewertet wird" }),
              desc: t({
                uk: "Відмінкові закінчення не зрізаються. «Інфаркту» замість «інфаркт» — це справжня помилка, і вона рахується як помилка; апостроф зберігається, діакритика не згортається. Англомовна токенізація «за замовчуванням» приховала б усе це й дала б красивіше число на тому самому аудіо.",
                en: "Case endings are not stripped. “Інфаркту” where the reference says “інфаркт” is a real error and is counted as one; the apostrophe is preserved and diacritics are not folded. Off-the-shelf English tokenisation would mask all of that and return a prettier number on identical audio.",
                de: "Kasusendungen werden nicht entfernt. „Інфаркту“ statt „інфаркт“ ist ein echter Fehler und wird als solcher gezählt; der Apostroph bleibt erhalten, Diakritika werden nicht zusammengefasst. Eine englische Standard-Tokenisierung würde all das verbergen und bei identischem Audio eine schönere Zahl liefern.",
              }),
            },
            {
              n: "04",
              title: t({ uk: "Що вважається воротами релізу", en: "What counts as the release gate", de: "Was als Release-Gate zählt" }),
              desc: t({
                uk: "Значення мають лише числа з GPU-стенда, де працює та сама конфігурація, що й у продакшені: large-v3 у fp16. Прогін на ноутбуці з моделлю tiny на CPU перевіряє справність самого конвеєра — від контролю цілісності корпусу до запису результатів — і ніколи не є сигналом до релізу. Це записано в методології, щоб зручне число не можна було випадково видати за гейтове.",
                en: "Only numbers from the GPU rig count, running the configuration production runs: large-v3 in fp16. A laptop run on CPU with the tiny model checks that the pipeline itself works — integrity check, decode, inference, scoring, outputs — and is never a release signal. The methodology says so in writing, so that a convenient number cannot quietly be presented as a gate number.",
                de: "Es zählen nur Zahlen vom GPU-Rig, das die Produktionskonfiguration fährt: large-v3 in fp16. Ein Laptop-Lauf auf der CPU mit dem Tiny-Modell prüft, ob die Pipeline funktioniert — Integritätsprüfung, Dekodierung, Inferenz, Bewertung, Ausgaben — und ist nie ein Release-Signal. Das steht so in der Methodik, damit eine bequeme Zahl nicht stillschweigend als Gate-Zahl ausgegeben werden kann.",
              }),
            },
          ],
        },

        {
          type: "grid",
          /* Two, not four. ContentPage only implements a 2-column variant and
             falls back to its 3-column default for anything else, which left
             the fourth metric stranded on a row of its own — and the fourth is
             the one that matters most here. */
          cols: 2,
          heading: t({
            uk: "Що означає кожне число",
            en: "What each number means",
            de: "Was jede Kennzahl bedeutet",
          }),
          sub: t({
            uk: "Чотири показники, і жоден із них сам по собі не описує якість нотатки.",
            en: "Four measures, and not one of them describes the quality of a note on its own.",
            de: "Vier Kennzahlen — und keine davon beschreibt für sich allein die Qualität einer Notiz.",
          }),
          items: [
            {
              icon: "fileText",
              title: "WER",
              desc: t({
                uk: "Частка слів, які довелося б виправити: відстань Левенштейна між розпізнаним і еталонним текстом, поділена на довжину еталона. 0,14 означає сім правильних слів із восьми.",
                en: "The share of words you would have to fix: Levenshtein distance between hypothesis and reference, divided by the reference length. 0.14 means seven words right out of eight.",
                de: "Der Anteil der Wörter, die korrigiert werden müssten: Levenshtein-Distanz zwischen Hypothese und Referenz, geteilt durch die Referenzlänge. 0,14 heißt sieben von acht Wörtern richtig.",
              }),
            },
            {
              icon: "layers",
              title: "CER",
              desc: t({
                uk: "Те саме на рівні символів. Потрібне там, де WER надто грубий: одна літера у назві препарату — це інше слово, але зовсім не та сама помилка, що й пропущене речення.",
                en: "The same at character level. It matters where WER is too blunt: one letter inside a drug name is a different word, but it is not the same failure as a dropped sentence.",
                de: "Dasselbe auf Zeichenebene. Wichtig dort, wo WER zu grob ist: Ein Buchstabe in einem Wirkstoffnamen ergibt ein anderes Wort — aber nicht denselben Fehler wie ein ausgelassener Satz.",
              }),
            },
            {
              icon: "clock",
              title: "RTF",
              desc: t({
                uk: "Скільки секунд обробки припадає на секунду аудіо. Це не про якість, а про те, чи встигає система за прийомом — показник, який визначає, чи можна нею користуватися під час візиту, а не після нього.",
                en: "Seconds of processing per second of audio. Not a quality measure but a usability one: it decides whether the system keeps up with a consultation instead of trailing it.",
                de: "Sekunden Verarbeitung pro Sekunde Audio. Kein Qualitäts-, sondern ein Nutzbarkeitsmaß: Es entscheidet, ob das System der Sprechstunde folgen kann, statt ihr hinterherzulaufen.",
              }),
            },
            {
              icon: "shield",
              title: t({ uk: "Нормалізація чисел", en: "Number normalisation", de: "Zahlennormalisierung" }),
              desc: t({
                uk: "Чи перетворилося сказане вголос «сто шістдесят вісім на дев'яносто шість» на 168/96, а «п'ять міліграмів» — на 5 мг. Рахується окремо за категоріями, бо саме тут помилка коштує найдорожче.",
                en: "Whether “one hundred sixty-eight over ninety-six”, spoken aloud, became 168/96 — and “five milligrams” became 5 mg. Scored per category, because this is where an error costs the most.",
                de: "Ob aus dem gesprochenen „hundertachtundsechzig zu sechsundneunzig“ 168/96 wurde — und aus „fünf Milligramm“ 5 mg. Pro Kategorie bewertet, weil ein Fehler hier am teuersten ist.",
              }),
            },
          ],
        },

        {
          type: "spec",
          heading: t({
            uk: "Цілі, встановлені до прогону",
            en: "Targets, set before the run",
            de: "Zielwerte, vor dem Lauf festgelegt",
          }),
          sub: t({
            uk: "Це цільові пороги WER, а не виміряні результати. Вони записані заздалегідь саме для того, щоб потім не можна було підігнати планку під отримане число. Потокове розпізнавання має право на один абсолютний пункт понад пакетне.",
            en: "These are target WER thresholds, not measured results. They are written down in advance precisely so the bar cannot be moved to fit whatever the run returns. Streaming is allowed one absolute point on top of batch.",
            de: "Dies sind Ziel-WER-Schwellen, keine gemessenen Ergebnisse. Sie werden im Voraus festgehalten, damit die Messlatte nicht nachträglich an das Ergebnis angepasst werden kann. Streaming darf einen absoluten Punkt über Batch liegen.",
          }),
          rows: TARGETS.map((row) => ({
            key: row.key,
            label: `${row.lang.toUpperCase()} · ${t(row.specialty)}`,
            value: t({
              uk: `пакетне ${row.batch} · потокове ${row.stream}`,
              en: `batch ${row.batch} · streaming ${row.stream}`,
              de: `Batch ${row.batch} · Streaming ${row.stream}`,
            }),
          })),
        },

        {
          type: "prose",
          heading: t({
            uk: "Чого ми ще не опублікували",
            en: "What we have not published yet",
            de: "Was wir noch nicht veröffentlicht haben",
          }),
          lead: t({
            uk: "Виміряних показників точності на цій сторінці немає — і це навмисно, а не через недогляд.",
            en: "There are no measured accuracy figures on this page — deliberately, not by omission.",
            de: "Auf dieser Seite stehen keine gemessenen Genauigkeitswerte — bewusst, nicht aus Versehen.",
          }),
          paragraphs: [
            t({
              uk: "Механіка вимірювання працює: гарматура прогонів, схема корпусу, правила підрахунку й ворота релізу — усе описане вище реалізоване й запускається однією командою. Чого бракує — це самого корпусу: версія v1 наразі містить службові фікстури замість справжнього мовлення, тож кожен збережений прогін дає WER = 1,0. Це число вимірює порожнечу, а не систему.",
              en: "The measuring apparatus works: the harness, the corpus schema, the scoring rules and the release gate described above are all implemented and run from one command. What is missing is the corpus itself — version v1 currently holds placeholder fixtures rather than real speech, so every stored run scores WER = 1.0. That number measures an absence, not a system.",
              de: "Der Messapparat funktioniert: Harness, Korpusschema, Bewertungsregeln und das oben beschriebene Release-Gate sind implementiert und mit einem Befehl ausführbar. Was fehlt, ist der Korpus selbst — Version v1 enthält derzeit Platzhalter statt echter Sprache, sodass jeder gespeicherte Lauf WER = 1,0 ergibt. Diese Zahl misst eine Leerstelle, kein System.",
            }),
            t({
              uk: "Опублікувати натомість чуже число з наукової статті або власну оцінку «приблизно» було б простіше — і саме тому цього тут немає. Числа з'являться на цій сторінці тоді, коли корпус буде озвучено лінгвістами й клінічним редактором і прогін на GPU-стенді дасть результат, який можна повторити. Разом із ними ми опублікуємо версію корпусу, модель і дату прогону, щоб число можна було перевірити, а не просто прочитати.",
              en: "Publishing somebody else's figure from a paper, or a round “about” of our own, would have been easier — which is exactly why neither is here. Numbers will appear on this page when the corpus has been voiced by linguists and the clinical content lead, and a run on the GPU rig produces a result that reproduces. They will arrive with the corpus version, the model and the run date attached, so the figure can be checked rather than merely read.",
              de: "Eine fremde Zahl aus einer Publikation zu übernehmen oder ein gerundetes eigenes „etwa“ anzugeben, wäre einfacher gewesen — genau deshalb steht beides nicht hier. Zahlen erscheinen auf dieser Seite, sobald der Korpus von Linguistinnen und der klinischen Redaktion eingesprochen wurde und ein Lauf auf dem GPU-Rig ein reproduzierbares Ergebnis liefert. Sie kommen mit Korpusversion, Modell und Laufdatum, damit sich die Zahl prüfen und nicht nur lesen lässt.",
            }),
          ],
        },

        {
          type: "grid",
          cols: 2,
          heading: t({
            uk: "Що можна перевірити вже сьогодні",
            en: "What you can check today",
            de: "Was Sie heute schon prüfen können",
          }),
          sub: t({
            uk: "Валідація виробника — це половина. Друга половина — можливість перевірити нас без нас.",
            en: "A vendor's own validation is half of it. The other half is being able to check us without us.",
            de: "Die eigene Validierung eines Anbieters ist die eine Hälfte. Die andere ist, uns ohne uns überprüfen zu können.",
          }),
          items: [
            {
              icon: "sign",
              title: t({ uk: "Будь-який підпис — публічно", en: "Any signature, publicly", de: "Jede Signatur, öffentlich" }),
              desc: t({
                uk: "Кожен підписаний запис має посилання перевірки, яке відкриє будь-хто — без облікового запису й без нашої участі. Підпис або сходиться, або ні; наше слово тут ні до чого.",
                en: "Every signed record carries a verification link anyone can open — no account, and no involvement from us. The signature either checks out or it does not; our word does not enter into it.",
                de: "Jede signierte Aufzeichnung trägt einen Prüf-Link, den jeder öffnen kann — ohne Konto und ohne unser Zutun. Die Signatur stimmt oder sie stimmt nicht; unser Wort spielt dabei keine Rolle.",
              }),
            },
            {
              icon: "book",
              title: t({ uk: "Джерела, які відкриваються", en: "Citations that open", de: "Quellen, die sich öffnen" }),
              desc: t({
                uk: "Кожне посилання на доказ веде до справжньої настанови чи дослідження з його походженням. Якщо джерело не відкривається — це помилка, а не стиль оформлення.",
                en: "Every evidence citation resolves to a real guideline or trial with its provenance attached. A citation that does not open is a defect here, not a formatting style.",
                de: "Jeder Evidenzverweis führt zu einer echten Leitlinie oder Studie samt Herkunft. Ein Verweis, der sich nicht öffnen lässt, ist hier ein Fehler und keine Darstellungsfrage.",
              }),
            },
            {
              icon: "history",
              title: t({ uk: "Журнал, який ви читаєте самі", en: "An audit log you read yourself", de: "Ein Protokoll, das Sie selbst lesen" }),
              desc: t({
                uk: "Хто, коли й що відкривав — записано на боці замовника й доступне адміністратору клініки. Перевірка доступу не потребує звернення до нас.",
                en: "Who opened what, and when, is recorded on the customer's side and readable by the clinic's own administrator. Checking access does not require asking us.",
                de: "Wer wann was geöffnet hat, wird auf Kundenseite protokolliert und ist für die Administration der Klinik einsehbar. Eine Zugriffsprüfung erfordert keine Anfrage bei uns.",
              }),
            },
            {
              icon: "server",
              title: t({ uk: "Виміряйте на своєму", en: "Measure it on your own", de: "Messen Sie es selbst" }),
              desc: t({
                uk: "Платформа розгортається у вашій інфраструктурі, тож той самий прогін можна зробити на власних записах і власною мовою. Ми не навчаємо моделі на даних замовника — це записано в договорі про обробку, а не лише тут.",
                en: "The platform deploys into your own infrastructure, so the same evaluation can be run on your recordings in your language. We do not train models on customer data — that is written into the data processing agreement, not only here.",
                de: "Die Plattform läuft in Ihrer eigenen Infrastruktur, dieselbe Auswertung lässt sich also mit Ihren Aufnahmen in Ihrer Sprache fahren. Wir trainieren keine Modelle mit Kundendaten — das steht im Auftragsverarbeitungsvertrag, nicht nur hier.",
              }),
            },
          ],
        },

        {
          type: "faq",
          heading: t({ uk: "Питання, які тут доречні", en: "Fair questions", de: "Berechtigte Fragen" }),
          items: [
            {
              q: t({
                uk: "Чому ви не наводите відсоток точності, як інші?",
                en: "Why is there no accuracy percentage, the way others have one?",
                de: "Warum steht hier kein Genauigkeitsprozentsatz wie bei anderen?",
              }),
              a: t({
                uk: "Бо ми його ще не виміряли на власному корпусі, а чуже число нічого не говорить про вашу мову, спеціальність і мікрофон. Коли прогін на гейтовій конфігурації дасть відтворюваний результат, він з'явиться тут — із версією корпусу, моделлю й датою.",
                en: "Because we have not measured it on our own corpus yet, and somebody else's figure says nothing about your language, your specialty or your microphone. When a run on the gate configuration produces a reproducible result, it appears here — with the corpus version, the model and the date attached.",
                de: "Weil wir ihn auf unserem eigenen Korpus noch nicht gemessen haben und eine fremde Zahl nichts über Ihre Sprache, Ihr Fachgebiet und Ihr Mikrofon aussagt. Sobald ein Lauf in der Gate-Konfiguration ein reproduzierbares Ergebnis liefert, steht er hier — mit Korpusversion, Modell und Datum.",
              }),
            },
            {
              q: t({
                uk: "Чи можна прогнати оцінку на наших власних записах?",
                en: "Can the evaluation be run on our own recordings?",
                de: "Lässt sich die Auswertung mit unseren eigenen Aufnahmen fahren?",
              }),
              a: t({
                uk: "Так — це і є сенс самостійного розгортання. Потрібні аудіо, еталонні транскрипції та ті самі метадані; методологія підрахунку одна й та сама, тож ваші числа можна порівнювати з нашими.",
                en: "Yes — that is the point of running it on your own infrastructure. You need audio, gold transcripts and the same metadata; the scoring methodology is identical, so your numbers are comparable with ours.",
                de: "Ja — genau dafür ist der Betrieb in eigener Infrastruktur da. Sie brauchen Audio, Goldtranskripte und dieselben Metadaten; die Bewertungsmethodik ist identisch, Ihre Zahlen sind also mit unseren vergleichbar.",
              }),
            },
            {
              q: t({
                uk: "Що відбувається, коли зміна погіршує показники?",
                en: "What happens when a change makes the numbers worse?",
                de: "Was passiert, wenn eine Änderung die Werte verschlechtert?",
              }),
              a: t({
                uk: "Прогін падає з помилкою регресії, і зміна не їде далі. Саме тому ворота — це запуск у збірці, а не таблиця, яку хтось переглядає раз на квартал.",
                en: "The run fails with a regression error and the change does not ship. That is why the gate is a command in the build rather than a spreadsheet somebody reviews once a quarter.",
                de: "Der Lauf schlägt mit einem Regressionsfehler fehl und die Änderung geht nicht live. Deshalb ist das Gate ein Befehl im Build und keine Tabelle, die jemand einmal im Quartal durchsieht.",
              }),
            },
          ],
        },

        cta,
      ],
    },
  };
}

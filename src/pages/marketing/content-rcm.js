// content-rcm.js — /rcm and the eleven country pages under it.
//
// The hub explains what Klarnote intends to do with the revenue cycle; each
// country page names the classification, the rulebook, the tariff and the file
// format that apply THERE. The facts come from rcm.js and are never retyped
// here — this file is framing and nothing else.
//
// Every page on this route is roadmap. `soonLabel` from positioning.js is
// rendered in the hero of the hub and in a dedicated block on every country
// page, and rcm.test.js fails the build if a country page loses it. RCM is
// exactly the kind of claim a buyer will test in a demo, and a claim-file
// generator that does not exist yet is not something to be coy about.
//
// Block types are ContentPage.jsx's: prose / grid / steps / spec / faq /
// backlink / cta. `spec` is new and was added for this route — a coding stack
// is a label/value table, and forcing it into a bullet list would have lost
// the one thing a coder reads it for.

import { positioning, pillars } from "./positioning.js";
import { rcmCountries, rcmCountry } from "./rcm.js";

/* Framing copy, in all eleven interface languages. Kept in one object rather
   than inline so a translator can see the whole surface at once. */
const T = {
  eyebrow: { uk: "Цикл доходів", en: "Revenue cycle", pl: "Cykl przychodów", de: "Erlöszyklus", ro: "Ciclul veniturilor", cs: "Cyklus výnosů", sr: "Ciklus prihoda", hu: "Bevételi ciklus", ar: "دورة الإيرادات", es: "Ciclo de ingresos", pt: "Ciclo de receitas" },

  hubTitle: { uk: "Кодування та рахунки — окремо для кожної країни", en: "Coding and claim files — country by country", pl: "Kodowanie i rozliczenia — osobno dla każdego kraju", de: "Kodierung und Abrechnung — Land für Land", ro: "Codificare și decontare — de la țară la țară", cs: "Kódování a vyúčtování — země po zemi", sr: "Kodiranje i fakturisanje — država po država", hu: "Kódolás és elszámolás — országonként", ar: "الترميز وملفات المطالبات — بلدًا بلدًا", es: "Codificación y facturación — país por país", pt: "Codificação e faturação — país a país" },

  hubSub: {
    uk: "Продиктована нотатка вже містить усе, що потрібно для рахунку: латеральність, тривалість, супутні стани, витратні матеріали. Klarnote пропонує коди за класифікатором, чинним саме у вашій країні, і формує файл рахунку у форматі, якого очікує ваш платник.",
    en: "The dictated note already contains what a claim needs: laterality, duration, comorbidity, materials consumed. Klarnote proposes codes against the classification actually in force in your country, and builds the claim file in the format your payer expects.",
    pl: "Podyktowana notatka zawiera już wszystko, czego potrzebuje rozliczenie: stronność, czas trwania, choroby współistniejące, zużyte materiały. Klarnote proponuje kody według klasyfikacji obowiązującej w Twoim kraju i tworzy plik rozliczeniowy w formacie, którego oczekuje płatnik.",
    de: "Die diktierte Dokumentation enthält bereits alles, was eine Abrechnung braucht: Seitenlokalisation, Dauer, Begleiterkrankungen, verbrauchte Materialien. Klarnote schlägt Kodes nach der in Ihrem Land tatsächlich geltenden Klassifikation vor und erzeugt die Abrechnungsdatei im Format, das Ihr Kostenträger erwartet.",
    ro: "Nota dictată conține deja ce îi trebuie unei decontări: lateralitatea, durata, comorbiditățile, materialele consumate. Klarnote propune coduri conform clasificării aflate efectiv în vigoare în țara dumneavoastră și construiește fișierul de decontare în formatul așteptat de plătitor.",
    cs: "Nadiktovaný záznam už obsahuje vše, co vyúčtování potřebuje: stranu, trvání, přidružená onemocnění, spotřebovaný materiál. Klarnote navrhuje kódy podle klasifikace skutečně platné ve vaší zemi a vytváří dávku ve formátu, který plátce očekává.",
    sr: "Izdiktirani nalaz već sadrži ono što fakturi treba: stranu, trajanje, komorbiditete, utrošeni materijal. Klarnote predlaže šifre prema klasifikaciji koja zaista važi u vašoj zemlji i pravi fakturu u formatu koji vaš platilac očekuje.",
    hu: "A diktált dokumentáció már tartalmazza, amire az elszámolásnak szüksége van: oldaliságot, időtartamot, kísérőbetegségeket, felhasznált anyagokat. A Klarnote az Ön országában ténylegesen hatályos osztályozás szerint javasol kódokat, és a finanszírozó által várt formátumban állítja elő az elszámolási állományt.",
    ar: "تحتوي الملاحظة المُملاة أصلًا على ما تحتاجه المطالبة: الجانب، والمدة، والأمراض المصاحبة، والمواد المستهلكة. يقترح Klarnote الرموز وفق التصنيف النافذ فعليًا في بلدك، وينشئ ملف المطالبة بالصيغة التي تتوقعها الجهة الدافعة.",
    es: "La nota dictada ya contiene lo que una reclamación necesita: lateralidad, duración, comorbilidad, materiales consumidos. Klarnote propone códigos según la clasificación realmente vigente en su país y genera el fichero de facturación en el formato que espera su pagador.",
    pt: "A nota ditada já contém o que uma faturação precisa: lateralidade, duração, comorbilidade, materiais consumidos. O Klarnote propõe códigos segundo a classificação efetivamente em vigor no seu país e gera o ficheiro no formato que o seu pagador espera.",
  },

  heroPoints: {
    uk: ["Класифікатор вашої країни, а не узагальнений МКХ", "Коди пропонуються — підтверджує людина", "Файл рахунку у форматі вашого платника"],
    en: ["Your country's classification, not a generic ICD", "Codes are proposed; a person confirms them", "A claim file in your payer's own format"],
    pl: ["Klasyfikacja Twojego kraju, nie ogólne ICD", "Kody są propozycją — potwierdza je człowiek", "Plik rozliczeniowy w formacie Twojego płatnika"],
    de: ["Die Klassifikation Ihres Landes, kein generisches ICD", "Kodes werden vorgeschlagen — ein Mensch bestätigt", "Eine Abrechnungsdatei im Format Ihres Kostenträgers"],
    ro: ["Clasificarea țării dumneavoastră, nu un ICD generic", "Codurile sunt propuse — le confirmă un om", "Un fișier în formatul propriu al plătitorului"],
    cs: ["Klasifikace vaší země, ne obecné MKN", "Kódy jsou návrh — potvrzuje je člověk", "Dávka ve formátu vašeho plátce"],
    sr: ["Klasifikacija vaše zemlje, a ne uopšteni MKB", "Šifre se predlažu — potvrđuje ih čovek", "Faktura u formatu vašeg platioca"],
    hu: ["Az Ön országának osztályozása, nem általános BNO", "A kódok javaslatok — ember hagyja jóvá", "Elszámolási állomány a finanszírozó formátumában"],
    ar: ["تصنيف بلدك، لا ترميز دولي عام", "الرموز مقترحة — ويؤكدها إنسان", "ملف مطالبة بصيغة جهتك الدافعة"],
    es: ["La clasificación de su país, no un CIE genérico", "Los códigos se proponen; los confirma una persona", "Un fichero en el formato propio de su pagador"],
    pt: ["A classificação do seu país, não um CID genérico", "Os códigos são propostos; confirma-os uma pessoa", "Um ficheiro no formato do seu pagador"],
  },

  stepsHeading: { uk: "Як будується рахунок", en: "How a claim gets built", pl: "Jak powstaje rozliczenie", de: "Wie eine Abrechnung entsteht", ro: "Cum se construiește o decontare", cs: "Jak vzniká vyúčtování", sr: "Kako nastaje faktura", hu: "Hogyan épül fel az elszámolás", ar: "كيف تُبنى المطالبة", es: "Cómo se construye una reclamación", pt: "Como se constrói uma faturação" },

  steps: {
    uk: [
      ["Диктуйте як завжди", "Прийом або звіт записує Scribe. У робочому дні лікаря не змінюється нічого."],
      ["Нотатка читається на предмет фактів, що впливають на оплату", "Латеральність, тривалість, супутні стани, витратні матеріали — саме те, чого найчастіше бракує."],
      ["Коди пропонуються за місцевим правилом", "Класифікатор, чинний у вашій країні, з посиланням на рядок нотатки, який його обґрунтовує."],
      ["Формується файл рахунку", "У форматі вашого платника — щоб ваша система подала його так, як подає завжди."],
    ],
    en: [
      ["Dictate as you always do", "Scribe captures the consultation or the report. Nothing about the clinician's day changes."],
      ["The note is read for billable facts", "Laterality, duration, comorbidity, materials consumed — the details that decide a code and the ones most often missing."],
      ["Codes are proposed against the local rulebook", "The classification in force where you practise, each proposal tied to the line of the note that justifies it."],
      ["A claim file is generated", "In your payer's own format, so your existing system submits it exactly the way it always has."],
    ],
    pl: [
      ["Dyktuj jak zwykle", "Scribe rejestruje wizytę lub raport. W dniu pracy lekarza nie zmienia się nic."],
      ["Notatka jest czytana pod kątem faktów rozliczeniowych", "Stronność, czas trwania, choroby współistniejące, zużyte materiały — szczegóły przesądzające o kodzie i najczęściej pomijane."],
      ["Kody proponowane według lokalnych zasad", "Klasyfikacja obowiązująca tam, gdzie pracujesz, a każda propozycja wskazuje wers notatki, który ją uzasadnia."],
      ["Powstaje plik rozliczeniowy", "W formacie Twojego płatnika, aby Twój system wysłał go dokładnie tak jak zawsze."],
    ],
    de: [
      ["Diktieren Sie wie immer", "Scribe erfasst die Konsultation oder den Befund. Am Arbeitstag der Ärztin ändert sich nichts."],
      ["Die Dokumentation wird auf abrechnungsrelevante Fakten gelesen", "Seitenlokalisation, Dauer, Begleiterkrankungen, verbrauchte Materialien — die Angaben, die den Kode entscheiden und am häufigsten fehlen."],
      ["Kodes werden nach dem lokalen Regelwerk vorgeschlagen", "Die Klassifikation, die dort gilt, wo Sie praktizieren — jeder Vorschlag mit der Zeile der Dokumentation, die ihn trägt."],
      ["Eine Abrechnungsdatei entsteht", "Im Format Ihres Kostenträgers, damit Ihr bestehendes System sie genau so einreicht wie bisher."],
    ],
    ro: [
      ["Dictați ca de obicei", "Scribe înregistrează consultația sau raportul. Nimic din ziua medicului nu se schimbă."],
      ["Nota este citită pentru faptele care contează la decontare", "Lateralitate, durată, comorbidități, materiale consumate — detaliile care decid codul și care lipsesc cel mai des."],
      ["Codurile sunt propuse după regula locală", "Clasificarea în vigoare acolo unde profesați, fiecare propunere legată de rândul din notă care o justifică."],
      ["Se generează fișierul de decontare", "În formatul propriu al plătitorului, astfel încât sistemul dumneavoastră să îl trimită exact ca până acum."],
    ],
    cs: [
      ["Diktujte jako vždy", "Scribe zachytí konzultaci nebo nález. Na pracovním dni lékaře se nemění nic."],
      ["Záznam se čte kvůli faktům rozhodným pro úhradu", "Strana, trvání, přidružená onemocnění, spotřebovaný materiál — údaje, které rozhodují o kódu a nejčastěji chybí."],
      ["Kódy se navrhují podle místního pravidla", "Klasifikace platná tam, kde působíte, s odkazem na řádek záznamu, který návrh odůvodňuje."],
      ["Vznikne dávka", "Ve formátu vašeho plátce, aby ji váš stávající systém odeslal přesně jako dosud."],
    ],
    sr: [
      ["Diktirajte kao i uvek", "Scribe beleži pregled ili nalaz. U danu lekara ne menja se ništa."],
      ["Nalaz se čita zbog činjenica bitnih za naplatu", "Strana, trajanje, komorbiditeti, utrošeni materijal — detalji koji odlučuju o šifri i najčešće nedostaju."],
      ["Šifre se predlažu po lokalnom pravilu", "Klasifikacija koja važi tamo gde radite, uz red nalaza koji predlog opravdava."],
      ["Nastaje faktura", "U formatu vašeg platioca, da je vaš postojeći sistem pošalje tačno kao i do sada."],
    ],
    hu: [
      ["Diktáljon úgy, ahogy szokott", "A Scribe rögzíti a konzultációt vagy a leletet. Az orvos munkanapján semmi nem változik."],
      ["A dokumentációt elszámolási tények szempontjából olvassuk", "Oldaliság, időtartam, kísérőbetegségek, felhasznált anyagok — azok az adatok, amelyek a kódot eldöntik, és amelyek a leggyakrabban hiányoznak."],
      ["A kódokat a helyi szabálykönyv szerint javasoljuk", "Az ott hatályos osztályozás, ahol Ön dolgozik, minden javaslat mellé a dokumentáció indokoló sorával."],
      ["Elkészül az elszámolási állomány", "A finanszírozó saját formátumában, hogy a meglévő rendszere pontosan úgy küldje be, ahogy eddig."],
    ],
    ar: [
      ["أملِ كما تفعل دائمًا", "يلتقط Scribe الاستشارة أو التقرير، ولا يتغيّر شيء في يوم الطبيب."],
      ["تُقرأ الملاحظة بحثًا عن وقائع تؤثّر في المطالبة", "الجانب، والمدة، والأمراض المصاحبة، والمواد المستهلكة — التفاصيل التي تحدّد الرمز وأكثرها غيابًا."],
      ["تُقترح الرموز وفق القاعدة المحلية", "التصنيف النافذ حيث تمارس، مع ربط كل اقتراح بالسطر الذي يبرّره."],
      ["يُنشأ ملف المطالبة", "بصيغة جهتك الدافعة، ليقدّمه نظامك الحالي تمامًا كما اعتاد."],
    ],
    es: [
      ["Dicte como siempre", "Scribe capta la consulta o el informe. Nada en la jornada del clínico cambia."],
      ["La nota se lee buscando hechos facturables", "Lateralidad, duración, comorbilidad, materiales consumidos: los detalles que deciden un código y los que más se omiten."],
      ["Los códigos se proponen según la norma local", "La clasificación vigente donde usted ejerce, con la línea de la nota que respalda cada propuesta."],
      ["Se genera el fichero de facturación", "En el formato propio de su pagador, para que su sistema lo envíe igual que siempre."],
    ],
    pt: [
      ["Dite como sempre", "O Scribe capta a consulta ou o relatório. Nada no dia do clínico muda."],
      ["A nota é lida à procura de factos faturáveis", "Lateralidade, duração, comorbilidade, materiais consumidos — os detalhes que decidem um código e os que mais faltam."],
      ["Os códigos são propostos segundo a regra local", "A classificação em vigor onde exerce, com a linha da nota que sustenta cada proposta."],
      ["É gerado o ficheiro de faturação", "No formato do seu pagador, para que o seu sistema o submeta exatamente como sempre."],
    ],
  },

  countriesHeading: { uk: "Країни, які ми описали", en: "The countries we have mapped", pl: "Kraje, które opisaliśmy", de: "Die Länder, die wir erfasst haben", ro: "Țările pe care le-am cartografiat", cs: "Země, které jsme zmapovali", sr: "Zemlje koje smo mapirali", hu: "A feltérképezett országok", ar: "البلدان التي رسمنا قواعدها", es: "Los países que hemos mapeado", pt: "Os países que mapeámos" },

  countriesSub: {
    uk: "Країна з'являється у цьому списку лише тоді, коли ми можемо назвати її класифікатор, правила кодування, тариф і формат файлу. Загальної «європейської» підтримки не буває.",
    en: "A country appears on this list only once we can name its classification, its coding rulebook, its tariff and its file format. There is no such thing as generic \"European\" support.",
    pl: "Kraj trafia na tę listę dopiero wtedy, gdy potrafimy wskazać jego klasyfikację, zasady kodowania, taryfę i format pliku. Ogólne „europejskie” wsparcie nie istnieje.",
    de: "Ein Land steht erst dann auf dieser Liste, wenn wir seine Klassifikation, sein Kodierregelwerk, seinen Tarif und sein Dateiformat benennen können. Generische „europäische“ Unterstützung gibt es nicht.",
    ro: "O țară apare pe această listă abia când îi putem numi clasificarea, regulile de codificare, tariful și formatul de fișier. Un sprijin „european” generic nu există.",
    cs: "Země se na tento seznam dostane až tehdy, když umíme pojmenovat její klasifikaci, pravidla kódování, tarif a formát dávky. Obecná „evropská“ podpora neexistuje.",
    sr: "Zemlja se pojavljuje na ovom spisku tek kad možemo da imenujemo njenu klasifikaciju, pravila kodiranja, tarifu i format datoteke. Uopštena „evropska“ podrška ne postoji.",
    hu: "Egy ország csak akkor kerül erre a listára, ha meg tudjuk nevezni az osztályozását, a kódolási szabálykönyvét, a tarifáját és az állományformátumát. Általános „európai” támogatás nem létezik.",
    ar: "لا يظهر بلد في هذه القائمة إلا حين نستطيع تسمية تصنيفه وقواعد ترميزه وتعرفته وصيغة ملفه. لا وجود لدعم «أوروبي» عام.",
    es: "Un país entra en esta lista solo cuando podemos nombrar su clasificación, su normativa de codificación, su tarifa y su formato de fichero. No existe un soporte «europeo» genérico.",
    pt: "Um país entra nesta lista apenas quando conseguimos nomear a sua classificação, as suas regras de codificação, a sua tarifa e o seu formato de ficheiro. Não existe suporte «europeu» genérico.",
  },

  specHeading: { uk: "Стек кодування", en: "The coding stack", pl: "Stos kodowania", de: "Der Kodierstack", ro: "Stiva de codificare", cs: "Kódovací sada", sr: "Sloj kodiranja", hu: "A kódolási készlet", ar: "منظومة الترميز", es: "La pila de codificación", pt: "A pilha de codificação" },

  sourcesLabel: { uk: "Першоджерела", en: "Primary sources", pl: "Źródła pierwotne", de: "Primärquellen", ro: "Surse primare", cs: "Primární zdroje", sr: "Primarni izvori", hu: "Elsődleges források", ar: "المصادر الأولية", es: "Fuentes primarias", pt: "Fontes primárias" },

  soonHeading: { uk: "Що з цього вже працює", en: "What of this is built", pl: "Co z tego już działa", de: "Was davon gebaut ist", ro: "Ce din toate acestea este construit", cs: "Co z toho je hotové", sr: "Šta je od ovoga napravljeno", hu: "Ebből mi készült el", ar: "ما الذي أُنجز من هذا", es: "Qué está construido de todo esto", pt: "O que disto está construído" },

  soonLead: {
    uk: "Нічого. Ця сторінка описує напрям, а не наявну функцію: кодування та формування рахунків перебувають в інтеграції. Диктування, докази і кваліфікований підпис працюють уже сьогодні — рахунки ще ні. Ми пишемо про це заздалегідь, бо вибір платформи роблять на роки, а не на квартал.",
    en: "None of it yet. This page describes a direction, not a shipped feature: coding and claim-file generation are in integration. Dictation, evidence and the qualified signature work today; claims do not. We describe it early because a platform is chosen for years, not for a quarter.",
    pl: "Na razie nic. Ta strona opisuje kierunek, a nie gotową funkcję: kodowanie i generowanie rozliczeń są w integracji. Dyktowanie, dowody i podpis kwalifikowany działają dziś; rozliczenia jeszcze nie. Piszemy o tym wcześnie, bo platformę wybiera się na lata, nie na kwartał.",
    de: "Noch nichts davon. Diese Seite beschreibt eine Richtung, keine ausgelieferte Funktion: Kodierung und Erzeugung der Abrechnungsdatei sind in Integration. Diktat, Evidenz und qualifizierte Signatur funktionieren heute; die Abrechnung nicht. Wir sagen es früh, weil eine Plattform für Jahre gewählt wird, nicht für ein Quartal.",
    ro: "Deocamdată nimic. Această pagină descrie o direcție, nu o funcție livrată: codificarea și generarea fișierului de decontare sunt în integrare. Dictarea, dovezile și semnătura calificată funcționează astăzi; decontarea, nu. O spunem devreme pentru că o platformă se alege pe ani, nu pe un trimestru.",
    cs: "Zatím nic. Tato stránka popisuje směr, ne hotovou funkci: kódování a tvorba dávky jsou v integraci. Diktování, důkazy a kvalifikovaný podpis fungují dnes; vyúčtování ne. Píšeme o tom brzy, protože platforma se vybírá na roky, ne na čtvrtletí.",
    sr: "Zasad ništa. Ova stranica opisuje pravac, a ne isporučenu funkciju: kodiranje i pravljenje fakture su u integraciji. Diktiranje, dokazi i kvalifikovani potpis rade danas; fakturisanje ne. Govorimo o tome rano jer se platforma bira na godine, a ne na kvartal.",
    hu: "Egyelőre semmi. Ez az oldal irányt ír le, nem kész funkciót: a kódolás és az elszámolási állomány előállítása integráció alatt áll. A diktálás, a bizonyítékok és a minősített aláírás ma is működik; az elszámolás nem. Azért mondjuk el korán, mert platformot évekre választanak, nem egy negyedévre.",
    ar: "لا شيء بعد. تصف هذه الصفحة اتجاهًا لا ميزة مُسلَّمة: الترميز وإنشاء ملف المطالبة قيد التكامل. الإملاء والأدلة والتوقيع المؤهَّل تعمل اليوم؛ أما المطالبات فلا. نقول ذلك مبكرًا لأن المنصّة تُختار لسنوات لا لربع سنة.",
    es: "Nada todavía. Esta página describe una dirección, no una función entregada: la codificación y la generación del fichero están en integración. El dictado, la evidencia y la firma cualificada funcionan hoy; la facturación no. Lo decimos pronto porque una plataforma se elige para años, no para un trimestre.",
    pt: "Nada ainda. Esta página descreve uma direção, não uma funcionalidade entregue: a codificação e a geração do ficheiro estão em integração. O ditado, a evidência e a assinatura qualificada funcionam hoje; a faturação não. Dizemo-lo cedo porque uma plataforma escolhe-se para anos, não para um trimestre.",
  },

  limitsHeading: { uk: "Чого це не робить", en: "What this does not do", pl: "Czego to nie robi", de: "Was das nicht tut", ro: "Ce nu face acest lucru", cs: "Co tohle nedělá", sr: "Šta ovo ne radi", hu: "Amit ez nem csinál", ar: "ما لا تفعله هذه الوظيفة", es: "Lo que esto no hace", pt: "O que isto não faz" },

  limits: {
    uk: ["Ми не подаємо рахунки замість вас і не маємо доступу до ваших рахунків у банку", "Ми не замінюємо кодувальника: пропозиція завжди проходить перевірку людиною", "Ми не встановлюємо ціни на ваші послуги і не ведемо переговори з платником", "Для країни, якої немає в цьому списку, нічого не генерується"],
    en: ["We do not submit claims for you, and we never touch your bank accounts", "We do not replace your coder: every proposal is reviewed by a person", "We do not price your services or negotiate with your payer", "Nothing is generated for a country that is not on this list"],
    pl: ["Nie wysyłamy rozliczeń za Ciebie i nie mamy dostępu do Twoich rachunków bankowych", "Nie zastępujemy kodera: każdą propozycję sprawdza człowiek", "Nie wyceniamy Twoich usług ani nie negocjujemy z płatnikiem", "Dla kraju spoza tej listy nic nie jest generowane"],
    de: ["Wir reichen nichts für Sie ein und rühren Ihre Bankkonten nicht an", "Wir ersetzen Ihre Kodierfachkraft nicht: jeden Vorschlag prüft ein Mensch", "Wir bepreisen Ihre Leistungen nicht und verhandeln nicht mit Ihrem Kostenträger", "Für ein Land, das nicht auf dieser Liste steht, wird nichts erzeugt"],
    ro: ["Nu trimitem decontări în locul dumneavoastră și nu atingem conturile bancare", "Nu vă înlocuim codificatorul: fiecare propunere este verificată de un om", "Nu stabilim prețul serviciilor și nu negociem cu plătitorul", "Pentru o țară care nu este pe această listă nu se generează nimic"],
    cs: ["Nepodáváme dávky za vás a nesaháme na vaše bankovní účty", "Nenahrazujeme kodéra: každý návrh kontroluje člověk", "Neurčujeme cenu vašich výkonů a nevyjednáváme s plátcem", "Pro zemi, která na tomto seznamu není, se nic nevytváří"],
    sr: ["Ne podnosimo fakture umesto vas i ne diramo vaše bankovne račune", "Ne zamenjujemo kodera: svaki predlog proverava čovek", "Ne određujemo cenu vaših usluga i ne pregovaramo sa platiocem", "Za zemlju koja nije na ovom spisku ništa se ne pravi"],
    hu: ["Nem nyújtunk be helyetted elszámolást, és nem nyúlunk a bankszámláihoz", "Nem váltjuk ki a kódolót: minden javaslatot ember ellenőriz", "Nem árazzuk be a szolgáltatásait, és nem tárgyalunk a finanszírozóval", "A listán nem szereplő országra semmi nem készül"],
    ar: ["لا نقدّم المطالبات نيابةً عنك، ولا نمسّ حساباتك المصرفية", "لا نستبدل المرمِّز لديك: كل اقتراح يراجعه إنسان", "لا نسعّر خدماتك ولا نتفاوض مع جهتك الدافعة", "لا يُنشأ شيء لبلد غير مدرج في هذه القائمة"],
    es: ["No presentamos reclamaciones por usted ni tocamos sus cuentas bancarias", "No sustituimos a su codificador: toda propuesta la revisa una persona", "No ponemos precio a sus servicios ni negociamos con su pagador", "No se genera nada para un país que no esté en esta lista"],
    pt: ["Não submetemos faturação por si nem tocamos nas suas contas bancárias", "Não substituímos o seu codificador: cada proposta é revista por uma pessoa", "Não fixamos o preço dos seus serviços nem negoceiamos com o pagador", "Nada é gerado para um país que não conste desta lista"],
  },

  backLabel: { uk: "Усі країни", en: "All countries", pl: "Wszystkie kraje", de: "Alle Länder", ro: "Toate țările", cs: "Všechny země", sr: "Sve zemlje", hu: "Minden ország", ar: "كل البلدان", es: "Todos los países", pt: "Todos os países" },

  /* The hero CTA. Not "sign up" as on the shipped pillar pages: signing up
     buys none of this yet, and the only honest next step for a reader who
     wants their country is a conversation. */
  talkLabel: { uk: "Зв'язатися з нами", en: "Talk to us", pl: "Porozmawiaj z nami", de: "Sprechen Sie mit uns", ro: "Discutați cu noi", cs: "Promluvte si s námi", sr: "Razgovarajte sa nama", hu: "Beszéljen velünk", ar: "تحدّث إلينا", es: "Hable con nosotros", pt: "Fale connosco" },

  faqHeading: { uk: "Часті запитання", en: "Common questions", pl: "Częste pytania", de: "Häufige Fragen", ro: "Întrebări frecvente", cs: "Časté otázky", sr: "Česta pitanja", hu: "Gyakori kérdések", ar: "أسئلة شائعة", es: "Preguntas frecuentes", pt: "Perguntas frequentes" },

  faq: {
    uk: [
      ["Чи можу я користуватися цим сьогодні?", "Ні. Кодування та формування рахунків перебувають в інтеграції. Сторінка позначена саме так навмисно: краще втратити угоду через чесність, ніж під час демонстрації."],
      ["Чому не «підтримка ЄС», а окремі країни?", "Бо спільного європейського рахунку не існує. Німеччина подає квартальний файл KVDT, Польща — XML-комунікат до НФЗ, Швейцарія з 1 січня 2026 року перейшла на generalInvoice 5.0. Спільний у них лише пацієнт."],
      ["Чи кодує модель самостійно?", "Ні. Діє те саме правило, що й на решті платформи: система пропонує, рішення ухвалює людина. Жоден код не потрапляє в рахунок без підтвердження."],
    ],
    en: [
      ["Can I use this today?", "No. Coding and claim-file generation are in integration. The page is labelled that way on purpose: it is better to lose a deal to honesty than to lose one in a demo."],
      ["Why country pages instead of \"EU support\"?", "Because there is no European claim. Germany files a quarterly KVDT batch, Poland sends an XML message to NFZ, Switzerland moved to generalInvoice 5.0 on 1 January 2026. The only thing they share is the patient."],
      ["Does the model code on its own?", "No. The same rule holds here as everywhere else on the platform: the system proposes, a person decides. No code reaches a claim without confirmation."],
    ],
    pl: [
      ["Czy mogę z tego korzystać dziś?", "Nie. Kodowanie i generowanie rozliczeń są w integracji. Strona jest tak oznaczona celowo: lepiej stracić kontrakt przez uczciwość niż na demonstracji."],
      ["Dlaczego strony krajowe, a nie „wsparcie UE”?", "Bo europejskie rozliczenie nie istnieje. Niemcy wysyłają kwartalny plik KVDT, Polska komunikat XML do NFZ, Szwajcaria od 1 stycznia 2026 przeszła na generalInvoice 5.0. Łączy je wyłącznie pacjent."],
      ["Czy model koduje samodzielnie?", "Nie. Obowiązuje ta sama zasada co na całej platformie: system proponuje, decyduje człowiek. Żaden kod nie trafia do rozliczenia bez potwierdzenia."],
    ],
    de: [
      ["Kann ich das heute nutzen?", "Nein. Kodierung und Erzeugung der Abrechnungsdatei sind in Integration. Die Seite ist bewusst so gekennzeichnet: lieber einen Abschluss an die Ehrlichkeit verlieren als in der Demo."],
      ["Warum Länderseiten statt „EU-Unterstützung“?", "Weil es die europäische Abrechnung nicht gibt. Deutschland reicht quartalsweise eine KVDT-Datei ein, Polen sendet eine XML-Nachricht an den NFZ, die Schweiz ist zum 1. Januar 2026 auf generalInvoice 5.0 gewechselt. Gemeinsam ist ihnen nur der Patient."],
      ["Kodiert das Modell selbstständig?", "Nein. Hier gilt dieselbe Regel wie überall auf der Plattform: das System schlägt vor, ein Mensch entscheidet. Kein Kode gelangt ohne Bestätigung in eine Abrechnung."],
    ],
    ro: [
      ["Pot folosi asta astăzi?", "Nu. Codificarea și generarea fișierului sunt în integrare. Pagina este etichetată astfel intenționat: mai bine pierdem un contract din onestitate decât într-o demonstrație."],
      ["De ce pagini de țară și nu „suport UE”?", "Pentru că decontarea europeană nu există. Germania depune trimestrial un fișier KVDT, Polonia trimite un mesaj XML la NFZ, Elveția a trecut la generalInvoice 5.0 la 1 ianuarie 2026. Le unește doar pacientul."],
      ["Codifică modelul singur?", "Nu. Se aplică aceeași regulă ca peste tot în platformă: sistemul propune, omul decide. Niciun cod nu ajunge într-o decontare fără confirmare."],
    ],
    cs: [
      ["Můžu to používat dnes?", "Ne. Kódování a tvorba dávky jsou v integraci. Stránka je takto označena záměrně: raději přijít o obchod kvůli poctivosti než na ukázce."],
      ["Proč stránky po zemích místo „podpory EU“?", "Protože evropské vyúčtování neexistuje. Německo podává čtvrtletní dávku KVDT, Polsko posílá XML zprávu NFZ, Švýcarsko přešlo 1. ledna 2026 na generalInvoice 5.0. Společného mají jen pacienta."],
      ["Kóduje model sám?", "Ne. Platí zde totéž co jinde na platformě: systém navrhuje, člověk rozhoduje. Žádný kód se bez potvrzení do dávky nedostane."],
    ],
    sr: [
      ["Mogu li ovo da koristim danas?", "Ne. Kodiranje i pravljenje fakture su u integraciji. Stranica je tako označena namerno: bolje izgubiti posao zbog iskrenosti nego na demonstraciji."],
      ["Zašto stranice po zemljama umesto „podrške za EU“?", "Zato što evropska faktura ne postoji. Nemačka podnosi kvartalnu KVDT datoteku, Poljska šalje XML poruku NFZ-u, Švajcarska je 1. januara 2026. prešla na generalInvoice 5.0. Zajednički im je samo pacijent."],
      ["Da li model kodira sam?", "Ne. Ovde važi isto pravilo kao svuda na platformi: sistem predlaže, čovek odlučuje. Nijedna šifra ne ulazi u fakturu bez potvrde."],
    ],
    hu: [
      ["Használhatom ezt ma?", "Nem. A kódolás és az állomány előállítása integráció alatt áll. Az oldal szándékosan van így megjelölve: jobb az őszinteség miatt elveszíteni egy üzletet, mint egy bemutatón."],
      ["Miért országoldalak és nem „EU-támogatás”?", "Mert európai elszámolás nem létezik. Németország negyedéves KVDT-állományt ad be, Lengyelország XML-üzenetet küld az NFZ-nek, Svájc 2026. január 1-jén állt át a generalInvoice 5.0-ra. Csak a beteg közös bennük."],
      ["Kódol a modell önállóan?", "Nem. Itt ugyanaz a szabály él, mint a platform többi részén: a rendszer javasol, ember dönt. Megerősítés nélkül egyetlen kód sem kerül elszámolásba."],
    ],
    ar: [
      ["هل يمكنني استخدام هذا اليوم؟", "لا. الترميز وإنشاء ملف المطالبة قيد التكامل. وُسمت الصفحة كذلك عن قصد: خسارة صفقة بسبب الصراحة أهون من خسارتها أثناء عرض توضيحي."],
      ["لماذا صفحات لكل بلد بدل «دعم الاتحاد الأوروبي»؟", "لأن المطالبة الأوروبية غير موجودة. ألمانيا تودع ملف KVDT فصليًا، وبولندا ترسل رسالة XML إلى NFZ، وسويسرا انتقلت إلى generalInvoice 5.0 في 1 يناير 2026. المشترك بينها هو المريض فقط."],
      ["هل يرمّز النموذج من تلقاء نفسه؟", "لا. تسري هنا القاعدة نفسها السارية في بقية المنصّة: النظام يقترح والإنسان يقرّر. ولا يدخل أي رمز في مطالبة دون تأكيد."],
    ],
    es: [
      ["¿Puedo usarlo hoy?", "No. La codificación y la generación del fichero están en integración. La página está etiquetada así a propósito: mejor perder un contrato por honestidad que perderlo en una demostración."],
      ["¿Por qué páginas por país y no «soporte UE»?", "Porque la reclamación europea no existe. Alemania presenta un fichero KVDT trimestral, Polonia envía un mensaje XML al NFZ, Suiza pasó a generalInvoice 5.0 el 1 de enero de 2026. Lo único que comparten es el paciente."],
      ["¿El modelo codifica por su cuenta?", "No. Rige la misma regla que en el resto de la plataforma: el sistema propone, una persona decide. Ningún código llega a una reclamación sin confirmación."],
    ],
    pt: [
      ["Posso usar isto hoje?", "Não. A codificação e a geração do ficheiro estão em integração. A página está assim rotulada de propósito: mais vale perder um negócio por honestidade do que perdê-lo numa demonstração."],
      ["Porquê páginas por país e não «suporte UE»?", "Porque a faturação europeia não existe. A Alemanha entrega um ficheiro KVDT trimestral, a Polónia envia uma mensagem XML ao NFZ, a Suíça passou a generalInvoice 5.0 em 1 de janeiro de 2026. Só têm o doente em comum."],
      ["O modelo codifica sozinho?", "Não. Vale aqui a mesma regra do resto da plataforma: o sistema propõe, uma pessoa decide. Nenhum código chega a uma faturação sem confirmação."],
    ],
  },
};

export function buildRcmPages(lang, cta) {
  const t = (m) => m[lang] ?? m.en;
  const pos = positioning(lang);
  const pillar = pillars(lang).find((p) => p.key === "bill");
  const countries = rcmCountries(lang);

  /* The roadmap block. Every page on this route carries it — the hub because
     it is the first thing a visitor reads, the country pages because that is
     where a buyer starts believing the detail is a shipped feature. */
  const soonBlock = {
    type: "prose",
    heading: `${t(T.soonHeading)} — ${pos.soonLabel}`,
    lead: t(T.soonLead),
  };

  const steps = {
    type: "steps",
    heading: t(T.stepsHeading),
    items: t(T.steps).map(([title, desc], i) => ({ n: `0${i + 1}`, title, desc })),
  };

  const backlink = { type: "backlink", path: "/rcm", label: t(T.backLabel) };

  /* ── The hub ──────────────────────────────────────────────────────── */
  const pages = {
    rcm: {
      hero: {
        icon: "card",
        eyebrow: `${T.eyebrow[lang] ?? T.eyebrow.en} · ${pos.soonLabel}`,
        title: t(T.hubTitle),
        /* The pillar's own tagline, imported rather than retyped — this page
           is the Bill pillar's page, and a pillar page that writes its own
           version of the pillar is how the site starts contradicting itself.
           The page's additional argument goes in the lead block below. */
        sub: pillar.tagline,
        points: t(T.heroPoints),
        cta: { label: t(T.talkLabel), path: "/contact" },
      },
      blocks: [
        { type: "prose", lead: t(T.hubSub) },
        steps,
        {
          type: "grid",
          cols: 3,
          heading: t(T.countriesHeading),
          sub: t(T.countriesSub),
          items: countries.map((c) => ({
            icon: "globe",
            title: c.label,
            /* The classifications ARE the description: a coder recognises
               their own country from this line alone. */
            desc: c.short,
            path: c.path,
          })),
        },
        { type: "prose", heading: t(T.limitsHeading), bullets: t(T.limits) },
        soonBlock,
        { type: "faq", heading: t(T.faqHeading), items: t(T.faq).map(([q, a]) => ({ q, a })) },
        cta,
      ],
    },
  };

  /* ── One page per country ─────────────────────────────────────────── */
  for (const c of countries) {
    pages[c.slug] = {
      hero: {
        icon: "card",
        eyebrow: `${T.eyebrow[lang] ?? T.eyebrow.en} · ${pos.soonLabel}`,
        title: c.label,
        sub: c.body,
        points: t(T.heroPoints),
      },
      blocks: [
        {
          type: "spec",
          heading: `${t(T.specHeading)} — ${c.label}`,
          rows: c.rows,
          sourcesLabel: t(T.sourcesLabel),
          sources: c.sources,
        },
        steps,
        { type: "prose", heading: t(T.limitsHeading), bullets: t(T.limits) },
        soonBlock,
        backlink,
        cta,
      ],
    };
  }

  return pages;
}

/* Exported for the nav, which lists the countries without building the pages. */
export { rcmCountries, rcmCountry };

// signupOptions.js — the picklists behind the public signup form.
//
// Every option is a PAIR: a stable `value` that goes to the CRM, and a `label`
// the visitor reads in their own language. They are not the same string and
// must never be, because the form is shown in eleven languages and the CRM has
// to segment across all of them: storing the label would file the same
// cardiologist under "Кардіологія", "Kardiologie" or "Cardiología" depending on
// which language they happened to be reading, and no HubSpot list could ever
// find them all.
//
// The values are the English wording on purpose rather than snake_case keys:
// they are what a marketer types into a HubSpot dropdown property, so the
// property definition and this file read the same and need no mapping table
// between them.

const L = (m, lang) => m[lang] ?? m.en;

// Resolve one registry for a language. Returns [{ value, label }] — `value` is
// what `leadFields` sends, `label` is what the select shows.
export function options(registry, lang = "en") {
  return registry.map((o) => ({ value: o.value, label: L(o.label, lang) }));
}

// The label for a value that is already chosen (re-rendering after a language
// switch, or a restored draft).
export function labelOf(registry, value, lang = "en") {
  const hit = registry.find((o) => o.value === value);
  return hit ? L(hit.label, lang) : "";
}

export const SPECIALTIES = [
  { value: "General practice", label: { uk: "Загальна практика", en: "General practice", pl: "Medycyna rodzinna", de: "Allgemeinmedizin", ro: "Medicină de familie", cs: "Všeobecné lékařství", sr: "Opšta medicina", hu: "Háziorvoslás", ar: "الطب العام", es: "Medicina general", pt: "Medicina geral" } },
  { value: "Radiology", label: { uk: "Радіологія", en: "Radiology", pl: "Radiologia", de: "Radiologie", ro: "Radiologie", cs: "Radiologie", sr: "Radiologija", hu: "Radiológia", ar: "الأشعة", es: "Radiología", pt: "Radiologia" } },
  { value: "Mental health", label: { uk: "Психічне здоров'я", en: "Mental health", pl: "Zdrowie psychiczne", de: "Psychische Gesundheit", ro: "Sănătate mintală", cs: "Duševní zdraví", sr: "Mentalno zdravlje", hu: "Mentális egészség", ar: "الصحة النفسية", es: "Salud mental", pt: "Saúde mental" } },
  { value: "Surgery", label: { uk: "Хірургія", en: "Surgery", pl: "Chirurgia", de: "Chirurgie", ro: "Chirurgie", cs: "Chirurgie", sr: "Hirurgija", hu: "Sebészet", ar: "الجراحة", es: "Cirugía", pt: "Cirurgia" } },
  { value: "Pediatrics", label: { uk: "Педіатрія", en: "Pediatrics", pl: "Pediatria", de: "Pädiatrie", ro: "Pediatrie", cs: "Pediatrie", sr: "Pedijatrija", hu: "Gyermekgyógyászat", ar: "طب الأطفال", es: "Pediatría", pt: "Pediatria" } },
  { value: "Cardiology", label: { uk: "Кардіологія", en: "Cardiology", pl: "Kardiologia", de: "Kardiologie", ro: "Cardiologie", cs: "Kardiologie", sr: "Kardiologija", hu: "Kardiológia", ar: "أمراض القلب", es: "Cardiología", pt: "Cardiologia" } },
  { value: "Neurology", label: { uk: "Неврологія", en: "Neurology", pl: "Neurologia", de: "Neurologie", ro: "Neurologie", cs: "Neurologie", sr: "Neurologija", hu: "Neurológia", ar: "طب الأعصاب", es: "Neurología", pt: "Neurologia" } },
  { value: "Obstetrics & gynaecology", label: { uk: "Акушерство та гінекологія", en: "Obstetrics & gynaecology", pl: "Położnictwo i ginekologia", de: "Gynäkologie und Geburtshilfe", ro: "Obstetrică-ginecologie", cs: "Gynekologie a porodnictví", sr: "Ginekologija i akušerstvo", hu: "Szülészet-nőgyógyászat", ar: "النساء والتوليد", es: "Obstetricia y ginecología", pt: "Obstetrícia e ginecologia" } },
  { value: "Other", label: { uk: "Інша", en: "Other", pl: "Inna", de: "Andere", ro: "Alta", cs: "Jiná", sr: "Druga", hu: "Egyéb", ar: "أخرى", es: "Otra", pt: "Outra" } },
];

// Buying power: who this person is inside the organisation, not what they
// practise. A head of department and a resident are the same specialty and a
// completely different sales conversation.
export const ROLES = [
  { value: "Physician", label: { uk: "Лікар", en: "Physician", pl: "Lekarz", de: "Arzt / Ärztin", ro: "Medic", cs: "Lékař", sr: "Lekar", hu: "Orvos", ar: "طبيب", es: "Médico/a", pt: "Médico(a)" } },
  { value: "Head of department", label: { uk: "Завідувач відділення", en: "Head of department", pl: "Kierownik oddziału", de: "Abteilungsleitung", ro: "Șef de secție", cs: "Vedoucí oddělení", sr: "Šef odeljenja", hu: "Osztályvezető", ar: "رئيس قسم", es: "Jefe de servicio", pt: "Chefe de serviço" } },
  { value: "Chief physician / medical director", label: { uk: "Головний лікар / медичний директор", en: "Chief physician / medical director", pl: "Dyrektor medyczny", de: "Chefarzt / Ärztliche Leitung", ro: "Medic-șef / director medical", cs: "Primář / lékařský ředitel", sr: "Glavni lekar / medicinski direktor", hu: "Főorvos / orvosigazgató", ar: "رئيس الأطباء / المدير الطبي", es: "Director médico", pt: "Diretor clínico" } },
  { value: "Owner / founder", label: { uk: "Власник / засновник", en: "Owner / founder", pl: "Właściciel / założyciel", de: "Inhaber / Gründer", ro: "Proprietar / fondator", cs: "Majitel / zakladatel", sr: "Vlasnik / osnivač", hu: "Tulajdonos / alapító", ar: "المالك / المؤسس", es: "Propietario / fundador", pt: "Proprietário / fundador" } },
  { value: "Administrator / operations", label: { uk: "Адміністратор / операційний менеджер", en: "Administrator / operations", pl: "Administrator / operacje", de: "Verwaltung / Betrieb", ro: "Administrator / operațiuni", cs: "Administrativa / provoz", sr: "Administracija / operacije", hu: "Adminisztráció / működés", ar: "الإدارة / العمليات", es: "Administración / operaciones", pt: "Administração / operações" } },
  { value: "IT / procurement", label: { uk: "IT / закупівлі", en: "IT / procurement", pl: "IT / zakupy", de: "IT / Beschaffung", ro: "IT / achiziții", cs: "IT / nákup", sr: "IT / nabavka", hu: "IT / beszerzés", ar: "تقنية المعلومات / المشتريات", es: "TI / compras", pt: "TI / compras" } },
  { value: "Nurse", label: { uk: "Медсестра / медбрат", en: "Nurse", pl: "Pielęgniarka / pielęgniarz", de: "Pflegekraft", ro: "Asistent medical", cs: "Zdravotní sestra / bratr", sr: "Medicinska sestra / tehničar", hu: "Ápoló", ar: "ممرض/ممرضة", es: "Enfermero/a", pt: "Enfermeiro(a)" } },
  { value: "Other", label: { uk: "Інше", en: "Other", pl: "Inne", de: "Sonstiges", ro: "Altele", cs: "Jiné", sr: "Drugo", hu: "Egyéb", ar: "أخرى", es: "Otro", pt: "Outro" } },
];

// ICP qualification: what KIND of organisation this is. A 400-bed public
// hospital and a two-room private practice are both "a clinic" and neither
// buys the same way.
export const ORG_TYPES = [
  { value: "Public hospital", label: { uk: "Державна лікарня", en: "Public hospital", pl: "Szpital publiczny", de: "Öffentliches Krankenhaus", ro: "Spital public", cs: "Veřejná nemocnice", sr: "Javna bolnica", hu: "Állami kórház", ar: "مستشفى حكومي", es: "Hospital público", pt: "Hospital público" } },
  { value: "Private clinic", label: { uk: "Приватна клініка", en: "Private clinic", pl: "Klinika prywatna", de: "Privatklinik", ro: "Clinică privată", cs: "Soukromá klinika", sr: "Privatna klinika", hu: "Magánklinika", ar: "عيادة خاصة", es: "Clínica privada", pt: "Clínica privada" } },
  { value: "Clinic network", label: { uk: "Мережа клінік", en: "Clinic network", pl: "Sieć klinik", de: "Klinikkette", ro: "Rețea de clinici", cs: "Síť klinik", sr: "Mreža klinika", hu: "Klinikahálózat", ar: "شبكة عيادات", es: "Red de clínicas", pt: "Rede de clínicas" } },
  { value: "Diagnostic centre", label: { uk: "Діагностичний центр", en: "Diagnostic centre", pl: "Centrum diagnostyczne", de: "Diagnostikzentrum", ro: "Centru de diagnostic", cs: "Diagnostické centrum", sr: "Dijagnostički centar", hu: "Diagnosztikai központ", ar: "مركز تشخيصي", es: "Centro de diagnóstico", pt: "Centro de diagnóstico" } },
  { value: "Solo / small practice", label: { uk: "Приватна практика (ФОП)", en: "Solo / small practice", pl: "Praktyka indywidualna", de: "Einzelpraxis", ro: "Cabinet individual", cs: "Soukromá praxe", sr: "Samostalna praksa", hu: "Egyéni praxis", ar: "عيادة فردية", es: "Consulta individual", pt: "Consultório individual" } },
  { value: "University / teaching hospital", label: { uk: "Університетська клініка", en: "University / teaching hospital", pl: "Szpital kliniczny", de: "Universitätsklinikum", ro: "Spital universitar", cs: "Fakultní nemocnice", sr: "Univerzitetska bolnica", hu: "Egyetemi klinika", ar: "مستشفى جامعي", es: "Hospital universitario", pt: "Hospital universitário" } },
  { value: "Other", label: { uk: "Інше", en: "Other", pl: "Inne", de: "Sonstiges", ro: "Altele", cs: "Jiné", sr: "Drugo", hu: "Egyéb", ar: "أخرى", es: "Otro", pt: "Outro" } },
];

// Deal size. Kept as pills rather than a dropdown: it is one tap, and it is the
// only field on the organisation step a visitor never has to think about.
export const SIZES = [
  { value: "Just me", label: { uk: "Тільки я", en: "Just me", pl: "Tylko ja", de: "Nur ich", ro: "Doar eu", cs: "Jen já", sr: "Samo ja", hu: "Csak én", ar: "أنا فقط", es: "Solo yo", pt: "Apenas eu" } },
  { value: "2-5", label: { en: "2–5" } },
  { value: "6-20", label: { en: "6–20" } },
  { value: "21-50", label: { en: "21–50" } },
  { value: "51+", label: { en: "51+" } },
];

// Why someone is writing to us, from the contact form. Not part of the signup
// wizard — it lives here because it is the same kind of object (stable CRM
// value + a label per language) and splitting the picklists across two files
// by which form uses them would be a distinction nobody maintains.
//
// Seven options, in the order a visitor is likely to want them: the two
// commercial reasons first, support where an existing customer will look, and
// "something else" last so it is never the path of least resistance.
export const CONTACT_REASONS = [
  { value: "Pricing and plans", label: { uk: "Ціни та тарифи", en: "Pricing and plans", pl: "Ceny i plany", de: "Preise und Tarife", ro: "Prețuri și planuri", cs: "Ceny a tarify", sr: "Cene i planovi", hu: "Árak és csomagok", ar: "الأسعار والخطط", es: "Precios y planes", pt: "Preços e planos", lt: "Kainos ir planai" } },
  { value: "Product question", label: { uk: "Питання про продукт", en: "Product question", pl: "Pytanie o produkt", de: "Frage zum Produkt", ro: "Întrebare despre produs", cs: "Dotaz k produktu", sr: "Pitanje o proizvodu", hu: "Kérdés a termékről", ar: "سؤال عن المنتج", es: "Pregunta sobre el producto", pt: "Questão sobre o produto", lt: "Klausimas apie produktą" } },
  { value: "See a demo", label: { uk: "Побачити демо", en: "See a demo", pl: "Zobaczyć demo", de: "Demo ansehen", ro: "Vreau o demonstrație", cs: "Chci vidět ukázku", sr: "Želim demo", hu: "Bemutatót kérek", ar: "أرغب في عرض توضيحي", es: "Ver una demo", pt: "Ver uma demonstração", lt: "Pamatyti demonstraciją" } },
  { value: "Support", label: { uk: "Підтримка (я вже користувач)", en: "Support (existing customer)", pl: "Wsparcie (obecny klient)", de: "Support (bestehender Kunde)", ro: "Asistență (client existent)", cs: "Podpora (stávající klient)", sr: "Podrška (postojeći korisnik)", hu: "Támogatás (meglévő ügyfél)", ar: "الدعم (عميل حالي)", es: "Soporte (cliente actual)", pt: "Suporte (cliente atual)", lt: "Pagalba (esamas klientas)" } },
  { value: "Security and privacy", label: { uk: "Безпека та приватність", en: "Security, privacy and DPA", pl: "Bezpieczeństwo, prywatność i DPA", de: "Sicherheit, Datenschutz und AVV", ro: "Securitate, confidențialitate și DPA", cs: "Bezpečnost, ochrana údajů a DPA", sr: "Bezbednost, privatnost i DPA", hu: "Biztonság, adatvédelem és DPA", ar: "الأمن والخصوصية واتفاقية معالجة البيانات", es: "Seguridad, privacidad y DPA", pt: "Segurança, privacidade e RGPD", lt: "Sauga, privatumas ir DTS" } },
  { value: "Partnership", label: { uk: "Партнерство", en: "Partnership", pl: "Współpraca", de: "Partnerschaft", ro: "Parteneriat", cs: "Partnerství", sr: "Partnerstvo", hu: "Partnerség", ar: "شراكة", es: "Colaboración", pt: "Parceria", lt: "Partnerystė" } },
  { value: "Other", label: { uk: "Інше", en: "Something else", pl: "Coś innego", de: "Etwas anderes", ro: "Altceva", cs: "Něco jiného", sr: "Nešto drugo", hu: "Valami más", ar: "شيء آخر", es: "Otra cosa", pt: "Outro assunto", lt: "Kita" } },
];

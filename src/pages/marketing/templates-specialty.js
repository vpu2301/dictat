// templates-specialty.js — Content registry for the public "Templates" marketplace.
//
// Pure data: no React, no imports, no side effects. Each entry describes one
// medical note template shown on /templates and its detail page /templates/<slug>:
//   slug      unique kebab-case route key
//   cat       category key used by the marketplace filter
//   icon      icon name resolved by the marketing icon map
//   name/tag  bilingual card title and one-line summary
//   mins      documentation minutes saved per note
//   fields    discrete structured fields captured by the template
//   popular   optional flag — surfaces the entry in the "Popular" rail
//   about     2–3 sentences for the detail page
//   bestFor   three clinician roles / settings the template suits
//   sections  note headings in clinical order, each with a dictated sample
//
// All samples are fully de-identified: no names, dates of birth, ID numbers or
// real clinic details — only abstract ages, vitals and findings.

export const SPECIALTY_TEMPLATES = [
  {
    slug: "cardiology-consult",
    cat: "cardiology",
    icon: "heart",
    name: { uk: "Консультація кардіолога", en: "Cardiology consultation" },
    tag: {
      uk: "Повний прийом кардіолога: скарги, фактори ризику, ЕКГ і план лікування",
      en: "Full cardiology visit: symptoms, risk factors, ECG findings and a treatment plan",
    },
    mins: 8,
    fields: 34,
    popular: true,
    about: {
      uk: "Шаблон покриває первинну та повторну консультацію кардіолога — від характеру болю в грудях до титрування доз. Лікар диктує прийом у вільній формі, а система розкладає сказане по розділах, окремо виносить фактори ризику, поточну терапію та цільові показники. Розрахунки на кшталт індексу маси тіла й частоти серцевих скорочень підтягуються з продиктованих вимірювань.",
      en: "The template covers both new and follow-up cardiology visits, from the character of chest pain through to dose titration. The clinician dictates the encounter freely and the system sorts it into sections, pulling risk factors, current therapy and target values into their own fields. Derived values such as body mass index are computed from the vitals you dictate.",
    },
    bestFor: {
      uk: ["Кардіологи амбулаторного прийому", "Терапевти з кардіологічним профілем", "Консультативні центри та діагностичні клініки"],
      en: ["Outpatient cardiologists", "Internists with a cardiac caseload", "Consultative and diagnostic clinics"],
    },
    sections: [
      {
        name: { uk: "Скарги та анамнез захворювання", en: "Presenting complaint and history" },
        sample: {
          uk: "Чоловік 58 років скаржиться на стискаючий біль за грудниною під час підйому на другий поверх, що минає у спокої протягом трьох-чотирьох хвилин. Симптоми тривають близько двох місяців і за останні два тижні почали виникати при меншому навантаженні.",
          en: "A 58-year-old man reports pressure-like retrosternal pain on climbing one flight of stairs, relieved by rest within three to four minutes. Symptoms have been present for about two months and over the past fortnight occur at a lower exertion threshold.",
        },
      },
      {
        name: { uk: "Фактори серцево-судинного ризику", en: "Cardiovascular risk factors" },
        sample: {
          uk: "Артеріальна гіпертензія протягом восьми років, дисліпідемія, куріння до однієї пачки на добу протягом тридцяти років. Обтяжений сімейний анамнез: інфаркт міокарда у батька у віці 54 років.",
          en: "Hypertension for eight years, dyslipidaemia, and a thirty-pack-year smoking history. Family history is positive: father sustained a myocardial infarction at 54.",
        },
      },
      {
        name: { uk: "Поточна терапія", en: "Current medications" },
        sample: {
          uk: "Приймає інгібітор АПФ у середній добовій дозі та статин увечері; ацетилсаліцилову кислоту приймає нерегулярно. Пропусків прийому гіпотензивного препарату за останній місяць не було.",
          en: "Takes an ACE inhibitor at a mid-range daily dose and an evening statin; aspirin is taken irregularly. No missed antihypertensive doses over the past month.",
        },
      },
      {
        name: { uk: "Об'єктивний огляд і вітальні показники", en: "Examination and vital signs" },
        sample: {
          uk: "Артеріальний тиск 148/92 мм рт. ст. на обох руках, пульс 78 за хвилину, ритмічний. Тони серця приглушені, шумів немає, периферичних набряків немає, дихання везикулярне.",
          en: "Blood pressure 148/92 mmHg in both arms, pulse 78 and regular. Heart sounds are muffled with no murmurs, no peripheral oedema, and the chest is clear on auscultation.",
        },
      },
      {
        name: { uk: "ЕКГ та інструментальні дані", en: "ECG and investigations" },
        sample: {
          uk: "На ЕКГ синусовий ритм з частотою 78 за хвилину, горизонтальна депресія сегмента ST до 0,5 мм у відведеннях V5–V6. Ознак гіпертрофії лівого шлуночка за вольтажними критеріями немає.",
          en: "ECG shows sinus rhythm at 78 bpm with up to 0.5 mm horizontal ST depression in V5–V6. Voltage criteria for left ventricular hypertrophy are not met.",
        },
      },
      {
        name: { uk: "Оцінка та діагноз", en: "Assessment and diagnosis" },
        sample: {
          uk: "Клінічна картина відповідає стабільній стенокардії напруження II функціонального класу на тлі неконтрольованої артеріальної гіпертензії. Ймовірність обструктивного ураження коронарних артерій оцінюється як проміжна-висока.",
          en: "The picture is consistent with stable exertional angina, CCS class II, on a background of uncontrolled hypertension. Pre-test probability of obstructive coronary disease is intermediate to high.",
        },
      },
      {
        name: { uk: "План обстеження та лікування", en: "Plan" },
        sample: {
          uk: "Призначено ехокардіографію та навантажувальний тест, ліпідограму й глікований гемоглобін. Додано бета-блокатор із поступовим титруванням, посилено дозу статину, наголошено на повній відмові від куріння.",
          en: "Echocardiography and an exercise stress test are arranged, along with a lipid panel and HbA1c. A beta blocker is added with planned titration, the statin dose is intensified, and complete smoking cessation is emphasised.",
        },
      },
      {
        name: { uk: "Рекомендації та повторний візит", en: "Advice and follow-up" },
        sample: {
          uk: "Пацієнту пояснено правила прийому нітратів при нападі та ознаки, за яких слід негайно викликати екстрену допомогу. Повторний огляд через чотири тижні з результатами обстежень.",
          en: "The patient was counselled on using short-acting nitrates during an episode and on red flags requiring emergency care. Review in four weeks with the results of the investigations.",
        },
      },
    ],
  },
  {
    slug: "echocardiography-report",
    cat: "cardiology",
    icon: "heart",
    name: { uk: "Протокол ехокардіографії", en: "Echocardiography report" },
    tag: {
      uk: "Структурований протокол ЕхоКГ: камери, клапани, функція та висновок",
      en: "Structured echo report: chambers, valves, function and a formatted conclusion",
    },
    mins: 9,
    fields: 42,
    about: {
      uk: "Шаблон розрахований на диктування протоколу безпосередньо біля апарата, коли руки зайняті датчиком. Числові вимірювання розпізнаються з одиницями та підставляються у відповідні поля, а описова частина клапанів і камер формується як готовий текст протоколу. Висновок збирається окремо, щоб його можна було швидко перевірити перед підписанням.",
      en: "The template is designed for dictating while your hands are on the probe. Numeric measurements are recognised with their units and dropped into the matching fields, while chamber and valve descriptions are rendered as finished report prose. The conclusion is assembled separately so it can be checked quickly before signing.",
    },
    bestFor: {
      uk: ["Лікарі функціональної діагностики", "Кардіологи, які самі виконують ЕхоКГ", "Діагностичні відділення стаціонарів"],
      en: ["Cardiac sonographers and imaging physicians", "Cardiologists who scan their own patients", "Hospital diagnostic departments"],
    },
    sections: [
      {
        name: { uk: "Показання та умови дослідження", en: "Indication and study conditions" },
        sample: {
          uk: "Дослідження виконано трансторакально у зв'язку зі скаргами на задишку при навантаженні та систолічним шумом. Якість візуалізації задовільна, ритм синусовий.",
          en: "Transthoracic study performed for exertional dyspnoea and a systolic murmur. Image quality is adequate and the rhythm is sinus throughout.",
        },
      },
      {
        name: { uk: "Лівий шлуночок", en: "Left ventricle" },
        sample: {
          uk: "Кінцево-діастолічний розмір 52 мм, товщина міжшлуночкової перегородки 12 мм, задньої стінки 11 мм. Зон порушення локальної скоротливості не виявлено, фракція викиду за Сімпсоном 58%.",
          en: "End-diastolic dimension 52 mm, interventricular septum 12 mm and posterior wall 11 mm. No regional wall motion abnormalities; biplane Simpson ejection fraction is 58%.",
        },
      },
      {
        name: { uk: "Ліве передсердя та праві відділи", en: "Left atrium and right heart" },
        sample: {
          uk: "Ліве передсердя помірно розширене, індекс об'єму 36 мл/м². Праві відділи не розширені, скоротливість правого шлуночка збережена, TAPSE 22 мм.",
          en: "The left atrium is mildly dilated with a volume index of 36 mL/m². Right-sided chambers are not dilated, right ventricular function is preserved and TAPSE is 22 mm.",
        },
      },
      {
        name: { uk: "Клапанний апарат", en: "Valves" },
        sample: {
          uk: "Стулки аортального клапана ущільнені, розкриття достатнє, максимальний градієнт 14 мм рт. ст. Мітральна регургітація I ступеня, стулки без вегетацій.",
          en: "Aortic cusps are mildly thickened with adequate opening and a peak gradient of 14 mmHg. There is grade I mitral regurgitation with no vegetations seen.",
        },
      },
      {
        name: { uk: "Діастолічна функція та тиск у легеневій артерії", en: "Diastolic function and pulmonary pressures" },
        sample: {
          uk: "Співвідношення E/A 0,7, середнє E/e' 11 — діастолічна дисфункція I типу. Розрахунковий систолічний тиск у легеневій артерії 30 мм рт. ст.",
          en: "E/A ratio 0.7 with an average E/e' of 11, consistent with grade I diastolic dysfunction. Estimated pulmonary artery systolic pressure is 30 mmHg.",
        },
      },
      {
        name: { uk: "Аорта та перикард", en: "Aorta and pericardium" },
        sample: {
          uk: "Корінь аорти 34 мм, висхідний відділ 36 мм, стінки ущільнені. У порожнині перикарда вільної рідини не виявлено.",
          en: "Aortic root measures 34 mm and the ascending aorta 36 mm, with mild wall thickening. No pericardial effusion is present.",
        },
      },
      {
        name: { uk: "Висновок", en: "Conclusion" },
        sample: {
          uk: "Концентричне ремоделювання лівого шлуночка зі збереженою систолічною функцією, діастолічна дисфункція I типу. Помірне розширення лівого передсердя, мітральна регургітація I ступеня, гемодинамічно незначуща.",
          en: "Concentric left ventricular remodelling with preserved systolic function and grade I diastolic dysfunction. Mild left atrial dilatation and haemodynamically insignificant grade I mitral regurgitation.",
        },
      },
    ],
  },
  {
    slug: "psychiatric-intake",
    cat: "psychiatry",
    icon: "user",
    name: { uk: "Первинна психіатрична оцінка", en: "Psychiatric intake assessment" },
    tag: {
      uk: "Первинний прийом психіатра: анамнез, психічний статус, ризики та план",
      en: "Initial psychiatric visit: history, mental state exam, risk assessment and plan",
    },
    mins: 12,
    fields: 46,
    about: {
      uk: "Найдовший за обсягом шаблон: первинна оцінка зазвичай триває годину й породжує кілька сторінок тексту. Лікар може диктувати відразу після прийому у звичній оповідній манері, а система розводить біографічні дані, психічний статус і оцінку ризику по окремих розділах. Формулювання про суїцидальні думки та вживання речовин виносяться у виділені поля, щоб їх не загубити в тексті.",
      en: "This is the longest template here: an intake typically runs an hour and produces several pages of text. You can dictate narratively straight after the session and the system separates background history, mental state examination and risk into their own sections. Statements about suicidality and substance use are lifted into dedicated fields so they are never buried in prose.",
    },
    bestFor: {
      uk: ["Психіатри амбулаторної практики", "Команди психічного здоров'я громади", "Приймальні відділення психіатричних стаціонарів"],
      en: ["Outpatient psychiatrists", "Community mental health teams", "Psychiatric admission units"],
    },
    sections: [
      {
        name: { uk: "Причина звернення", en: "Reason for referral" },
        sample: {
          uk: "Жінка 32 років звернулася самостійно зі скаргами на пригнічений настрій, втрату інтересу до звичних занять і ранні пробудження протягом останніх чотирьох місяців. Стан погіршився після зміни роботи.",
          en: "A 32-year-old woman self-referred with four months of low mood, loss of interest in usual activities and early morning waking. Symptoms worsened after a change of employment.",
        },
      },
      {
        name: { uk: "Анамнез теперішнього стану", en: "History of presenting illness" },
        sample: {
          uk: "Симптоми наростали поступово, зараз присутні майже щодня протягом більшої частини дня. Апетит знижений, втрата ваги близько чотирьох кілограмів, концентрація уваги суттєво порушена на роботі.",
          en: "Symptoms developed gradually and are now present most of the day, nearly every day. Appetite is reduced with about four kilograms of weight loss, and concentration is markedly impaired at work.",
        },
      },
      {
        name: { uk: "Психіатричний, соматичний і сімейний анамнез", en: "Past psychiatric, medical and family history" },
        sample: {
          uk: "Раніше по допомозі до психіатра не зверталася, госпіталізацій не було. У матері — депресивний епізод, який лікували амбулаторно; соматично здорова, хронічних захворювань не має.",
          en: "No previous psychiatric contact or admissions. The patient's mother was treated as an outpatient for a depressive episode; there is no significant medical history.",
        },
      },
      {
        name: { uk: "Вживання психоактивних речовин", en: "Substance use" },
        sample: {
          uk: "Алкоголь вживає епізодично, до двох стандартних порцій на тиждень, епізодів надмірного вживання не описує. Тютюн і нелегальні речовини заперечує.",
          en: "Alcohol use is occasional, up to two standard drinks a week, with no episodes of heavy use described. Denies tobacco and illicit substances.",
        },
      },
      {
        name: { uk: "Психічний статус", en: "Mental state examination" },
        sample: {
          uk: "Контакт продуктивний, охайна, мова у нормальному темпі, настрій знижений, афект звужений, конгруентний. Маячних ідей і розладів сприйняття не виявлено, критика до стану збережена.",
          en: "Engages well, appropriately groomed, speech of normal rate and volume, mood low with a constricted but congruent affect. No delusional beliefs or perceptual disturbance; insight is intact.",
        },
      },
      {
        name: { uk: "Оцінка ризику", en: "Risk assessment" },
        sample: {
          uk: "Пасивні думки про небажання жити виникали двічі за останній місяць, без плану, наміру чи підготовчих дій. Заперечує аутоагресію в анамнезі, має підтримку партнера й погоджується на план безпеки.",
          en: "Passive thoughts that life is not worth living occurred twice in the past month, with no plan, intent or preparatory acts. No history of self-harm, supportive partner at home, and the patient agrees to a safety plan.",
        },
      },
      {
        name: { uk: "Діагностичне формулювання", en: "Diagnostic formulation" },
        sample: {
          uk: "Клінічна картина відповідає депресивному епізоду помірного ступеня без психотичних симптомів. Провідними чинниками є хронічний робочий стрес і соціальна ізоляція після переїзду.",
          en: "The presentation meets criteria for a moderate depressive episode without psychotic features. Chronic occupational stress and social isolation after a relocation are the main contributing factors.",
        },
      },
      {
        name: { uk: "План ведення", en: "Management plan" },
        sample: {
          uk: "Розпочато селективний інгібітор зворотного захоплення серотоніну в стартовій дозі з поясненням очікуваних побічних ефектів. Направлено на когнітивно-поведінкову терапію, повторний огляд через два тижні.",
          en: "An SSRI was started at the introductory dose with counselling about expected early side effects. Referral made for cognitive behavioural therapy, with review in two weeks.",
        },
      },
    ],
  },
  {
    slug: "psychotherapy-progress-note",
    cat: "psychiatry",
    icon: "edit",
    name: { uk: "Нотатка сеансу психотерапії", en: "Psychotherapy progress note" },
    tag: {
      uk: "Коротка нотатка сеансу: теми, втручання, прогрес до цілей і домашнє завдання",
      en: "Concise session note: themes, interventions, progress toward goals and homework",
    },
    mins: 5,
    fields: 18,
    about: {
      uk: "Шаблон для щоденних записів між сеансами, коли важлива швидкість, а не обсяг. Терапевт наговорює дві-три хвилини одразу після зустрічі, і система формує лаконічний запис із посиланням на цілі плану лікування. Окремо фіксуються використані втручання та узгоджене домашнє завдання.",
      en: "A template for the routine note written between sessions, where speed matters more than length. Dictate for two or three minutes right after the appointment and the system produces a compact record tied back to the treatment plan goals. Interventions used and the agreed homework are captured as their own fields.",
    },
    bestFor: {
      uk: ["Психотерапевти та психологи", "Психіатри, які ведуть терапію", "Приватні кабінети та онлайн-практики"],
      en: ["Psychotherapists and counselling psychologists", "Psychiatrists providing therapy", "Private and telehealth practices"],
    },
    sections: [
      {
        name: { uk: "Формат і тривалість сеансу", en: "Session format and duration" },
        sample: {
          uk: "Індивідуальний сеанс тривалістю 50 хвилин, проведений очно, восьмий за рахунком у поточному курсі. Клієнт прийшов вчасно, залучення протягом зустрічі високе.",
          en: "Fifty-minute individual session delivered in person, the eighth of the current course. The client arrived on time and engagement was good throughout.",
        },
      },
      {
        name: { uk: "Теми сеансу", en: "Session content" },
        sample: {
          uk: "Основною темою був конфлікт із керівником і пов'язане уникання робочих зустрічей. Клієнт уперше описав переконання про власну некомпетентність як центральне для цих ситуацій.",
          en: "The main theme was conflict with a line manager and the resulting avoidance of team meetings. The client identified a belief about personal incompetence as central to these situations for the first time.",
        },
      },
      {
        name: { uk: "Психічний стан під час сеансу", en: "Mental state during session" },
        sample: {
          uk: "Настрій дещо знижений, афект жвавий, помітне пожвавлення в другій половині зустрічі. Суїцидальних думок не висловлює, сон покращився до шести годин на добу.",
          en: "Mood was mildly low with a reactive affect that brightened in the second half of the session. No suicidal ideation expressed and sleep has improved to about six hours a night.",
        },
      },
      {
        name: { uk: "Застосовані втручання", en: "Interventions used" },
        sample: {
          uk: "Використано когнітивне реструктурування з веденням щоденника думок і техніку низхідної стрілки для виявлення глибинного переконання. Наприкінці відпрацьовано коротку вправу на діафрагмальне дихання.",
          en: "Cognitive restructuring with a thought record was used, along with a downward-arrow exercise to surface the underlying belief. The session closed with a brief diaphragmatic breathing practice.",
        },
      },
      {
        name: { uk: "Прогрес щодо цілей терапії", en: "Progress toward goals" },
        sample: {
          uk: "Ціль щодо участі у робочих зустрічах виконана частково: клієнт відвідав дві з трьох запланованих. Рівень тривоги за суб'єктивною шкалою знизився з восьми до шести балів.",
          en: "The goal of attending team meetings was partly met, with two of three attended this week. Subjective anxiety ratings fell from eight to six out of ten.",
        },
      },
      {
        name: { uk: "План і домашнє завдання", en: "Plan and homework" },
        sample: {
          uk: "До наступної зустрічі клієнт заповнює щоденник думок для двох робочих ситуацій і планує одне коротке висловлювання на нараді. Наступний сеанс через тиждень у тому ж форматі.",
          en: "Before the next session the client will complete thought records for two workplace situations and plan one brief contribution in a meeting. Next appointment in one week in the same format.",
        },
      },
    ],
  },
  {
    slug: "well-child-visit",
    cat: "pediatrics",
    icon: "users",
    name: { uk: "Профілактичний огляд дитини", en: "Well-child visit" },
    tag: {
      uk: "Плановий огляд: розвиток, годування, щеплення, зростання й поради батькам",
      en: "Routine check-up: development, feeding, immunisations, growth and parent advice",
    },
    mins: 7,
    fields: 32,
    popular: true,
    about: {
      uk: "Шаблон веде через усі обов'язкові пункти планового огляду, які легко пропустити наприкінці зміни. Продиктовані показники зросту, ваги та обводу голови складаються в окремі поля разом із перцентилями, а віхи розвитку фіксуються за віковими групами. Розділ порад батькам формується як готовий текст для видачі на руки.",
      en: "The template walks through every mandatory element of a routine check that is easy to skip late in a clinic. Dictated length, weight and head circumference land in their own fields alongside centiles, and developmental milestones are recorded by age band. The parent advice section is rendered as text you can hand over at the end of the visit.",
    },
    bestFor: {
      uk: ["Педіатри первинної ланки", "Сімейні лікарі з дитячим прийомом", "Дитячі поліклініки та центри розвитку"],
      en: ["Primary care paediatricians", "Family doctors seeing children", "Child health clinics"],
    },
    sections: [
      {
        name: { uk: "Вік і мета візиту", en: "Age and purpose of visit" },
        sample: {
          uk: "Плановий профілактичний огляд дитини віком дев'ять місяців, скарг батьки не мають. Дитина від першої вагітності, пологи термінові, без ускладнень.",
          en: "Routine health surveillance visit at nine months of age, with no parental concerns raised. Child of a first pregnancy, born at term without complications.",
        },
      },
      {
        name: { uk: "Годування та харчування", en: "Feeding and nutrition" },
        sample: {
          uk: "Грудне вигодовування продовжується, прикорм введено з шести місяців, наразі отримує овочеві та круп'яні страви двічі на добу. Питний режим достатній, харчової алергії не відмічалося.",
          en: "Breastfeeding continues, complementary foods were introduced at six months, and the child now takes vegetable and cereal meals twice daily. Fluid intake is adequate and no food allergy has been observed.",
        },
      },
      {
        name: { uk: "Розвиток", en: "Development" },
        sample: {
          uk: "Самостійно сидить, повзає, підтягується до опори, впевнено бере дрібні предмети пальцями. Лепече склади, реагує на своє ім'я, проявляє тривогу при незнайомих людях.",
          en: "Sits independently, crawls, pulls to stand and picks up small objects with a pincer grip. Babbles in syllables, responds to name, and shows appropriate stranger wariness.",
        },
      },
      {
        name: { uk: "Антропометрія", en: "Growth measurements" },
        sample: {
          uk: "Маса тіла 8,9 кг, довжина тіла 71 см, обвід голови 45 см — усі показники в межах 25–50 перцентиля. Динаміка зростання рівномірна, відхилень від власного коридору немає.",
          en: "Weight 8.9 kg, length 71 cm and head circumference 45 cm, all between the 25th and 50th centiles. Growth is tracking steadily along the child's own centile lines.",
        },
      },
      {
        name: { uk: "Об'єктивний огляд", en: "Physical examination" },
        sample: {
          uk: "Шкіра чиста, велике тім'ячко 1×1 см, не напружене, зів спокійний. Дихання пуерильне, тони серця ясні, живіт м'який, стегнові суглоби без обмеження відведення.",
          en: "Skin is clear, anterior fontanelle measures 1×1 cm and is soft, and the throat is unremarkable. Chest is clear, heart sounds are normal, abdomen soft, and hip abduction is full and symmetrical.",
        },
      },
      {
        name: { uk: "Щеплення", en: "Immunisations" },
        sample: {
          uk: "Календар щеплень виконано відповідно до віку, реакцій на попередні введення не було. Наступне щеплення заплановано на дванадцять місяців, батькам роз'яснено графік.",
          en: "Immunisations are up to date for age with no reactions to previous doses. The next scheduled vaccination is at twelve months and the schedule was explained to the parents.",
        },
      },
      {
        name: { uk: "Поради батькам і безпека", en: "Anticipatory guidance and safety" },
        sample: {
          uk: "Обговорено безпеку вдома у зв'язку з початком повзання: розетки, сходи, дрібні предмети та побутова хімія. Наголошено на профілактиці дефіциту вітаміну D і режимі сну.",
          en: "Home safety was discussed in light of new mobility: sockets, stairs, small objects and household chemicals. Vitamin D supplementation and sleep routine were reinforced.",
        },
      },
      {
        name: { uk: "План спостереження", en: "Follow-up plan" },
        sample: {
          uk: "Наступний профілактичний огляд у дванадцять місяців із контролем розвитку мовлення та ходи. Батькам надано критерії для позапланового звернення.",
          en: "Next surveillance visit at twelve months with review of speech and walking. Parents were given clear criteria for seeking earlier review.",
        },
      },
    ],
  },
  {
    slug: "pediatric-acute-visit",
    cat: "pediatrics",
    icon: "clock",
    name: { uk: "Гострий стан у дитини", en: "Paediatric acute illness visit" },
    tag: {
      uk: "Швидкий прийом при гострому захворюванні: перебіг, огляд, червоні прапорці",
      en: "Fast acute visit: illness course, examination, red flags and safety-netting advice",
    },
    mins: 6,
    fields: 26,
    about: {
      uk: "Шаблон створений для щільного прийому в сезон респіраторних інфекцій, коли на пацієнта є десять хвилин. Він фіксує тривалість і динаміку симптомів, ознаки зневоднення та дихальної недостатності, а також окремо виносить перевірені червоні прапорці. Розділ безпекових настанов формується автоматично як текст для батьків.",
      en: "Built for a packed respiratory-season clinic where each child gets ten minutes. It captures symptom duration and trajectory, hydration and respiratory distress signs, and records the red flags you explicitly checked. The safety-netting section is generated as plain advice text for the parents.",
    },
    bestFor: {
      uk: ["Педіатри поліклінік у сезон інфекцій", "Сімейні лікарі невідкладного прийому", "Дитячі відділення невідкладної допомоги"],
      en: ["Paediatricians in busy walk-in clinics", "Family doctors covering urgent slots", "Paediatric urgent care units"],
    },
    sections: [
      {
        name: { uk: "Скарги та тривалість", en: "Presenting complaint and duration" },
        sample: {
          uk: "Дитина 4 років, третя доба лихоманки до 38,8 °C, кашель вологий, нежить. Температура знижується після жарознижувального, апетит помірно знижений.",
          en: "A 4-year-old on the third day of fever up to 38.8 °C with a productive cough and rhinorrhoea. Fever responds to antipyretics and appetite is moderately reduced.",
        },
      },
      {
        name: { uk: "Гідратація та загальний стан", en: "Hydration and general condition" },
        sample: {
          uk: "П'є охоче, сечовипускання не рідше чотирьох разів на добу, слизові вологі. Між епізодами лихоманки активна, грається, контакт із оточенням збережений.",
          en: "Drinking willingly with at least four wet nappies or voids a day and moist mucous membranes. Between fever spikes the child is active, playful and interactive.",
        },
      },
      {
        name: { uk: "Об'єктивний огляд", en: "Examination" },
        sample: {
          uk: "Частота дихання 26 за хвилину, сатурація 98% на повітрі, втягнення поступливих місць грудної клітки немає. Аускультативно жорстке дихання, поодинокі провідні хрипи, зів помірно гіперемований.",
          en: "Respiratory rate 26 per minute, saturation 98% in air, and no chest recession. Auscultation reveals coarse breath sounds with a few transmitted upper airway sounds; the throat is mildly injected.",
        },
      },
      {
        name: { uk: "Червоні прапорці", en: "Red flags checked" },
        sample: {
          uk: "Висипу, що не зникає при натисканні, ригідності потиличних м'язів, порушення свідомості та задишки у спокої немає. Ознак зневоднення та тривалого капілярного наповнення не виявлено.",
          en: "No non-blanching rash, neck stiffness, altered consciousness or dyspnoea at rest. No signs of dehydration and capillary refill is under two seconds.",
        },
      },
      {
        name: { uk: "Оцінка", en: "Assessment" },
        sample: {
          uk: "Клінічна картина відповідає гострій вірусній інфекції верхніх дихальних шляхів без ознак ускладнень. Показань до антибактеріальної терапії та рентгенографії наразі немає.",
          en: "The picture is consistent with an uncomplicated viral upper respiratory tract infection. There is currently no indication for antibiotics or chest imaging.",
        },
      },
      {
        name: { uk: "Лікування", en: "Treatment" },
        sample: {
          uk: "Рекомендовано жарознижувальне за вагою при температурі вище 38,5 °C або вираженому дискомфорті, рясне пиття та зволоження повітря. Сольовий розчин у ніс перед годуванням і сном.",
          en: "Weight-based antipyretics were advised for temperature above 38.5 °C or marked discomfort, along with generous fluids and humidified air. Saline nasal drops before feeds and sleep.",
        },
      },
      {
        name: { uk: "Настанови батькам", en: "Safety-netting advice" },
        sample: {
          uk: "Батькам пояснено ознаки, за яких потрібне негайне звернення: утруднене дихання, відмова від пиття, млявість, висип. Повторний огляд, якщо лихоманка триватиме понад п'ять діб.",
          en: "Parents were advised to seek urgent review for laboured breathing, refusal to drink, lethargy or a rash. Reassessment if fever persists beyond five days.",
        },
      },
    ],
  },
  {
    slug: "antenatal-visit",
    cat: "obgyn",
    icon: "calendar",
    name: { uk: "Візит вагітної", en: "Antenatal visit" },
    tag: {
      uk: "Плановий візит під час вагітності: термін, скарги, вимірювання, скринінги",
      en: "Routine pregnancy visit: gestation, symptoms, measurements, screening and plan",
    },
    mins: 6,
    fields: 30,
    about: {
      uk: "Шаблон повторює структуру обмінної карти, тож запис лягає в звичний для акушера порядок. Термін вагітності, висота дна матки, тиск і серцебиття плода фіксуються як окремі поля, придатні для порівняння між візитами. Результати скринінгів і подальші призначення збираються в один блок, щоб нічого не загубилося між прийомами.",
      en: "The template follows the layout of the antenatal record, so the note lands in the order obstetricians expect. Gestational age, fundal height, blood pressure and fetal heart rate are captured as discrete fields that can be compared across visits. Screening results and pending orders are grouped together so nothing slips between appointments.",
    },
    bestFor: {
      uk: ["Акушери-гінекологи жіночих консультацій", "Акушерки, які ведуть вагітність", "Центри планування сім'ї"],
      en: ["Obstetricians in antenatal clinics", "Midwives leading maternity care", "Family planning and maternity centres"],
    },
    sections: [
      {
        name: { uk: "Термін вагітності та акушерський анамнез", en: "Gestation and obstetric history" },
        sample: {
          uk: "Друга вагітність, перші пологи фізіологічні, поточний термін 28 тижнів за даними раннього ультразвукового дослідження. Вагітність перебігає без ускладнень.",
          en: "Second pregnancy, one previous uncomplicated vaginal birth, currently at 28 weeks by early ultrasound dating. The pregnancy has progressed without complications.",
        },
      },
      {
        name: { uk: "Скарги та самопочуття", en: "Symptoms and wellbeing" },
        sample: {
          uk: "Скаржиться на періодичний тягнучий біль у попереку наприкінці дня, який минає в спокої. Кровʼянистих виділень, підтікання навколоплідних вод і головного болю немає.",
          en: "Reports intermittent lower back ache at the end of the day, relieved by rest. No vaginal bleeding, fluid loss or headache.",
        },
      },
      {
        name: { uk: "Рухи плода", en: "Fetal movements" },
        sample: {
          uk: "Рухи плода відчуває активно й регулярно, характер і частота не змінилися за останній тиждень. Пацієнтці нагадано про потребу негайного звернення при зменшенні рухів.",
          en: "Fetal movements are felt regularly and have not changed in pattern or frequency over the past week. The patient was reminded to attend immediately if movements reduce.",
        },
      },
      {
        name: { uk: "Обʼєктивне обстеження", en: "Examination" },
        sample: {
          uk: "Артеріальний тиск 112/70 мм рт. ст., набряків немає, маса тіла зросла на 8 кг від початку вагітності. Висота дна матки 27 см, окружність живота 92 см, положення плода поздовжнє.",
          en: "Blood pressure 112/70 mmHg, no oedema, and a total weight gain of 8 kg so far. Fundal height is 27 cm with a longitudinal lie.",
        },
      },
      {
        name: { uk: "Стан плода", en: "Fetal assessment" },
        sample: {
          uk: "Серцебиття плода ясне, ритмічне, 142 удари за хвилину. Передлежача частина — головка, рухома над входом у малий таз.",
          en: "Fetal heart rate is clear and regular at 142 beats per minute. The presenting part is cephalic and free above the pelvic brim.",
        },
      },
      {
        name: { uk: "Обстеження та скринінги", en: "Investigations and screening" },
        sample: {
          uk: "Гемоглобін 116 г/л, аналіз сечі без патологічних змін, тест на толерантність до глюкози в межах норми. Резус-належність позитивна, додаткової профілактики не потребує.",
          en: "Haemoglobin 116 g/L, urinalysis unremarkable, and the glucose tolerance test was normal. Rhesus positive, so no anti-D prophylaxis is required.",
        },
      },
      {
        name: { uk: "План ведення", en: "Plan" },
        sample: {
          uk: "Продовжити препарати заліза та йоду, рекомендовано помірну фізичну активність і контроль ваги. Наступний візит через два тижні з контролем аналізу сечі.",
          en: "Continue iron and iodine supplementation, with advice on moderate activity and weight monitoring. Next visit in two weeks with a repeat urinalysis.",
        },
      },
    ],
  },
  {
    slug: "gynaecology-consult",
    cat: "obgyn",
    icon: "fileText",
    name: { uk: "Консультація гінеколога", en: "Gynaecology consultation" },
    tag: {
      uk: "Гінекологічний прийом: менструальний анамнез, огляд, УЗД та подальші кроки",
      en: "Gynaecology visit: menstrual history, examination, ultrasound and next steps",
    },
    mins: 7,
    fields: 28,
    about: {
      uk: "Шаблон охоплює типовий амбулаторний гінекологічний прийом — від порушень циклу до профілактичного огляду. Менструальний, контрацептивний і репродуктивний анамнез виносяться в окремі структуровані поля, які зручно порівнювати з попередніми візитами. Результати огляду в дзеркалах, бімануального дослідження та УЗД лягають у звичну послідовність протоколу.",
      en: "The template covers a typical outpatient gynaecology visit, from cycle disturbance to routine screening. Menstrual, contraceptive and reproductive history are captured as structured fields that are easy to compare with earlier visits. Speculum, bimanual and ultrasound findings follow the usual report order.",
    },
    bestFor: {
      uk: ["Гінекологи амбулаторної практики", "Жіночі консультації та приватні клініки", "Лікарі з профілактичних оглядів"],
      en: ["Outpatient gynaecologists", "Women's health clinics", "Clinicians running screening programmes"],
    },
    sections: [
      {
        name: { uk: "Скарги", en: "Presenting complaint" },
        sample: {
          uk: "Жінка 41 року скаржиться на рясні та тривалі менструації протягом останніх шести місяців із появою згустків. Відзначає підвищену втомлюваність, міжменструальних кровотеч немає.",
          en: "A 41-year-old woman reports six months of heavy, prolonged periods with clots. She notes increasing fatigue but has had no intermenstrual bleeding.",
        },
      },
      {
        name: { uk: "Менструальний і репродуктивний анамнез", en: "Menstrual and reproductive history" },
        sample: {
          uk: "Менархе у 13 років, цикл регулярний, 28 днів, тривалість менструації збільшилася з п'яти до восьми діб. Двоє пологів через природні пологові шляхи, вагітність наразі не планує.",
          en: "Menarche at 13, cycles regular at 28 days, with bleeding lasting eight days rather than the previous five. Two vaginal births and no current plans for pregnancy.",
        },
      },
      {
        name: { uk: "Контрацепція та терапія", en: "Contraception and current treatment" },
        sample: {
          uk: "Контрацепція бар'єрна, гормональні препарати не приймає протягом останніх п'яти років. Самостійно приймала препарати заліза курсом близько місяця.",
          en: "Uses barrier contraception and has not taken hormonal preparations for five years. She has self-medicated with oral iron for about a month.",
        },
      },
      {
        name: { uk: "Огляд у дзеркалах і бімануальне дослідження", en: "Speculum and bimanual examination" },
        sample: {
          uk: "Шийка матки циліндрична, епітелій без візуальних змін, виділення слизові, помірні. Матка збільшена до розмірів, що відповідають шести тижням вагітності, щільна, безболісна; додатки не пальпуються.",
          en: "The cervix appears healthy with no visible lesions and moderate mucoid discharge. The uterus is enlarged to about a six-week size, firm and non-tender, with no adnexal masses palpable.",
        },
      },
      {
        name: { uk: "Ультразвукове дослідження", en: "Ultrasound findings" },
        sample: {
          uk: "У передній стінці матки визначається інтрамуральний вузол діаметром 34 мм із чіткими контурами. Ендометрій завтовшки 9 мм, однорідний, яєчники звичайної структури.",
          en: "A 34 mm well-defined intramural fibroid is seen in the anterior uterine wall. The endometrium measures 9 mm and is homogeneous, with normal ovaries bilaterally.",
        },
      },
      {
        name: { uk: "Обстеження та результати", en: "Investigations" },
        sample: {
          uk: "Гемоглобін 104 г/л, феритин знижений, цитологічне дослідження шийки матки без інтраепітеліальних змін. Тиреотропний гормон у межах норми.",
          en: "Haemoglobin 104 g/L with low ferritin; cervical cytology shows no intraepithelial lesion. Thyroid function is within normal limits.",
        },
      },
      {
        name: { uk: "Діагноз і план", en: "Diagnosis and plan" },
        sample: {
          uk: "Лейоміома матки з рясними менструальними кровотечами та залізодефіцитною анемією легкого ступеня. Розпочато препарати заліза, обговорено варіанти гормональної та хірургічної тактики, контроль через три місяці.",
          en: "Uterine leiomyoma with heavy menstrual bleeding and mild iron-deficiency anaemia. Oral iron was started, hormonal and surgical options were discussed, and review is planned in three months.",
        },
      },
    ],
  },
  {
    slug: "dermatology-consult",
    cat: "dermatology",
    icon: "layers",
    name: { uk: "Консультація дерматолога", en: "Dermatology consultation" },
    tag: {
      uk: "Прийом дерматолога: морфологія висипу, локалізація, тригери й схема лікування",
      en: "Dermatology visit: rash morphology, distribution, triggers and a treatment regimen",
    },
    mins: 6,
    fields: 24,
    about: {
      uk: "Опис висипу — найдовша частина дерматологічного запису, і саме її незручно набирати вручну. Шаблон розкладає продиктований опис на морфологію, локалізацію, поширеність і вторинні зміни, зберігаючи термінологію без спотворень. Схема місцевого лікування формується як покроковий текст, придатний для видачі пацієнту.",
      en: "The rash description is the longest part of a dermatology note and the most tedious to type. The template splits your dictation into morphology, distribution, extent and secondary change while preserving the terminology exactly. The topical regimen is rendered as step-by-step instructions you can hand to the patient.",
    },
    bestFor: {
      uk: ["Дерматологи амбулаторного прийому", "Сімейні лікарі з дерматологічними випадками", "Косметологічні та шкірні клініки"],
      en: ["Outpatient dermatologists", "Family doctors managing skin complaints", "Skin and cosmetic clinics"],
    },
    sections: [
      {
        name: { uk: "Скарги та початок захворювання", en: "Complaint and onset" },
        sample: {
          uk: "Чоловік 29 років скаржиться на висип на згинальних поверхнях кінцівок із вираженим свербежем протягом трьох тижнів. Загострення пов'язує зі стресом і зміною пральних засобів.",
          en: "A 29-year-old man presents with a three-week itchy eruption on the flexural surfaces of the limbs. He links the flare to stress and a change of laundry detergent.",
        },
      },
      {
        name: { uk: "Опис висипань", en: "Description of lesions" },
        sample: {
          uk: "Висип представлений еритематозними папулами й бляшками з нечіткими межами, місцями зливними, вкритими дрібними лусочками. Наявні лінійні екскоріації, ознак вторинного інфікування немає.",
          en: "The eruption consists of erythematous papules and plaques with ill-defined borders, partly confluent and covered by fine scale. Linear excoriations are present with no evidence of secondary infection.",
        },
      },
      {
        name: { uk: "Локалізація та поширеність", en: "Distribution and extent" },
        sample: {
          uk: "Уражені ліктьові та підколінні ямки, бічні поверхні шиї, симетрично з обох боків. Загальна площа ураження становить близько 8% поверхні тіла.",
          en: "Involvement is symmetrical over the antecubital and popliteal fossae and the sides of the neck. Total affected area is approximately 8% of the body surface.",
        },
      },
      {
        name: { uk: "Анамнез і тригери", en: "History and triggers" },
        sample: {
          uk: "З дитинства відзначає сухість шкіри та періодичні загострення в холодну пору року. У сімейному анамнезі — алергічний риніт у матері; професійних контактів із подразниками немає.",
          en: "He describes lifelong dry skin with winter flares. Family history includes maternal allergic rhinitis, and there is no occupational irritant exposure.",
        },
      },
      {
        name: { uk: "Діагноз", en: "Diagnosis" },
        sample: {
          uk: "Атопічний дерматит, стадія загострення, середньої тяжкості. Диференціювали з алергічним контактним дерматитом і мікотичним ураженням шкіри.",
          en: "Atopic dermatitis in an acute flare, of moderate severity. Allergic contact dermatitis and superficial fungal infection were considered and felt less likely.",
        },
      },
      {
        name: { uk: "Лікування", en: "Treatment" },
        sample: {
          uk: "Призначено топічний кортикостероїд середньої сили на уражені ділянки двічі на добу до двох тижнів із подальшим переходом на підтримуючий режим. Емолієнти щонайменше двічі на добу постійно, антигістамінний препарат на ніч.",
          en: "A moderately potent topical corticosteroid twice daily for up to two weeks, then stepping down to intermittent maintenance use. Emollients at least twice daily indefinitely, with a sedating antihistamine at night.",
        },
      },
      {
        name: { uk: "Рекомендації та контроль", en: "Advice and follow-up" },
        sample: {
          uk: "Пояснено правила догляду за шкірою, вибір миючих засобів і уникнення тригерів. Повторний огляд через чотири тижні або раніше в разі приєднання інфекції.",
          en: "Skin care, choice of cleansers and trigger avoidance were explained in detail. Review in four weeks, or sooner if signs of infection develop.",
        },
      },
    ],
  },
  {
    slug: "skin-lesion-dermoscopy",
    cat: "dermatology",
    icon: "scan",
    name: { uk: "Огляд новоутворення та дерматоскопія", en: "Skin lesion and dermoscopy note" },
    tag: {
      uk: "Опис новоутворення шкіри: розміри, дерматоскопічні ознаки та тактика",
      en: "Skin lesion record: dimensions, dermoscopic features, risk assessment and next step",
    },
    mins: 5,
    fields: 22,
    about: {
      uk: "Шаблон для запису одного або кількох новоутворень із дерматоскопічною картиною та рішенням щодо подальшої тактики. Розміри, локалізація й ознаки за алгоритмом ABCDE фіксуються окремими полями, тому наступний огляд можна порівняти з попереднім по пунктах. Рішення про спостереження, біопсію чи видалення виноситься в окремий розділ разом із обґрунтуванням.",
      en: "A template for documenting one or more lesions with their dermoscopic appearance and the decision that followed. Dimensions, site and ABCDE features are stored as separate fields, so the next review can be compared point by point. The decision to monitor, biopsy or excise sits in its own section with the reasoning behind it.",
    },
    bestFor: {
      uk: ["Дерматологи та дерматоонкологи", "Клініки з картування невусів", "Хірурги, які видаляють новоутворення шкіри"],
      en: ["Dermatologists and skin cancer clinicians", "Mole-mapping and screening clinics", "Surgeons excising skin lesions"],
    },
    sections: [
      {
        name: { uk: "Причина огляду", en: "Reason for review" },
        sample: {
          uk: "Жінка 45 років звернулася у зв'язку зі зміною кольору й розміру пігментного утворення на спині протягом останніх шести місяців. Свербіння чи кровоточивості не відмічає.",
          en: "A 45-year-old woman attends because a pigmented lesion on her back has changed in colour and size over six months. There has been no itching or bleeding.",
        },
      },
      {
        name: { uk: "Локалізація та розміри", en: "Site and dimensions" },
        sample: {
          uk: "Утворення розташоване в міжлопатковій ділянці справа, розмірами 8 × 6 мм, злегка підвищується над рівнем шкіри. Поряд визначаються три дрібніші невуси однорідної будови.",
          en: "The lesion lies in the right interscapular area, measures 8 × 6 mm and is slightly raised. Three smaller, uniform naevi are present nearby.",
        },
      },
      {
        name: { uk: "Клінічний опис", en: "Clinical appearance" },
        sample: {
          uk: "Утворення асиметричне, з нерівними фестончастими краями та неоднорідним забарвленням від світло-коричневого до майже чорного. Поверхня гладка, виразкування немає.",
          en: "The lesion is asymmetric with irregular scalloped borders and colour varying from light brown to near black. The surface is smooth with no ulceration.",
        },
      },
      {
        name: { uk: "Дерматоскопічна картина", en: "Dermoscopic findings" },
        sample: {
          uk: "Атипова пігментна сітка з нерівномірним потовщенням ліній на периферії, ділянки біло-блакитної вуалі в центрі. Судинний малюнок поліморфний, регресивних змін не виявлено.",
          en: "An atypical pigment network with irregular thickening at the periphery and a central blue-white veil. The vascular pattern is polymorphous and no regression structures are seen.",
        },
      },
      {
        name: { uk: "Оцінка ризику", en: "Risk assessment" },
        sample: {
          uk: "За семипунктовою шкалою утворення набирає бали, що відповідають високій ймовірності меланоцитарної атипії. Фототип шкіри другий, в анамнезі сонячні опіки в дитинстві.",
          en: "The seven-point checklist score falls in the range suggesting a high likelihood of melanocytic atypia. Skin phototype II with a history of childhood sunburns.",
        },
      },
      {
        name: { uk: "Тактика", en: "Plan" },
        sample: {
          uk: "Рекомендовано ексцизійну біопсію з відступом 2 мм і подальшим гістологічним дослідженням. Виконано цифрову дерматоскопічну фіксацію решти невусів для динамічного спостереження.",
          en: "Excisional biopsy with a 2 mm margin and histopathological examination is recommended. Digital dermoscopic images of the remaining naevi were stored for monitoring.",
        },
      },
    ],
  },
  {
    slug: "orthopaedic-consult",
    cat: "orthopedics",
    icon: "bone",
    name: { uk: "Консультація ортопеда", en: "Orthopaedic consultation" },
    tag: {
      uk: "Ортопедичний прийом: механізм травми, обсяг рухів, тести та план лікування",
      en: "Orthopaedic visit: injury mechanism, range of motion, special tests and a plan",
    },
    mins: 7,
    fields: 30,
    about: {
      uk: "Ортопедичний огляд складається з десятків вимірювань і тестів, які довго вносити вручну. Шаблон фіксує обсяг рухів у градусах для кожного суглоба, результати спеціальних тестів і неврологічний статус кінцівки окремими полями. Дані про больовий синдром і функціональні обмеження зберігаються у форматі, придатному для порівняння з наступними візитами.",
      en: "An orthopaedic examination is dozens of measurements and named tests that are slow to type. The template records range of motion in degrees for each joint, the outcome of each special test, and distal neurovascular status as discrete fields. Pain and functional limitation are stored in a form that can be compared at the next visit.",
    },
    bestFor: {
      uk: ["Ортопеди-травматологи амбулаторного прийому", "Спортивні лікарі", "Реабілітаційні та травматологічні центри"],
      en: ["Outpatient orthopaedic surgeons", "Sports medicine physicians", "Trauma and rehabilitation centres"],
    },
    sections: [
      {
        name: { uk: "Скарги та механізм травми", en: "Complaint and mechanism of injury" },
        sample: {
          uk: "Чоловік 34 років скаржиться на біль і нестабільність у правому колінному суглобі після ротаційної травми під час гри у футбол два тижні тому. Одразу після травми виник набряк, навантаження було утруднене.",
          en: "A 34-year-old man reports pain and instability in the right knee after a twisting injury playing football two weeks ago. Swelling developed immediately and weight-bearing was difficult.",
        },
      },
      {
        name: { uk: "Больовий синдром і функція", en: "Pain and function" },
        sample: {
          uk: "Біль за візуальною аналоговою шкалою 6 балів при навантаженні та 2 бали у спокої, посилюється при спуску сходами. Пацієнт не може бігати й відчуває підкошування суглоба при поворотах.",
          en: "Pain scores 6 out of 10 on weight-bearing and 2 at rest, worse descending stairs. He cannot run and describes the knee giving way on turning.",
        },
      },
      {
        name: { uk: "Огляд і пальпація", en: "Inspection and palpation" },
        sample: {
          uk: "Помірний випіт у порожнині суглоба, гіпотрофія чотириголового м'яза стегна близько 1,5 см порівняно з протилежним боком. Болючість при пальпації медіальної суглобової щілини.",
          en: "There is a moderate effusion with about 1.5 cm of quadriceps wasting compared with the other side. The medial joint line is tender to palpation.",
        },
      },
      {
        name: { uk: "Обсяг рухів", en: "Range of motion" },
        sample: {
          uk: "Активне згинання до 115°, розгинання повне, пасивні рухи дещо ширші за активні. Обсяг рухів у контралатеральному суглобі повний і безболісний.",
          en: "Active flexion reaches 115° with full extension; passive range slightly exceeds active. The contralateral knee has full, pain-free movement.",
        },
      },
      {
        name: { uk: "Спеціальні тести", en: "Special tests" },
        sample: {
          uk: "Тест Лахмана позитивний, передній висувний ящик помірно позитивний, тест півот-шифт слабко позитивний. Проби на бічні зв'язки негативні, тест Мак-Мюррея з медіального боку болючий.",
          en: "Lachman test is positive with a moderately positive anterior drawer and a mildly positive pivot shift. Collateral ligament stress tests are negative and McMurray's is painful medially.",
        },
      },
      {
        name: { uk: "Нейросудинний статус", en: "Neurovascular status" },
        sample: {
          uk: "Пульсація на артеріях стопи збережена, чутливість у зонах іннервації малогомілкового та великогомілкового нервів не порушена. Активне тильне згинання стопи в повному обсязі.",
          en: "Distal pulses are palpable and sensation is intact in the peroneal and tibial nerve distributions. Active ankle dorsiflexion is full.",
        },
      },
      {
        name: { uk: "Візуалізація та діагноз", en: "Imaging and diagnosis" },
        sample: {
          uk: "На рентгенограмах кісткової патології не виявлено; за даними МРТ — повний розрив передньої хрестоподібної зв'язки та розрив заднього рогу медіального меніска. Діагноз відповідає клінічній картині нестабільності.",
          en: "Radiographs show no bony injury; MRI demonstrates a complete anterior cruciate ligament tear with a posterior horn medial meniscal tear. The findings match the clinical picture of instability.",
        },
      },
      {
        name: { uk: "План лікування", en: "Management plan" },
        sample: {
          uk: "Розпочато передопераційну реабілітацію для відновлення обсягу рухів і сили чотириголового м'яза. Обговорено артроскопічну реконструкцію зв'язки, очікувані терміни відновлення та ризики; рішення прийматиметься через шість тижнів.",
          en: "Prehabilitation was started to restore range of motion and quadriceps strength. Arthroscopic reconstruction was discussed along with expected recovery times and risks, with a decision planned in six weeks.",
        },
      },
    ],
  },
  {
    slug: "fracture-follow-up",
    cat: "orthopedics",
    icon: "bone",
    name: { uk: "Контроль перелому", en: "Fracture follow-up" },
    tag: {
      uk: "Повторний огляд після перелому: консолідація, іммобілізація, навантаження",
      en: "Fracture review: healing on imaging, immobilisation, weight-bearing and next steps",
    },
    mins: 4,
    fields: 20,
    about: {
      uk: "Короткий шаблон для серії однотипних повторних оглядів, яких у травматолога буває десятки за зміну. Він фіксує тиждень після травми, стан іммобілізації, рентгенологічні ознаки консолідації та дозволений режим навантаження. Оскільки поля повторюються від візиту до візиту, динаміку зрощення видно без перечитування всього тексту.",
      en: "A short template for the run of near-identical review appointments that fill a fracture clinic. It records the week since injury, the state of the cast or brace, radiographic union and the permitted weight-bearing status. Because the fields repeat across visits, the healing trajectory is visible without rereading the whole note.",
    },
    bestFor: {
      uk: ["Травматологи ортопедичних кабінетів", "Хірурги стаціонарів на повторних оглядах", "Реабілітологи в спільному веденні пацієнтів"],
      en: ["Fracture clinic orthopaedic surgeons", "Hospital surgeons running review lists", "Rehabilitation teams sharing care"],
    },
    sections: [
      {
        name: { uk: "Травма та термін спостереження", en: "Injury and interval since fracture" },
        sample: {
          uk: "Повторний огляд на шостому тижні після перелому дистального метаепіфіза променевої кістки без зміщення, лікованого консервативно. Первинна репозиція не виконувалася.",
          en: "Six-week review following an undisplaced distal radius fracture managed conservatively. No reduction was required at presentation.",
        },
      },
      {
        name: { uk: "Скарги на момент огляду", en: "Current symptoms" },
        sample: {
          uk: "Біль у ділянці перелому мінімальний, виникає лише при спробі опори на кисть. Оніміння та порушення чутливості пальців не відмічає.",
          en: "Pain at the fracture site is minimal and occurs only when leaning on the hand. There is no numbness or altered sensation in the fingers.",
        },
      },
      {
        name: { uk: "Стан іммобілізації", en: "Immobilisation status" },
        sample: {
          uk: "Гіпсова пов'язка цілісна, не тисне, шкіра під нею без ознак подразнення чи мацерації. Пацієнт дотримувався режиму іммобілізації без самостійного зняття.",
          en: "The cast is intact and non-constricting, with healthy skin underneath and no maceration. The patient has kept the cast on as instructed.",
        },
      },
      {
        name: { uk: "Огляд", en: "Examination" },
        sample: {
          uk: "Набряк кисті незначний, пальці теплі, капілярне наповнення швидке, рухи в п'ястно-фалангових суглобах у повному обсязі. Болючість при пальпації в проєкції перелому мінімальна.",
          en: "Minimal hand swelling with warm, well-perfused fingers and full metacarpophalangeal movement. Tenderness over the fracture site is minimal.",
        },
      },
      {
        name: { uk: "Рентгенологічний контроль", en: "Radiographic review" },
        sample: {
          uk: "На контрольних рентгенограмах у двох проєкціях визначається формування кісткової мозолі, лінія перелому простежується нечітко. Вторинного зміщення уламків немає, суглобова поверхня конгруентна.",
          en: "Repeat radiographs in two views show callus formation with the fracture line becoming indistinct. There is no secondary displacement and the articular surface remains congruent.",
        },
      },
      {
        name: { uk: "Тактика та навантаження", en: "Plan and weight-bearing" },
        sample: {
          uk: "Гіпсову пов'язку знято, призначено знімний ортез на два тижні з поступовим розширенням рухів. Дозволено побутове навантаження без підйому ваги понад два кілограми.",
          en: "The cast was removed and a removable splint prescribed for two weeks with graded mobilisation. Light everyday use is permitted, avoiding lifting more than two kilograms.",
        },
      },
      {
        name: { uk: "Реабілітація та наступний візит", en: "Rehabilitation and next review" },
        sample: {
          uk: "Надано комплекс вправ для відновлення обсягу рухів у променево-зап'ястковому суглобі та сили захвату. Наступний огляд через чотири тижні, рентгенологічний контроль за потреби.",
          en: "A home exercise programme for wrist range of motion and grip strength was provided. Review in four weeks, with further imaging only if progress is unsatisfactory.",
        },
      },
    ],
  },
];

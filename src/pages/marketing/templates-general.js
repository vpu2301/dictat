// templates-general.js — Content registry for the public "Templates" marketplace.
//
// Pure data: no React, no imports, no side effects. Each entry describes one
// medical note template that Klarnote can fill from dictation:
//   slug      route key — /templates/<slug>, unique across the registry
//   cat       category: "general" | "primary-care" | "surgical"
//   icon      icon name resolved by the templates UI
//   name/tag  bilingual title and one-line summary (uk is primary)
//   mins      minutes of documentation saved per note
//   fields    discrete structured fields captured by the template
//   popular   optional flag for the most widely used templates
//   about     2–3 sentences shown on the template detail page
//   bestFor   three clinician roles / settings the template suits
//   sections  note headings in clinical order, each with a dictated sample
//
// All samples are fully de-identified: no names, no dates of birth, no ID numbers.

export const GENERAL_TEMPLATES = [
  {
    slug: "soap-note",
    cat: "general",
    icon: "fileText",
    name: { uk: "SOAP-запис", en: "SOAP note" },
    tag: {
      uk: "Класична структура візиту: скарги, огляд, оцінка та план — з однієї розмови.",
      en: "The classic visit structure: subjective, objective, assessment and plan from one conversation.",
    },
    mins: 6,
    fields: 22,
    popular: true,
    about: {
      uk: "SOAP — універсальний формат амбулаторного запису, який підходить майже для будь-якої спеціальності. Klarnote слухає розмову з пацієнтом, відокремлює суб'єктивні скарги від об'єктивних даних огляду й розкладає решту на діагностичну оцінку та план. Лікар лише перечитує та підписує.",
      en: "SOAP is the universal outpatient format that fits almost any specialty. Klarnote listens to the encounter, separates the patient's own account from your objective findings, and sorts the rest into assessment and plan. You read it over and sign.",
    },
    bestFor: {
      uk: ["Сімейні лікарі", "Амбулаторний прийом", "Ординатори та інтерни"],
      en: ["Family physicians", "Outpatient clinics", "Residents and trainees"],
    },
    sections: [
      {
        name: { uk: "Суб'єктивно", en: "Subjective" },
        sample: {
          uk: "Чоловік 54 років скаржиться на тиснучий біль за грудниною протягом трьох днів, який виникає під час підйому сходами і минає у спокої за кілька хвилин. Задишку, серцебиття та набряки гомілок заперечує.",
          en: "A 54-year-old man reports three days of pressure-like retrosternal discomfort brought on by climbing stairs and relieved by rest within a few minutes. He denies dyspnoea, palpitations or ankle swelling.",
        },
      },
      {
        name: { uk: "Об'єктивно", en: "Objective" },
        sample: {
          uk: "Стан задовільний, АТ 148/92 мм рт. ст., ЧСС 78 за хв, ритм правильний, SpO₂ 98%. Тони серця приглушені, шумів немає; дихання везикулярне з обох боків, набряків немає.",
          en: "Well-appearing, BP 148/92 mmHg, HR 78 and regular, SpO₂ 98% on room air. Heart sounds muffled with no murmur; chest clear bilaterally; no peripheral oedema.",
        },
      },
      {
        name: { uk: "Оцінка", en: "Assessment" },
        sample: {
          uk: "Клінічна картина відповідає стабільній стенокардії напруження на тлі нещодавно виявленої артеріальної гіпертензії. Гострий коронарний синдром на цей момент малоймовірний.",
          en: "The presentation is consistent with stable exertional angina on a background of newly identified hypertension. Acute coronary syndrome appears unlikely at present.",
        },
      },
      {
        name: { uk: "План", en: "Plan" },
        sample: {
          uk: "Призначено ЕКГ спокою, ліпідограму та глікований гемоглобін; розпочато ацетилсаліцилову кислоту й статин. Направлення до кардіолога на навантажувальний тест протягом двох тижнів.",
          en: "Resting ECG, lipid panel and HbA1c ordered; aspirin and a statin started today. Cardiology referral for exercise testing within two weeks.",
        },
      },
      {
        name: { uk: "Рекомендації пацієнту", en: "Patient instructions" },
        sample: {
          uk: "Пацієнта попереджено негайно звернутися по невідкладну допомогу, якщо біль виникне у спокої або триватиме понад 15 хвилин. Рекомендовано щоденний контроль АТ і обмеження солі.",
          en: "Advised to seek emergency care immediately if pain occurs at rest or lasts longer than 15 minutes. Daily home blood-pressure logging and salt restriction recommended.",
        },
      },
      {
        name: { uk: "Наступний візит", en: "Follow-up" },
        sample: {
          uk: "Повторний огляд через два тижні з результатами обстежень або раніше за погіршення стану.",
          en: "Review in two weeks with results in hand, or sooner if symptoms worsen.",
        },
      },
    ],
  },
  {
    slug: "consultation-note",
    cat: "general",
    icon: "users",
    name: { uk: "Консультативний висновок", en: "Consultation note" },
    tag: {
      uk: "Відповідь профільного фахівця на направлення: питання, оцінка та чіткі рекомендації.",
      en: "A specialist's answer to a referral: the question asked, the assessment and clear recommendations.",
    },
    mins: 8,
    fields: 28,
    popular: true,
    about: {
      uk: "Консультативний висновок має відповісти на конкретне запитання лікаря, який направив пацієнта, і повернути йому зрозумілий план дій. Klarnote утримує цю логіку: фіксує причину звернення, вибудовує анамнез і огляд, а наприкінці окремо виносить рекомендації для лікаря первинної ланки.",
      en: "A consultation note has to answer the referring clinician's specific question and hand back a workable plan. Klarnote keeps that logic intact: it captures the reason for referral, builds the history and examination, then sets the advice to the referrer out as its own section.",
    },
    bestFor: {
      uk: ["Профільні спеціалісти", "Консультативні поліклініки", "Стаціонарні консультації"],
      en: ["Specialty consultants", "Outpatient specialty clinics", "Inpatient consult services"],
    },
    sections: [
      {
        name: { uk: "Причина консультації", en: "Reason for consultation" },
        sample: {
          uk: "Пацієнтку 61 року направлено сімейним лікарем для уточнення генезу залізодефіцитної анемії, виявленої під час планового обстеження.",
          en: "A 61-year-old woman was referred by her family physician to clarify the cause of iron-deficiency anaemia found on routine screening.",
        },
      },
      {
        name: { uk: "Анамнез захворювання", en: "History of present illness" },
        sample: {
          uk: "Протягом чотирьох місяців наростає загальна слабкість і задишка при звичному навантаженні. Явної кровотечі не відмічала, апетит збережений, маса тіла стабільна.",
          en: "Over four months she has developed progressive fatigue and breathlessness on usual exertion. She has noticed no overt bleeding, her appetite is preserved and weight is stable.",
        },
      },
      {
        name: { uk: "Супутній анамнез і терапія", en: "Background and medications" },
        sample: {
          uk: "В анамнезі гіпотиреоз, компенсований левотироксином. Приймає ібупрофен кілька разів на тиждень з приводу болю в колінах.",
          en: "Background of hypothyroidism, well controlled on levothyroxine. She takes ibuprofen several times a week for knee pain.",
        },
      },
      {
        name: { uk: "Об'єктивний огляд", en: "Examination" },
        sample: {
          uk: "Шкіра та слизові бліді, живіт м'який, безболісний, органи не збільшені. Ректальне дослідження без патології, слідів крові не виявлено.",
          en: "Pallor of skin and mucous membranes; abdomen soft, non-tender, no organomegaly. Rectal examination unremarkable with no visible blood.",
        },
      },
      {
        name: { uk: "Дані обстежень", en: "Investigations reviewed" },
        sample: {
          uk: "Гемоглобін 92 г/л, феритин 6 нг/мл, MCV 74 фл. Функція нирок і печінкові проби в межах норми.",
          en: "Haemoglobin 92 g/L, ferritin 6 ng/mL, MCV 74 fL. Renal function and liver enzymes within normal limits.",
        },
      },
      {
        name: { uk: "Висновок консультанта", en: "Impression" },
        sample: {
          uk: "Залізодефіцитна анемія, найімовірніше внаслідок хронічної крововтрати зі шлунково-кишкового тракту на тлі регулярного прийому НПЗЗ. Потребує ендоскопічного дообстеження.",
          en: "Iron-deficiency anaemia, most likely from chronic gastrointestinal blood loss related to regular NSAID use. Endoscopic evaluation is warranted.",
        },
      },
      {
        name: { uk: "Рекомендації лікарю, що направив", en: "Recommendations to the referrer" },
        sample: {
          uk: "Рекомендовано відмінити НПЗЗ, розпочати пероральні препарати заліза та інгібітор протонної помпи. Гастро- і колоноскопію заплановано на найближчі три тижні, результати буде надіслано окремо.",
          en: "Please stop the NSAID and start oral iron with a proton-pump inhibitor. Gastroscopy and colonoscopy are booked within three weeks and results will be forwarded separately.",
        },
      },
    ],
  },
  {
    slug: "progress-note",
    cat: "general",
    icon: "clock",
    name: { uk: "Щоденник стаціонару", en: "Progress note (inpatient)" },
    tag: {
      uk: "Щоденний запис у відділенні: динаміка за добу, дані, проблеми й план на сьогодні.",
      en: "The daily ward entry: overnight events, data, active problems and today's plan.",
    },
    mins: 5,
    fields: 26,
    popular: true,
    about: {
      uk: "Щоденник у стаціонарі пишеться швидко й багато разів на день, тому саме тут диктування економить найбільше часу. Klarnote структурує обхід за проблемами, підтягує вітальні показники та свіжі аналізи, які ви озвучуєте, і формує план на добу.",
      en: "Inpatient progress notes are written fast and many times a day, which is exactly where dictation pays off most. Klarnote structures the round by active problem, files the vitals and fresh results you read out, and closes with the plan for the day.",
    },
    bestFor: {
      uk: ["Терапевтичні відділення", "Чергові лікарі", "Ординатори на обході"],
      en: ["Internal medicine wards", "On-call physicians", "Residents on rounds"],
    },
    sections: [
      {
        name: { uk: "Динаміка за добу", en: "Interval history" },
        sample: {
          uk: "Друга доба госпіталізації з приводу негоспітальної пневмонії. За минулу ніч температура не підвищувалася, кашель став продуктивнішим, задишка у спокої зменшилася.",
          en: "Day two of admission for community-acquired pneumonia. She remained afebrile overnight, the cough has become more productive and rest dyspnoea has eased.",
        },
      },
      {
        name: { uk: "Вітальні показники", en: "Vital signs" },
        sample: {
          uk: "Температура 36,9 °C, АТ 118/70 мм рт. ст., ЧСС 84 за хв, ЧД 20 за хв, SpO₂ 94% на кисні 2 л/хв. Діурез адекватний, баланс рідини нейтральний.",
          en: "Temperature 36.9 °C, BP 118/70 mmHg, HR 84, RR 20, SpO₂ 94% on 2 L/min oxygen. Urine output adequate, fluid balance neutral.",
        },
      },
      {
        name: { uk: "Об'єктивний статус", en: "Examination" },
        sample: {
          uk: "Свідомість ясна, контактний. Над нижньою часткою правої легені зберігаються дрібнопухирчасті хрипи, ділянка притуплення зменшилася. Живіт м'який, периферичних набряків немає.",
          en: "Alert and orientated. Crackles persist over the right lower zone with a smaller area of dullness than yesterday. Abdomen soft, no peripheral oedema.",
        },
      },
      {
        name: { uk: "Результати обстежень", en: "Results" },
        sample: {
          uk: "Лейкоцити знизилися з 15,2 до 11,4 ×10⁹/л, С-реактивний білок 68 мг/л проти 140 мг/л учора. Креатинін і електроліти в нормі.",
          en: "White cells down from 15.2 to 11.4 ×10⁹/L and CRP 68 mg/L compared with 140 mg/L yesterday. Creatinine and electrolytes normal.",
        },
      },
      {
        name: { uk: "Активні проблеми", en: "Active problems" },
        sample: {
          uk: "1. Негоспітальна пневмонія — позитивна динаміка на антибіотикотерапії. 2. Киснева залежність — потреба знижується. 3. Артеріальна гіпертензія — стабільна.",
          en: "1. Community-acquired pneumonia — responding to antibiotics. 2. Oxygen requirement — declining. 3. Hypertension — stable.",
        },
      },
      {
        name: { uk: "План на добу", en: "Plan for today" },
        sample: {
          uk: "Продовжити внутрішньовенну антибіотикотерапію ще 24 години з подальшим переходом на пероральну форму. Пробне зниження кисневої підтримки, дихальна гімнастика, контроль аналізів завтра вранці.",
          en: "Continue intravenous antibiotics for a further 24 hours, then switch to oral. Trial reduction of oxygen, chest physiotherapy, and repeat bloods tomorrow morning.",
        },
      },
      {
        name: { uk: "Комунікація та виписка", en: "Communication and disposition" },
        sample: {
          uk: "Стан обговорено з пацієнтом і донькою за його згодою. Ймовірна виписка через 48 годин за умови стабільної сатурації без кисню.",
          en: "Progress discussed with the patient and, with his consent, his daughter. Discharge anticipated in 48 hours if saturations remain stable off oxygen.",
        },
      },
    ],
  },
  {
    slug: "discharge-summary",
    cat: "general",
    icon: "archive",
    name: { uk: "Виписний епікриз", en: "Discharge summary" },
    tag: {
      uk: "Повний підсумок госпіталізації з діагнозами, перебігом, терапією та планом спостереження.",
      en: "The full account of an admission: diagnoses, hospital course, medications and follow-up plan.",
    },
    mins: 12,
    fields: 40,
    about: {
      uk: "Виписний епікриз — найдовший і найчастіше відкладений документ у стаціонарі, хоча саме його читає наступний лікар. Klarnote збирає його з вашої усної розповіді про госпіталізацію: діагнози, ключові обстеження, перебіг, зміни в терапії та інструкції для пацієнта.",
      en: "The discharge summary is the longest document on the ward and the one most often postponed, yet it is what the next clinician actually reads. Klarnote assembles it from your spoken account of the admission: diagnoses, key investigations, course, medication changes and patient instructions.",
    },
    bestFor: {
      uk: ["Стаціонарні відділення", "Лікарі-госпіталісти", "Координатори виписки"],
      en: ["Hospital wards", "Hospitalists", "Discharge coordinators"],
    },
    sections: [
      {
        name: { uk: "Діагнози", en: "Diagnoses" },
        sample: {
          uk: "Основний діагноз: негоспітальна правобічна нижньочасткова пневмонія, середньої тяжкості. Супутні: артеріальна гіпертензія II ступеня, цукровий діабет 2 типу.",
          en: "Principal diagnosis: moderate community-acquired right lower lobe pneumonia. Comorbidities: stage 2 hypertension and type 2 diabetes mellitus.",
        },
      },
      {
        name: { uk: "Причина госпіталізації", en: "Reason for admission" },
        sample: {
          uk: "Жінка 68 років госпіталізована через п'ятиденну лихоманку, кашель із мокротинням і наростаючу задишку зі зниженням сатурації до 89% на повітрі.",
          en: "A 68-year-old woman was admitted with five days of fever, productive cough and increasing breathlessness with saturations of 89% on room air.",
        },
      },
      {
        name: { uk: "Обстеження", en: "Investigations" },
        sample: {
          uk: "Рентгенографія органів грудної клітки виявила інфільтрацію нижньої частки правої легені. Лейкоцити при надходженні 15,2 ×10⁹/л, СРБ 140 мг/л; гемокультура росту не дала.",
          en: "Chest radiograph showed right lower lobe consolidation. Admission white cells 15.2 ×10⁹/L with CRP 140 mg/L; blood cultures showed no growth.",
        },
      },
      {
        name: { uk: "Перебіг госпіталізації", en: "Hospital course" },
        sample: {
          uk: "Розпочато внутрішньовенну антибіотикотерапію та кисневу підтримку, на третю добу досягнуто стійкої нормотермії. Кисень відмінено на п'яту добу, пацієнтка самостійно долала сходовий проліт без десатурації.",
          en: "Intravenous antibiotics and supplemental oxygen were started, with sustained defervescence by day three. Oxygen was weaned off on day five and she managed a flight of stairs without desaturation.",
        },
      },
      {
        name: { uk: "Стан при виписці", en: "Condition at discharge" },
        sample: {
          uk: "Стан задовільний, температура нормальна, SpO₂ 96% на повітрі, аускультативно поодинокі хрипи справа. Самообслуговування у повному обсязі.",
          en: "Comfortable and afebrile, SpO₂ 96% on room air, with only scattered right-sided crackles. Independent in all activities of daily living.",
        },
      },
      {
        name: { uk: "Медикаментозні призначення", en: "Discharge medications" },
        sample: {
          uk: "Амоксицилін із клавулановою кислотою перорально ще 5 днів. Попередню антигіпертензивну та цукрознижувальну терапію продовжено без змін.",
          en: "Oral co-amoxiclav to complete a further five days. Pre-admission antihypertensive and glucose-lowering therapy continued unchanged.",
        },
      },
      {
        name: { uk: "Рекомендації та спостереження", en: "Follow-up and instructions" },
        sample: {
          uk: "Огляд сімейним лікарем протягом тижня, контрольна рентгенографія через шість тижнів. Рекомендовано вакцинацію проти пневмокока після одужання.",
          en: "Review by the family physician within one week and repeat chest radiograph in six weeks. Pneumococcal vaccination advised once recovered.",
        },
      },
      {
        name: { uk: "Ознаки, що потребують звернення", en: "Warning signs" },
        sample: {
          uk: "Негайно звернутися по допомогу в разі повернення лихоманки, посилення задишки, болю в грудях або кровохаркання.",
          en: "Seek urgent care if fever returns or if breathlessness, chest pain or haemoptysis develop.",
        },
      },
    ],
  },
  {
    slug: "referral-letter",
    cat: "general",
    icon: "sign",
    name: { uk: "Направлення до спеціаліста", en: "Referral letter" },
    tag: {
      uk: "Направлення з чітким запитанням, стислим анамнезом і вже виконаними обстеженнями.",
      en: "A referral with a clear clinical question, a tight history and the workup already done.",
    },
    mins: 5,
    fields: 18,
    about: {
      uk: "Хороше направлення економить консультанту цілий візит: воно ставить конкретне запитання й повідомляє, що вже зроблено. Klarnote перетворює ваш усний виклад на лист, у якому окремо стоять привід, анамнез, результати обстежень і терміновість.",
      en: "A good referral saves the consultant an entire visit by asking a precise question and stating what has already been done. Klarnote turns your spoken summary into a letter with the reason, history, results and urgency each in its own place.",
    },
    bestFor: {
      uk: ["Первинна ланка", "Амбулаторні лікарі", "Приватні клініки"],
      en: ["Primary care", "Outpatient clinicians", "Private practices"],
    },
    sections: [
      {
        name: { uk: "Привід для направлення", en: "Reason for referral" },
        sample: {
          uk: "Прошу проконсультувати чоловіка 47 років щодо тактики при вузловому утворенні щитоподібної залози діаметром 18 мм, виявленому при УЗД.",
          en: "I would be grateful for your opinion on a 47-year-old man with an 18 mm thyroid nodule found on ultrasound.",
        },
      },
      {
        name: { uk: "Стислий анамнез", en: "Relevant history" },
        sample: {
          uk: "Вузол виявлено випадково при обстеженні з приводу болю в шиї. Симптомів компресії, дисфагії чи змін голосу немає; опромінення шиї та сімейного анамнезу раку щитоподібної залози не було.",
          en: "The nodule was an incidental finding during imaging for neck pain. There are no compressive symptoms, dysphagia or voice change, and no history of neck irradiation or familial thyroid cancer.",
        },
      },
      {
        name: { uk: "Огляд і обстеження", en: "Findings and investigations" },
        sample: {
          uk: "Пальпаторно вузол щільний, рухомий, лімфовузли шиї не збільшені. ТТГ 1,8 мМО/л, вільний Т4 у нормі; УЗД описує гіпоехогенний вузол із мікрокальцинатами.",
          en: "The nodule is firm and mobile with no palpable cervical lymphadenopathy. TSH 1.8 mIU/L with normal free T4; ultrasound describes a hypoechoic nodule containing microcalcifications.",
        },
      },
      {
        name: { uk: "Поточна терапія та алергії", en: "Medications and allergies" },
        sample: {
          uk: "Постійно приймає амлодипін 5 мг на добу. Алергічних реакцій на медикаменти в анамнезі немає.",
          en: "Takes amlodipine 5 mg daily. No known drug allergies.",
        },
      },
      {
        name: { uk: "Запитання до консультанта", en: "Question for the specialist" },
        sample: {
          uk: "Чи показана тонкоголкова аспіраційна біопсія цього вузла і чи потребує пацієнт хірургічного лікування?",
          en: "Is fine-needle aspiration indicated for this nodule, and does he require surgical management?",
        },
      },
      {
        name: { uk: "Терміновість і контакт", en: "Urgency and contact" },
        sample: {
          uk: "Направлення планове, бажаний огляд протягом чотирьох тижнів. Пацієнт поінформований і згоден на консультацію.",
          en: "Routine referral; review within four weeks would be appreciated. The patient is informed and agreeable to the appointment.",
        },
      },
    ],
  },
  {
    slug: "procedure-note",
    cat: "general",
    icon: "scalpel",
    name: { uk: "Протокол маніпуляції", en: "Procedure note" },
    tag: {
      uk: "Запис про виконану біля ліжка маніпуляцію: згода, техніка, результат і ускладнення.",
      en: "A record of a bedside procedure: consent, technique, outcome and any complications.",
    },
    mins: 4,
    fields: 20,
    about: {
      uk: "Протокол маніпуляції має бути написаний одразу після її виконання, коли руки ще зайняті, а пам'ять свіжа — тому диктування тут природніше за клавіатуру. Klarnote фіксує показання, отриману згоду, анестезію, покроковий опис техніки та стан пацієнта після процедури.",
      en: "A procedure note should be written the moment the procedure ends, when your hands are still busy and the detail is fresh — dictation fits that better than a keyboard. Klarnote records the indication, the consent taken, anaesthesia, the step-by-step technique and the patient's condition afterwards.",
    },
    bestFor: {
      uk: ["Відділення невідкладної допомоги", "Палати інтенсивної терапії", "Процедурні кабінети"],
      en: ["Emergency departments", "Intensive care units", "Procedure rooms"],
    },
    sections: [
      {
        name: { uk: "Показання", en: "Indication" },
        sample: {
          uk: "Чоловік 72 років із масивним правобічним плевральним випотом і задишкою у спокої; виконано діагностично-лікувальний торакоцентез.",
          en: "A 72-year-old man with a large right pleural effusion and dyspnoea at rest underwent diagnostic and therapeutic thoracentesis.",
        },
      },
      {
        name: { uk: "Згода та підготовка", en: "Consent and preparation" },
        sample: {
          uk: "Отримано інформовану згоду після обговорення ризиків пневмотораксу, кровотечі та інфікування. Проведено чек-лист безпеки, коагулограма в межах норми.",
          en: "Informed consent obtained after discussing the risks of pneumothorax, bleeding and infection. Safety checklist completed and coagulation profile within normal limits.",
        },
      },
      {
        name: { uk: "Анестезія", en: "Anaesthesia" },
        sample: {
          uk: "Місцева інфільтраційна анестезія 10 мл 1% лідокаїну пошарово до парієтальної плеври. Седація не застосовувалася.",
          en: "Local infiltration with 10 mL of 1% lidocaine down to the parietal pleura. No sedation was used.",
        },
      },
      {
        name: { uk: "Опис маніпуляції", en: "Procedure" },
        sample: {
          uk: "Під ультразвуковим контролем у восьмому міжребер'ї по задній пахвовій лінії пунктовано плевральну порожнину по верхньому краю ребра. Евакуйовано 1200 мл прозорої солом'яно-жовтої рідини, зразки направлено на цитологічне та біохімічне дослідження.",
          en: "Under ultrasound guidance the pleural space was entered in the eighth intercostal space at the posterior axillary line, over the upper border of the rib. 1200 mL of clear straw-coloured fluid was drained and samples sent for cytology and biochemistry.",
        },
      },
      {
        name: { uk: "Результат і ускладнення", en: "Outcome and complications" },
        sample: {
          uk: "Маніпуляцію перенесено добре, задишка суттєво зменшилася. Ускладнень не було, крововтрата мінімальна.",
          en: "The procedure was well tolerated with marked relief of dyspnoea. There were no complications and blood loss was minimal.",
        },
      },
      {
        name: { uk: "Стан після процедури", en: "Post-procedure care" },
        sample: {
          uk: "Контрольна рентгенографія органів грудної клітки пневмотораксу не виявила. Показники гемодинаміки стабільні, спостереження протягом двох годин.",
          en: "Post-procedure chest radiograph showed no pneumothorax. Observations remained stable and the patient was monitored for two hours.",
        },
      },
    ],
  },
  {
    slug: "annual-physical",
    cat: "primary-care",
    icon: "heart",
    name: { uk: "Профілактичний огляд", en: "Annual physical" },
    tag: {
      uk: "Щорічний огляд здорової людини: ризики, скринінги, вакцинація та поради щодо способу життя.",
      en: "The yearly well-person visit: risk review, screening, immunisations and lifestyle advice.",
    },
    mins: 9,
    fields: 36,
    about: {
      uk: "Профілактичний огляд формально короткий, але вимагає перевірити десятки пунктів — від скринінгів до щеплень. Klarnote тримає цей чек-лист у структурі запису: усе, що ви проговорюєте вголос, лягає у відповідний розділ, а незакриті скринінги залишаються видимими.",
      en: "A preventive visit looks short but requires dozens of checkpoints, from screening to vaccines. Klarnote keeps that checklist in the structure of the note: everything you say aloud lands in the right section, and outstanding screening stays visible.",
    },
    bestFor: {
      uk: ["Сімейна медицина", "Корпоративні медогляди", "Профілактичні програми"],
      en: ["Family medicine", "Occupational health checks", "Preventive care programmes"],
    },
    sections: [
      {
        name: { uk: "Мета візиту та скарги", en: "Purpose of visit" },
        sample: {
          uk: "Жінка 45 років звернулася для планового профілактичного огляду. Активних скарг не має, самопочуття оцінює як добре.",
          en: "A 45-year-old woman attends for a routine preventive health check. She has no active complaints and describes her health as good.",
        },
      },
      {
        name: { uk: "Анамнез і фактори ризику", en: "History and risk factors" },
        sample: {
          uk: "Не палить, алкоголь вживає епізодично, фізична активність — приблизно 90 хвилин на тиждень. Сімейний анамнез обтяжений раком молочної залози у матері у 62 роки.",
          en: "Non-smoker, occasional alcohol, roughly 90 minutes of physical activity per week. Family history notable for maternal breast cancer diagnosed at 62.",
        },
      },
      {
        name: { uk: "Антропометрія та вітальні показники", en: "Vitals and measurements" },
        sample: {
          uk: "Зріст 166 см, маса 74 кг, ІМТ 26,9 кг/м². АТ 126/78 мм рт. ст., ЧСС 68 за хв, окружність талії 86 см.",
          en: "Height 166 cm, weight 74 kg, BMI 26.9 kg/m². BP 126/78 mmHg, HR 68, waist circumference 86 cm.",
        },
      },
      {
        name: { uk: "Об'єктивний огляд", en: "Physical examination" },
        sample: {
          uk: "Шкіра чиста, щитоподібна залоза не збільшена, серцева діяльність ритмічна без шумів. Легені, живіт і периферичні судини без патологічних змін.",
          en: "Skin clear, thyroid not enlarged, heart sounds regular with no murmur. Chest, abdomen and peripheral pulses unremarkable.",
        },
      },
      {
        name: { uk: "Скринінги", en: "Screening" },
        sample: {
          uk: "Мамографію востаннє виконано два роки тому — призначено повторну. Цитологічне дослідження шийки матки актуальне, скринінг колоректального раку запланувати після 50 років.",
          en: "Last mammogram was two years ago and a repeat has been arranged. Cervical cytology is up to date; colorectal screening to begin at age 50.",
        },
      },
      {
        name: { uk: "Вакцинація", en: "Immunisations" },
        sample: {
          uk: "Ревакцинацію проти дифтерії та правця виконано сім років тому. Рекомендовано щорічну вакцинацію проти грипу цієї осені.",
          en: "Tetanus-diphtheria booster given seven years ago. Annual influenza vaccination recommended this autumn.",
        },
      },
      {
        name: { uk: "Лабораторні призначення", en: "Laboratory orders" },
        sample: {
          uk: "Призначено загальний аналіз крові, ліпідограму, глюкозу натще та ТТГ. Результати обговоримо телефоном протягом тижня.",
          en: "Full blood count, lipid panel, fasting glucose and TSH ordered. Results to be discussed by telephone within a week.",
        },
      },
      {
        name: { uk: "Поради та наступний огляд", en: "Counselling and follow-up" },
        sample: {
          uk: "Обговорено збільшення аеробного навантаження до 150 хвилин на тиждень і зменшення споживання доданого цукру. Наступний профілактичний огляд через рік.",
          en: "Discussed increasing aerobic activity to 150 minutes per week and reducing added sugar. Next preventive visit in one year.",
        },
      },
    ],
  },
  {
    slug: "chronic-disease-followup",
    cat: "primary-care",
    icon: "history",
    name: { uk: "Контроль хронічної хвороби", en: "Chronic disease follow-up" },
    tag: {
      uk: "Плановий контроль гіпертензії та діабету: цілі, показники, прихильність і корекція терапії.",
      en: "Routine hypertension and diabetes review: targets, readings, adherence and treatment changes.",
    },
    mins: 7,
    fields: 30,
    about: {
      uk: "Візит із приводу хронічної хвороби майже завжди повторює одну схему: чи досягнуто цільових показників, чи приймаються ліки, чи є ускладнення. Klarnote розкладає вашу розмову за цією схемою й окремо виносить кожну зміну дози, щоб наступний лікар бачив логіку рішень.",
      en: "A chronic disease visit follows the same arc every time: are the targets met, is the medication being taken, are complications appearing. Klarnote maps your conversation onto that arc and pulls out every dose change so the next clinician can see the reasoning.",
    },
    bestFor: {
      uk: ["Сімейні лікарі", "Кабінети діабету", "Медсестринські прийоми"],
      en: ["Family physicians", "Diabetes clinics", "Nurse-led review clinics"],
    },
    sections: [
      {
        name: { uk: "Стан на момент огляду", en: "Interval since last visit" },
        sample: {
          uk: "Чоловік 58 років із артеріальною гіпертензією та цукровим діабетом 2 типу на плановому огляді через три місяці. Гіпоглікемій, епізодів болю в грудях чи набряків не відмічав.",
          en: "A 58-year-old man with hypertension and type 2 diabetes attends for his three-month review. He reports no hypoglycaemia, chest pain or swelling.",
        },
      },
      {
        name: { uk: "Домашній моніторинг", en: "Home monitoring" },
        sample: {
          uk: "Домашні виміри АТ переважно 140–150 на 85–90 мм рт. ст. вранці. Глікемія натще коливається в межах 7,5–9,0 ммоль/л.",
          en: "Home blood-pressure readings mostly 140–150 over 85–90 mmHg in the mornings. Fasting glucose ranges between 7.5 and 9.0 mmol/L.",
        },
      },
      {
        name: { uk: "Прихильність до терапії", en: "Medication adherence" },
        sample: {
          uk: "Метформін приймає регулярно, вечірню дозу периндоприлу пропускає приблизно двічі на тиждень. Побічних ефектів не відмічає.",
          en: "Metformin is taken consistently, but he misses the evening perindopril roughly twice a week. No side effects reported.",
        },
      },
      {
        name: { uk: "Огляд і показники", en: "Examination and measurements" },
        sample: {
          uk: "АТ на прийомі 148/88 мм рт. ст. на обох руках, маса 92 кг, ІМТ 30,1 кг/м². Огляд стоп: пульсація збережена, чутливість монофіламентом не порушена, виразок немає.",
          en: "Clinic BP 148/88 mmHg in both arms, weight 92 kg, BMI 30.1 kg/m². Foot check: pulses present, monofilament sensation intact, no ulceration.",
        },
      },
      {
        name: { uk: "Лабораторні дані", en: "Laboratory review" },
        sample: {
          uk: "HbA1c 8,1% проти 7,6% три місяці тому. ШКФ 78 мл/хв, співвідношення альбумін/креатинін сечі 4,2 мг/ммоль, ЛПНЩ 3,1 ммоль/л.",
          en: "HbA1c 8.1% compared with 7.6% three months ago. eGFR 78 mL/min, urine albumin-to-creatinine ratio 4.2 mg/mmol, LDL 3.1 mmol/L.",
        },
      },
      {
        name: { uk: "Оцінка контролю", en: "Assessment of control" },
        sample: {
          uk: "Обидва стани контрольовані недостатньо: гіпертензія — переважно через пропуски прийому, глікемія — через недостатню дозу цукрознижувальної терапії.",
          en: "Both conditions are suboptimally controlled: blood pressure largely due to missed doses, and glycaemia due to inadequate treatment intensity.",
        },
      },
      {
        name: { uk: "Корекція лікування", en: "Treatment changes" },
        sample: {
          uk: "Периндоприл переведено на ранковий прийом і додано індапамід. До метформіну додано інгібітор SGLT2 з урахуванням серцево-судинного ризику.",
          en: "Perindopril moved to the morning and indapamide added. An SGLT2 inhibitor added to metformin given his cardiovascular risk.",
        },
      },
      {
        name: { uk: "План спостереження", en: "Follow-up plan" },
        sample: {
          uk: "Контроль креатиніну та калію через два тижні, повторний огляд із HbA1c через три місяці. Направлення на щорічний огляд очного дна оформлено.",
          en: "Creatinine and potassium in two weeks, review with repeat HbA1c in three months. Annual retinal screening referral completed.",
        },
      },
    ],
  },
  {
    slug: "telehealth-visit",
    cat: "primary-care",
    icon: "waveform",
    name: { uk: "Дистанційна консультація", en: "Telehealth visit" },
    tag: {
      uk: "Запис онлайн-візиту: спосіб зв'язку, згода, обмеження огляду та критерії очної явки.",
      en: "A remote visit record: modality, consent, examination limits and when to be seen in person.",
    },
    mins: 5,
    fields: 20,
    about: {
      uk: "Дистанційний візит потребує кількох формальних елементів, про які легко забути: спосіб зв'язку, підтвердження особи, згода на телемедицину та межі можливого огляду. Klarnote фіксує їх автоматично з вашої розмови й окремо оформлює умови повернення до очного прийому.",
      en: "A remote visit needs a few formalities that are easy to forget: the modality, identity verification, consent to telemedicine and the limits of what could be examined. Klarnote captures those from the conversation and sets out the safety-netting for an in-person review.",
    },
    bestFor: {
      uk: ["Онлайн-клініки", "Сімейні лікарі", "Повторні консультації"],
      en: ["Virtual care clinics", "Family physicians", "Follow-up consultations"],
    },
    sections: [
      {
        name: { uk: "Формат візиту та згода", en: "Modality and consent" },
        sample: {
          uk: "Консультацію проведено відеозв'язком, особу пацієнта підтверджено. Отримано усну згоду на дистанційний прийом, пацієнт перебував удома сам.",
          en: "Consultation conducted by video with identity confirmed. Verbal consent to a remote visit was obtained; the patient was at home alone.",
        },
      },
      {
        name: { uk: "Причина звернення", en: "Presenting concern" },
        sample: {
          uk: "Жінка 34 років скаржиться на печіння під час сечовипускання та часті позиви протягом двох діб. Лихоманки, болю в попереку та блювання немає.",
          en: "A 34-year-old woman reports two days of dysuria and urinary frequency. There is no fever, flank pain or vomiting.",
        },
      },
      {
        name: { uk: "Анамнез", en: "Relevant history" },
        sample: {
          uk: "Подібний епізод був рік тому, лікувався перорально з повним одужанням. Вагітність виключено, алергії на медикаменти не відомі.",
          en: "A similar episode a year ago resolved fully with oral treatment. Pregnancy is excluded and there are no known drug allergies.",
        },
      },
      {
        name: { uk: "Дистанційна оцінка", en: "Remote assessment" },
        sample: {
          uk: "Візуально стан задовільний, мовлення без ознак інтоксикації, самостійно повідомляє температуру 36,8 °C. Пальпація живота та поперекової ділянки недоступна для оцінки.",
          en: "Appears well on camera with no signs of systemic illness; self-reported temperature 36.8 °C. Abdominal and flank palpation could not be assessed.",
        },
      },
      {
        name: { uk: "Оцінка та план", en: "Assessment and plan" },
        sample: {
          uk: "Клінічно — неускладнена інфекція нижніх сечових шляхів. Призначено короткий курс перорального антибіотика та рекомендовано збільшити питний режим.",
          en: "Clinically an uncomplicated lower urinary tract infection. A short oral antibiotic course was prescribed with advice to increase fluid intake.",
        },
      },
      {
        name: { uk: "Умови очного огляду", en: "Safety netting" },
        sample: {
          uk: "Пацієнтку попереджено звернутися очно за появи лихоманки, болю в попереку, блювання або якщо симптоми не зменшаться протягом 48 годин.",
          en: "Advised to attend in person if fever, flank pain or vomiting develop, or if symptoms do not improve within 48 hours.",
        },
      },
    ],
  },
  {
    slug: "pre-operative-assessment",
    cat: "surgical",
    icon: "shield",
    name: { uk: "Передопераційний огляд", en: "Pre-operative assessment" },
    tag: {
      uk: "Оцінка перед втручанням: показання, ризики, супутні хвороби, терапія та план анестезії.",
      en: "Assessment before surgery: indication, risk, comorbidity, medications and the anaesthetic plan.",
    },
    mins: 8,
    fields: 34,
    about: {
      uk: "Передопераційний огляд визначає, чи піде пацієнт в операційну, тому потребує повного переліку супутніх станів, ліків і ризиків. Klarnote збирає ці дані з вашої розмови й окремо виносить рішення щодо препаратів, які треба відмінити, та отриману інформовану згоду.",
      en: "The pre-operative assessment decides whether the patient reaches theatre, so it needs a complete picture of comorbidity, medication and risk. Klarnote gathers that from your conversation and highlights which drugs must be held, along with the consent obtained.",
    },
    bestFor: {
      uk: ["Хірургічні відділення", "Анестезіологи", "Передопераційні кабінети"],
      en: ["Surgical departments", "Anaesthetists", "Pre-admission clinics"],
    },
    sections: [
      {
        name: { uk: "Планове втручання", en: "Planned procedure" },
        sample: {
          uk: "Чоловік 63 років готується до планової лапароскопічної холецистектомії з приводу симптомної жовчнокам'яної хвороби. Втручання заплановане на найближчий тиждень.",
          en: "A 63-year-old man is scheduled for elective laparoscopic cholecystectomy for symptomatic gallstone disease, planned for next week.",
        },
      },
      {
        name: { uk: "Супутні захворювання", en: "Comorbidities" },
        sample: {
          uk: "Артеріальна гіпертензія та цукровий діабет 2 типу, обидва медикаментозно контрольовані. Пароксизмів аритмії, інфаркту чи інсульту в анамнезі не було.",
          en: "Hypertension and type 2 diabetes, both medically controlled. No history of arrhythmia, myocardial infarction or stroke.",
        },
      },
      {
        name: { uk: "Анестезіологічний анамнез", en: "Anaesthetic history" },
        sample: {
          uk: "Дві попередні операції під загальним знеболенням перенесені без ускладнень, післяопераційної нудоти не було. Сімейного анамнезу злоякісної гіпертермії немає.",
          en: "Two previous general anaesthetics without complication and no postoperative nausea. No family history of malignant hyperthermia.",
        },
      },
      {
        name: { uk: "Медикаменти та алергії", en: "Medications and allergies" },
        sample: {
          uk: "Приймає метформін, периндоприл і ацетилсаліцилову кислоту. Алергія на пеніцилін у вигляді висипу, задокументована.",
          en: "Takes metformin, perindopril and aspirin. Documented penicillin allergy presenting as rash.",
        },
      },
      {
        name: { uk: "Обстеження та функціональний статус", en: "Investigations and functional status" },
        sample: {
          uk: "Гемоглобін 138 г/л, креатинін 92 мкмоль/л, HbA1c 7,2%, ЕКГ — синусовий ритм без ішемічних змін. Долає два сходові прольоти без задишки, що відповідає понад 4 МЕТ.",
          en: "Haemoglobin 138 g/L, creatinine 92 µmol/L, HbA1c 7.2%, ECG sinus rhythm without ischaemic change. He climbs two flights without dyspnoea, consistent with more than 4 METs.",
        },
      },
      {
        name: { uk: "Оцінка ризику", en: "Risk assessment" },
        sample: {
          uk: "Фізичний статус за ASA II, серцево-судинний ризик втручання низький. Оцінка за шкалою Каприні відповідає помірному ризику венозного тромбоемболізму.",
          en: "ASA physical status II with low cardiac risk for this procedure. Caprini score places him at moderate risk of venous thromboembolism.",
        },
      },
      {
        name: { uk: "План підготовки", en: "Pre-operative plan" },
        sample: {
          uk: "Ацетилсаліцилову кислоту відмінити за п'ять днів, метформін пропустити в день операції. Голодування за стандартним протоколом, антибіотикопрофілактика цефазоліном замінена на кліндаміцин через алергію.",
          en: "Aspirin to be held for five days and metformin omitted on the morning of surgery. Standard fasting protocol; antibiotic prophylaxis switched from cefazolin to clindamycin because of the allergy.",
        },
      },
      {
        name: { uk: "Інформована згода", en: "Consent" },
        sample: {
          uk: "Обговорено ризики кровотечі, інфікування, ушкодження жовчних проток і ймовірність конверсії у відкриту операцію. Пацієнт розуміє інформацію та підписав згоду.",
          en: "Risks of bleeding, infection, bile duct injury and conversion to open surgery were discussed. The patient understands and has signed the consent form.",
        },
      },
    ],
  },
  {
    slug: "operative-note",
    cat: "surgical",
    icon: "scan",
    name: { uk: "Протокол операції", en: "Operative note" },
    tag: {
      uk: "Повний протокол втручання: доступ, знахідки, хід операції, крововтрата та рахунок матеріалів.",
      en: "The full operative record: approach, findings, steps, blood loss and instrument counts.",
    },
    mins: 11,
    fields: 38,
    about: {
      uk: "Протокол операції — юридично найважливіший документ хірурга, і диктувати його одразу після виходу з операційної значно точніше, ніж відновлювати ввечері. Klarnote структурує ваш опис за звичним порядком: доступ, інтраопераційні знахідки, етапи, закриття та стан наприкінці втручання.",
      en: "The operative note is the surgeon's most consequential document, and dictating it straight out of theatre is far more accurate than reconstructing it that evening. Klarnote structures your account in the familiar order: approach, findings, steps, closure and condition at the end.",
    },
    bestFor: {
      uk: ["Хірурги", "Операційні блоки", "Денний стаціонар"],
      en: ["Surgeons", "Operating theatres", "Day-surgery units"],
    },
    sections: [
      {
        name: { uk: "Діагноз і виконане втручання", en: "Diagnosis and procedure" },
        sample: {
          uk: "Доопераційний і післяопераційний діагноз: хронічний калькульозний холецистит. Виконано лапароскопічну холецистектомію.",
          en: "Pre-operative and post-operative diagnosis: chronic calculous cholecystitis. Procedure performed: laparoscopic cholecystectomy.",
        },
      },
      {
        name: { uk: "Знеболення та положення", en: "Anaesthesia and positioning" },
        sample: {
          uk: "Загальна анестезія з інтубацією трахеї. Положення на спині з підйомом головного кінця та нахилом вліво, антисептична обробка та обкладання за стандартом.",
          en: "General anaesthesia with endotracheal intubation. Supine with reverse Trendelenburg and left tilt; prepped and draped in the standard fashion.",
        },
      },
      {
        name: { uk: "Доступ", en: "Approach" },
        sample: {
          uk: "Пневмоперитонеум накладено відкритим способом через параумбілікальний доступ до тиску 12 мм рт. ст. Встановлено три додаткові троакари під візуальним контролем.",
          en: "Pneumoperitoneum established by open periumbilical technique to a pressure of 12 mmHg. Three additional ports were placed under direct vision.",
        },
      },
      {
        name: { uk: "Інтраопераційні знахідки", en: "Operative findings" },
        sample: {
          uk: "Жовчний міхур потовщений, із помірними зрощеннями до сальника, конкременти пальпуються в просвіті. Загальна жовчна протока не розширена, ознак перфорації немає.",
          en: "The gallbladder was thick-walled with moderate omental adhesions and palpable stones within the lumen. The common bile duct was not dilated and there was no perforation.",
        },
      },
      {
        name: { uk: "Хід операції", en: "Operative technique" },
        sample: {
          uk: "Зрощення розділено тупим і гострим шляхом, досягнуто критичного вікна безпеки з чіткою ідентифікацією міхурової протоки та артерії. Обидві структури кліповано й перетнуто, міхур відділено від ложа електрокоагуляцією та вилучено в контейнері через параумбілікальний порт.",
          en: "Adhesions were taken down bluntly and sharply and the critical view of safety was achieved with clear identification of the cystic duct and artery. Both were clipped and divided, the gallbladder was dissected from its bed with cautery and removed in a retrieval bag through the umbilical port.",
        },
      },
      {
        name: { uk: "Гемостаз і закриття", en: "Haemostasis and closure" },
        sample: {
          uk: "Ложе міхура сухе, черевну порожнину промито, дренаж не встановлювався. Фасцію параумбілікального доступу ушито, шкіру закрито внутрішньошкірним швом.",
          en: "The gallbladder bed was dry, the abdomen irrigated and no drain was left. The umbilical fascia was closed and the skin approximated with a subcuticular suture.",
        },
      },
      {
        name: { uk: "Крововтрата та рахунок", en: "Blood loss and counts" },
        sample: {
          uk: "Орієнтовна крововтрата — менше 30 мл, гемотрансфузії не проводилися. Рахунок серветок, голок та інструментів двічі підтверджено як повний.",
          en: "Estimated blood loss under 30 mL with no transfusion. Sponge, needle and instrument counts were correct on two occasions.",
        },
      },
      {
        name: { uk: "Стан після втручання", en: "Condition and disposition" },
        sample: {
          uk: "Пацієнт екстубований в операційній, стабільний, переведений до палати пробудження. Препарат направлено на патогістологічне дослідження.",
          en: "The patient was extubated in theatre, remained stable and was transferred to recovery. The specimen was sent for histopathology.",
        },
      },
    ],
  },
  {
    slug: "post-operative-followup",
    cat: "surgical",
    icon: "eye",
    name: { uk: "Післяопераційний огляд", en: "Post-operative follow-up" },
    tag: {
      uk: "Контрольний візит після операції: загоєння рани, біль, гістологія та повернення до активності.",
      en: "The post-surgical review: wound healing, pain control, pathology and return to activity.",
    },
    mins: 5,
    fields: 22,
    about: {
      uk: "Післяопераційний візит короткий, але має закрити кілька обов'язкових питань: як загоюється рана, чи контрольований біль, що показала гістологія та коли можна повертатися до роботи. Klarnote тримає ці пункти в структурі й фіксує момент виписки пацієнта зі спостереження хірурга.",
      en: "The post-operative visit is short but must close several loops: wound healing, pain control, the pathology result and when normal activity can resume. Klarnote keeps those points in the structure and records the moment the patient is discharged from surgical care.",
    },
    bestFor: {
      uk: ["Хірургічні поліклініки", "Денна хірургія", "Медсестринське спостереження ран"],
      en: ["Surgical outpatient clinics", "Day-surgery services", "Nurse-led wound clinics"],
    },
    sections: [
      {
        name: { uk: "Виконане втручання", en: "Procedure performed" },
        sample: {
          uk: "Пацієнт оглянутий через два тижні після лапароскопічної холецистектомії. Післяопераційний період у стаціонарі перебігав без ускладнень, виписаний наступного дня.",
          en: "Reviewed two weeks after laparoscopic cholecystectomy. The inpatient course was uncomplicated and he was discharged the following day.",
        },
      },
      {
        name: { uk: "Скарги на момент огляду", en: "Current symptoms" },
        sample: {
          uk: "Помірний дискомфорт у ділянці параумбілікального доступу при нахилах, який поступово зменшується. Нудоти, лихоманки та жовтяниці немає, апетит відновився.",
          en: "Mild discomfort at the umbilical port site when bending, gradually improving. No nausea, fever or jaundice, and appetite has returned.",
        },
      },
      {
        name: { uk: "Стан рани", en: "Wound assessment" },
        sample: {
          uk: "Усі чотири рани сухі, без ознак запалення чи розходження країв. Шви розсмоктувальні, зняття не потребують.",
          en: "All four wounds are dry with no erythema, discharge or dehiscence. Sutures are absorbable and need no removal.",
        },
      },
      {
        name: { uk: "Знеболення", en: "Pain management" },
        sample: {
          uk: "Приймає парацетамол за потреби, приблизно раз на добу; опіоїди відмінено на п'ятий день. Знеболення вважає достатнім.",
          en: "Taking paracetamol as needed, roughly once daily; opioids were stopped on day five. He considers pain control adequate.",
        },
      },
      {
        name: { uk: "Результат гістології", en: "Pathology result" },
        sample: {
          uk: "Патогістологічний висновок: хронічний холецистит із холестерозом, ознак злоякісності не виявлено. Результат обговорено з пацієнтом.",
          en: "Histopathology reports chronic cholecystitis with cholesterolosis and no evidence of malignancy. The result was discussed with the patient.",
        },
      },
      {
        name: { uk: "Рекомендації щодо активності", en: "Activity advice" },
        sample: {
          uk: "Дозволено повернення до офісної роботи, підйом ваги понад 5 кг обмежити ще на два тижні. Дієтичних обмежень не потребує.",
          en: "Cleared to return to desk work, with lifting over 5 kg restricted for a further two weeks. No dietary restrictions required.",
        },
      },
      {
        name: { uk: "Завершення спостереження", en: "Discharge from follow-up" },
        sample: {
          uk: "Подальше хірургічне спостереження не потрібне, пацієнта передано під нагляд сімейного лікаря. Повторне звернення — за появи лихоманки, жовтяниці або наростання болю в животі.",
          en: "No further surgical review is required and care is returned to the family physician. Advised to return if fever, jaundice or worsening abdominal pain develop.",
        },
      },
    ],
  },
];

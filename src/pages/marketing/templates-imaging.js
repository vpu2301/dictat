// templates-imaging.js — Content data for the public "Templates marketplace" page.
//
// Pure data: no React, no imports, no side effects. Each entry describes one
// dictation template shown at /templates and /templates/<slug>:
//   slug     unique kebab-case route segment
//   cat      category key ("radiology" | "dentistry")
//   icon     icon name resolved by the marketing icon map
//   name/tag bilingual title and one-line summary
//   mins     minutes of documentation saved per report
//   fields   discrete fields captured by the structured template
//   popular  present only on the most widely used entries
//   about / bestFor / sections  detail-page copy; `sample` shows how a
//   section reads once dictation has been structured. All samples are
//   fully de-identified.

export const IMAGING_TEMPLATES = [
  {
    slug: "ct-report",
    cat: "radiology",
    icon: "scan",
    name: { uk: "Протокол КТ-дослідження", en: "CT report" },
    tag: {
      uk: "Структурований протокол КТ: методика, контраст, порівняння, знахідки за системами, висновок.",
      en: "Structured CT report: technique, contrast, comparison, findings by system and a clear impression.",
    },
    mins: 8,
    fields: 26,
    popular: true,
    about: {
      uk: "Протокол комп'ютерної томографії описує параметри сканування, використаний контраст і послідовно розібрані знахідки за анатомічними ділянками. Рентгенолог диктує звичною мовою, а система розкладає сказане по розділах, підставляє одиниці вимірювання та формує нумерований висновок. Порівняння з попередніми дослідженнями і рекомендації щодо контролю фіксуються окремими полями.",
      en: "A CT report captures scan parameters, contrast administration and findings walked through region by region. The radiologist dictates in normal speech and the template sorts it into sections, normalises measurements and builds a numbered impression. Comparison with prior studies and follow-up advice are stored as separate fields.",
    },
    bestFor: {
      uk: ["Рентгенологи діагностичних центрів", "Ургентна радіологія стаціонару", "Онкологічний моніторинг"],
      en: ["Diagnostic-centre radiologists", "Emergency inpatient radiology", "Oncology surveillance reading"],
    },
    sections: [
      {
        name: { uk: "Показання", en: "Clinical indication" },
        sample: {
          uk: "Пацієнт 54 років із гострим болем у правому підребер'ї та підвищеним рівнем лейкоцитів; виключити ускладнення жовчнокам'яної хвороби.",
          en: "54-year-old with acute right upper quadrant pain and leucocytosis; exclude complicated gallstone disease.",
        },
      },
      {
        name: { uk: "Методика дослідження", en: "Technique" },
        sample: {
          uk: "Мультизрізова КТ органів черевної порожнини та малого таза, товщина зрізу 1,25 мм, з мультипланарними реконструкціями в коронарній та сагітальній площинах.",
          en: "Multidetector CT of the abdomen and pelvis, 1.25 mm collimation, with coronal and sagittal multiplanar reformats.",
        },
      },
      {
        name: { uk: "Контрастування", en: "Contrast" },
        sample: {
          uk: "Внутрішньовенно введено 90 мл неіонного йодовмісного контрасту; сканування виконано в портовенозну фазу. Побічних реакцій під час дослідження не зафіксовано.",
          en: "90 mL of non-ionic iodinated contrast administered intravenously with imaging in the portal venous phase. No adverse reaction during the examination.",
        },
      },
      {
        name: { uk: "Порівняння", en: "Comparison" },
        sample: {
          uk: "Порівняно з КТ органів черевної порожнини, виконаною чотири місяці тому в цьому ж закладі.",
          en: "Compared with the abdominal CT performed four months earlier at this institution.",
        },
      },
      {
        name: { uk: "Знахідки", en: "Findings" },
        sample: {
          uk: "Стінка жовчного міхура потовщена до 5 мм, у просвіті — конкремент 9 мм, навколо міхура визначається смужка рідини. Печінка звичайних розмірів і однорідної структури, внутрішньопечінкові жовчні протоки не розширені; підшлункова залоза, селезінка та нирки без вогнищевих змін.",
          en: "The gallbladder wall is thickened to 5 mm with a 9 mm calculus in the lumen and a rim of pericholecystic fluid. The liver is normal in size and attenuation with no intrahepatic biliary dilatation; pancreas, spleen and kidneys show no focal lesion.",
        },
      },
      {
        name: { uk: "Обмеження дослідження", en: "Limitations" },
        sample: {
          uk: "Оцінка нижніх відділів утруднена через артефакти від рухів пацієнта. Дрібні вогнища розміром менше 4 мм достовірній характеристиці не підлягають.",
          en: "Assessment of the lower abdomen is degraded by patient motion artefact. Lesions smaller than 4 mm cannot be reliably characterised.",
        },
      },
      {
        name: { uk: "Висновок", en: "Impression" },
        sample: {
          uk: "1. КТ-ознаки гострого калькульозного холециститу без ознак перфорації. 2. Інших гострих змін в органах черевної порожнини не виявлено.",
          en: "1. Acute calculous cholecystitis without evidence of perforation. 2. No other acute intra-abdominal abnormality.",
        },
      },
      {
        name: { uk: "Рекомендації", en: "Recommendation" },
        sample: {
          uk: "Рекомендована консультація хірурга в невідкладному порядку; повторна візуалізація за клінічними показаннями.",
          en: "Urgent surgical consultation advised; repeat imaging only if clinically indicated.",
        },
      },
    ],
  },
  {
    slug: "mri-report",
    cat: "radiology",
    icon: "scan",
    name: { uk: "Протокол МРТ-дослідження", en: "MRI report" },
    tag: {
      uk: "Послідовності, гадолінієвий контраст, посегментні знахідки та структурований висновок МРТ.",
      en: "Sequences, gadolinium contrast, segment-by-segment findings and a structured MRI impression.",
    },
    mins: 9,
    fields: 28,
    popular: true,
    about: {
      uk: "Протокол магнітно-резонансної томографії вимагає точного переліку послідовностей і площин, тому диктування тут економить найбільше часу. Шаблон розпізнає назви імпульсних послідовностей, режими з пригніченням жиру та фази контрастування й розставляє їх у відповідні поля. Знахідки описуються посегментно, а висновок формується у вигляді пронумерованих пунктів із чіткою клінічною відповіддю.",
      en: "MRI reporting demands an exact list of sequences and planes, which is where dictation saves the most time. The template recognises pulse-sequence names, fat-suppressed series and contrast phases, and files them into the right fields. Findings are described segment by segment and the impression is assembled as numbered points that answer the clinical question.",
    },
    bestFor: {
      uk: ["Нейрорадіологи", "Скелетно-м'язова радіологія", "Приватні МРТ-центри"],
      en: ["Neuroradiologists", "Musculoskeletal radiology", "Private MRI centres"],
    },
    sections: [
      {
        name: { uk: "Клінічні дані", en: "Clinical history" },
        sample: {
          uk: "Пацієнтка 37 років зі стійким болем у попереку та іррадіацією по задній поверхні лівої нижньої кінцівки протягом трьох місяців.",
          en: "37-year-old with three months of persistent low back pain radiating down the posterior left leg.",
        },
      },
      {
        name: { uk: "Протокол сканування", en: "Technique" },
        sample: {
          uk: "МРТ попереково-крижового відділу хребта на апараті 1,5 Тл: сагітальні T1- та T2-зважені зображення, сагітальна STIR, аксіальні T2 на рівнях L3–S1.",
          en: "MRI of the lumbar spine at 1.5 T: sagittal T1 and T2, sagittal STIR and axial T2 sequences through L3–S1.",
        },
      },
      {
        name: { uk: "Контрастування", en: "Contrast" },
        sample: {
          uk: "Дослідження виконано без внутрішньовенного контрастування, оскільки клінічне питання не потребувало введення гадолінію.",
          en: "Performed without intravenous gadolinium, as the clinical question did not require contrast administration.",
        },
      },
      {
        name: { uk: "Порівняння", en: "Comparison" },
        sample: {
          uk: "Попередніх магнітно-резонансних досліджень цієї ділянки для порівняння не надано.",
          en: "No prior MRI of this region is available for comparison.",
        },
      },
      {
        name: { uk: "Знахідки", en: "Findings" },
        sample: {
          uk: "На рівні L5–S1 визначається задньолатеральна протрузія диска ліворуч розміром до 6 мм, що звужує лівий латеральний карман і контактує з корінцем S1. Висота тіл хребців збережена, сигнал від кісткового мозку однорідний, конус спинного мозку на рівні L1 без структурних змін.",
          en: "At L5–S1 there is a 6 mm left posterolateral disc protrusion narrowing the left lateral recess and abutting the traversing S1 nerve root. Vertebral body heights are preserved with homogeneous marrow signal, and the conus terminates at L1 without structural abnormality.",
        },
      },
      {
        name: { uk: "Супутні знахідки", en: "Incidental findings" },
        sample: {
          uk: "Виявлено просту кісту правої нирки діаметром 18 мм, що не потребує подальшого спостереження.",
          en: "An 18 mm simple right renal cyst is noted and requires no further follow-up.",
        },
      },
      {
        name: { uk: "Висновок", en: "Impression" },
        sample: {
          uk: "1. Лівобічна протрузія диска L5–S1 із компресією корінця S1, що відповідає клінічній картині. 2. Ознак стенозу хребтового каналу на інших рівнях немає.",
          en: "1. Left L5–S1 disc protrusion with S1 nerve root compression, concordant with the clinical presentation. 2. No canal stenosis at the remaining levels.",
        },
      },
      {
        name: { uk: "Рекомендації", en: "Recommendation" },
        sample: {
          uk: "Рекомендовано консультацію нейрохірурга та обговорення селективної блокади корінця за відсутності ефекту консервативної терапії.",
          en: "Neurosurgical review suggested, with consideration of selective nerve root block if conservative therapy fails.",
        },
      },
    ],
  },
  {
    slug: "ultrasound-report",
    cat: "radiology",
    icon: "scan",
    name: { uk: "Протокол УЗД", en: "Ultrasound report" },
    tag: {
      uk: "Опис органів, вимірювання, доплерівська оцінка кровотоку та висновок ультразвукового дослідження.",
      en: "Organ-by-organ description, measurements, Doppler assessment and the ultrasound conclusion.",
    },
    mins: 6,
    fields: 24,
    about: {
      uk: "Ультразвукове дослідження описується безпосередньо біля апарата, тому голосове введення дозволяє не відриватися від датчика. Шаблон збирає розміри органів у міліметрах, показники доплерівського картування та якісні характеристики структури в окремі поля. Наприкінці автоматично формується коротка узагальнена відповідь для лікаря, який направив пацієнта.",
      en: "Ultrasound is described at the machine, so voice entry lets the sonologist keep both hands on the probe. The template collects organ dimensions in millimetres, Doppler parameters and qualitative echotexture into discrete fields. It closes with a concise conclusion written for the referring clinician.",
    },
    bestFor: {
      uk: ["Лікарі ультразвукової діагностики", "Амбулаторні клініки", "Акушерство та гінекологія"],
      en: ["Sonologists and ultrasound physicians", "Outpatient clinics", "Obstetrics and gynaecology"],
    },
    sections: [
      {
        name: { uk: "Показання", en: "Indication" },
        sample: {
          uk: "Скринінгове дослідження щитоподібної залози у пацієнтки 45 років у зв'язку з пальпаторно визначеним вузлом справа.",
          en: "Screening thyroid ultrasound in a 45-year-old with a palpable right-sided nodule.",
        },
      },
      {
        name: { uk: "Умови дослідження", en: "Technique" },
        sample: {
          uk: "Дослідження виконано лінійним датчиком 7,5–12 МГц у режимі сірої шкали з подальшим кольоровим доплерівським картуванням.",
          en: "Performed with a 7.5–12 MHz linear transducer in grey scale followed by colour Doppler interrogation.",
        },
      },
      {
        name: { uk: "Опис органів", en: "Organ findings" },
        sample: {
          uk: "Права частка щитоподібної залози розмірами 48 × 18 × 16 мм, ліва — 46 × 17 × 15 мм, перешийок 3 мм. У середній третині правої частки визначається ізоехогенний вузол 12 × 9 мм із чіткими рівними контурами та тонким гіпоехогенним обідком.",
          en: "The right thyroid lobe measures 48 × 18 × 16 mm and the left 46 × 17 × 15 mm, with a 3 mm isthmus. A 12 × 9 mm isoechoic nodule with smooth margins and a thin hypoechoic halo is seen in the mid right lobe.",
        },
      },
      {
        name: { uk: "Доплерівське дослідження", en: "Doppler assessment" },
        sample: {
          uk: "Кровотік у паренхімі не посилений, у вузлі реєструється переважно периферичний тип васкуляризації.",
          en: "Parenchymal vascularity is not increased and the nodule shows predominantly peripheral flow.",
        },
      },
      {
        name: { uk: "Регіонарні лімфовузли", en: "Regional lymph nodes" },
        sample: {
          uk: "Шийні лімфовузли не збільшені, зберігають жирові ворота та звичайну овальну форму.",
          en: "Cervical lymph nodes are not enlarged and retain a normal oval shape with preserved fatty hila.",
        },
      },
      {
        name: { uk: "Обмеження", en: "Limitations" },
        sample: {
          uk: "Нижній полюс лівої частки частково прикритий грудниною, що обмежує оцінку загруднинного поширення.",
          en: "The lower pole of the left lobe is partly obscured by the sternum, limiting assessment for retrosternal extension.",
        },
      },
      {
        name: { uk: "Висновок", en: "Conclusion" },
        sample: {
          uk: "Солітарний вузол правої частки щитоподібної залози з ознаками низького ризику; дифузних змін паренхіми не виявлено. Рекомендовано ультразвуковий контроль через 12 місяців.",
          en: "Solitary right thyroid nodule with low-risk sonographic features and no diffuse parenchymal change. Ultrasound follow-up in 12 months is recommended.",
        },
      },
    ],
  },
  {
    slug: "dental-examination-charting",
    cat: "dentistry",
    icon: "grid",
    name: { uk: "Огляд та зубна формула", en: "Dental exam & charting note" },
    tag: {
      uk: "Первинний стоматологічний огляд: скарги, зубна формула, стан ясен, рентген та план лікування.",
      en: "Baseline dental visit: complaints, tooth chart, periodontal status, radiographs and treatment plan.",
    },
    mins: 7,
    fields: 34,
    about: {
      uk: "Заповнення зубної формули вручну змушує лікаря постійно відволікатися від пацієнта, тоді як продиктовані номери зубів і стан кожної поверхні розкладаються в структуровану карту автоматично. Шаблон розпізнає нумерацію за системою FDI, позначення поверхонь та індекси стану ясен. План лікування та узгоджені з пацієнтом етапи зберігаються окремими полями для подальшого візиту.",
      en: "Charting by hand pulls the dentist away from the patient, whereas dictated tooth numbers and surface findings are mapped into a structured chart automatically. The template recognises FDI notation, surface codes and periodontal indices. The treatment plan and the stages agreed with the patient are stored as separate fields for the next visit.",
    },
    bestFor: {
      uk: ["Стоматологи-терапевти", "Приватні стоматологічні клініки", "Профілактичні огляди"],
      en: ["General dentists", "Private dental practices", "Routine check-up appointments"],
    },
    sections: [
      {
        name: { uk: "Скарги та анамнез", en: "Complaints and history" },
        sample: {
          uk: "Пацієнт 29 років скаржиться на короткочасну чутливість зубів верхньої щелепи ліворуч на холодне протягом останнього місяця. Загальносоматичний анамнез не обтяжений, алергію на медикаменти заперечує.",
          en: "29-year-old reporting one month of brief cold sensitivity in the upper left quadrant. Medical history is unremarkable and no drug allergies are reported.",
        },
      },
      {
        name: { uk: "Позаротовий огляд", en: "Extraoral examination" },
        sample: {
          uk: "Конфігурація обличчя не змінена, регіонарні лімфовузли не пальпуються. Скронево-нижньощелепні суглоби рухаються плавно, без клацання та болючості.",
          en: "Facial symmetry is preserved and regional lymph nodes are not palpable. Temporomandibular joints move smoothly without clicking or tenderness.",
        },
      },
      {
        name: { uk: "Зубна формула", en: "Tooth chart" },
        sample: {
          uk: "Зуб 26 — каріозна порожнина на оклюзійній поверхні в межах дентину; зуби 16 та 36 відновлені композитними реставраціями в задовільному стані. Зуб 46 відсутній, дефект не заміщено.",
          en: "Tooth 26 shows an occlusal carious cavity extending into dentine; teeth 16 and 36 carry serviceable composite restorations. Tooth 46 is missing and the space is unrestored.",
        },
      },
      {
        name: { uk: "Стан тканин пародонта", en: "Periodontal status" },
        sample: {
          uk: "Глибина зондування не перевищує 3 мм, кровоточивість при зондуванні визначається у 12% ділянок. Наявні помірні над'ясенні зубні відкладення в ділянці нижніх фронтальних зубів.",
          en: "Probing depths do not exceed 3 mm with bleeding on probing at 12% of sites. Moderate supragingival calculus is present around the lower anterior teeth.",
        },
      },
      {
        name: { uk: "Рентгенологічне дослідження", en: "Radiographic findings" },
        sample: {
          uk: "На прицільній рентгенограмі зуба 26 визначається просвітлення в межах дентину без сполучення з порожниною зуба; періапікальні тканини без змін.",
          en: "The periapical radiograph of tooth 26 shows a dentinal radiolucency without pulpal communication and normal periapical tissues.",
        },
      },
      {
        name: { uk: "Діагноз", en: "Diagnosis" },
        sample: {
          uk: "Хронічний середній карієс зуба 26; хронічний генералізований катаральний гінгівіт легкого ступеня.",
          en: "Moderate chronic caries of tooth 26 with mild generalised plaque-induced gingivitis.",
        },
      },
      {
        name: { uk: "План лікування", en: "Treatment plan" },
        sample: {
          uk: "Професійна гігієна порожнини рота, наступним візитом — реставрація зуба 26 композитним матеріалом. Обговорено варіанти заміщення дефекту в ділянці зуба 46.",
          en: "Professional cleaning first, followed by composite restoration of tooth 26 at the next visit. Options for replacing the missing tooth 46 were discussed.",
        },
      },
      {
        name: { uk: "Рекомендації пацієнту", en: "Patient instructions" },
        sample: {
          uk: "Пацієнту роз'яснено техніку чищення міжзубних проміжків та рекомендовано пасту з високим вмістом фториду. Контрольний огляд через шість місяців.",
          en: "Interdental cleaning technique demonstrated and a high-fluoride toothpaste advised. Review appointment in six months.",
        },
      },
    ],
  },
  {
    slug: "endodontic-treatment",
    cat: "dentistry",
    icon: "layers",
    name: { uk: "Ендодонтичне лікування", en: "Endodontic treatment note" },
    tag: {
      uk: "Протокол лікування кореневих каналів: анестезія, робоча довжина, обробка, обтурація, контроль.",
      en: "Root canal record: anaesthesia, working length, instrumentation, obturation and post-op review.",
    },
    mins: 6,
    fields: 26,
    about: {
      uk: "Ендодонтичне втручання потребує детального протоколу: кількість каналів, робочі довжини, розміри інструментів та засоби іригації мають бути зафіксовані для юридичного захисту й планування наступних етапів. Лікар диктує ці параметри під час роботи або одразу після неї, а шаблон розкладає їх по каналах. Дані про обтурацію та контрольний знімок зберігаються у структурованому вигляді.",
      en: "Root canal therapy needs a detailed record: canal count, working lengths, file sizes and irrigants must all be documented for medicolegal cover and for planning the next stage. The clinician dictates these parameters during or straight after treatment and the template distributes them per canal. Obturation details and the post-operative radiograph are stored in structured form.",
    },
    bestFor: {
      uk: ["Лікарі-ендодонтисти", "Стоматологи загальної практики", "Невідкладна стоматологічна допомога"],
      en: ["Endodontists", "General dentists doing root canals", "Emergency dental care"],
    },
    sections: [
      {
        name: { uk: "Показання до лікування", en: "Indication" },
        sample: {
          uk: "Зуб 36 із діагнозом хронічний апікальний періодонтит, підтвердженим негативною реакцією на температурні подразники та періапікальним просвітленням 4 мм.",
          en: "Tooth 36 with chronic apical periodontitis, confirmed by a negative thermal response and a 4 mm periapical radiolucency.",
        },
      },
      {
        name: { uk: "Анестезія та ізоляція", en: "Anaesthesia and isolation" },
        sample: {
          uk: "Виконано мандибулярну провідникову анестезію 1,7 мл артикаїну з адреналіном 1:100 000. Робоче поле ізольовано кофердамом.",
          en: "Inferior alveolar nerve block with 1.7 mL articaine and 1:100 000 adrenaline. The tooth was isolated under rubber dam.",
        },
      },
      {
        name: { uk: "Доступ і топографія каналів", en: "Access and canal anatomy" },
        sample: {
          uk: "Сформовано ендодонтичний доступ, виявлено чотири устя: медіально-щічне, медіально-язикове, дистально-щічне та дистально-язикове. Устя оброблено ультразвуковою насадкою.",
          en: "An access cavity was prepared and four orifices located: mesiobuccal, mesiolingual, distobuccal and distolingual. Orifices were refined with an ultrasonic tip.",
        },
      },
      {
        name: { uk: "Робоча довжина", en: "Working length" },
        sample: {
          uk: "Робочі довжини визначено апекслокатором і підтверджено рентгенологічно: медіальні канали — 20,5 мм, дистальні — 21,0 мм від щічних горбків.",
          en: "Working lengths were established electronically and confirmed radiographically: mesial canals 20.5 mm and distal canals 21.0 mm from the buccal cusps.",
        },
      },
      {
        name: { uk: "Механічна та медикаментозна обробка", en: "Instrumentation and irrigation" },
        sample: {
          uk: "Канали оброблено нікель-титановими інструментами до розміру 25/06 у медіальних та 30/06 у дистальних. Іригація 3% розчином гіпохлориту натрію з фінальним промиванням 17% ЕДТА та ультразвуковою активацією.",
          en: "Canals were shaped with rotary nickel-titanium files to 25/06 mesially and 30/06 distally. Irrigation used 3% sodium hypochlorite with a final 17% EDTA rinse and ultrasonic activation.",
        },
      },
      {
        name: { uk: "Обтурація", en: "Obturation" },
        sample: {
          uk: "Канали запломбовано гутаперчею методом латеральної конденсації із силером на основі епоксидної смоли до фізіологічного звуження. Порожнину закрито тимчасовою пломбою.",
          en: "Canals were obturated with gutta-percha by lateral condensation and an epoxy resin sealer to the apical constriction, then sealed with a temporary restoration.",
        },
      },
      {
        name: { uk: "Контрольна рентгенограма", en: "Post-operative radiograph" },
        sample: {
          uk: "На контрольному знімку пломбувальний матеріал заповнює канали рівномірно, до верхівок, без виведення за апекс і без порожнин.",
          en: "The post-operative film shows homogeneous fills to the radiographic apices with no voids and no extrusion.",
        },
      },
      {
        name: { uk: "Рекомендації та наступний візит", en: "Aftercare and follow-up" },
        sample: {
          uk: "Пацієнта попереджено про можливу помірну болючість протягом двох-трьох діб, рекомендовано нестероїдні протизапальні за потреби. Постійна реставрація з покриттям горбків запланована протягом місяця, рентгенологічний контроль — через 12 місяців.",
          en: "The patient was warned about mild discomfort for two to three days and advised to take non-steroidal analgesia as needed. A definitive cuspal-coverage restoration is planned within a month, with radiographic review at 12 months.",
        },
      },
    ],
  },
  {
    slug: "oral-surgery-extraction",
    cat: "dentistry",
    icon: "scalpel",
    name: { uk: "Видалення зуба", en: "Tooth extraction note" },
    tag: {
      uk: "Операційний протокол видалення: анестезія, техніка, гемостаз, ускладнення та післяопераційні поради.",
      en: "Operative record for extraction: anaesthesia, technique, haemostasis, complications and aftercare.",
    },
    mins: 5,
    fields: 22,
    about: {
      uk: "Протокол хірургічного втручання в порожнині рота має точно відображати перебіг операції, адже саме він стає основним документом у разі ускладнень. Хірург диктує хід видалення одразу після завершення, поки деталі свіжі, і отримує готовий структурований запис. Окремо фіксуються стан лунки, спосіб гемостазу та надані пацієнту рекомендації.",
      en: "An oral surgery record must reflect the operation precisely, since it becomes the primary document if complications arise. The surgeon dictates the course of the extraction immediately afterwards, while details are fresh, and receives a finished structured note. Socket condition, haemostasis and the aftercare given to the patient are captured separately.",
    },
    bestFor: {
      uk: ["Щелепно-лицеві хірурги", "Хірургічний стоматологічний прийом", "Клініки денної хірургії"],
      en: ["Oral and maxillofacial surgeons", "Dental surgery sessions", "Day-case surgical clinics"],
    },
    sections: [
      {
        name: { uk: "Показання до операції", en: "Indication" },
        sample: {
          uk: "Зуб 48 у положенні мезіального нахилу з рецидивуючим перикоронаритом; консервативне лікування неефективне.",
          en: "Mesioangularly impacted tooth 48 with recurrent pericoronitis unresponsive to conservative management.",
        },
      },
      {
        name: { uk: "Передопераційна оцінка", en: "Pre-operative assessment" },
        sample: {
          uk: "На ортопантомограмі корені зуба 48 прилягають до верхньої стінки нижньощелепного каналу. Пацієнт 24 років, супутньої патології немає, антикоагулянтів не приймає.",
          en: "The panoramic radiograph shows the roots of tooth 48 abutting the superior border of the inferior alveolar canal. The 24-year-old patient is medically fit and takes no anticoagulants.",
        },
      },
      {
        name: { uk: "Анестезія", en: "Anaesthesia" },
        sample: {
          uk: "Провідникова анестезія нижнього альвеолярного та язикового нервів 3,4 мл артикаїну з адреналіном, доповнена інфільтрацією з щічного боку. Достатність знеболення підтверджено перед розрізом.",
          en: "Inferior alveolar and lingual nerve blocks using 3.4 mL articaine with adrenaline, supplemented by buccal infiltration. Adequate anaesthesia was confirmed before incision.",
        },
      },
      {
        name: { uk: "Хід операції", en: "Operative technique" },
        sample: {
          uk: "Виконано трикутний слизово-окісний клапоть, проведено остеотомію щічної кортикальної пластинки та розділення коронки і коренів бором. Фрагменти видалено елеватором, лунку ревізовано та промито стерильним фізіологічним розчином.",
          en: "A triangular mucoperiosteal flap was raised, buccal bone removed and the crown sectioned from the roots with a bur. Fragments were elevated out, and the socket was curetted and irrigated with sterile saline.",
        },
      },
      {
        name: { uk: "Гемостаз та ушивання", en: "Haemostasis and closure" },
        sample: {
          uk: "Гемостаз досягнуто тампонадою та гемостатичною губкою в лунці. Клапоть повернуто на місце та фіксовано трьома вузловими швами розсмоктувальним матеріалом.",
          en: "Haemostasis was achieved with pressure packing and a resorbable haemostatic sponge in the socket. The flap was repositioned and secured with three interrupted resorbable sutures.",
        },
      },
      {
        name: { uk: "Ускладнення", en: "Complications" },
        sample: {
          uk: "Інтраопераційних ускладнень не було; перфорації нижньощелепного каналу та порушення чутливості не відзначено.",
          en: "No intra-operative complications occurred, with no breach of the inferior alveolar canal and no altered sensation.",
        },
      },
      {
        name: { uk: "Післяопераційні рекомендації", en: "Post-operative instructions" },
        sample: {
          uk: "Рекомендовано холод місцево впродовж перших годин, м'яку їжу та відмову від полоскань у першу добу. Призначено нестероїдний анальгетик за потреби, роз'яснено ознаки альвеоліту.",
          en: "Local cold packs for the first hours, a soft diet and no rinsing for 24 hours were advised. Non-steroidal analgesia was prescribed as required and the signs of dry socket explained.",
        },
      },
      {
        name: { uk: "Контрольний огляд", en: "Follow-up" },
        sample: {
          uk: "Контрольний огляд призначено через сім днів для оцінки загоєння; за потреби раніше — при посиленні болю або набряку.",
          en: "Review in seven days to assess healing, or sooner if pain or swelling increases.",
        },
      },
    ],
  },
];

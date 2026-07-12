// i18n.js — Translation strings (UK + EN)
import React from 'react';

export const STRINGS = {
  uk: {
    // Nav
    "nav.dictation": "Диктування",
    "nav.reports": "Звіти",
    "nav.templates": "Шаблони",
    "nav.settings": "Налаштування",
    "brand.tagline": "Медичне диктування",

    // Save status
    "save.saved": "Збережено",
    "save.saving": "Збереження…",
    "save.unsaved": "Не збережено",
    "save.justNow": "щойно",
    "save.minAgo": "{n} хв тому",
    "save.error": "Помилка збереження",

    // Mic states
    "mic.idle": "Натисніть, щоб почати",
    "mic.idle.help": "або натисніть {key}",
    "mic.connecting": "З'єднання…",
    "mic.connecting.help": "Підключення до сервісу розпізнавання",
    "mic.listening": "Слухаю",
    "mic.listening.help": "Натисніть {key} для паузи",
    "mic.paused": "Пауза",
    "mic.paused.help": "Натисніть {key}, щоб продовжити",
    "mic.processing": "Обробка…",
    "mic.processing.help": "Завершення останніх сегментів",
    "mic.error_permission": "Доступ заборонено",
    "mic.error_permission.help": "Дозвольте мікрофон у налаштуваннях браузера",
    "mic.error_network": "Немає з'єднання",
    "mic.error_network.help": "Аудіо буферизується локально",
    "mic.error_unsupported": "Браузер не підтримує",
    "mic.error_unsupported.help": "Потрібен Chrome, Edge або Safari",
    "mic.lang": "Мова диктування",

    // Editor
    "editor.placeholder": "Натисніть мікрофон або почніть друкувати…",
    "editor.section.empty": "Натисніть, щоб додати текст або диктуйте «{anchor}»",

    // Suggestions
    "sug.title": "Підказки",
    "sug.source.personal": "Особисті",
    "sug.source.specialty": "Спеціальність",
    "sug.source.template": "Шаблон",
    "sug.source.general": "Загальні",
    "sug.source.user": "Моя фраза",
    "sug.source.tenant": "Клінічний словник",
    "sug.source.system": "Медичний корпус",
    "sug.tabHint": "{key} прийняти",
    "sug.undo": "Скасовано підказку",

    // Autocomplete (sprint 10, step 05)
    "ac.hint.accept": "Tab — прийняти",
    "ac.hint.dismiss": "Esc — сховати",
    "ac.settings.label": "Підказки під час набору",
    "ac.settings.desc": "Показувати автодоповнення медичних фраз. Підказки навчаються з того, що ви приймаєте — покращення з'являються наступного дня.",
    "ac.help.tabNote": "Коли видно підказку, Tab приймає її, Esc — ховає. Без підказки Tab працює як зазвичай.",

    // Voice commands
    "cmd.ref": "Голосові команди",
    "cmd.newPara": "новий абзац",
    "cmd.newLine": "новий рядок",
    "cmd.comma": "кома",
    "cmd.period": "крапка",
    "cmd.question": "знак питання",
    "cmd.dash": "тире",
    "cmd.colon": "двокрапка",
    "cmd.goTo": "перейти до <розділ>",
    "cmd.undo": "скасувати",
    "cmd.save": "зберегти",
    "cmd.stop": "кінець диктування",
    "cmd.showAll": "Усі команди…",
    "cmd.close": "Закрити",
    "cmd.modal.sub": "Скажіть фразу під час диктування — символ або дія застосується одразу.",
    "cmd.group.structure": "Структура",
    "cmd.group.punct": "Пунктуація та символи",
    "cmd.group.nav": "Навігація",
    "cmd.group.actions": "Дії",

    // Actions
    "action.save": "Зберегти",
    "action.sign": "Підписати",
    "action.export": "Експорт",
    "action.amend": "Внести правки",
    "action.cancel": "Скасувати",
    "action.continue": "Продовжити",
    "action.back": "Назад",
    "action.new": "Створити звіт",
    "action.search": "Пошук…",

    // Reports list
    "reports.title": "Звіти",
    "reports.sub": "Усі диктовані звіти",
    "reports.tab.mine": "Мої чернетки",
    "reports.tab.signed": "Підписані",
    "reports.tab.amended": "З правками",
    "reports.tab.all": "Всі",
    "reports.col.patient": "Пацієнт",
    "reports.col.template": "Шаблон",
    "reports.col.status": "Статус",
    "reports.col.modified": "Оновлено",
    "reports.col.author": "Автор",
    "reports.col.lang": "Мова",
    "reports.status.draft": "Чернетка",
    "reports.status.signed": "Підписано",
    "reports.status.amended": "З правками",
    "reports.empty": "Немає звітів",

    // Specialties / templates
    "spec.radiology": "Радіологія",
    "spec.cardiology": "Кардіологія",
    "spec.cardiacSurgery": "Кардіохірургія",
    "spec.orthopaedics": "Ортопедія",

    // Templates picker
    "tpl.switch": "Переключити шаблон",
    "tpl.add": "Додати шаблон",
    "tpl.addTitle": "Новий шаблон",
    "tpl.addSub": "Створіть власний шаблон звіту з розділами для диктування.",
    "tpl.nameUk": "Назва (укр)",
    "tpl.nameEn": "Назва (англ)",
    "tpl.nameUk.ph": "МРТ головного мозку",
    "tpl.nameEn.ph": "Brain MRI",
    "tpl.code": "Код",
    "tpl.specialty": "Спеціальність",
    "tpl.icon": "Іконка",
    "tpl.sections": "розділів",
    "tpl.addSection": "Додати розділ",
    "tpl.required": "Обов'язковий",
    "tpl.create": "Створити шаблон",

    // Sign
    "sign.title": "Підписати звіт КЕП",
    "sign.sub": "Цифровий підпис буде застосовано через сертифікат КЕП.",
    "sign.step.connect": "З'єднання з провайдером КЕП…",
    "sign.step.await": "Очікування підпису у застосунку Дія",
    "sign.step.verify": "Перевірка сертифіката",
    "sign.step.done": "Звіт підписано",
    "sign.confirm": "Підтвердити та підписати",
    "sign.signedBy": "Підписав(ла)",
    "sign.signedAt": "Дата підпису",
    "sign.cert": "Сертифікат",

    // Crash recovery
    "recovery.title": "Знайдено незавершену сесію",
    "recovery.sub": "Чернетка від {when} не була збережена. Відновити?",
    "recovery.resume": "Відновити",
    "recovery.discard": "Відхилити",

    // Misc
    "common.required": "Обов'язково",
    "common.partial": "частково",
    "common.filled": "заповнено",
    "common.missing": "пусто",
    "common.words": "{n} слів",
    "common.signed": "Підписано",
    "common.draft": "Чернетка",
    "common.now": "зараз",
    "common.minute": "хв",
  },

  en: {
    "nav.dictation": "Dictation",
    "nav.reports": "Reports",
    "nav.templates": "Templates",
    "nav.settings": "Settings",
    "brand.tagline": "Medical dictation",

    "save.saved": "Saved",
    "save.saving": "Saving…",
    "save.unsaved": "Unsaved",
    "save.justNow": "just now",
    "save.minAgo": "{n} min ago",
    "save.error": "Save failed",

    "mic.idle": "Press to dictate",
    "mic.idle.help": "or press {key}",
    "mic.connecting": "Connecting…",
    "mic.connecting.help": "Reaching transcription service",
    "mic.listening": "Listening",
    "mic.listening.help": "Press {key} to pause",
    "mic.paused": "Paused",
    "mic.paused.help": "Press {key} to resume",
    "mic.processing": "Processing…",
    "mic.processing.help": "Finalising last segments",
    "mic.error_permission": "Microphone blocked",
    "mic.error_permission.help": "Allow microphone in browser settings",
    "mic.error_network": "Connection lost",
    "mic.error_network.help": "Audio buffering locally",
    "mic.error_unsupported": "Browser unsupported",
    "mic.error_unsupported.help": "Use Chrome, Edge, or Safari",
    "mic.lang": "Dictation language",

    "editor.placeholder": "Press the microphone or start typing…",
    "editor.section.empty": "Click to type or say \"{anchor}\"",

    "sug.title": "Suggestions",
    "sug.source.personal": "Personal",
    "sug.source.specialty": "Specialty",
    "sug.source.template": "Template",
    "sug.source.general": "General",
    "sug.source.user": "My phrase",
    "sug.source.tenant": "Clinic dictionary",
    "sug.source.system": "Medical corpus",
    "sug.tabHint": "{key} to accept",
    "sug.undo": "Suggestion undone",

    // Autocomplete (sprint 10, step 05)
    "ac.hint.accept": "Tab — accept",
    "ac.hint.dismiss": "Esc — dismiss",
    "ac.settings.label": "Inline suggestions",
    "ac.settings.desc": "Show medical phrase autocomplete. Suggestions learn from what you accept — improvements appear the next day.",
    "ac.help.tabNote": "When a suggestion is visible, Tab accepts it and Esc dismisses it. Without one, Tab behaves normally.",

    "cmd.ref": "Voice commands",
    "cmd.newPara": "new paragraph",
    "cmd.newLine": "new line",
    "cmd.comma": "comma",
    "cmd.period": "period",
    "cmd.question": "question mark",
    "cmd.dash": "dash",
    "cmd.colon": "colon",
    "cmd.goTo": "go to <section>",
    "cmd.undo": "undo",
    "cmd.save": "save",
    "cmd.stop": "stop dictation",
    "cmd.showAll": "All commands…",
    "cmd.close": "Close",
    "cmd.modal.sub": "Say a phrase while dictating — the symbol or action is applied immediately.",
    "cmd.group.structure": "Structure",
    "cmd.group.punct": "Punctuation & symbols",
    "cmd.group.nav": "Navigation",
    "cmd.group.actions": "Actions",

    "action.save": "Save",
    "action.sign": "Sign",
    "action.export": "Export",
    "action.amend": "Amend",
    "action.cancel": "Cancel",
    "action.continue": "Continue",
    "action.back": "Back",
    "action.new": "New report",
    "action.search": "Search…",

    "reports.title": "Reports",
    "reports.sub": "All dictated reports",
    "reports.tab.mine": "My drafts",
    "reports.tab.signed": "Signed",
    "reports.tab.amended": "Amended",
    "reports.tab.all": "All",
    "reports.col.patient": "Patient",
    "reports.col.template": "Template",
    "reports.col.status": "Status",
    "reports.col.modified": "Modified",
    "reports.col.author": "Author",
    "reports.col.lang": "Lang",
    "reports.status.draft": "Draft",
    "reports.status.signed": "Signed",
    "reports.status.amended": "Amended",
    "reports.empty": "No reports yet",

    "spec.radiology": "Radiology",
    "spec.cardiology": "Cardiology",
    "spec.cardiacSurgery": "Cardiac surgery",
    "spec.orthopaedics": "Orthopaedics",

    "tpl.switch": "Switch template",
    "tpl.add": "Add template",
    "tpl.addTitle": "New template",
    "tpl.addSub": "Create your own report template with sections for dictation.",
    "tpl.nameUk": "Name (UK)",
    "tpl.nameEn": "Name (EN)",
    "tpl.nameUk.ph": "МРТ головного мозку",
    "tpl.nameEn.ph": "Brain MRI",
    "tpl.code": "Code",
    "tpl.specialty": "Specialty",
    "tpl.icon": "Icon",
    "tpl.sections": "sections",
    "tpl.addSection": "Add section",
    "tpl.required": "Required",
    "tpl.create": "Create template",

    "sign.title": "Sign report with KEP",
    "sign.sub": "A digital signature will be applied using your KEP certificate.",
    "sign.step.connect": "Connecting to KEP provider…",
    "sign.step.await": "Waiting for signature in Diia app",
    "sign.step.verify": "Verifying certificate",
    "sign.step.done": "Report signed",
    "sign.confirm": "Confirm and sign",
    "sign.signedBy": "Signed by",
    "sign.signedAt": "Signed at",
    "sign.cert": "Certificate",

    "recovery.title": "Unfinished session found",
    "recovery.sub": "A draft from {when} was not saved. Recover?",
    "recovery.resume": "Resume",
    "recovery.discard": "Discard",

    "common.required": "Required",
    "common.partial": "partial",
    "common.filled": "filled",
    "common.missing": "empty",
    "common.words": "{n} words",
    "common.signed": "Signed",
    "common.draft": "Draft",
    "common.now": "now",
    "common.minute": "min",
  }
};

export const I18nContext = React.createContext({ lang: "uk", t: (k) => k });

export function I18nProvider({ lang, children }) {
  const t = React.useCallback((key, params) => {
    let s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
    if (params) {
      Object.keys(params).forEach((k) => {
        s = s.replace(`{${k}}`, params[k]);
      });
    }
    return s;
  }, [lang]);
  return React.createElement(I18nContext.Provider, { value: { lang, t } }, children);
}

export function useI18n() { return React.useContext(I18nContext); }

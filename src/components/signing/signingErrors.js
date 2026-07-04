// signingErrors.js — map backend signing problems to friendly UA/EN copy.
//
// The report-service passes signing-service problems through 1:1 as
// HTTPException(detail={error, detail}), which client.js surfaces as
// ApiError.problem.detail.error. Codes per backend inline.py / reports_sign.py.

const MESSAGES = {
  key_container_rejected: {
    uk: 'Не вдалося відкрити контейнер ключа: невірний файл або хибний пароль до ключа.',
    en: 'The key container could not be opened: bad file or wrong key password.',
  },
  missing_credentials: {
    uk: 'Додайте файл ключа та введіть пароль до нього.',
    en: 'Attach the key file and enter its password.',
  },
  account_password_rejected: {
    uk: 'Пароль облікового запису не прийнято.',
    en: 'The account password was not accepted.',
  },
  account_locked: {
    uk: 'Обліковий запис тимчасово заблоковано через повторні невдалі спроби. Спробуйте пізніше.',
    en: 'The account is temporarily locked after repeated failures. Try again later.',
  },
  report_not_signable: {
    uk: 'Звіт не готовий до підписання — підписати можна лише завершений звіт або чернетку правки.',
    en: 'The report is not ready for signing — only a finalized report or a drafted amendment can be signed.',
  },
  provider_unavailable: {
    uk: 'Сервіс підписання тимчасово недоступний. Спробуйте за хвилину.',
    en: 'The signing provider is temporarily unavailable. Try again in a minute.',
  },
  signing_service_unavailable: {
    uk: 'Сервіс підписання тимчасово недоступний. Спробуйте за хвилину.',
    en: 'The signing service is temporarily unavailable. Try again in a minute.',
  },
  envelope_invalid: {
    uk: 'Створений підпис не пройшов перевірку. Зверніться до адміністратора.',
    en: 'The produced signature failed verification. Contact your administrator.',
  },
}

const FALLBACK = {
  uk: 'Не вдалося підписати документ. Спробуйте ще раз.',
  en: 'Signing failed. Please try again.',
}

// Extract the machine error code from an ApiError (or plain Error).
export function signingErrorCode(err) {
  const d = err && err.problem && err.problem.detail
  if (d && typeof d === 'object' && typeof d.error === 'string') return d.error
  if (d && typeof d === 'string') return d
  return null
}

export function signingErrorMessage(err, lang) {
  const key = lang === 'uk' ? 'uk' : 'en'
  const code = signingErrorCode(err)
  if (code && MESSAGES[code]) return MESSAGES[code][key]
  if (err && err.status === 401) return MESSAGES.account_password_rejected[key]
  if (err && err.status === 423) return MESSAGES.account_locked[key]
  if (err && err.status === 409) return MESSAGES.report_not_signable[key]
  if (err && err.status === 503) return MESSAGES.provider_unavailable[key]
  return FALLBACK[key]
}

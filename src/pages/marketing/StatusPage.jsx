// StatusPage.jsx — the public #/status page.
//
// This used to be a pill in the site footer that opened a drop-up panel. A
// visitor asking "is Klarnote up?" wants something they can link to, reload
// and keep open next to the thing that is failing — none of which a popover
// does. The footer now links here; the probing itself is unchanged and still
// lives in components/ServiceHealth.jsx.
//
// The check runs in the visitor's own browser, against the endpoints this
// build is configured with. That is worth saying on the page: a red row can
// mean the service is down for everyone, or that this one network cannot
// reach it, and the page must not claim to know which.
import React from "react";
import { Icon } from "../../components/UI.jsx";
import { MarketingShell } from "./MarketingShell.jsx";
import {
  useServiceHealth, HealthRow, STATE, ROLE_OF,
  copyHealthReport, slowestReady,
} from "../../components/ServiceHealth.jsx";
import { DEFAULT_READY_PATH } from "../../api/services.js";
import { tr } from "../../i18n.js";

const T = {
  title: { uk: "Стан сервісів", en: "Service status", pl: "Stan usług", de: "Dienststatus", ro: "Starea serviciilor", cs: "Stav služeb", sr: "Status servisa", hu: "Szolgáltatások állapota", ar: "حالة الخدمات", es: "Estado de los servicios", pt: "Estado dos serviços" },
  sub: {
    uk: "Перевірка виконується у вашому браузері й опитує сервіси, до яких налаштована ця збірка. Оновлюється кожні 30 секунд.",
    en: "The check runs in your browser and probes the services this build is configured against. It refreshes every 30 seconds.",
    pl: "Sprawdzenie działa w Twojej przeglądarce i odpytuje usługi skonfigurowane w tej wersji. Odświeża się co 30 sekund.",
    de: "Die Prüfung läuft in Ihrem Browser und fragt die Dienste ab, für die dieser Build konfiguriert ist. Sie aktualisiert sich alle 30 Sekunden.",
    ro: "Verificarea rulează în browserul dvs. și interoghează serviciile configurate în această versiune. Se reîmprospătează la fiecare 30 de secunde.",
    cs: "Kontrola běží ve vašem prohlížeči a dotazuje se služeb, na které je tento build nakonfigurován. Obnovuje se každých 30 sekund.",
    sr: "Provera se izvršava u vašem pregledaču i ispituje servise za koje je ovaj build podešen. Osvežava se svakih 30 sekundi.",
    hu: "Az ellenőrzés az Ön böngészőjében fut, és a build által beállított szolgáltatásokat kérdezi le. 30 másodpercenként frissül.",
    ar: "يجري الفحص في متصفحك ويستعلم عن الخدمات المهيأة في هذه النسخة. يتم التحديث كل 30 ثانية.",
    es: "La comprobación se ejecuta en su navegador y sondea los servicios configurados en esta versión. Se actualiza cada 30 segundos.",
    pt: "A verificação é executada no seu navegador e sonda os serviços configurados nesta versão. Atualiza a cada 30 segundos.",
  },
  ready: { uk: "готові", en: "ready", pl: "gotowe", de: "bereit", ro: "gata", cs: "připraveno", sr: "spremno", hu: "kész", ar: "جاهزة", es: "listos", pt: "prontos" },
  recheck: { uk: "Оновити", en: "Re-check", pl: "Sprawdź ponownie", de: "Erneut prüfen", ro: "Verifică din nou", cs: "Zkontrolovat znovu", sr: "Proveri ponovo", hu: "Újraellenőrzés", ar: "إعادة الفحص", es: "Volver a comprobar", pt: "Verificar de novo" },
  checking: { uk: "Перевірка…", en: "Checking…", pl: "Sprawdzanie…", de: "Wird geprüft…", ro: "Se verifică…", cs: "Kontrola…", sr: "Provera…", hu: "Ellenőrzés…", ar: "جارٍ الفحص…", es: "Comprobando…", pt: "A verificar…" },
  copy: { uk: "Копіювати звіт", en: "Copy report", pl: "Kopiuj raport", de: "Bericht kopieren", ro: "Copiază raportul", cs: "Kopírovat zprávu", sr: "Kopiraj izveštaj", hu: "Jelentés másolása", ar: "نسخ التقرير", es: "Copiar informe", pt: "Copiar relatório" },
  notReady: { uk: "Не готові", en: "Not ready", pl: "Niegotowe", de: "Nicht bereit", ro: "Nepregătite", cs: "Nepřipraveno", sr: "Nisu spremni", hu: "Nem áll készen", ar: "غير جاهزة", es: "No listos", pt: "Não prontos" },
  affected: { uk: "Постраждалі функції: ", en: "Affected features: ", pl: "Dotknięte funkcje: ", de: "Betroffene Funktionen: ", ro: "Funcții afectate: ", cs: "Dotčené funkce: ", sr: "Pogođene funkcije: ", hu: "Érintett funkciók: ", ar: "الميزات المتأثرة: ", es: "Funciones afectadas: ", pt: "Funcionalidades afetadas: " },
  slowest: { uk: "найповільніший", en: "slowest", pl: "najwolniejszy", de: "langsamster", ro: "cel mai lent", cs: "nejpomalejší", sr: "najsporiji", hu: "leglassabb", ar: "الأبطأ", es: "el más lento", pt: "o mais lento" },
  checkedAt: { uk: "Перевірено", en: "Checked at", pl: "Sprawdzono", de: "Geprüft um", ro: "Verificat la", cs: "Zkontrolováno", sr: "Provereno u", hu: "Ellenőrizve", ar: "تم الفحص في", es: "Comprobado a las", pt: "Verificado às" },
  method: {
    uk: "Кожен сервіс опитується запитом GET на шлях готовності.",
    en: "Each service is probed with a GET to its readiness path.",
    pl: "Każda usługa jest odpytywana żądaniem GET na ścieżkę gotowości.",
    de: "Jeder Dienst wird per GET auf seinem Readiness-Pfad abgefragt.",
    ro: "Fiecare serviciu este interogat cu un GET pe calea sa de readiness.",
    cs: "Každá služba se dotazuje požadavkem GET na svou readiness cestu.",
    sr: "Svaki servis se ispituje GET zahtevom na svoju readiness putanju.",
    hu: "Minden szolgáltatást GET kéréssel kérdezünk le a readiness útvonalán.",
    ar: "يتم فحص كل خدمة بطلب GET على مسار الجاهزية الخاص بها.",
    es: "Cada servicio se sondea con un GET a su ruta de readiness.",
    pt: "Cada serviço é sondado com um GET no seu caminho de readiness.",
  },
  caveat: {
    uk: "Червоний рядок може означати як зупинений сервіс, так і мережу, з якої до нього немає доступу. Якщо стан не збігається з тим, що ви бачите в застосунку, скопіюйте звіт і надішліть його нам.",
    en: "A red row can mean the service is down, or simply that this network cannot reach it. If the result does not match what you see in the app, copy the report and send it to us.",
    pl: "Czerwony wiersz może oznaczać awarię usługi albo po prostu brak dostępu z tej sieci. Jeśli wynik nie zgadza się z tym, co widzisz w aplikacji, skopiuj raport i wyślij go do nas.",
    de: "Eine rote Zeile kann bedeuten, dass der Dienst ausgefallen ist — oder dass dieses Netzwerk ihn nicht erreicht. Passt das Ergebnis nicht zu dem, was Sie in der App sehen, kopieren Sie den Bericht und senden Sie ihn uns.",
    ro: "Un rând roșu poate însemna că serviciul este oprit sau doar că această rețea nu îl poate accesa. Dacă rezultatul nu corespunde cu ce vedeți în aplicație, copiați raportul și trimiteți-ni-l.",
    cs: "Červený řádek může znamenat výpadek služby, nebo jen to, že ji tato síť nedosáhne. Pokud výsledek neodpovídá tomu, co vidíte v aplikaci, zkopírujte zprávu a pošlete nám ji.",
    sr: "Crveni red može značiti da je servis pao ili samo da mu ova mreža ne može pristupiti. Ako se rezultat ne poklapa sa onim što vidite u aplikaciji, kopirajte izveštaj i pošaljite nam ga.",
    hu: "A piros sor jelentheti azt, hogy a szolgáltatás áll, de azt is, hogy erről a hálózatról nem érhető el. Ha az eredmény nem egyezik azzal, amit az alkalmazásban lát, másolja ki a jelentést és küldje el nekünk.",
    ar: "قد يعني الصف الأحمر أن الخدمة متوقفة، أو أن هذه الشبكة لا تصل إليها فحسب. إذا لم تطابق النتيجة ما تراه في التطبيق، انسخ التقرير وأرسله إلينا.",
    es: "Una fila roja puede significar que el servicio está caído, o simplemente que esta red no lo alcanza. Si el resultado no coincide con lo que ve en la aplicación, copie el informe y envíenoslo.",
    pt: "Uma linha vermelha pode significar que o serviço está em baixo ou apenas que esta rede não lhe chega. Se o resultado não corresponder ao que vê na aplicação, copie o relatório e envie-no-lo.",
  },
  contact: { uk: "Повідомити про проблему", en: "Report a problem", pl: "Zgłoś problem", de: "Problem melden", ro: "Raportați o problemă", cs: "Nahlásit problém", sr: "Prijavi problem", hu: "Probléma jelentése", ar: "الإبلاغ عن مشكلة", es: "Informar de un problema", pt: "Comunicar um problema" },
};

const LOCALE_OF = {
  uk: "uk-UA", en: "en-GB", pl: "pl-PL", de: "de-DE", ro: "ro-RO", cs: "cs-CZ",
  sr: "sr-RS", hu: "hu-HU", ar: "ar", es: "es-ES", pt: "pt-PT",
};

export function StatusPage({ navigate, lang = "en", tweaks, setTweak }) {
  const L = (m) => m[lang] ?? m.en;
  const health = useServiceHealth();
  const { rows, bad, overall, checkedAt, busy, check } = health;

  const palette = STATE[overall];
  const readyCount = rows.length - bad.length;
  const slowest = slowestReady(rows);
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };

  return (
    <MarketingShell navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak}>
      <header className="mk-hero st-hero">
        <h1 className="mk-hero-title">{L(T.title)}</h1>
        <p className="mk-hero-sub">{L(T.sub)}</p>

        {/* The verdict, before any of the detail below it. */}
        <div className="st-overall" style={{ background: palette.bg, color: palette.fg }} role="status">
          <span className="health-dot" style={{ background: palette.dot }} />
          {/* State words live in the platform dictionary (tr), not in T. */}
          <strong>{tr(lang, palette.uk, palette.en)}</strong>
          {rows.length > 0 && (
            <span className="st-overall-count">{readyCount}/{rows.length} {L(T.ready)}</span>
          )}
        </div>
      </header>

      <section className="mk-blocks st-page">
        <div className="st-bar">
          <div className="st-bar-meta">
            {checkedAt
              ? `${L(T.checkedAt)} ${new Date(checkedAt).toLocaleTimeString(LOCALE_OF[lang] || "en-GB")}`
              : L(T.checking)}
            {slowest && ` · ${L(T.slowest)} ${slowest[0]} ${slowest[1].ms} ms`}
          </div>
          <button className="btn btn-ghost" onClick={check} disabled={busy}>
            <Icon name="refresh" size={13} /> {busy ? L(T.checking) : L(T.recheck)}
          </button>
          <button className="btn btn-ghost" onClick={() => copyHealthReport(health)} disabled={!rows.length}>
            <Icon name="copy" size={13} /> {L(T.copy)}
          </button>
        </div>

        {bad.length > 0 && (
          <div className="health-summary st-summary">
            <strong>{L(T.notReady)}: {bad.map(([k]) => k).join(", ")}</strong>
            <div>
              {L(T.affected)}
              {bad.map(([k]) => (ROLE_OF[k] ? tr(lang, ROLE_OF[k].uk, ROLE_OF[k].en) : k)).join("; ")}
            </div>
          </div>
        )}

        <ul className="health-list st-list">
          {rows.map(([name, v]) => <HealthRow key={name} name={name} v={v} lang={lang} />)}
        </ul>

        <p className="st-note">
          {L(T.method)} <code>GET {DEFAULT_READY_PATH}</code>
          <br />
          {L(T.caveat)}
        </p>

        <div className="st-actions">
          <a className="btn btn-ghost" href="#/contact" onClick={go("/contact")}>{L(T.contact)}</a>
        </div>
      </section>
    </MarketingShell>
  );
}

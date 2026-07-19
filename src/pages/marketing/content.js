// content.js — Bilingual content registry for every public marketing sub-page.
//
// Each entry is keyed by route slug and holds a `hero` plus a list of `blocks`.
// ContentPage.jsx renders the blocks by `type`:
//   prose   { heading, lead?, paragraphs?, bullets? }
//   grid    { heading?, sub?, cols?, items:[{icon,title,desc}] }
//   steps   { heading?, items:[{n,title,desc}] }
//   stats   { items:[{v,l}] }
//   faq     { heading?, items:[{q,a}] }
//   roles   { heading?, sub?, items:[{title,team,location,type}] }
//   posts   { heading?, items:[{tag,title,excerpt,date,read}] }
//   contact { items:[{icon,title,value,note}] }
//   feature-hero { icon, points:[...] }   (rendered inside hero)
//   cta     { title, sub, primary, secondary }
//
// Legal pages use `updated` for the "last updated" line.

/* Reusable closing CTA so every page ends with a clear next step. */
const CTA = {
  uk: { type: "cta", title: "Готові спробувати Klarnote?", sub: "Зареєструйтесь — і поверніть лікарям час для пацієнтів.", primary: { label: "Зареєструватися", path: "/signup" }, secondary: { label: "Зв'язатися з нами", path: "/contact" } },
  en: { type: "cta", title: "Ready to try Klarnote?", sub: "Sign up and give clinicians their time back.", primary: { label: "Sign up", path: "/signup" }, secondary: { label: "Talk to us", path: "/contact" } },
  pl: { type: "cta", title: "Gotowi wypróbować Klarnote?", sub: "Zarejestruj się i oddaj lekarzom ich czas.", primary: { label: "Zarejestruj się", path: "/signup" }, secondary: { label: "Porozmawiaj z nami", path: "/contact" } },
  de: { type: "cta", title: "Bereit, Klarnote auszuprobieren?", sub: "Registrieren Sie sich und geben Sie Ärzten ihre Zeit zurück.", primary: { label: "Registrieren", path: "/signup" }, secondary: { label: "Sprechen Sie mit uns", path: "/contact" } },
  ro: { type: "cta", title: "Gata să încercați Klarnote?", sub: "Înregistrați-vă și redați medicilor timpul lor.", primary: { label: "Înregistrare", path: "/signup" }, secondary: { label: "Discutați cu noi", path: "/contact" } },
  cs: { type: "cta", title: "Připraveni vyzkoušet Klarnote?", sub: "Zaregistrujte se a vraťte lékařům jejich čas.", primary: { label: "Registrovat se", path: "/signup" }, secondary: { label: "Promluvte si s námi", path: "/contact" } },
  sr: { type: "cta", title: "Spremni da isprobate Klarnote?", sub: "Registrujte se i vratite lekarima njihovo vreme.", primary: { label: "Registrujte se", path: "/signup" }, secondary: { label: "Razgovarajte sa nama", path: "/contact" } },
  hu: { type: "cta", title: "Készen áll a Klarnote kipróbálására?", sub: "Regisztráljon, és adja vissza az orvosok idejét.", primary: { label: "Regisztráció", path: "/signup" }, secondary: { label: "Beszéljen velünk", path: "/contact" } },
};

import { buildCompanyLegal } from "./content-company.js";
import { buildProductPages } from "./content-product.js";
import { buildFeatureDetail } from "./content-features.js";

/* Public resolver used by ContentPage. Returns null for unknown slugs. */
export function getContent(slug, lang) {
  const cta = CTA[lang] ?? CTA.en;
  const m = slug.match(/^features\/(.+)$/);
  if (m) return buildFeatureDetail(m[1], lang, cta);
  return buildCompanyLegal(lang, cta)[slug] || buildProductPages(lang, cta)[slug] || null;
}

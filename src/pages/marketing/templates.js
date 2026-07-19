// templates.js — Registry for the public templates marketplace (/templates).
//
// Marketing-only: this catalogue advertises the note structures Klarnote can
// dictate into. It is NOT the tenant template library (that lives behind auth
// in src/api/templates.js + components/TemplatesPage.jsx and is backend-backed).
// Nothing here is fetched, cloned or written — TemplatesPage.jsx only renders it.
//
// Entry shape (see templates-*.js):
//   { slug, cat, icon, name:{uk,en}, tag:{uk,en}, mins, fields, popular?,
//     about:{uk,en}, bestFor:{uk:[…],en:[…]},
//     sections:[{ name:{uk,en}, sample:{uk,en} }] }
//
// Copy follows the marketing i18n convention: leaf values are language objects
// resolved with an `?? .en` fallback, so untranslated languages degrade to
// English rather than breaking.

import { GENERAL_TEMPLATES } from "./templates-general.js";
import { SPECIALTY_TEMPLATES } from "./templates-specialty.js";
import { IMAGING_TEMPLATES } from "./templates-imaging.js";

/* Filter rail. `key` matches the `cat` field on every catalogue entry; the
   order here is the order of the chips and of the grid. */
export const TEMPLATE_CATEGORIES = [
  { key: "general",      icon: "fileText", label: { uk: "Загальні",        en: "General" } },
  { key: "primary-care", icon: "user",     label: { uk: "Первинна ланка",  en: "Primary care" } },
  { key: "surgical",     icon: "scalpel",  label: { uk: "Хірургія",        en: "Surgical" } },
  { key: "cardiology",   icon: "heart",    label: { uk: "Кардіологія",     en: "Cardiology" } },
  { key: "psychiatry",   icon: "users",    label: { uk: "Психіатрія",      en: "Psychiatry" } },
  { key: "pediatrics",   icon: "heart",    label: { uk: "Педіатрія",       en: "Paediatrics" } },
  { key: "obgyn",        icon: "user",     label: { uk: "Акушерство та гінекологія", en: "Obstetrics & gynaecology" } },
  { key: "dermatology",  icon: "layers",   label: { uk: "Дерматологія",    en: "Dermatology" } },
  { key: "orthopedics",  icon: "bone",     label: { uk: "Ортопедія",       en: "Orthopaedics" } },
  { key: "radiology",    icon: "scan",     label: { uk: "Радіологія",      en: "Radiology" } },
  { key: "dentistry",    icon: "sparkle",  label: { uk: "Стоматологія",    en: "Dentistry" } },
];

/* The whole catalogue, in category order so the unfiltered grid reads sensibly. */
const CAT_ORDER = TEMPLATE_CATEGORIES.map((c) => c.key);

export const TEMPLATES = [...GENERAL_TEMPLATES, ...SPECIALTY_TEMPLATES, ...IMAGING_TEMPLATES]
  .slice()
  .sort((a, b) => CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat));

export const getTemplate = (slug) => TEMPLATES.find((t) => t.slug === slug) || null;

export const categoryLabel = (key, lang) => {
  const c = TEMPLATE_CATEGORIES.find((x) => x.key === key);
  return c ? (c.label[lang] ?? c.label.en) : key;
};

/* Split on anything that isn't a letter or digit, so Cyrillic and Latin
   tokenize the same way. */
const tokenize = (s) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/* Case- and language-insensitive search across the fields a visitor would type:
   name, one-liner, category label and section headings. Both languages are
   always searched, so a Ukrainian visitor can still find "SOAP".
   Terms match at word starts, not anywhere in a word — plain substring search
   makes "dental" hit "incidental" and "КТ" hit "структура". Every term must
   match, which lets a visitor narrow with a second word. */
export function searchTemplates(list, query, lang) {
  const terms = tokenize(query);
  if (!terms.length) return list;
  return list.filter((t) => {
    const tokens = tokenize([
      t.name.uk, t.name.en, t.tag.uk, t.tag.en,
      categoryLabel(t.cat, lang), categoryLabel(t.cat, "en"),
      ...t.sections.flatMap((s) => [s.name.uk, s.name.en]),
    ].join(" "));
    return terms.every((term) => tokens.some((tok) => tok.startsWith(term)));
  });
}

/* Up to `n` other templates to show at the foot of a detail page: same
   category first, then anything else, so a lone-in-its-category entry still
   gets suggestions. */
export function relatedTemplates(tpl, n = 3) {
  if (!tpl) return [];
  const same = TEMPLATES.filter((t) => t.slug !== tpl.slug && t.cat === tpl.cat);
  const rest = TEMPLATES.filter((t) => t.slug !== tpl.slug && t.cat !== tpl.cat);
  return [...same, ...rest].slice(0, n);
}

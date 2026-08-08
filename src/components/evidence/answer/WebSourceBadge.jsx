// WebSourceBadge.jsx — how a web citation identifies itself (EVA-S04).
//
// A corpus source is a document somebody curated, versioned and can point at.
// A web source is a page that said something on a particular day. Those are
// not the same kind of claim, and this component exists so they never look
// like it: the domain and the access date are as prominent as the title,
// because they are what a clinician needs in order to decide how much of the
// answer to believe.
//
// THE LINK IS FLAG-GATED (AC-S04-F-4). With `evidenceExternalLinks` off there
// is not one outbound anchor in the module — not here, not in the drawer. The
// source is still fully described; it simply is not clickable, and a disabled
// "cached copy" affordance stands where the link would. That placeholder is
// not decoration: S08 puts the snapshot behind it, and shipping the slot now
// means a clinic running with egress blocked sees the shape of what it will
// get rather than a source that looks broken.

import React from "react";
import { Icon } from "../../UI.jsx";
import { useI18n } from "../../../i18n.js";
import { FEATURES } from "../../../api/services.js";
import { accessedDate, webHref } from "./sourceView.js";

export function WebSourceBadge({ source }) {
  const { t } = useI18n();
  const web = source?.web;
  if (!web) return null;

  const href = webHref(source, FEATURES.evidenceExternalLinks);
  const accessed = accessedDate(web.accessed_at);

  return (
    <span className="evd-web" data-testid="web-source-badge" data-domain={web.domain}>
      <span className="evd-badge evd-web-domain" data-testid="web-domain">{web.domain}</span>
      {web.trust_tier && (
        <span className="evd-badge evd-web-trust" data-trust={web.trust_tier}>
          {t(`trust.${web.trust_tier}`)}
        </span>
      )}
      {accessed && (
        <span className="evd-web-accessed" data-testid="web-accessed">
          {t("answer.web_accessed_at")} <time dateTime={web.accessed_at}>{accessed}</time>
        </span>
      )}
      {href ? (
        // `noreferrer` as well as `noopener`: a clinical question in a
        // Referer header is the question itself leaving the building.
        <a className="evd-web-link" href={href} target="_blank" rel="noopener noreferrer"
           data-testid="web-link">
          {t("answer.open_source")} <Icon name="arrowRight" size={12} />
        </a>
      ) : (
        <span className="evd-web-cached" data-testid="web-cached"
              title={t("answer.cached_copy_soon")}>
          {t("answer.cached_copy")}
        </span>
      )}
    </span>
  );
}

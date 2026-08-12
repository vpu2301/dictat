// auditKinds.js — the audit event-kind catalogue, for the filter's datalist.
//
// REFERENCE DATA, not mock data: this mirrors the backend's documented kind
// catalogue (medical-dictation-backend/docs/audit/event-kinds.md). The filter
// is a free-text input — the server matches `kind` exactly and accepts values
// this list has never heard of — so a stale entry here costs a suggestion,
// never a result. JSX-free so node --test can load it.

export const AUDIT_KINDS = [
  // auth-service — sessions & identity
  "auth.login",
  "auth.refresh",
  "auth.refresh_replay_detected",
  "auth.logout",
  "auth.reauth_succeeded",
  "auth.reauth_failed",
  "auth.account_locked",
  "auth.mfa.enrolled",
  "auth.session.revoked",
  "authz.denied",
  // users & roles
  "user.invited",
  "user.deactivated",
  "user.reactivated",
  "user.role_changed",
  "user.reset_mfa",
  // tenant
  "tenant.created",
  "tenant.updated",
  "tenant.logo_updated",
  "tenant.member_added",
  "tenant.member_role_changed",
  "tenant.member_removed",
  "tenant.switched",
  // audit itself
  "audit.chain_verified",
  // report-service — templates
  "template.created",
  "template.cloned",
  "template.updated",
  "template.versioned",
  "template.deprecated",
  "template.viewed_full",
  // nlp-service — abbreviations
  "abbreviation.policy.set",
  "abbreviation.policy.deleted",
  // autocomplete-service
  "autocomplete.phrase.created",
  "autocomplete.phrase.deleted",
  "autocomplete.phrase.write_rejected_pii",
  "autocomplete.snippet.created",
  "autocomplete.snippet.deleted",
  "autocomplete.rollup.completed",
  // report-service — synonyms
  "synonym.group.created",
  "synonym.group.updated",
  "synonym.group.deleted",
];

export const AUDIT_SEVERITIES = ["info", "warn", "sec", "error"];

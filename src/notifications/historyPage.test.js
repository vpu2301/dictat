// historyPage.test.js — the dropdown's door to the archive, and the
// archive itself.
//
// The regression this guards is a plain one: the bell popover only ever
// holds the pages already pulled, so if the "See all notifications" link
// disappears from the footer there is no route to the history at all —
// nothing in the sidebar points at /notifications. Grepping the JSX
// cannot tell a rendered footer from a dead branch, so this renders both
// components for real (see src/testing/renderRole.mjs).

import test from "node:test";
import assert from "node:assert/strict";

import { ROLES, renderAs, h } from "../testing/renderRole.mjs";

const { NotificationsProvider } = await import("./store.jsx");
const { NotificationPanel } = await import("../components/NotificationPanel.jsx");
const NotificationsPage = (await import("../pages/NotificationsPage.jsx")).default;

// Effects never run under static rendering, so the provider mounts with
// the initial (empty) feed and no socket is opened.
const withProvider = (element) =>
  renderAs(ROLES.clinician, h(NotificationsProvider, { enabled: true }, element));

test("the dropdown offers a way through to the full history", () => {
  const html = withProvider(h(NotificationPanel, { lang: "en", navigate: () => {} }));
  assert.match(html, /See all notifications/);
  assert.match(html, /nb-panel-foot/);
});

test("the history page renders its filters and an honest empty state", () => {
  const html = withProvider(h(NotificationsPage, { lang: "en", navigate: () => {} }));
  assert.match(html, /No notifications yet/);
  assert.match(html, /All types/);
  assert.match(html, /Unread/);
  // The preferences matrix is a different screen; the page must link to
  // it rather than absorb it.
  assert.match(html, /Preferences/);
});

test("the history page says so when the feature is off, instead of rendering an empty archive", () => {
  const html = renderAs(
    ROLES.clinician,
    h(NotificationsProvider, { enabled: false }, h(NotificationsPage, { lang: "en", navigate: () => {} })),
  );
  assert.match(html, /disabled in this environment/);
});

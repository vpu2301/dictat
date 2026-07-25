// micDevices.test.js — pure helpers behind the Studio microphone picker.
// Run: node --test src/dictation/micDevices.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  isMacPlatform,
  looksLikeIPhone,
  matchPreferred,
  micAudioConstraints,
  normalizeMics,
  selectionFollowsSystemDefault,
  stripDefaultPrefix,
} from "./micDevices.js";

const dev = (deviceId, label, groupId = "", kind = "audioinput") => ({ deviceId, label, groupId, kind });

// A typical Chrome/macOS list with an iPhone paired as a Continuity mic.
const CHROME_MAC = [
  dev("default", "Default - iPhone Microphone", "g-phone"),
  dev("aaa", "MacBook Pro Microphone", "g-built-in"),
  dev("bbb", "iPhone Microphone", "g-phone"),
  dev("ccc", "Speakers", "g-out", "audiooutput"),
];

test("normalizeMics drops pseudo entries and non-inputs", () => {
  const s = normalizeMics([...CHROME_MAC, dev("communications", "Communications", "g-built-in")]);
  assert.deepEqual(s.devices.map((d) => d.deviceId), ["aaa", "bbb"]);
});

test("normalizeMics reads the OS default off the alias entry", () => {
  const s = normalizeMics(CHROME_MAC);
  assert.equal(s.hasDefaultAlias, true);
  assert.equal(s.defaultGroupId, "g-phone");
  assert.equal(s.defaultLabel, "iPhone Microphone");
  assert.equal(s.labelsHidden, false);
});

test("normalizeMics flags a permission-masked list", () => {
  const s = normalizeMics([dev("", "", ""), dev("", "", "", "audiooutput")]);
  assert.equal(s.labelsHidden, true);
  assert.deepEqual(s.devices, []);
});

test("normalizeMics on a browser without a default alias", () => {
  const s = normalizeMics([dev("aaa", "Built-in Microphone", "g1")]);
  assert.equal(s.hasDefaultAlias, false);
  assert.equal(s.defaultLabel, "");
});

test("stripDefaultPrefix handles localised alias labels", () => {
  assert.equal(stripDefaultPrefix("Default - iPhone Microphone"), "iPhone Microphone");
  assert.equal(stripDefaultPrefix("Стандартний - Мікрофон iPhone"), "Мікрофон iPhone");
  assert.equal(stripDefaultPrefix("iPhone Microphone"), "iPhone Microphone");
  assert.equal(stripDefaultPrefix(undefined), "");
});

test("matchPreferred: empty preference means follow the system default", () => {
  const { devices } = normalizeMics(CHROME_MAC);
  assert.deepEqual(matchPreferred(devices, { id: "", label: "" }), { deviceId: "", status: "default" });
});

test("matchPreferred: exact id wins", () => {
  const { devices } = normalizeMics(CHROME_MAC);
  const m = matchPreferred(devices, { id: "bbb", label: "iPhone Microphone" });
  assert.equal(m.status, "ok");
  assert.equal(m.deviceId, "bbb");
});

test("matchPreferred: heals a re-issued deviceId by label", () => {
  const { devices } = normalizeMics(CHROME_MAC);
  const m = matchPreferred(devices, { id: "stale-id", label: "iPhone Microphone" });
  assert.equal(m.status, "healed");
  assert.equal(m.deviceId, "bbb");
});

test("matchPreferred: a departed iPhone falls back to the system default", () => {
  const { devices } = normalizeMics([dev("default", "Default - MacBook Pro Microphone", "g-built-in"), dev("aaa", "MacBook Pro Microphone", "g-built-in")]);
  const m = matchPreferred(devices, { id: "bbb", label: "iPhone Microphone" });
  assert.equal(m.status, "missing");
  assert.equal(m.deviceId, "");
});

test("selectionFollowsSystemDefault: chosen device IS the OS default", () => {
  const s = normalizeMics(CHROME_MAC);
  assert.equal(selectionFollowsSystemDefault(s, "bbb"), true); // iPhone, same groupId as alias
});

test("selectionFollowsSystemDefault: chosen device is NOT the OS default", () => {
  const s = normalizeMics(CHROME_MAC);
  assert.equal(selectionFollowsSystemDefault(s, "aaa"), false); // built-in while default is the iPhone
});

test("selectionFollowsSystemDefault: no nagging when we can't tell", () => {
  const noAlias = normalizeMics([dev("aaa", "Built-in", "g1"), dev("bbb", "USB", "g2")]);
  assert.equal(selectionFollowsSystemDefault(noAlias, "bbb"), true); // no alias entry to compare against
  assert.equal(selectionFollowsSystemDefault(normalizeMics(CHROME_MAC), ""), true); // following the default
  assert.equal(selectionFollowsSystemDefault(normalizeMics(CHROME_MAC), "gone"), true); // device unplugged
});

test("selectionFollowsSystemDefault falls back to label when groupIds are absent", () => {
  const s = normalizeMics([
    dev("default", "Default - USB Mic"),
    dev("aaa", "Built-in Microphone"),
    dev("bbb", "USB Mic"),
  ]);
  assert.equal(selectionFollowsSystemDefault(s, "bbb"), true);
  assert.equal(selectionFollowsSystemDefault(s, "aaa"), false);
});

test("micAudioConstraints pins the device exactly, or omits it entirely", () => {
  assert.deepEqual(micAudioConstraints("bbb").deviceId, { exact: "bbb" });
  assert.equal("deviceId" in micAudioConstraints(""), false);
  const c = micAudioConstraints("");
  assert.equal(c.channelCount, 1);
  assert.equal(c.echoCancellation, true);
  assert.equal(c.noiseSuppression, true);
  assert.equal(c.autoGainControl, true);
});

test("iPhone / macOS detection", () => {
  assert.equal(looksLikeIPhone("iPhone Microphone"), true);
  assert.equal(looksLikeIPhone("Мікрофон iPhone"), true);
  assert.equal(looksLikeIPhone("MacBook Pro Microphone"), false);
  assert.equal(isMacPlatform({ platform: "MacIntel", userAgent: "Mozilla/5.0 (Macintosh)" }), true);
  assert.equal(isMacPlatform({ platform: "iPhone", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)" }), false);
  assert.equal(isMacPlatform({ platform: "Win32", userAgent: "Mozilla/5.0 (Windows NT 10.0)" }), false);
});

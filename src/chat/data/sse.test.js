// chat/data/sse.test.js — the frame parser, under the conditions a socket
// actually produces: split chunks, CRLF, heartbeat comments, multi-line data.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { feedSSE, parseFrame, readSSE } from "./sse.js";

test("a complete frame parses into event and data", () => {
  const { events, rest } = feedSSE("", 'event: partial\ndata: {"delta":"Hi"}\n\n');
  assert.equal(rest, "");
  assert.deepEqual(events, [{ event: "partial", data: { delta: "Hi" } }]);
});

test("a frame split across two chunks is not lost", () => {
  // This is the case that breaks a naive parser, and it happens constantly:
  // the network cares nothing for frame boundaries.
  const first = feedSSE("", 'event: partial\ndata: {"del');
  assert.deepEqual(first.events, []);
  const second = feedSSE(first.rest, 'ta":"Hi"}\n\nevent: done\ndata: {}\n\n');
  assert.deepEqual(second.events, [
    { event: "partial", data: { delta: "Hi" } },
    { event: "done", data: {} },
  ]);
});

test("heartbeat comments are not events", () => {
  // The backend sends one every 15s while the model is thinking. A client that
  // treats them as messages will act on an empty frame mid-answer.
  const { events } = feedSSE("", ": heartbeat 2026-08-06T12:00:00Z\n\nevent: done\ndata: {}\n\n");
  assert.deepEqual(events, [{ event: "done", data: {} }]);
});

test("CRLF line endings parse the same as LF", () => {
  const { events } = feedSSE("", 'event: status\r\ndata: {"stage":"searching"}\r\n\r\n');
  assert.deepEqual(events, [{ event: "status", data: { stage: "searching" } }]);
});

test("multi-line data is rejoined before it is parsed", () => {
  const frame = parseFrame('event: final\ndata: {"response":\ndata: {"answer_md":"x"}}');
  assert.deepEqual(frame.data, { response: { answer_md: "x" } });
});

test("data with no leading space is still read", () => {
  assert.deepEqual(parseFrame('event:partial\ndata:{"delta":"x"}').data, { delta: "x" });
});

test("a frame whose data is not JSON is surfaced, not silently emptied", () => {
  const frame = parseFrame("event: error\ndata: upstream exploded");
  assert.deepEqual(frame, { event: "error", data: { raw: "upstream exploded" } });
});

test("readSSE yields frames in order from a streaming body", async () => {
  const chunks = [
    'event: stream_started\ndata: {"stream_id":"s1"}\n\n',
    ": heartbeat 1\n\nevent: partial\ndata: ",
    '{"delta":"He"}\n\nevent: partial\ndata: {"delta":"llo"}\n\n',
    // No trailing blank line: a server that closes abruptly still owes us this.
    'event: done\ndata: {}',
  ];
  const encoder = new TextEncoder();
  let i = 0;
  const response = {
    body: {
      getReader: () => ({
        read: async () => (i < chunks.length
          ? { value: encoder.encode(chunks[i++]), done: false }
          : { value: undefined, done: true }),
        releaseLock() {},
      }),
    },
  };

  const seen = [];
  for await (const evt of readSSE(response)) seen.push(evt);
  assert.deepEqual(seen.map((e) => e.event), ["stream_started", "partial", "partial", "done"]);
  assert.equal(seen[1].data.delta + seen[2].data.delta, "Hello");
});

test("a non-streaming response still yields its frames", async () => {
  // A test double or an environment without ReadableStream must not silently
  // produce an empty answer.
  const response = { text: async () => 'event: final\ndata: {"response":{"answer_md":"x"}}' };
  const seen = [];
  for await (const evt of readSSE(response)) seen.push(evt);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].data.response.answer_md, "x");
});

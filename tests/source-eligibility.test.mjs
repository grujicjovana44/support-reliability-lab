import assert from "node:assert/strict";
import test from "node:test";
import { answer } from "../dist/app.js";

const topic = "returns";
const archivedDocument = {
  id: "returns-archived",
  revision: "1",
  topic,
  state: "archived",
  text: "Returns are accepted within 30 days."
};
const activeDocument = {
  id: "returns-active",
  revision: "2",
  topic,
  state: "active",
  text: "Returns are accepted within 10 days."
};

function runPolicy(documents) {
  let modelCalls = 0;
  const result = answer({ kind: "policy", topic }, {
    documents,
    lookup: () => undefined,
    model: source => {
      modelCalls++;
      return `Policy: ${source.text}`;
    }
  });
  return { result, modelCalls };
}

test("selects the active document when the archived document comes first", () => {
  const { result, modelCalls } = runPolicy([archivedDocument, activeDocument]);

  assert.equal(result.status, "ok");
  assert.equal(result.text, "Policy: Returns are accepted within 10 days.");
  assert.deepEqual(result.citations, ["returns-active"]);
  assert.ok(!result.citations.includes("returns-archived"));
  assert.equal(modelCalls, 1);
  assert.ok(result.trace.some(event => event.stage === "retrieval" && event.sourceId === "returns-active"));
});

test("selects the active document when it comes first", () => {
  const { result, modelCalls } = runPolicy([activeDocument, archivedDocument]);

  assert.equal(result.status, "ok");
  assert.equal(result.text, "Policy: Returns are accepted within 10 days.");
  assert.deepEqual(result.citations, ["returns-active"]);
  assert.ok(!result.citations.includes("returns-archived"));
  assert.equal(modelCalls, 1);
  assert.ok(result.trace.some(event => event.stage === "retrieval" && event.sourceId === "returns-active"));
});

test("refuses when only archived documents exist for the topic", () => {
  const { result, modelCalls } = runPolicy([archivedDocument]);

  assert.equal(result.status, "refused");
  assert.deepEqual(result.citations, []);
  assert.equal(modelCalls, 0);
  assert.ok(!result.trace.some(event => event.stage === "retrieval"));
});

test("refuses when the only active document belongs to another topic", () => {
  const otherTopicDocument = {
    id: "shipping-active",
    revision: "1",
    topic: "shipping",
    state: "active",
    text: "Shipping takes 3 days."
  };
  const { result, modelCalls } = runPolicy([otherTopicDocument]);

  assert.equal(result.status, "refused");
  assert.equal(modelCalls, 0);
});

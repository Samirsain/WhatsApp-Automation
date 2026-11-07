import assert from "node:assert/strict";
import test from "node:test";
import { byStageThenNewest, deliveryLabel, matchesSearch, matchRange, search, stepOf } from "./funnel-list";

const c = { leadNumber: 42, name: "Riya Sharma", phoneE164: "+919876543210" };

test("search matches name, number and lead ID", () => {
  assert.ok(matchesSearch(c, ""));
  assert.ok(matchesSearch(c, "riya"));
  assert.ok(matchesSearch(c, "98765"));
  assert.ok(matchesSearch(c, "+91 98765"));
  assert.ok(matchesSearch(c, "L-0042"));
  assert.ok(matchesSearch(c, "l42"));
  assert.ok(!matchesSearch(c, "amit"));
  assert.ok(!matchesSearch(c, "11111"));
});

test("3/3 comes first, then 2/3, then 1/3; newest first inside a stage", () => {
  const d = (n: number) => new Date(2026, 10, n);
  const rows = [
    { id: "a", step: 1, createdAt: d(5) },
    { id: "b", step: 3, createdAt: d(1) },
    { id: "c", step: 2, createdAt: d(2) },
    { id: "d", step: 3, createdAt: d(4) },
  ];
  assert.deepEqual(rows.sort(byStageThenNewest).map((r) => r.id), ["d", "b", "c", "a"]);
});

test("only three delivery words", () => {
  assert.equal(deliveryLabel("READ"), "Seen");
  assert.equal(deliveryLabel("DELIVERED"), "Delivered");
  for (const s of ["SENT", "QUEUED", "FAILED"]) assert.equal(deliveryLabel(s), "Not delivered");
});

test("step defaults to 1", () => {
  assert.equal(stepOf(null), 1);
  assert.equal(stepOf({ step: 3 }), 3);
});

test("best match first: name start beats name middle, ties keep stage order", () => {
  const people = [
    { leadNumber: 1, name: "Arjun Kumar", phoneE164: "+919800000001" },
    { leadNumber: 2, name: "Kumar Raj", phoneE164: "+919800000002" },
    { leadNumber: 3, name: "Ravi Kumarswamy", phoneE164: "+919800000003" },
    { leadNumber: 4, name: "Amit", phoneE164: "+919800000004" },
  ];
  assert.deepEqual(search(people, "kum", (c) => c).map((c) => c.leadNumber), [2, 1, 3]);
  assert.deepEqual(search(people, "", (c) => c).length, 4);
});

test("number search: the whole number first, then starts-with, then anywhere", () => {
  const people = [
    { leadNumber: 1, name: "A", phoneE164: "+919123498765" },
    { leadNumber: 2, name: "B", phoneE164: "+919876512345" },
    { leadNumber: 3, name: "C", phoneE164: "+919876543210" },
  ];
  assert.deepEqual(search(people, "98765", (c) => c).map((c) => c.leadNumber), [2, 3, 1]);
  assert.deepEqual(search(people, "9876543210", (c) => c).map((c) => c.leadNumber), [3]);
});

test("highlight finds the typed part, numbers through spaces and +", () => {
  assert.deepEqual(matchRange("Riya Sharma", "sha", "name"), [5, 8]);
  assert.deepEqual(matchRange("+919876543210", "98765", "number"), [3, 8]);
  assert.deepEqual(matchRange("+91 98765 43210", "6543", "number"), [7, 12]);
  assert.equal(matchRange("Riya", "amit", "name"), null);
  assert.equal(matchRange("+919876543210", "riya", "number"), null);
});

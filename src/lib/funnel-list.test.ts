import assert from "node:assert/strict";
import test from "node:test";
import { byStageThenNewest, deliveryLabel, matchesSearch, stepOf } from "./funnel-list";

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

import assert from "node:assert/strict";
import test from "node:test";
import { computeFunds, istDayStart, parseTopups, sumSpend } from "./funds";

const analytics = {
  pricing_analytics: {
    data: [
      {
        data_points: [
          { start: 1, end: 2, pricing_category: "MARKETING", volume: 3, cost: 2.5893 },
          { start: 1, end: 2, pricing_category: "SERVICE", volume: 3, cost: 0 },
          { start: 2, end: 3, pricing_category: "MARKETING", volume: 1, cost: 0.8631 },
        ],
      },
    ],
  },
};

test("sumSpend adds cost and counts marketing messages", () => {
  assert.deepEqual(sumSpend(analytics), { spent: 3.4524, marketing: 4 });
  assert.deepEqual(sumSpend({}), { spent: 0, marketing: 0 });
});

test("computeFunds: left, per-message rate and messages left", () => {
  const f = computeFunds({ added: 100, spent: 3.4524, marketing: 4 });
  assert.equal(f.left, 96.55);
  assert.equal(f.perMessage, 0.86);
  assert.equal(f.messagesLeft, 112);
});

test("computeFunds falls back to a default rate before any spend, and never goes below zero", () => {
  const fresh = computeFunds({ added: 100, spent: 0, marketing: 0 });
  assert.equal(fresh.perMessage, 0.86);
  assert.equal(fresh.messagesLeft, 116);
  const over = computeFunds({ added: 1, spent: 5, marketing: 5 });
  assert.equal(over.left, 0);
  assert.equal(over.messagesLeft, 0);
});

test("parseTopups keeps only valid positive amounts", () => {
  const list = parseTopups([
    { amount: 100, at: "2026-09-26T05:00:00.000Z" },
    { amount: -5, at: "2026-09-26T05:00:00.000Z" },
    { amount: "x", at: "y" },
    null,
  ]);
  assert.deepEqual(list, [{ amount: 100, at: "2026-09-26T05:00:00.000Z" }]);
  assert.deepEqual(parseTopups(null), []);
});

test("istDayStart snaps to midnight India time, the day boundary Meta buckets spend by", () => {
  assert.equal(istDayStart(new Date("2026-09-26T07:30:00Z")).toISOString(), "2026-09-25T18:30:00.000Z");
  assert.equal(istDayStart(new Date("2026-09-25T19:00:00Z")).toISOString(), "2026-09-25T18:30:00.000Z");
  assert.equal(istDayStart(new Date("2026-09-25T18:00:00Z")).toISOString(), "2026-09-24T18:30:00.000Z");
});

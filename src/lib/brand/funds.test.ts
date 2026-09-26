import assert from "node:assert/strict";
import test from "node:test";
import { computeBalance, fundsStatus, istDayStart, istMonthStart, parseBalance, spendSince } from "./funds";

const analytics = {
  pricing_analytics: {
    data: [
      {
        data_points: [
          { start: 100, end: 200, pricing_category: "MARKETING", volume: 3, cost: 2.5893 },
          { start: 100, end: 200, pricing_category: "SERVICE", volume: 3, cost: 0 },
          { start: 200, end: 300, pricing_category: "MARKETING", volume: 1, cost: 0.8631 },
        ],
      },
    ],
  },
};

test("spendSince adds cost and marketing volume of buckets starting at or after the cut-off", () => {
  assert.deepEqual(spendSince(analytics, 0), { spent: 3.45, marketing: 4 });
  assert.deepEqual(spendSince(analytics, 200), { spent: 0.86, marketing: 1 });
  assert.deepEqual(spendSince({}, 0), { spent: 0, marketing: 0 });
});

test("istDayStart snaps to midnight India time, the day boundary Meta buckets spend by", () => {
  assert.equal(istDayStart(new Date("2026-09-26T07:30:00Z")).toISOString(), "2026-09-25T18:30:00.000Z");
  assert.equal(istDayStart(new Date("2026-09-25T19:00:00Z")).toISOString(), "2026-09-25T18:30:00.000Z");
  assert.equal(istDayStart(new Date("2026-09-25T18:00:00Z")).toISOString(), "2026-09-24T18:30:00.000Z");
});

test("istMonthStart is the 1st of the month, midnight India time", () => {
  assert.equal(istMonthStart(new Date("2026-09-26T07:30:00Z")).toISOString(), "2026-08-31T18:30:00.000Z");
  assert.equal(istMonthStart(new Date("2026-09-30T19:00:00Z")).toISOString(), "2026-09-30T18:30:00.000Z");
});

test("fundsStatus: out only when the latest marketing send failed for payment", () => {
  assert.equal(fundsStatus({ failureCode: "131042" }), "out");
  assert.equal(fundsStatus({ failureCode: null }), "ok");
  assert.equal(fundsStatus({ failureCode: "131049" }), "ok");
  assert.equal(fundsStatus(null), "unknown");
});

test("computeBalance: left, messages left, and red below ₹50", () => {
  const b = computeBalance({ baseline: 99.99, spent: 9.49, marketing: 11 });
  assert.equal(b.left, 90.5);
  assert.equal(b.perMessage, 0.86);
  assert.equal(b.messagesLeft, 105);
  assert.equal(b.low, false);
  assert.equal(computeBalance({ baseline: 55, spent: 5.01, marketing: 6 }).low, true);
  assert.equal(computeBalance({ baseline: 50, spent: 0, marketing: 0 }).low, false);
  const over = computeBalance({ baseline: 1, spent: 5, marketing: 5 });
  assert.equal(over.left, 0);
  assert.equal(over.messagesLeft, 0);
  assert.equal(computeBalance({ baseline: 100, spent: 0, marketing: 0 }).perMessage, 0.86);
});

test("parseBalance accepts only a positive amount with a valid date", () => {
  assert.deepEqual(parseBalance({ amount: 99.99, at: "2026-09-26T00:00:00.000Z" }), { amount: 99.99, at: "2026-09-26T00:00:00.000Z" });
  assert.equal(parseBalance({ amount: -1, at: "2026-09-26T00:00:00.000Z" }), null);
  assert.equal(parseBalance({ amount: 5, at: "nope" }), null);
  assert.equal(parseBalance(null), null);
});

import assert from "node:assert/strict";
import test from "node:test";
import { leadId } from "./lead-id";

test("small numbers are padded to four digits", () => {
  assert.equal(leadId(1), "L-0001");
  assert.equal(leadId(42), "L-0042");
});

test("numbers past 9999 keep every digit", () => {
  assert.equal(leadId(12345), "L-12345");
});

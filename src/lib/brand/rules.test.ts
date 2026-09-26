import assert from "node:assert/strict";
import test from "node:test";
import { parseNumberList } from "../numbers/parse-list";
import {
  failureAction, failureReason, isBrandReply, isFirstBrandTap, retryDueAt,
  rowsToText, RETRY_AFTER_MS,
} from "./rules";
import { BRAND_TEMPLATES, pickTemplate, thankYouText } from "./templates";

const brand = { kind: "brand", template: "property_brand_1", image: "x", name: "A" };

test("pickTemplate returns each of the three at the edges of the range", () => {
  assert.equal(pickTemplate(() => 0).template, "property_brand_1");
  assert.equal(pickTemplate(() => 0.5).template, "property_brand_2");
  assert.equal(pickTemplate(() => 0.9999).template, "property_brand_3");
  assert.equal(pickTemplate(() => 1).template, "property_brand_3");
  assert.equal(BRAND_TEMPLATES.length, 3);
});

test("thank-you uses the name when known and falls back cleanly", () => {
  assert.match(thankYouText("Samir"), /^धन्यवाद Samir जी/);
  assert.match(thankYouText(null), /^धन्यवाद जी/);
  assert.match(thankYouText("  "), /^धन्यवाद जी/);
});

test("isBrandReply matches button text, payload, case and spaces only for BRAND", () => {
  assert.equal(isBrandReply("BRAND"), true);
  assert.equal(isBrandReply(" brand "), true);
  assert.equal(isBrandReply("", "BRAND"), true);
  assert.equal(isBrandReply("Hi"), false);
  assert.equal(isBrandReply("brand please"), false);
});

test("retryDueAt only for a first-time 131049 brand failure", () => {
  const at = new Date("2026-09-26T05:00:00Z");
  assert.equal(retryDueAt("131049", brand, at)?.getTime(), at.getTime() + RETRY_AFTER_MS);
  assert.equal(retryDueAt("131026", brand, at), null);
  assert.equal(retryDueAt(undefined, brand, at), null);
  assert.equal(retryDueAt("131049", { ...brand, retryOf: "m1" }, at), null);
  assert.equal(retryDueAt("131049", { kind: "brand_thanks" }, at), null);
  assert.equal(retryDueAt("131049", null, at), null);
});

test("failure reasons are plain Hindi and unknown codes show the code", () => {
  assert.match(failureReason("131049"), /Meta ne roka/);
  assert.match(failureReason("131026"), /WhatsApp/);
  assert.equal(failureReason("999"), "Meta ne bheja nahi (code 999)");
  assert.equal(failureReason(null), "Meta ne bheja nahi");
});

test("failure action: auto while a retry is pending, none when opted out", () => {
  assert.equal(failureAction("131049", new Date()), "auto");
  assert.equal(failureAction("131049", null), "resend");
  assert.equal(failureAction("131050", null), "none");
  assert.equal(failureAction("131026", null), "resend");
});

test("rowsToText keeps comma names whole and parseNumberList reads them", () => {
  const text = rowsToText([
    { name: "Sharma, Rahul", number: "98765 43210" },
    { name: "", number: "" },
    { name: "", number: "9812345678" },
  ]);
  const parsed = parseNumberList(text);
  assert.equal(parsed.valid.length, 2);
  assert.equal(parsed.valid[0].name, "Sharma, Rahul");
  assert.equal(parsed.valid[0].e164, "+919876543210");
  assert.equal(parsed.valid[1].name, null);
});

test("a CSV header row is skipped by parseNumberList", () => {
  const parsed = parseNumberList("name,number\nRahul,9876543210");
  assert.equal(parsed.valid.length, 1);
  assert.equal(parsed.rejected.length, 0);
});

test("only the first BRAND tap qualifies", () => {
  assert.equal(isFirstBrandTap(null), true);
  assert.equal(isFirstBrandTap(new Date()), false);
});

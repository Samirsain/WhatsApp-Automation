import assert from "node:assert/strict";
import test from "node:test";
import { parseNumberList } from "../numbers/parse-list";
import {
  failureAction, failureReason, isBrandReply, retryDueAt,
  csvCell, parseCsvRows, rowsToText, RETRY_AFTER_MS,
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

test("thank-you puts the name in capitals when known and falls back cleanly", () => {
  assert.equal(
    thankYouText("Samir"),
    "धन्यवाद SAMIR जी 🙏\nहमारी टीम जल्द ही आपसे संपर्क करेगी। ✅\n3% Real Estate Club",
  );
  assert.match(thankYouText(null), /^धन्यवाद 🙏\n/);
  assert.match(thankYouText("  "), /^धन्यवाद 🙏\n/);
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

test("failure reasons are plain English and unknown codes show the code", () => {
  assert.match(failureReason("131049"), /Blocked by Meta/);
  assert.match(failureReason("131026"), /WhatsApp/);
  assert.match(failureReason("190"), /access token/);
  assert.equal(failureReason("999"), "Not delivered by Meta (code 999)");
  assert.equal(failureReason(null), "Not delivered by Meta");
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


test("csvCell neutralises spreadsheet formulas and keeps phones as text", () => {
  assert.equal(csvCell('=HYPERLINK("http://x","y")'), `"'=HYPERLINK(""http://x"",""y"")"`);
  assert.equal(csvCell("@cmd"), "'@cmd");
  assert.equal(csvCell("-2+3"), "'-2+3");
  assert.equal(csvCell("+919876543210"), "'+919876543210");
  assert.equal(csvCell("Sharma, Rahul"), '"Sharma, Rahul"');
  assert.equal(csvCell(null), "");
  assert.equal(csvCell("Rahul"), "Rahul");
});

test("parseCsvRows picks the number column, strips quotes, handles ; and counts skips", () => {
  const { rows, skipped } = parseCsvRows(
    [
      "﻿name,number,city",
      "Rahul,9876543210,Jaipur",
      '"Sharma, Rahul",9812345678,',
      "Priya;9123456789",
      "no number here,,",
      "",
    ].join("\r\n"),
  );
  assert.deepEqual(rows, [
    { name: "Rahul", number: "9876543210" },
    { name: "Sharma, Rahul", number: "9812345678" },
    { name: "Priya", number: "9123456789" },
  ]);
  assert.equal(skipped, 2); // the header row and the row with no number
});

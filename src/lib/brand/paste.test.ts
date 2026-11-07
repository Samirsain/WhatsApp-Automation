import assert from "node:assert/strict";
import test from "node:test";
import { applyPaste, parsePaste } from "./paste";

test("Excel Name + Number columns fill name and number", () => {
  const text = "Rahul\t9876543210\r\nPriya Sharma\t+91 98123 45678\r\n";
  assert.deepEqual(parsePaste(text, "name"), [
    { name: "Rahul", number: "9876543210" },
    { name: "Priya Sharma", number: "+91 98123 45678" },
  ]);
});

test("columns the other way round (Number, Name) still land right", () => {
  assert.deepEqual(parsePaste("9876543210\tRahul\n9812345678\tAmit", "number"), [
    { name: "Rahul", number: "9876543210" },
    { name: "Amit", number: "9812345678" },
  ]);
});

test("a header row is skipped", () => {
  assert.deepEqual(parsePaste("Name\tMobile Number\nRahul\t9876543210\nAmit\t9812345678", "name"), [
    { name: "Rahul", number: "9876543210" },
    { name: "Amit", number: "9812345678" },
  ]);
});

test("extra columns (S.No, city) are ignored", () => {
  assert.deepEqual(parsePaste("1\tRahul\t9876543210\tDelhi\n2\tAmit\t9812345678\tPune", "name"), [
    { name: "Rahul", number: "9876543210" },
    { name: "Amit", number: "9812345678" },
  ]);
});

test("plain lines: comma, dash or space between name and number", () => {
  assert.deepEqual(parsePaste("Rahul, 9876543210\n9812345678 - Amit Verma\nNeha 99001 12233", "name"), [
    { name: "Rahul", number: "9876543210" },
    { name: "Amit Verma", number: "9812345678" },
    { name: "Neha", number: "99001 12233" },
  ]);
});

test("a single column goes down the box it was pasted into", () => {
  assert.deepEqual(parsePaste("Rahul\nAmit\nNeha", "name"), [{ name: "Rahul" }, { name: "Amit" }, { name: "Neha" }]);
  assert.deepEqual(parsePaste("9876543210\n9812345678", "number"), [{ number: "9876543210" }, { number: "9812345678" }]);
  // Numbers pasted under Name still go to Number.
  assert.deepEqual(parsePaste("9876543210\n9812345678", "name"), [{ number: "9876543210" }, { number: "9812345678" }]);
});

test("one plain value is a normal paste; one name+number line is a row", () => {
  assert.equal(parsePaste("Rahul", "name"), null);
  assert.equal(parsePaste("9876543210", "number"), null);
  assert.deepEqual(parsePaste("Rahul 9876543210", "name"), [{ name: "Rahul", number: "9876543210" }]);
});

test("pasted rows overwrite from the row pasted into and add rows as needed", () => {
  const rows = [
    { name: "Keep", number: "9000000000" },
    { name: "", number: "" },
  ];
  assert.deepEqual(applyPaste(rows, 1, [{ name: "A", number: "1" }, { name: "B", number: "2" }]), [
    { name: "Keep", number: "9000000000" },
    { name: "A", number: "1" },
    { name: "B", number: "2" },
  ]);
  // A names-only paste keeps the numbers already typed.
  assert.deepEqual(applyPaste([{ name: "", number: "9000000000" }], 0, [{ name: "Riya" }]), [{ name: "Riya", number: "9000000000" }]);
});

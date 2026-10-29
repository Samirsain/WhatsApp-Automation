import assert from "node:assert/strict";
import test from "node:test";
import { LEAD_STAGES, parseStage, STAGE_LABELS } from "./stages";

test("three stages in working order, each with a label", () => {
  assert.deepEqual(LEAD_STAGES, ["NEW", "NOT_INTERESTED", "MEMBER_ADDED"]);
  assert.equal(STAGE_LABELS.NOT_INTERESTED, "Not interested");
  assert.equal(STAGE_LABELS.MEMBER_ADDED, "Member added");
});

test("parseStage accepts only a known stage", () => {
  assert.equal(parseStage("MEMBER_ADDED"), "MEMBER_ADDED");
  assert.equal(parseStage("ONBOARDING"), null);
  assert.equal(parseStage("member_added"), null);
  assert.equal(parseStage(""), null);
  assert.equal(parseStage(undefined), null);
  assert.equal(parseStage("DROP TABLE"), null);
});

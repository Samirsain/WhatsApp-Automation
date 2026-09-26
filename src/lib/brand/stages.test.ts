import assert from "node:assert/strict";
import test from "node:test";
import { LEAD_STAGES, parseStage, STAGE_LABELS } from "./stages";

test("four stages in working order, each with a label", () => {
  assert.deepEqual(LEAD_STAGES, ["NEW", "INTERESTED", "ONBOARDING", "NOT_INTERESTED"]);
  assert.equal(STAGE_LABELS.NOT_INTERESTED, "Not interested");
});

test("parseStage accepts only a known stage", () => {
  assert.equal(parseStage("ONBOARDING"), "ONBOARDING");
  assert.equal(parseStage("onboarding"), null);
  assert.equal(parseStage(""), null);
  assert.equal(parseStage(undefined), null);
  assert.equal(parseStage("DROP TABLE"), null);
});

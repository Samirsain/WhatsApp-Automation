import assert from "node:assert/strict";
import test from "node:test";
import { parseLogin } from "./login";

test("a username or an email signs in, lower-cased and trimmed", () => {
  assert.deepEqual(parseLogin({ email: " 3%Club ", password: "x" }), { login: "3%club", password: "x" });
  assert.deepEqual(parseLogin({ email: "Admin@3percent.local", password: "x" }), {
    login: "admin@3percent.local",
    password: "x",
  });
});

test("empty login or password is refused", () => {
  assert.equal(parseLogin({ email: "  ", password: "x" }), null);
  assert.equal(parseLogin({ email: "3%club", password: "" }), null);
  assert.equal(parseLogin(undefined), null);
});

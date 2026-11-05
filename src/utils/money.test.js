import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSplit, balanceDelta, simplifyDebts, sum } from "./money.js";

test("equal split distributes leftover paise", () => {
  const s = computeSplit(1000, "equal", { a: 1, b: 1, c: 1, d: 0 });
  assert.deepEqual(s, { a: 334, b: 333, c: 333 });
});

test("exact must add up", () => {
  assert.deepEqual(computeSplit(1000, "exact", { a: 6, b: 4 }), { a: 600, b: 400 });
  assert.throws(() => computeSplit(1000, "exact", { a: 6, b: 3 }), /left/);
});

test("percent must total 100", () => {
  assert.equal(sum(computeSplit(999, "percent", { a: 33.33, b: 33.33, c: 33.34 })), 999);
  assert.throws(() => computeSplit(1000, "percent", { a: 50, b: 40 }), /100%/);
});

test("shares split by weight", () => {
  assert.deepEqual(computeSplit(900, "shares", { a: 2, b: 1 }), { a: 600, b: 300 });
});

test("delta and simplify", () => {
  const d = balanceDelta({ paidBy: { a: 900 }, split: { a: 300, b: 300, c: 300 } });
  assert.deepEqual(d, { a: 600, b: -300, c: -300 });
  const debts = simplifyDebts(d);
  assert.equal(debts.length, 2);
  assert.ok(debts.every((x) => x.to === "a" && x.amount === 300));
  assert.deepEqual(simplifyDebts({ a: 0 }), []);
});

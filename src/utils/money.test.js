import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSplit, balanceDelta, simplifyDebts, sum, aggregateFriendBalances, friendGroupDebts, pairDelta, groupDebts } from "./money.js";
import { contactsOf } from "./helpers.js";

const addInto = (acc, d) => {
  for (const [k, v] of Object.entries(d)) acc[k] = (acc[k] || 0) + v;
  return acc;
};

test("pairwise debts: each person owes the actual payer", () => {
  // a=Ayan paid 300 split 3 ways; s=Sayan paid 600 split 3 ways; v=Souvik paid nothing.
  const e1 = { paidBy: { a: 30000 }, split: { a: 10000, s: 10000, v: 10000 } };
  const e2 = { paidBy: { s: 60000 }, split: { a: 20000, s: 20000, v: 20000 } };
  const pairs = addInto(addInto({}, pairDelta(e1)), pairDelta(e2));
  const debts = groupDebts({ pairs, balances: {} });
  assert.deepEqual(debts, [
    { from: "v", to: "s", amount: 20000 },
    { from: "a", to: "s", amount: 10000 },
    { from: "v", to: "a", amount: 10000 },
  ]);
  // Toggle on → same balances, fewest transfers.
  const balances = addInto(addInto({}, balanceDelta(e1)), balanceDelta(e2));
  assert.deepEqual(groupDebts({ pairs, balances, simplify: true }), [{ from: "v", to: "s", amount: 30000 }]);
  // A payment v → s for 200 clears that pair; reversing it (delete) restores it.
  const pay = { paidBy: { v: 20000 }, split: { s: 20000 } };
  addInto(pairs, pairDelta(pay));
  assert.equal(groupDebts({ pairs }).some((d) => d.from === "v" && d.to === "s"), false);
  addInto(pairs, pairDelta(pay, -1));
  assert.deepEqual(groupDebts({ pairs })[0], { from: "v", to: "s", amount: 20000 });
});

test("pairwise with multiple payers stays exact to the paisa", () => {
  const e = { paidBy: { a: 700, b: 300 }, split: { a: 333, b: 333, c: 334 } };
  const debts = groupDebts({ pairs: pairDelta(e) });
  assert.deepEqual(debts, [
    { from: "c", to: "a", amount: 334 },
    { from: "b", to: "a", amount: 33 },
  ]);
  // Pairwise nets agree with the per-person balances.
  const net = {};
  for (const { from, to, amount } of debts) addInto(net, { [to]: amount, [from]: -amount });
  assert.deepEqual(net, balanceDelta(e));
});

test("groups without pairs fall back to simplified", () => {
  assert.deepEqual(groupDebts({ balances: { a: 100, b: -100 } }), [{ from: "b", to: "a", amount: 100 }]);
});

test("contacts: unique, without me, sorted by name", () => {
  const groups = [
    { memberIds: ["me", "b", "a"], members: { me: { name: "Me", email: "me@x.in" }, b: { name: "Bea", email: "b@x.in" }, a: { name: "Ann", email: "a@x.in" } } },
    { memberIds: ["me", "a"], members: { me: { name: "Me", email: "me@x.in" }, a: { name: "Ann", email: "a@x.in" } }, deleted: true },
  ];
  assert.deepEqual(contactsOf("me", groups).map((c) => c.uid), ["a", "b"]);
});

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

test("aggregate friend balances across groups", () => {
  const groups = [
    { memberIds: ["me", "bob"], balances: { me: 500, bob: -500 } },
    { memberIds: ["me", "bob"], balances: { me: -200, bob: 200 } },
  ];
  assert.deepEqual(aggregateFriendBalances("me", groups), { bob: 300 });
  const per = friendGroupDebts("me", "bob", [...groups, { memberIds: ["me", "cy"], balances: { me: 100, cy: -100 } }]);
  assert.deepEqual(per.map((p) => p.net), [500, -200]);
});

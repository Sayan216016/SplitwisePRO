// All amounts are integer paise (₹1 = 100) to avoid float drift.

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export const toPaise = (rupees) => Math.round(Number(rupees) * 100);
export const formatINR = (paise) => inr.format((paise || 0) / 100);
export const sum = (obj) => Object.values(obj).reduce((s, v) => s + v, 0);

// Integer split by weights; leftover paise go to the first people so the total is exact.
export function splitByWeights(total, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const totalWeight = entries.reduce((s, [, w]) => s + w, 0);
  if (!totalWeight) throw new Error("Pick at least one person to split with");
  const out = {};
  let used = 0;
  for (const [uid, w] of entries) {
    out[uid] = Math.floor((total * w) / totalWeight);
    used += out[uid];
  }
  for (let i = 0; used < total; i++, used++) out[entries[i % entries.length][0]]++;
  return out;
}

// input is { uid: number } — equal: 1/0, exact: rupees, percent: %, shares: count.
export function computeSplit(total, type, input) {
  if (Object.values(input).some((v) => v < 0 || !Number.isFinite(v))) throw new Error("Values can't be negative");
  if (type === "exact") {
    const out = Object.fromEntries(
      Object.entries(input).map(([uid, v]) => [uid, toPaise(v)]).filter(([, p]) => p > 0),
    );
    const diff = total - sum(out);
    if (diff) throw new Error(`Amounts must add up — ${formatINR(Math.abs(diff))} ${diff > 0 ? "left" : "over"}`);
    return out;
  }
  if (type === "percent") {
    const pct = sum(input);
    if (Math.abs(pct - 100) > 0.001) throw new Error(`Percentages must total 100% — now ${+pct.toFixed(2)}%`);
  }
  const weights = Object.fromEntries(Object.entries(input).map(([uid, v]) => [uid, Math.round(v * 100)]));
  return splitByWeights(total, weights);
}

export function validateExpense({ amount, paidBy, split }) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Enter an amount above ₹0");
  if (sum(paidBy) !== amount) throw new Error("Payments must add up to the total");
  if (sum(split) !== amount) throw new Error("Split must add up to the total");
}

// Net effect on each person's balance: positive = is owed money.
export function balanceDelta({ paidBy, split }, sign = 1) {
  const out = {};
  for (const [uid, p] of Object.entries(paidBy)) out[uid] = (out[uid] || 0) + sign * p;
  for (const [uid, p] of Object.entries(split)) out[uid] = (out[uid] || 0) - sign * p;
  return out;
}

/** Net paise per friend across shared groups (positive = they owe you). Uses group balances only. */
export function aggregateFriendBalances(myUid, groups) {
  const net = {};
  for (const g of groups) {
    if (!g.balances || !g.memberIds?.includes(myUid)) continue;
    for (const { from, to, amount } of simplifyDebts(g.balances)) {
      if (from === myUid) net[to] = (net[to] || 0) - amount;
      else if (to === myUid) net[from] = (net[from] || 0) + amount;
    }
  }
  return net;
}

/** Per shared group: the simplified debt between you and one friend (net > 0 = they owe you). */
export function friendGroupDebts(myUid, friendUid, groups) {
  return groups
    .filter((g) => g.memberIds?.includes(myUid) && g.memberIds.includes(friendUid))
    .map((group) => {
      const debt = simplifyDebts(group.balances || {}).find((d) =>
        (d.from === myUid && d.to === friendUid) || (d.from === friendUid && d.to === myUid)) || null;
      return { group, debt, net: !debt ? 0 : debt.to === myUid ? debt.amount : -debt.amount };
    });
}

// Greedy: biggest debtor pays biggest creditor. At most n-1 transfers.
export function simplifyDebts(balances) {
  const people = Object.entries(balances).filter(([, b]) => b !== 0).map(([uid, b]) => ({ uid, b }));
  const debts = [];
  for (;;) {
    people.sort((x, y) => x.b - y.b);
    const debtor = people[0];
    const creditor = people[people.length - 1];
    if (!debtor || debtor.b >= 0 || creditor.b <= 0) return debts;
    const amount = Math.min(-debtor.b, creditor.b);
    debts.push({ from: debtor.uid, to: creditor.uid, amount });
    debtor.b += amount;
    creditor.b -= amount;
  }
}

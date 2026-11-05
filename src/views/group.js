import { renderHeader, avatar } from "../components/layout.js";
import { escapeHtml, memberList, timeAgo } from "../utils/helpers.js";
import { formatINR, simplifyDebts } from "../utils/money.js";

export function renderNotFound(user) {
  return `${renderHeader(user)}<main class="page"><div class="container page__body">
    <div class="empty"><h3>Group not found</h3><p>It may have been deleted, or you're not a member.</p>
    <a class="btn btn--primary" href="#/">Back to groups</a></div></div></main>`;
}

function expenseRow(e, user, name) {
  if (e.type === "payment") {
    const [from] = Object.keys(e.paidBy);
    const [to] = Object.keys(e.split);
    return `<li><button class="row row--payment" type="button" data-edit-expense="${escapeHtml(e.id)}">
      <span class="icon-circle" aria-hidden="true">₹</span>
      <span class="row__main"><strong>${escapeHtml(name(from))} paid ${escapeHtml(name(to))}</strong>
        <span class="caption muted">${timeAgo(e.createdAt)}</span></span>
      <span class="row__end"><strong>${formatINR(e.amount)}</strong></span>
    </button></li>`;
  }
  const payers = Object.keys(e.paidBy);
  const paidText = payers.length > 1 ? `${payers.length} people paid` : `${name(payers[0])} paid`;
  const mine = (e.paidBy[user.uid] || 0) - (e.split[user.uid] || 0);
  const end = mine > 0 ? `<span class="pos">you lent ${formatINR(mine)}</span>`
    : mine < 0 ? `<span class="neg">you borrowed ${formatINR(-mine)}</span>`
      : `<span class="muted">not involved</span>`;
  return `<li><button class="row" type="button" data-edit-expense="${escapeHtml(e.id)}">
    <span class="icon-circle icon-circle--inactive" aria-hidden="true">${escapeHtml(e.description[0]?.toUpperCase() || "•")}</span>
    <span class="row__main"><strong>${escapeHtml(e.description)}</strong>
      <span class="caption muted">${escapeHtml(paidText)} ${formatINR(e.amount)} · ${timeAgo(e.createdAt)}</span></span>
    <span class="row__end caption">${end}</span>
  </button></li>`;
}

export function renderGroup({ user, group, expenses }) {
  const members = memberList(group);
  const name = (uid) => (uid === user.uid ? "You" : group.members?.[uid]?.name || "Someone");
  const balances = group.balances || {};
  const debts = simplifyDebts(balances);
  const pending = group.pendingEmails || [];

  return `${renderHeader(user)}
  <main class="page">
    <section class="hero-band">
      <div class="container">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/">Groups</a> › <span>${escapeHtml(group.name)}</span></nav>
        <h1 class="hero__title">${escapeHtml(group.name)}</h1>
        <div class="avatars">${members.map((m) => avatar(m)).join("")}
          <span class="caption">${members.length} member${members.length === 1 ? "" : "s"}${pending.length ? ` · ${pending.length} invite${pending.length === 1 ? "" : "s"} pending` : ""}</span></div>
        <div class="hero__actions">
          <button class="btn btn--primary btn--on-green" type="button" data-action="add-expense">Add expense</button>
          <button class="btn btn--secondary" type="button" data-action="settle-up">Settle up</button>
          <button class="btn btn--outline btn--outline-light" type="button" data-action="add-members">Add members</button>
        </div>
      </div>
    </section>
    <div class="container page__body group-grid">
      <section>
        <h2>Expenses</h2>
        ${expenses.length ? `<ul class="rows">${expenses.map((e) => expenseRow(e, user, name)).join("")}</ul>`
          : `<div class="empty"><h3>No expenses yet</h3><p>Add the first one — dinner, cab, rent, anything.</p></div>`}
      </section>
      <aside class="side">
        <section class="panel-mint">
          <h2>Who owes whom</h2>
          ${debts.length ? `<ul class="debts">${debts.map((d, i) => `<li class="debt">
            <p><strong>${escapeHtml(name(d.from))}</strong> ${d.from === user.uid ? "owe" : "owes"} <strong>${escapeHtml(name(d.to))}</strong></p>
            <span class="debt__amount">${formatINR(d.amount)}</span>
            <button class="btn btn--outline" type="button" data-settle="${i}">Settle</button>
          </li>`).join("")}</ul>` : `<p class="muted">Everyone is settled up.</p>`}
        </section>
        <section>
          <p class="eyebrow">Balances</p>
          <ul class="spec-list">${members.map((m) => {
            const b = balances[m.uid] || 0;
            return `<li>${avatar(m, "avatar--sm")}<span>${escapeHtml(name(m.uid))}</span>
              <span class="${b > 0 ? "pos" : b < 0 ? "neg" : "muted"}">${b > 0 ? "+" : b < 0 ? "−" : ""}${formatINR(Math.abs(b))}</span></li>`;
          }).join("")}</ul>
          ${pending.length ? `<p class="eyebrow">Pending invites</p><ul class="spec-list">${pending.map((p) => `<li><span class="muted">${escapeHtml(p)}</span></li>`).join("")}</ul>` : ""}
          ${group.createdBy === user.uid ? `<button class="btn btn--danger" type="button" data-action="delete-group">Delete group</button>` : ""}
        </section>
      </aside>
    </div>
  </main>`;
}

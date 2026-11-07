import { renderHeader, avatar } from "../components/layout.js";
import { balanceText, expenseRow, notFound } from "../components/ui.js";
import { escapeHtml, memberList, personName, plural } from "../utils/helpers.js";
import { formatINR, groupDebts } from "../utils/money.js";

export const renderNotFound = (user) =>
  notFound(user, "Group not found", "It may have been deleted, or you're not a member.", "Back to groups");

export function renderGroup({ user, group, expenses, hasMore = false }) {
  const members = memberList(group);
  const name = (uid) => personName(uid, user, group);
  const balances = group.balances || {};
  const debts = groupDebts(group);
  const pending = group.pendingEmails || [];

  return `${renderHeader(user)}
  <main class="page">
    <section class="hero-band">
      <div class="container">
        <div class="hero__top">
          <a class="btn btn--outline btn--outline-light back-btn" href="#/">← Dashboard</a>
          <button class="hero-summary" type="button" data-action="scroll-debts">${balanceText(balances[user.uid] || 0)}</button>
        </div>
        <h1 class="hero__title">${escapeHtml(group.name)}</h1>
        <div class="avatars">${members.map((m) => avatar(m)).join("")}
          <span class="caption">${plural(members.length, "member")}${pending.length ? ` · ${plural(pending.length, "invite")} pending` : ""}</span></div>
        <div class="hero__actions">
          <button class="btn btn--primary btn--on-green" type="button" data-action="add-expense">Add expense</button>
          <button class="btn btn--secondary" type="button" data-action="settle-up">Settle up</button>
          <button class="btn btn--outline btn--outline-light" type="button" data-action="add-members">Add members</button>
        </div>
      </div>
    </section>
    <div class="container page__body group-grid">
        <section class="panel-mint group-debts" id="debts">
          <h2>Who owes whom</h2>
          ${debts.length ? `<ul class="debts">${debts.map((d, i) => `<li class="debt${d.from === user.uid ? " debt--owe" : d.to === user.uid ? " debt--owed" : ""}">
            <p><strong>${escapeHtml(name(d.from))}</strong> ${d.from === user.uid ? "owe" : "owes"} <strong>${escapeHtml(name(d.to))}</strong></p>
            <span class="debt__amount">${formatINR(d.amount)}</span>
            ${d.from === user.uid ? `<button class="btn btn--outline" type="button" data-settle="${i}">Settle</button>` : ""}
          </li>`).join("")}</ul>` : `<p class="muted">Everyone is settled up.</p>`}
          <label class="member-input member-input--check"><input type="checkbox" data-action="toggle-simplify" ${group.simplify ? "checked" : ""}>
            <span>Simplify debts <span class="caption muted">— fewest payments, may route money through others</span></span></label>
        </section>
      <section class="group-expenses">
        <h2>Expenses</h2>
        ${expenses.length ? `<ul class="rows">${expenses.map((e) => expenseRow(e, user, group)).join("")}</ul>
          ${hasMore ? `<button class="btn btn--outline load-more" type="button" data-action="load-more-expenses">Load more</button>` : ""}`
          : `<div class="empty"><h3>No expenses yet</h3><p>Add the first one — dinner, cab, rent, anything.</p></div>`}
      </section>
      <aside class="side">
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

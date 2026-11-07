// Small view pieces shared across pages (HTML strings).
import { renderHeader } from "./layout.js";
import { escapeHtml, timeAgo, personName, plural } from "../utils/helpers.js";
import { formatINR } from "../utils/money.js";

export const iconCircle = (text, fallback = "?", cls = "") =>
  `<span class="icon-circle ${cls}" aria-hidden="true">${escapeHtml(text?.[0]?.toUpperCase() || fallback)}</span>`;

export function balanceText(b) {
  if (b > 0) return `<span class="pos">you are owed ${formatINR(b)}</span>`;
  if (b < 0) return `<span class="neg">you owe ${formatINR(-b)}</span>`;
  return `<span class="muted">settled up</span>`;
}

export function notFound(user, title, text, link = "Back to dashboard") {
  return `${renderHeader(user)}<main class="page"><div class="container page__body">
    <div class="empty"><h3>${title}</h3><p>${text}</p>
    <a class="btn btn--primary" href="#/">${link}</a></div></div></main>`;
}

// `extra` (e.g. a Settle button) switches to the split-row layout so the button sits outside the link.
export function groupRow(group, net, extra = "") {
  const href = `#/group/${escapeHtml(group.id)}`;
  const inner = `${iconCircle(group.name, "G")}
    <span class="row__main"><strong>${escapeHtml(group.name)}</strong>
      <span class="caption muted">${plural(group.memberIds.length, "member")}</span></span>
    <span class="row__end">${balanceText(net)}</span>`;
  return extra
    ? `<li class="row row--split"><a class="row__link" href="${href}">${inner}</a>${extra}</li>`
    : `<li><a class="row" href="${href}">${inner}</a></li>`;
}

export function expenseRow(e, user, group, groupName = "") {
  const name = (uid) => personName(uid, user, group);
  const where = groupName ? `${escapeHtml(groupName)} · ` : "";
  const by = `added by ${e.createdBy === user.uid ? "you" : escapeHtml(name(e.createdBy))} · `;
  if (e.type === "payment") {
    const [from] = Object.keys(e.paidBy);
    const [to] = Object.keys(e.split);
    return `<li><button class="row row--payment" type="button" data-edit-expense="${escapeHtml(e.id)}">
      <span class="icon-circle" aria-hidden="true">₹</span>
      <span class="row__main"><strong>${escapeHtml(name(from))} paid ${escapeHtml(name(to))}</strong>
        <span class="caption muted">${where}${by}${timeAgo(e.createdAt)}</span></span>
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
    ${iconCircle(e.description, "•", "icon-circle--inactive")}
    <span class="row__main"><strong>${escapeHtml(e.description)}</strong>
      <span class="caption muted">${where}${escapeHtml(paidText)} ${formatINR(e.amount)} · ${by}${timeAgo(e.createdAt)}</span></span>
    <span class="row__end caption">${end}</span>
  </button></li>`;
}

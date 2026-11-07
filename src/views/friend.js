import { renderHeader, avatar } from "../components/layout.js";
import { expenseRow, groupRow, notFound } from "../components/ui.js";
import { escapeHtml, plural } from "../utils/helpers.js";
import { formatINR, friendGroupDebts } from "../utils/money.js";

const involves = (e, uid) => uid in e.paidBy || uid in e.split;
const ms = (e) => e.createdAt?.toMillis?.() ?? Date.now();

export const renderFriendNotFound = (user) =>
  notFound(user, "Friend not found", "You don't share any groups with this person.");

// expensesByGroup: { gid: expense[] | undefined (still loading) }; limits: { gid: max fetched }
function renderSharedExpenses(user, friendUid, shared, expensesByGroup, limits) {
  if (shared.some(({ group }) => !expensesByGroup[group.id])) return `<p class="muted">Loading expenses…</p>`;
  const capped = shared.filter(({ group }) => expensesByGroup[group.id].length >= limits[group.id]);
  // A capped group may have older expenses not loaded yet; hide anything older than its oldest loaded one so the merged list has no gaps.
  const cutoff = Math.max(0, ...capped.map(({ group }) => ms(expensesByGroup[group.id].at(-1))));
  const rows = shared
    .flatMap(({ group }) => expensesByGroup[group.id]
      .filter((e) => ms(e) >= cutoff && involves(e, user.uid) && involves(e, friendUid))
      .map((e) => ({ e, group })))
    .sort((a, b) => ms(b.e) - ms(a.e));
  const more = capped.length
    ? `<button class="btn btn--outline load-more" type="button" data-action="load-more-expenses">Load more</button>` : "";
  if (!rows.length) return `<div class="empty empty--compact"><p class="muted">No shared expenses${capped.length ? " in recent activity" : " yet"}.</p></div>${more}`;
  return `<ul class="rows">${rows.map(({ e, group }) => expenseRow(e, user, group, group.name)).join("")}</ul>${more}`;
}

export function renderFriend({ user, friendUid, groups, expensesByGroup = {}, limits = {} }) {
  const shared = friendGroupDebts(user.uid, friendUid, groups)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const friend = { ...shared[0].group.members?.[friendUid] };
  friend.name ||= friend.email || "Member";
  const net = shared.reduce((s, x) => s + x.net, 0);
  const first = escapeHtml(friend.name.split(" ")[0]);
  const headline = net > 0 ? `${first} owes you <span class="lime">${formatINR(net)}</span>`
    : net < 0 ? `You owe ${first} <span class="lime">${formatINR(-net)}</span>`
      : `You and ${first} are settled up`;

  return `${renderHeader(user)}
  <main class="page">
    <section class="hero-band">
      <div class="container">
        <a class="btn btn--outline btn--outline-light back-btn" href="#/">← Dashboard</a>
        <div class="friend-hero">
          ${avatar(friend, "avatar--lg")}
          <div>
            <h1 class="hero__title">${headline}</h1>
            <p class="caption">${escapeHtml(friend.email || "")} · ${plural(shared.length, "shared group")}</p>
          </div>
        </div>
        <div class="hero__actions">
          <button class="btn btn--on-green" type="button" data-action="add-expense">+ Add expense</button>
        </div>
      </div>
    </section>
    <div class="container page__body">
      <h2>By group</h2>
      <ul class="rows">${shared.map(({ group, net: n }) => groupRow(group, n,
        n ? `<button class="btn btn--outline" type="button" data-settle-group="${escapeHtml(group.id)}">Settle</button>` : "")).join("")}</ul>
      <h2 class="friend-section">Shared expenses</h2>
      ${renderSharedExpenses(user, friendUid, shared, expensesByGroup, limits)}
    </div>
  </main>`;
}

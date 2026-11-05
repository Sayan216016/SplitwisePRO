import { renderHeader, avatar } from "../components/layout.js";
import { escapeHtml } from "../utils/helpers.js";
import { formatINR, friendGroupDebts } from "../utils/money.js";
import { balanceText } from "./home.js";
import { expenseRow } from "./group.js";

const involves = (e, uid) => uid in e.paidBy || uid in e.split;
const ms = (e) => e.createdAt?.toMillis?.() ?? Date.now();

export function renderFriendNotFound(user) {
  return `${renderHeader(user)}<main class="page"><div class="container page__body">
    <div class="empty"><h3>Friend not found</h3><p>You don't share any groups with this person.</p>
    <a class="btn btn--primary" href="#/">Back to dashboard</a></div></div></main>`;
}

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
  return `<ul class="rows">${rows.map(({ e, group }) => {
    const name = (uid) => (uid === user.uid ? "You" : group.members?.[uid]?.name || "Someone");
    return expenseRow(e, user, name, group.name);
  }).join("")}</ul>${more}`;
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
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/">Friends</a> › <span>${escapeHtml(friend.name)}</span></nav>
        <div class="friend-hero">
          ${avatar(friend, "avatar--lg")}
          <div>
            <h1 class="hero__title">${headline}</h1>
            <p class="caption">${escapeHtml(friend.email || "")} · ${shared.length} shared group${shared.length === 1 ? "" : "s"}</p>
          </div>
        </div>
      </div>
    </section>
    <div class="container page__body">
      <h2>By group</h2>
      <ul class="rows">${shared.map(({ group, net: n }) => `<li class="row row--split">
        <a class="row__link" href="#/group/${escapeHtml(group.id)}">
          <span class="icon-circle" aria-hidden="true">${escapeHtml(group.name[0]?.toUpperCase() || "G")}</span>
          <span class="row__main"><strong>${escapeHtml(group.name)}</strong>
            <span class="caption muted">${group.memberIds.length} member${group.memberIds.length === 1 ? "" : "s"}</span></span>
          <span class="row__end">${balanceText(n)}</span>
        </a>
        ${n ? `<button class="btn btn--outline" type="button" data-settle-group="${escapeHtml(group.id)}">Settle</button>` : ""}
      </li>`).join("")}</ul>
      <h2 class="friend-section">Shared expenses</h2>
      ${renderSharedExpenses(user, friendUid, shared, expensesByGroup, limits)}
    </div>
  </main>`;
}

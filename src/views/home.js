import { renderHeader } from "../components/layout.js";
import { escapeHtml, timeAgo } from "../utils/helpers.js";
import { formatINR, aggregateFriendBalances } from "../utils/money.js";

export function balanceText(b) {
  if (b > 0) return `<span class="pos">you are owed ${formatINR(b)}</span>`;
  if (b < 0) return `<span class="neg">you owe ${formatINR(-b)}</span>`;
  return `<span class="muted">settled up</span>`;
}

function buildFriends(uid, groups) {
  const nets = aggregateFriendBalances(uid, groups);
  const people = new Map();
  for (const g of groups) {
    for (const id of g.memberIds || []) {
      if (id === uid || people.has(id)) continue;
      const m = g.members?.[id] || {};
      people.set(id, {
        uid: id,
        name: m.name || m.email || "Member",
        email: m.email || "",
        groupCount: 0,
      });
    }
  }
  for (const g of groups) {
    for (const id of g.memberIds || []) {
      if (id !== uid && people.has(id)) people.get(id).groupCount += 1;
    }
  }
  return [...people.values()]
    .map((p) => ({ ...p, net: nets[p.uid] || 0 }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.name.localeCompare(b.name));
}

function renderActivity(activity) {
  if (!activity.length) return `<p class="muted">No activity yet.</p>`;
  return `<ul class="feed">${activity.map((a) => `<li class="feed__item">
    <a class="link-green" href="#/group/${escapeHtml(a.groupId)}">${escapeHtml(a.groupName)}</a>
    <p><strong>${escapeHtml(a.actorName)}</strong> ${escapeHtml(a.text)}</p>
    <span class="caption muted">${timeAgo(a.createdAt)}</span>
  </li>`).join("")}</ul>`;
}

const friendRow = (f) => `<li>
    <a class="row" href="#/friend/${escapeHtml(f.uid)}">
      <span class="icon-circle" aria-hidden="true">${escapeHtml(f.name[0]?.toUpperCase() || "?")}</span>
      <span class="row__main"><strong>${escapeHtml(f.name)}</strong>
        <span class="caption muted">${f.groupCount} shared group${f.groupCount === 1 ? "" : "s"}</span></span>
      <span class="row__end">${balanceText(f.net)}</span>
    </a></li>`;

const groupRow = (g) => `<li>
    <a class="row" href="#/group/${escapeHtml(g.id)}">
      <span class="icon-circle" aria-hidden="true">${escapeHtml(g.name[0]?.toUpperCase() || "G")}</span>
      <span class="row__main"><strong>${escapeHtml(g.name)}</strong>
        <span class="caption muted">${g.memberIds.length} member${g.memberIds.length === 1 ? "" : "s"}</span></span>
      <span class="row__end">${balanceText(g.net)}</span>
    </a></li>`;

function viewTab(id, label, active) {
  return `<button type="button" class="view-tab" role="tab" aria-selected="${active}" data-balance-tab="${id}">${label}</button>`;
}

function filterChip(id, label, active, disabled) {
  return `<button type="button" class="filter-chip" aria-pressed="${active}" data-balance-filter="${id}"${disabled ? " disabled" : ""}>${label}</button>`;
}

// items: [{ net, ...row data }]; filter: all | owed | owe
function renderBalanceList(items, rowHtml, filter, showSettled) {
  const owed = items.filter((i) => i.net > 0);
  const owe = items.filter((i) => i.net < 0);
  const settled = items.filter((i) => i.net === 0);
  const total = (list) => formatINR(Math.abs(list.reduce((s, i) => s + i.net, 0)));

  const chips = `<div class="filter-chips" role="group" aria-label="Filter balances">
    ${filterChip("all", `All <em>${items.length}</em>`, filter === "all", false)}
    ${filterChip("owed", `Owes you · ${total(owed)} <em>${owed.length}</em>`, filter === "owed", !owed.length && filter !== "owed")}
    ${filterChip("owe", `You owe · ${total(owe)} <em>${owe.length}</em>`, filter === "owe", !owe.length && filter !== "owe")}
  </div>`;

  const shown = filter === "owed" ? owed : filter === "owe" ? owe : [...owed, ...owe];
  const empty = filter === "owed" ? "No one owes you right now."
    : filter === "owe" ? "You don't owe anyone right now."
    : "Everything is settled up.";
  const list = shown.length
    ? `<ul class="rows">${shown.map(rowHtml).join("")}</ul>`
    : `<div class="empty empty--compact"><p class="muted">${empty}</p></div>`;

  const settledBlock = filter === "all" && settled.length
    ? `<button type="button" class="settled-toggle" aria-expanded="${showSettled}" data-balance-settled>
        Settled up <em>${settled.length}</em><span aria-hidden="true">${showSettled ? "▴" : "▾"}</span></button>
      ${showSettled ? `<ul class="rows rows--muted">${settled.map(rowHtml).join("")}</ul>` : ""}`
    : "";

  return chips + list + settledBlock;
}

export function renderHome({ user, groups, activity, balanceTab = "friends", balanceFilter = "all", showSettled = false }) {
  let owed = 0;
  let owe = 0;
  for (const g of groups) {
    const b = g.balances?.[user.uid] || 0;
    if (b > 0) owed += b;
    else owe -= b;
  }
  const net = owed - owe;
  const first = (user.displayName || "there").split(" ")[0];
  const list = balanceTab === "activity"
    ? (activity ? renderActivity(activity) : `<p class="muted">Loading activity…</p>`)
    : !groups.length
    ? `<div class="empty"><h3>No groups yet</h3><p>Create a group for a trip, your flat or a dinner — or ask a friend to add you.</p></div>`
    : balanceTab === "groups"
      ? renderBalanceList(groups.map((g) => ({ ...g, net: g.balances?.[user.uid] || 0 })), groupRow, balanceFilter, showSettled)
      : renderBalanceList(buildFriends(user.uid, groups), friendRow, balanceFilter, showSettled);

  return `${renderHeader(user)}
  <main class="page">
    <section class="hero-band">
      <div class="container">
        <div class="hero__head">
          <h1 class="hero__title">Hi, ${escapeHtml(first)}</h1>
          <div class="hero__cta">
            <button class="btn btn--on-green" type="button" data-action="add-expense">+ Add expense</button>
            <button class="btn btn--outline btn--outline-light" type="button" data-action="new-group">Create group</button>
          </div>
        </div>
        <div class="stats">
          <div class="stat stat--dark"><span class="caption">Total balance</span><strong>${net < 0 ? "−" : ""}${formatINR(Math.abs(net))}</strong></div>
          <div class="stat"><span class="caption">You are owed</span><strong class="pos">${formatINR(owed)}</strong></div>
          <div class="stat"><span class="caption">You owe</span><strong class="neg">${formatINR(owe)}</strong></div>
        </div>
      </div>
    </section>
    <div class="container page__body">
      <section>
        <div class="section-head">
          <h2>${balanceTab === "activity" ? "Recent activity" : "Balances"}</h2>
        </div>
        <div class="view-tabs" role="tablist" aria-label="Dashboard view">
          ${viewTab("friends", "Friends", balanceTab === "friends")}
          ${viewTab("groups", "Groups", balanceTab === "groups")}
          ${viewTab("activity", "Activity", balanceTab === "activity")}
        </div>
        ${list}
      </section>
    </div>
  </main>`;
}

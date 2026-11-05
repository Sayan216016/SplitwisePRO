import { renderHeader } from "../components/layout.js";
import { escapeHtml, timeAgo } from "../utils/helpers.js";
import { formatINR } from "../utils/money.js";

export function balanceText(b) {
  if (b > 0) return `<span class="pos">you are owed ${formatINR(b)}</span>`;
  if (b < 0) return `<span class="neg">you owe ${formatINR(-b)}</span>`;
  return `<span class="muted">settled up</span>`;
}

function renderActivity(activity) {
  if (!activity.length) return `<p class="muted">No activity yet.</p>`;
  return `<ul class="feed">${activity.map((a) => `<li class="feed__item">
    <a class="link-green" href="#/group/${escapeHtml(a.groupId)}">${escapeHtml(a.groupName)}</a>
    <p><strong>${escapeHtml(a.actorName)}</strong> ${escapeHtml(a.text)}</p>
    <span class="caption muted">${timeAgo(a.createdAt)}</span>
  </li>`).join("")}</ul>`;
}

export function renderHome({ user, groups, activity }) {
  let owed = 0;
  let owe = 0;
  for (const g of groups) {
    const b = g.balances?.[user.uid] || 0;
    if (b > 0) owed += b;
    else owe -= b;
  }
  const net = owed - owe;
  const first = (user.displayName || "there").split(" ")[0];

  return `${renderHeader(user)}
  <main class="page">
    <section class="hero-band">
      <div class="container">
        <p class="eyebrow eyebrow--light">Dashboard</p>
        <h1 class="hero__title">Hi, ${escapeHtml(first)}</h1>
        <div class="stats">
          <div class="stat stat--dark"><span class="caption">Total balance</span><strong>${net < 0 ? "−" : ""}${formatINR(Math.abs(net))}</strong></div>
          <div class="stat"><span class="caption">You are owed</span><strong class="pos">${formatINR(owed)}</strong></div>
          <div class="stat"><span class="caption">You owe</span><strong class="neg">${formatINR(owe)}</strong></div>
        </div>
      </div>
    </section>
    <div class="container page__body home-grid">
      <section>
        <div class="section-head">
          <h2>Your groups</h2>
          <button class="btn btn--primary" type="button" data-action="new-group">Create group</button>
        </div>
        ${groups.length ? `<ul class="rows">${groups.map((g) => `<li>
          <a class="row" href="#/group/${escapeHtml(g.id)}">
            <span class="icon-circle" aria-hidden="true">${escapeHtml(g.name[0]?.toUpperCase() || "G")}</span>
            <span class="row__main"><strong>${escapeHtml(g.name)}</strong>
              <span class="caption muted">${g.memberIds.length} member${g.memberIds.length === 1 ? "" : "s"}</span></span>
            <span class="row__end">${balanceText(g.balances?.[user.uid] || 0)}</span>
          </a></li>`).join("")}</ul>`
        : `<div class="empty"><h3>No groups yet</h3><p>Create a group for a trip, your flat or a dinner — or ask a friend to add you.</p></div>`}
      </section>
      <section class="panel-mint">
        <h2>Recent activity</h2>
        ${renderActivity(activity)}
      </section>
    </div>
  </main>`;
}

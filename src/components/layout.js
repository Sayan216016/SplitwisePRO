import { escapeHtml, initials } from "../utils/helpers.js";

export function avatar(m, cls = "") {
  return m?.photoURL
    ? `<img class="avatar ${cls}" src="${escapeHtml(m.photoURL)}" alt="${escapeHtml(m.name || "")}" referrerpolicy="no-referrer">`
    : `<span class="avatar ${cls}" title="${escapeHtml(m?.name || "")}">${escapeHtml(initials(m?.name))}</span>`;
}

export const themeButton = () =>
  `<button class="icon-btn" type="button" data-action="toggle-theme" aria-label="Toggle dark mode">◐</button>`;

export function renderHeader(user) {
  return `<header class="nav">
    <div class="container nav__inner">
      <a class="logo" href="#/"><span class="logo__mark" aria-hidden="true"></span>SplitwisePRO</a>
      <div class="nav__actions">
        ${themeButton()}
        <div class="user-chip">
          ${avatar({ name: user.displayName, photoURL: user.photoURL }, "avatar--sm")}
          <span class="user-chip__name">${escapeHtml(user.displayName || user.email)}</span>
          <button class="user-chip__out" type="button" data-action="sign-out">Sign out</button>
        </div>
      </div>
    </div>
  </header>`;
}

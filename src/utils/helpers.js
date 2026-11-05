const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s = "") => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export const initials = (name = "?") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

export const memberList = (group) => group.memberIds.map((uid) => ({ uid, ...group.members?.[uid] }));

let toastTimer;
export function toast(message, kind = "info") {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.dataset.kind = kind;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3500);
}

export function timeAgo(ts) {
  if (!ts?.toDate) return "just now";
  const s = (Date.now() - ts.toDate().getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return ts.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

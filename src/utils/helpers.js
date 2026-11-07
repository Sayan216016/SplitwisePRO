const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s = "") => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export const initials = (name = "?") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

// "Sayan Mukherjee" → "Sayan M". Emails and single names stay as they are.
export const shortName = (name = "") => {
  const w = String(name).trim().split(/\s+/);
  return w.length > 1 && !name.includes("@") ? `${w[0]} ${w.at(-1)[0].toUpperCase()}` : name;
};

// "You" for the signed-in user, otherwise the member's short name.
export const personName = (uid, user, group) =>
  uid === user.uid ? "You" : shortName(group?.members?.[uid]?.name) || "Someone";

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export const memberList = (group) => group.memberIds.map((uid) => ({ uid, ...group.members?.[uid] }));

// Everyone you've shared a group with (including deleted groups), minus you, sorted by name.
export function contactsOf(uid, groups) {
  const byUid = {};
  for (const g of groups) for (const m of memberList(g)) if (m.uid !== uid && m.email) byUid[m.uid] = m;
  return Object.values(byUid).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

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

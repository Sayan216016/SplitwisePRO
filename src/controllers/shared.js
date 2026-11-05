import { signOutUser } from "../services/auth.js";
import { saveExpense, deleteExpense } from "../services/db.js";
import { openExpenseModal, openSettleModal } from "../components/popups.js";
import { toast } from "../utils/helpers.js";

export const app = document.getElementById("app");
export const EXPENSE_PAGE = 50;
let settleTimer;

export const setApp = (html) => (app.innerHTML = html);
export const navigate = (path) => (location.hash = `#${path}`);
export const on = (sel, fn) => app.querySelector(sel)?.addEventListener("click", fn);
export const onError = (e) => {
  console.error(e);
  toast(e.message, "error");
};

export function settle() {
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => (app.dataset.settled = "1"), 600);
}
export function unsettle() {
  clearTimeout(settleTimer);
  delete app.dataset.settled;
}

export function bindChrome() {
  on('[data-action="sign-out"]', () => signOutUser());
}

// Only the author may edit or delete; everyone else gets a read-only view.
export function openExistingExpense(group, user, e) {
  const author = e.createdBy === user.uid ? null : group.members?.[e.createdBy]?.name || "another member";
  const opts = {
    group, user, readOnlyBy: author,
    onSave: (d) => saveExpense(group.id, user, d, e.id),
    onDelete: () => deleteExpense(group.id, user, e.id),
  };
  e.type === "payment" ? openSettleModal({ ...opts, payment: e }) : openExpenseModal({ ...opts, expense: e });
}

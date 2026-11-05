import { subscribeGroups, subscribeExpenses, saveExpense } from "../services/db.js";
import { renderFriend, renderFriendNotFound } from "../views/friend.js";
import { groupSkeleton } from "../components/skeletons.js";
import { openExpenseModal, openSettleModal } from "../components/popups.js";
import { friendGroupDebts } from "../utils/money.js";
import { app, EXPENSE_PAGE, setApp, on, onError, settle, bindChrome, openExistingExpense } from "./shared.js";

export function mountFriend(user, friendUid) {
  let groups = null;
  const expensesByGroup = {};
  const expenseUnsubs = new Map(); // gid → unsubscribe
  const limits = {}; // gid → how many recent expenses to fetch

  const subscribe = (gid) => {
    expenseUnsubs.get(gid)?.();
    expenseUnsubs.set(gid, subscribeExpenses(gid, (e) => { expensesByGroup[gid] = e; render(); },
      (e) => { expensesByGroup[gid] = []; onError(e); }, limits[gid]));
  };

  const syncExpenseSubs = (shared) => {
    const ids = new Set(shared.map((s) => s.group.id));
    for (const [gid, unsub] of expenseUnsubs) {
      if (ids.has(gid)) continue;
      unsub();
      expenseUnsubs.delete(gid);
      delete expensesByGroup[gid];
      delete limits[gid];
    }
    for (const gid of ids) {
      if (expenseUnsubs.has(gid)) continue;
      limits[gid] = EXPENSE_PAGE;
      subscribe(gid);
    }
  };

  // Only groups that hit their cap can have more; the rest keep their listener.
  const loadMore = () => {
    for (const gid of expenseUnsubs.keys()) {
      if ((expensesByGroup[gid]?.length || 0) < limits[gid]) continue;
      limits[gid] += EXPENSE_PAGE;
      subscribe(gid);
    }
  };

  const render = () => {
    if (!groups) return setApp(groupSkeleton());
    const shared = friendGroupDebts(user.uid, friendUid, groups);
    if (!shared.length || friendUid === user.uid) return setApp(renderFriendNotFound(user)), bindChrome();
    setApp(renderFriend({ user, friendUid, groups, expensesByGroup, limits }));
    bindChrome();
    on('[data-action="load-more-expenses"]', loadMore);
    on('[data-action="add-expense"]', () => openExpenseModal({
      groups: shared.map((s) => s.group), user, onSave: (d, g) => saveExpense(g.id, user, d),
    }));
    app.querySelectorAll("[data-settle-group]").forEach((btn) => btn.addEventListener("click", () => {
      const { group, debt } = shared.find((s) => s.group.id === btn.dataset.settleGroup);
      openSettleModal({ group, user, suggestion: debt, onSave: (d) => saveExpense(group.id, user, d) });
    }));
    app.querySelectorAll("[data-edit-expense]").forEach((btn) => btn.addEventListener("click", () => {
      const { group } = shared.find((s) => expensesByGroup[s.group.id]?.some((x) => x.id === btn.dataset.editExpense));
      openExistingExpense(group, user, expensesByGroup[group.id].find((x) => x.id === btn.dataset.editExpense));
    }));
    settle();
  };

  const unsubGroups = subscribeGroups(user.uid, (g) => {
    groups = g;
    syncExpenseSubs(friendGroupDebts(user.uid, friendUid, g));
    render();
  }, onError);
  render();
  return () => {
    unsubGroups();
    expenseUnsubs.forEach((u) => u());
  };
}

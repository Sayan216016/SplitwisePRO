import { findUserByEmail, subscribeGroup, subscribeGroups, subscribeExpenses, addMembers, deleteGroup, saveExpense, setSimplify } from "../services/db.js";
import { renderGroup, renderNotFound } from "../views/group.js";
import { groupSkeleton } from "../components/skeletons.js";
import { openGroupModal, openExpenseModal, openSettleModal } from "../components/popups.js";
import { groupDebts } from "../utils/money.js";
import { contactsOf } from "../utils/helpers.js";
import { app, EXPENSE_PAGE, setApp, navigate, on, onError, settle, bindChrome, openExistingExpense } from "./shared.js";

export function mountGroup(user, gid) {
  let group; // undefined = loading, null = missing / no access
  let expenses = null;
  let allGroups = [];

  const render = () => {
    if (group === null) return setApp(renderNotFound(user)), bindChrome();
    if (!group || !expenses) return setApp(groupSkeleton());
    setApp(renderGroup({ user, group, expenses, hasMore: expenses.length >= expenseLimit }));
    bindChrome();
    on('[data-action="load-more-expenses"]', loadMore);
    on('[data-action="scroll-debts"]', () => document.getElementById("debts").scrollIntoView({ behavior: "smooth", block: "start" }));
    const save = (id) => (d) => saveExpense(gid, user, d, id);

    on('[data-action="add-expense"]', () => openExpenseModal({ group, user, onSave: save() }));
    on('[data-action="settle-up"]', () => openSettleModal({ group, user, onSave: save() }));
    on('[data-action="add-members"]', () => openGroupModal({
      group,
      selfEmail: user.email.toLowerCase(),
      findUser: findUserByEmail,
      contacts: contactsOf(user.uid, allGroups),
      onSave: (d) => addMembers(gid, group, user, d),
    }));
    app.querySelector('[data-action="toggle-simplify"]')?.addEventListener("change", (e) =>
      setSimplify(gid, group, user, e.target.checked).catch(onError));
    on('[data-action="delete-group"]', async () => {
      if (!confirm(`Delete "${group.name}" and all its expenses? This can't be undone.`)) return;
      try {
        await deleteGroup(gid);
        navigate("/");
      } catch (e) {
        onError(e);
      }
    });
    app.querySelectorAll("[data-edit-expense]").forEach((btn) => btn.addEventListener("click", () =>
      openExistingExpense(group, user, expenses.find((x) => x.id === btn.dataset.editExpense))));
    const debts = groupDebts(group);
    app.querySelectorAll("[data-settle]").forEach((btn) => btn.addEventListener("click", () =>
      openSettleModal({ group, user, suggestion: debts[btn.dataset.settle], onSave: save() })));
    settle();
  };

  let expenseLimit = EXPENSE_PAGE;
  let unsubExpenses = () => {};
  const subscribe = () => {
    unsubExpenses();
    unsubExpenses = subscribeExpenses(gid, (e) => { expenses = e; render(); }, () => { group = null; render(); }, expenseLimit);
  };
  const loadMore = () => {
    expenseLimit += EXPENSE_PAGE;
    subscribe();
  };

  const unsubGroup = subscribeGroup(gid, (g) => { group = g; render(); }, () => { group = null; render(); });
  const unsubContacts = subscribeGroups(user.uid, (_, all) => { allGroups = all; }, onError);
  subscribe();
  render();
  return () => {
    unsubGroup();
    unsubContacts();
    unsubExpenses();
  };
}

import "./styles/index.css";
import { configMissing } from "./config/firebase.js";
import { watchAuth, signInWithGoogle, signOutUser } from "./services/auth.js";
import {
  findUserByEmail, subscribeGroups, subscribeGroup, subscribeExpenses, subscribeActivity,
  createGroup, addMembers, deleteGroup, saveExpense, deleteExpense,
} from "./services/db.js";
import { renderSignIn } from "./views/signin.js";
import { renderHome } from "./views/home.js";
import { renderGroup, renderNotFound } from "./views/group.js";
import { renderFriend, renderFriendNotFound } from "./views/friend.js";
import { homeSkeleton, groupSkeleton } from "./components/skeletons.js";
import { closeModal } from "./components/modal.js";
import { openGroupModal, openExpenseModal, openSettleModal } from "./components/popups.js";
import { toast } from "./utils/helpers.js";
import { simplifyDebts, friendGroupDebts } from "./utils/money.js";
import { initThemeToggle } from "./utils/theme.js";

const app = document.getElementById("app");
const EXPENSE_PAGE = 50;
let currentUser = null;
let authReady = false;
let unsubRoute = () => {};
let settleTimer;

const setApp = (html) => (app.innerHTML = html);
const navigate = (path) => (location.hash = `#${path}`);
const on = (sel, fn) => app.querySelector(sel)?.addEventListener("click", fn);
const onError = (e) => {
  console.error(e);
  toast(e.message, "error");
};

function settle() {
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => (app.dataset.settled = "1"), 600);
}
function unsettle() {
  clearTimeout(settleTimer);
  delete app.dataset.settled;
}

// Only the author may edit or delete; everyone else gets a read-only view.
function openExistingExpense(group, user, e) {
  const author = e.createdBy === user.uid ? null : group.members?.[e.createdBy]?.name || "another member";
  const opts = {
    group, user, readOnlyBy: author,
    onSave: (d) => saveExpense(group.id, user, d, e.id),
    onDelete: () => deleteExpense(group.id, user, e.id),
  };
  e.type === "payment" ? openSettleModal({ ...opts, payment: e }) : openExpenseModal({ ...opts, expense: e });
}

function bindChrome() {
  on('[data-action="sign-out"]', () => signOutUser());
}

function route() {
  closeModal();
  unsettle();
  unsubRoute();
  unsubRoute = () => {};
  if (configMissing) return mountSignIn({ error: "Firebase config missing — see docs/firebase-github-setup.md" });
  if (!authReady) return setApp(homeSkeleton());
  if (!currentUser) return mountSignIn();
  const [, page, id] = location.hash.replace(/^#/, "").split("/");
  if (page === "group" && id) mountGroup(currentUser, id);
  else if (page === "friend" && id) mountFriend(currentUser, id);
  else mountHome(currentUser);
}

function mountFriend(user, friendUid) {
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
  unsubRoute = () => {
    unsubGroups();
    expenseUnsubs.forEach((u) => u());
  };
  render();
}

function mountSignIn(state = {}) {
  const draw = (s) => {
    setApp(renderSignIn(s));
    on('[data-action="sign-in"]', async () => {
      draw({ loading: true });
      try {
        await signInWithGoogle();
      } catch (e) {
        draw({ error: e.code === "auth/popup-closed-by-user" ? "Sign-in was cancelled." : e.message });
      }
    });
  };
  draw(state);
}

function mountHome(user) {
  let groups = null;
  let activity = null;
  let balanceTab = "friends";
  let balanceFilter = "all";
  let showSettled = false;
  let unsubActivity = null;

  const onBalanceUi = (e) => {
    const tab = e.target.closest("[data-balance-tab]");
    const filt = e.target.closest("[data-balance-filter]");
    if (tab) {
      balanceTab = tab.dataset.balanceTab;
      balanceFilter = "all";
      // Activity is read only once its tab is first opened, then kept live until leaving the dashboard.
      if (balanceTab === "activity" && !unsubActivity) {
        unsubActivity = subscribeActivity(user.uid, (a) => { activity = a; render(); }, (err) => { activity = []; onError(err); });
      }
    } else if (filt) {
      const f = filt.dataset.balanceFilter;
      balanceFilter = f === balanceFilter ? "all" : f;
    } else if (e.target.closest("[data-balance-settled]")) {
      showSettled = !showSettled;
    } else return;
    render();
  };

  const render = () => {
    if (!groups) return setApp(homeSkeleton());
    setApp(renderHome({ user, groups, activity, balanceTab, balanceFilter, showSettled }));
    bindChrome();
    on('[data-action="new-group"]', () => openGroupModal({
      selfEmail: user.email.toLowerCase(),
      findUser: findUserByEmail,
      onSave: async (d) => navigate(`/group/${await createGroup(user, d)}`),
    }));
    on('[data-action="add-expense"]', () => groups.length
      ? openExpenseModal({ groups, user, onSave: async (d, g) => {
        await saveExpense(g.id, user, d);
        navigate(`/group/${g.id}`);
      } })
      : toast("Create a group first, then add expenses to it."));
    settle();
  };

  app.addEventListener("click", onBalanceUi);
  const unsubGroups = subscribeGroups(user.uid, (g) => { groups = g; render(); }, onError);
  unsubRoute = () => {
    unsubGroups();
    unsubActivity?.();
    app.removeEventListener("click", onBalanceUi);
  };
  render();
}

function mountGroup(user, gid) {
  let group; // undefined = loading, null = missing / no access
  let expenses = null;

  const render = () => {
    if (group === null) return setApp(renderNotFound(user)), bindChrome();
    if (!group || !expenses) return setApp(groupSkeleton());
    setApp(renderGroup({ user, group, expenses, hasMore: expenses.length >= expenseLimit }));
    bindChrome();
    on('[data-action="load-more-expenses"]', loadMore);
    const save = (id) => (d) => saveExpense(gid, user, d, id);

    on('[data-action="add-expense"]', () => openExpenseModal({ group, user, onSave: save() }));
    on('[data-action="settle-up"]', () => openSettleModal({ group, user, onSave: save() }));
    on('[data-action="add-members"]', () => openGroupModal({
      group,
      selfEmail: user.email.toLowerCase(),
      findUser: findUserByEmail,
      onSave: (d) => addMembers(gid, group, user, d),
    }));
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
    const debts = simplifyDebts(group.balances || {});
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
  subscribe();
  unsubRoute = () => {
    unsubGroup();
    unsubExpenses();
  };
  render();
}

initThemeToggle();
if (!configMissing) {
  watchAuth((user) => {
    currentUser = user;
    authReady = true;
    route();
  });
}
window.addEventListener("hashchange", route);
route();

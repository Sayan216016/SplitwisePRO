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
import { homeSkeleton, groupSkeleton } from "./components/skeletons.js";
import { closeModal } from "./components/modal.js";
import { openGroupModal, openExpenseModal, openSettleModal } from "./components/popups.js";
import { toast } from "./utils/helpers.js";
import { simplifyDebts } from "./utils/money.js";
import { initThemeToggle } from "./utils/theme.js";

const app = document.getElementById("app");
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
  else mountHome(currentUser);
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

  const render = () => {
    if (!groups) return setApp(homeSkeleton());
    setApp(renderHome({ user, groups, activity: activity || [] }));
    bindChrome();
    on('[data-action="new-group"]', () => openGroupModal({
      selfEmail: user.email.toLowerCase(),
      findUser: findUserByEmail,
      onSave: async (d) => navigate(`/group/${await createGroup(user, d)}`),
    }));
    settle();
  };

  const unsubs = [
    subscribeGroups(user.uid, (g) => { groups = g; render(); }, onError),
    subscribeActivity(user.uid, (a) => { activity = a; render(); }, (e) => { activity = []; onError(e); }),
  ];
  unsubRoute = () => unsubs.forEach((u) => u());
  render();
}

function mountGroup(user, gid) {
  let group; // undefined = loading, null = missing / no access
  let expenses = null;

  const render = () => {
    if (group === null) return setApp(renderNotFound(user)), bindChrome();
    if (!group || !expenses) return setApp(groupSkeleton());
    setApp(renderGroup({ user, group, expenses }));
    bindChrome();
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
    app.querySelectorAll("[data-edit-expense]").forEach((btn) => btn.addEventListener("click", () => {
      const e = expenses.find((x) => x.id === btn.dataset.editExpense);
      const opts = { group, user, onSave: save(e.id), onDelete: () => deleteExpense(gid, user, e.id) };
      e.type === "payment" ? openSettleModal({ ...opts, payment: e }) : openExpenseModal({ ...opts, expense: e });
    }));
    const debts = simplifyDebts(group.balances || {});
    app.querySelectorAll("[data-settle]").forEach((btn) => btn.addEventListener("click", () =>
      openSettleModal({ group, user, suggestion: debts[btn.dataset.settle], onSave: save() })));
    settle();
  };

  const unsubs = [
    subscribeGroup(gid, (g) => { group = g; render(); }, () => { group = null; render(); }),
    subscribeExpenses(gid, (e) => { expenses = e; render(); }, () => { group = null; render(); }),
  ];
  unsubRoute = () => unsubs.forEach((u) => u());
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

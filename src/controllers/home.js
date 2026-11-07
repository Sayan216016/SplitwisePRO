import { findUserByEmail, subscribeGroups, subscribeActivity, createGroup, saveExpense } from "../services/db.js";
import { renderHome } from "../views/home.js";
import { homeSkeleton } from "../components/skeletons.js";
import { openGroupModal, openExpenseModal } from "../components/popups.js";
import { toast, contactsOf } from "../utils/helpers.js";
import { app, setApp, navigate, on, onError, settle, bindChrome } from "./shared.js";

export function mountHome(user) {
  let groups = null;
  let allGroups = [];
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
      contacts: contactsOf(user.uid, allGroups),
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
  const unsubGroups = subscribeGroups(user.uid, (g, all) => { groups = g; allGroups = all; render(); }, onError);
  render();
  return () => {
    unsubGroups();
    unsubActivity?.();
    app.removeEventListener("click", onBalanceUi);
  };
}

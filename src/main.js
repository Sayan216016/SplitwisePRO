import "./styles/index.css";
import { configMissing } from "./config/firebase.js";
import { watchAuth } from "./services/auth.js";
import { homeSkeleton } from "./components/skeletons.js";
import { closeModal } from "./components/modal.js";
import { initThemeToggle } from "./utils/theme.js";
import { setApp, unsettle } from "./controllers/shared.js";
import { mountSignIn } from "./controllers/signin.js";
import { mountHome } from "./controllers/home.js";
import { mountGroup } from "./controllers/group.js";
import { mountFriend } from "./controllers/friend.js";

let currentUser = null;
let authReady = false;
let unsubRoute = () => {};

function route() {
  closeModal();
  unsettle();
  unsubRoute();
  unsubRoute = () => {};
  if (configMissing) return (unsubRoute = mountSignIn({ error: "Firebase config missing — see docs/firebase-github-setup.md" }));
  if (!authReady) return setApp(homeSkeleton());
  if (!currentUser) return (unsubRoute = mountSignIn());
  const [, page, id] = location.hash.replace(/^#/, "").split("/");
  if (page === "group" && id) unsubRoute = mountGroup(currentUser, id);
  else if (page === "friend" && id) unsubRoute = mountFriend(currentUser, id);
  else unsubRoute = mountHome(currentUser);
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

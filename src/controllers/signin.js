import { signInWithGoogle } from "../services/auth.js";
import { renderSignIn } from "../views/signin.js";
import { setApp, on } from "./shared.js";

export function mountSignIn(state = {}) {
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
  return () => {};
}

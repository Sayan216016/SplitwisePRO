import { escapeHtml } from "../utils/helpers.js";
import { themeButton } from "../components/layout.js";

export function renderSignIn({ loading = false, error = "" } = {}) {
  return `<main class="signin">
    <div class="signin__theme">${themeButton()}</div>
    <section class="signin__hero">
      <a class="logo logo--light" href="#/"><span class="logo__mark" aria-hidden="true"></span>SplitwisePRO</a>
      <h1 class="signin__title">Split bills, <span class="lime">not friendships.</span></h1>
      <p class="signin__lead">Track shared expenses in ₹, see who owes whom, and settle up in one tap.</p>
    </section>
    <section class="auth-card">
      <p class="eyebrow">Get started</p>
      <h2>Sign in or sign up</h2>
      <p class="muted">Use your Gmail account. New here? We'll create your account automatically.</p>
      <button class="btn btn--primary btn--block" type="button" data-action="sign-in" ${loading ? "disabled" : ""}>
        ${loading ? "Signing in…" : "Continue with Google"}
      </button>
      ${error ? `<p class="form__error" role="alert">${escapeHtml(error)}</p>` : ""}
    </section>
  </main>`;
}

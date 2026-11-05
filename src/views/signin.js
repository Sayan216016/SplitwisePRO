import { escapeHtml } from "../utils/helpers.js";
import { themeButton } from "../components/layout.js";

function googleLogo() {
  return `<span class="signin__google-mark" aria-hidden="true"><svg class="signin__google-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg></span>`;
}

function signInBackground() {
  return `<div class="signin__bg" aria-hidden="true">
    <svg class="signin__svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="signin-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="var(--lime-hero)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--logo-lime)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <circle class="signin__orb signin__orb--1" cx="180" cy="140" r="120" fill="url(#signin-glow)"/>
      <circle class="signin__orb signin__orb--2" cx="1180" cy="720" r="200" fill="url(#signin-glow)"/>
      <circle class="signin__orb signin__orb--3" cx="920" cy="120" r="72" fill="var(--lime-hero)" fill-opacity="0.12"/>
      <path class="signin__wave signin__wave--1" d="M-40 520 Q360 420 720 520 T1520 480 L1520 920 L-40 920 Z" fill="var(--lime-hero)" fill-opacity="0.06"/>
      <path class="signin__wave signin__wave--2" d="M-40 600 Q420 500 840 580 T1520 560 L1520 920 L-40 920 Z" fill="var(--logo-lime)" fill-opacity="0.05"/>
      <g class="signin__coins">
        <circle cx="320" cy="680" r="28" fill="none" stroke="var(--lime-hero)" stroke-width="2" stroke-opacity="0.35"/>
        <circle cx="1080" cy="260" r="22" fill="none" stroke="var(--lime-hero)" stroke-width="1.5" stroke-opacity="0.28"/>      </g>
      <path class="signin__arc" d="M200 380 Q520 180 860 320" fill="none" stroke="var(--on-primary)" stroke-opacity="0.12" stroke-width="2" stroke-dasharray="8 14"/>
    </svg>
  </div>`;
}

export function renderSignIn({ loading = false, error = "" } = {}) {
  return `<main class="signin">
    ${signInBackground()}
    <div class="signin__theme">${themeButton()}</div>
    <section class="signin__hero">
      <a class="logo logo--light" href="#/"><span class="logo__mark" aria-hidden="true"></span>SplitwisePRO</a>
      <h1 class="signin__title">Split bills, <span class="lime">not friendships.</span></h1>
      <p class="signin__lead">Track shared expenses, see who owes whom, and settle up in one tap.</p>
    </section>
    <section class="auth-card">
      <p class="eyebrow">Get started</p>
      <h2>Sign in or sign up</h2>
      <p class="muted">Use your Gmail account. New here? We'll create your account automatically.</p>
      <button class="btn btn--primary btn--block" type="button" data-action="sign-in" ${loading ? "disabled" : ""}>
        ${googleLogo()}${loading ? "Signing in…" : "Continue with Google"}
      </button>
      ${error ? `<p class="form__error" role="alert">${escapeHtml(error)}</p>` : ""}
    </section>
  </main>`;
}

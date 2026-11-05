import { escapeHtml } from "../utils/helpers.js";
import { themeButton } from "../components/layout.js";

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
        <text x="320" y="688" text-anchor="middle" fill="var(--lime-hero)" fill-opacity="0.5" font-size="22" font-family="var(--font)" font-weight="700">₹</text>
        <circle cx="1080" cy="260" r="22" fill="none" stroke="var(--lime-hero)" stroke-width="1.5" stroke-opacity="0.28"/>
        <text x="1080" y="267" text-anchor="middle" fill="var(--lime-hero)" fill-opacity="0.4" font-size="16" font-family="var(--font)" font-weight="700">₹</text>
      </g>
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

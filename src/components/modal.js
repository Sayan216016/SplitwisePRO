// Mounted on <body> so Firestore-driven #app re-renders don't wipe form input.
let current = null;
let closing = false;

const MOTION =
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function onKey(e) {
  if (e.key === "Escape") closeModal();
}

function detachModal(el) {
  el.remove();
  if (current === el) current = null;
  closing = false;
  document.removeEventListener("keydown", onKey);
}

export function openModal(html) {
  closeModal(false);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <button class="modal__close" type="button" data-close aria-label="Close">✕</button>${html}</div>`;
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop || e.target.closest("[data-close]")) closeModal();
  });
  document.body.appendChild(backdrop);
  document.addEventListener("keydown", onKey);
  current = backdrop;
  backdrop.querySelector("input, select")?.focus();
  return backdrop.querySelector(".modal");
}

export function closeModal(animate = true) {
  if (!current || closing) return;
  const el = current;
  if (!animate || MOTION) {
    detachModal(el);
    return;
  }
  closing = true;
  const panel = el.querySelector(".modal");
  el.classList.add("modal-backdrop--closing");
  panel?.classList.add("modal--closing");
  let pending = panel ? 2 : 1;
  const onAnimEnd = (e) => {
    if (e.target !== el && e.target !== panel) return;
    pending -= 1;
    if (pending <= 0) detachModal(el);
  };
  el.addEventListener("animationend", onAnimEnd);
  panel?.addEventListener("animationend", onAnimEnd);
}

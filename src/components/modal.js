// Mounted on <body> so Firestore-driven #app re-renders don't wipe form input.
let current = null;

function onKey(e) {
  if (e.key === "Escape") closeModal();
}

export function openModal(html) {
  closeModal();
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

export function closeModal() {
  current?.remove();
  current = null;
  document.removeEventListener("keydown", onKey);
}

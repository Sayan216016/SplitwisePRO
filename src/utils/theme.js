// Initial theme is set by the inline script in index.html; keep the "theme" key in sync.
export function initThemeToggle() {
  document.addEventListener("click", (e) => {
    if (!e.target.closest('[data-action="toggle-theme"]')) return;
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  });
}

const lines = (n) => Array.from({ length: n }, () => `<div class="skeleton skeleton--row"></div>`).join("");

export const homeSkeleton = () => `<main class="page" aria-busy="true">
  <div class="hero-band"><div class="container"><div class="skeleton skeleton--title"></div><div class="stats">${`<div class="skeleton skeleton--stat"></div>`.repeat(3)}</div></div></div>
  <div class="container page__body">${lines(4)}</div>
</main>`;

export const groupSkeleton = () => `<main class="page" aria-busy="true">
  <div class="hero-band"><div class="container"><div class="skeleton skeleton--title"></div></div></div>
  <div class="container page__body group-grid"><div>${lines(5)}</div><div class="desktop-only">${lines(3)}</div></div>
</main>`;

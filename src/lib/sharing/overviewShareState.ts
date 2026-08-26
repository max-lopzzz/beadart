// The "share everything" overview is a single global thing (there's only
// ever one, unlike per-pattern shares), so its slug lives in localStorage
// rather than alongside any one Pattern record.
const KEY = 'beadart.overviewShareSlug';

export function getOverviewShareSlug(): string | null {
  return window.localStorage.getItem(KEY);
}

export function setOverviewShareSlug(slug: string | null): void {
  if (slug) {
    window.localStorage.setItem(KEY, slug);
  } else {
    window.localStorage.removeItem(KEY);
  }
}

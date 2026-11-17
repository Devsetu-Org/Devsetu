/** Hide the pre-React splash painted in index.html once the app is ready. */
export function hideAppSplash(): void {
  const splash = document.getElementById('app-splash');
  if (!splash || splash.dataset.hidden === '1') return;
  splash.dataset.hidden = '1';
  splash.classList.add('is-hiding');
  splash.setAttribute('aria-busy', 'false');
  splash.setAttribute('aria-hidden', 'true');

  const remove = (): void => {
    splash.remove();
  };

  splash.addEventListener('transitionend', remove, { once: true });
  // Fallback if transitionend never fires (display:none / reduced motion).
  window.setTimeout(remove, 400);
}

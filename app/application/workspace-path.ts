export function isWorkspacePath(path: string): boolean {
  return /^(?:\/|\/(?:apps\/(?:customer|maintenance|energy|production|supplier)|records(?:\/[a-zA-Z0-9-]+)?|data))$/.test(
    path,
  );
}

// All workspace views and their data are already loaded in the authenticated
// client. Native history updates the framework's pathname without fetching RSC.
export function navigateWorkspace(path: string, canLeave: () => boolean) {
  if (!isWorkspacePath(path)) return false;
  if (window.location.pathname === path) return true;
  if (!canLeave()) return false;
  window.history.pushState(null, '', path);
  return true;
}

export function syncWorkspaceHistory() {
  const sync = (event: PopStateEvent) => {
    if (!isWorkspacePath(window.location.pathname)) return;
    // These entries belong to the already authenticated workspace. Handle them
    // before the framework starts an RSC fetch so an older back/forward request
    // cannot overwrite a newer directory click. Patched replaceState notifies
    // pathname subscribers while preserving the current history entry.
    event.stopImmediatePropagation();
    window.history.replaceState(
      window.history.state,
      '',
      window.location.href,
    );
  };
  window.addEventListener('popstate', sync, true);
  return () => window.removeEventListener('popstate', sync, true);
}

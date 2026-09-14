export function isWorkspacePath(path: string): boolean {
  const [pathname, search, extra] = path.split('?');
  if (
    extra !== undefined ||
    !/^(?:\/|\/(?:apps\/(?:customer|maintenance|energy|production|supplier)|users))$/.test(
      pathname,
    )
  )
    return false;
  if (search === undefined || search === '') return true;
  if (!pathname.startsWith('/apps/')) return false;
  const params = new URLSearchParams(search);
  return (
    params.size === 1 &&
    (params.get('mode') === 'chat' ||
      (params.get('mode') === 'dashboard' &&
        /^\/apps\/(?:energy|production|supplier)$/.test(pathname)))
  );
}

export function workspaceView(
  pathname: string,
  search: string,
): 'chat' | 'dashboard' {
  return /^\/apps\/(?:energy|production|supplier)$/.test(pathname) &&
    new URLSearchParams(search).get('mode') !== 'chat'
    ? 'dashboard'
    : 'chat';
}

const navigationEvent = 'fengbin:workspace-navigation';
export function readWorkspaceSearch() {
  return window.location.search;
}
export function subscribeWorkspaceNavigation(listener: () => void) {
  window.addEventListener(navigationEvent, listener);
  return () => window.removeEventListener(navigationEvent, listener);
}
function notifyNavigation() {
  window.dispatchEvent(new Event(navigationEvent));
}

// All workspace views and their data are already loaded in the authenticated
// client. Native history updates the framework's pathname without fetching RSC.
export function navigateWorkspace(path: string, canLeave: () => boolean) {
  if (!isWorkspacePath(path)) return false;
  if (window.location.pathname + window.location.search === path) return true;
  if (!canLeave()) return false;
  window.history.pushState(null, '', path);
  notifyNavigation();
  return true;
}

export function syncWorkspaceHistory(canLeave: () => boolean = () => true) {
  let currentUrl = window.location.href;
  let currentState = window.history.state;
  const remember = subscribeWorkspaceNavigation(() => {
    currentUrl = window.location.href;
    currentState = window.history.state;
  });
  const sync = (event: PopStateEvent) => {
    if (!isWorkspacePath(window.location.pathname)) return;
    // These entries belong to the already authenticated workspace. Handle them
    // before the framework starts an RSC fetch so an older back/forward request
    // cannot overwrite a newer directory click. Patched replaceState notifies
    // pathname subscribers while preserving the current history entry.
    event.stopImmediatePropagation();
    if (!canLeave()) {
      window.history.pushState(currentState, '', currentUrl);
      notifyNavigation();
      return;
    }
    window.history.replaceState(window.history.state, '', window.location.href);
    notifyNavigation();
  };
  window.addEventListener('popstate', sync, true);
  return () => {
    window.removeEventListener('popstate', sync, true);
    remember();
  };
}

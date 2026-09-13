import type { AccountUser } from './account-types';

// Keep authentication independent of workspace rendering. Direct URLs still
// pass the server guard; this also detects expiry/logout while the app is open.
export function monitorAdminSession(onUser?: (user: AccountUser) => void) {
  const controller = new AbortController();
  let checking = false;
  async function check() {
    if (checking || controller.signal.aborted) return;
    checking = true;
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (response.status === 401 && !controller.signal.aborted)
        window.location.replace('/login');
      else if (response.ok && onUser) {
        const result = await response.json() as { user?: AccountUser };
        if (result.user && !controller.signal.aborted) onUser(result.user);
      }
    } catch {
      // A transient connection failure should not interrupt local work.
      // Retry on focus, the next navigation, or the periodic check.
    } finally {
      checking = false;
    }
  }
  void check();
  const timer = window.setInterval(check, 60_000);
  window.addEventListener('focus', check);
  return () => {
    controller.abort();
    window.clearInterval(timer);
    window.removeEventListener('focus', check);
  };
}

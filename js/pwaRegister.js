/**
 * pwaRegister.js
 * ---------------------------------------------------------
 * Registers sw.js (see that file for the caching strategy) and
 * handles the one bit of user-facing behaviour a service worker
 * needs: telling the player when a NEW version has finished
 * downloading in the background and is ready to take over, since
 * sw.js deliberately does NOT auto-activate a new version under an
 * already-open tab (see its 'install' handler) - that would risk
 * serving a mix of old HTML and new JS mid-session. Instead, this
 * shows a small, dismissible banner; tapping it reloads the page,
 * which is the point at which it's actually safe to switch over.
 *
 * Entirely optional/best-effort: browsers without service worker
 * support (or with it disabled) just don't get offline caching or
 * the update banner - every page still works exactly as a normal
 * website either way, since nothing else in the app depends on
 * this having succeeded.
 * ---------------------------------------------------------
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // 'installed' + an existing controller means this is an
          // UPDATE to an already-cached app, not the very first
          // install (which also passes through 'installed', but
          // with no controller yet to replace) - only the update
          // case needs a prompt, since a first install has nothing
          // stale on screen to warn about.
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(newWorker);
          }
        });
      });
    }).catch(() => {
      // Registration failed (unsupported browser quirk, served over
      // plain http instead of https/localhost, etc.) - fail silently,
      // same stance as every other best-effort script in this app.
    });
  });

  /**
   * Shows a small dismissible banner offering to reload onto the
   * newly-installed version. Built with plain DOM/inline styles
   * (not styles.css) since this can appear on any page and needs
   * to work even if this specific update ships a styles.css change
   * - the banner's own look shouldn't depend on the very stylesheet
   * that might be what changed.
   * @param {ServiceWorker} newWorker
   */
  function showUpdateBanner(newWorker) {
    if (document.getElementById('pwa-update-banner')) return; // already showing

    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.setAttribute('role', 'status');
    banner.style.cssText = [
      'position:fixed', 'left:12px', 'right:12px', 'bottom:12px',
      'z-index:9999',
      'display:flex', 'align-items:center', 'justify-content:space-between',
      'gap:10px',
      'padding:12px 14px',
      'border-radius:12px',
      'background:#1C1A15',
      'color:#F3ECD8',
      'font-family:"Space Mono",monospace',
      'font-size:0.78rem',
      'box-shadow:0 12px 28px -10px rgba(0,0,0,0.65), 0 0 0 1px rgba(199,163,75,0.35)',
    ].join(';');

    const label = document.createElement('span');
    label.textContent = 'Update available';
    banner.appendChild(label);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-shrink:0;';

    const reloadBtn = document.createElement('button');
    reloadBtn.type = 'button';
    reloadBtn.textContent = 'Reload';
    reloadBtn.style.cssText = [
      'padding:6px 12px', 'border:none', 'border-radius:999px',
      'background:#C7A34B', 'color:#1C1A15', 'font-weight:700',
      'font-family:inherit', 'font-size:inherit', 'cursor:pointer',
    ].join(';');
    reloadBtn.addEventListener('click', () => {
      // Ask the new (already-installed, currently "waiting") worker
      // to take over. Its own 'activate' handling in sw.js clears
      // old caches; the controllerchange listener below then reloads
      // once it has actually taken control, not a moment before.
      newWorker.postMessage({ type: 'SKIP_WAITING' });
    });
    actions.appendChild(reloadBtn);

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.textContent = 'Later';
    dismissBtn.setAttribute('aria-label', 'Dismiss update notice');
    dismissBtn.style.cssText = [
      'padding:6px 10px', 'border:none', 'border-radius:999px',
      'background:transparent', 'color:#A79E8B', 'font-family:inherit',
      'font-size:inherit', 'cursor:pointer',
    ].join(';');
    dismissBtn.addEventListener('click', () => banner.remove());
    actions.appendChild(dismissBtn);

    banner.appendChild(actions);
    document.body.appendChild(banner);
  }

  let hasReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Guards against a rare double-fire reloading the page twice -
    // this event is only ever meant to trigger one reload per
    // actual handover.
    if (hasReloaded) return;
    hasReloaded = true;
    window.location.reload();
  });
})();

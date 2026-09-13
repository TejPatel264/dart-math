/**
 * sw.js
 * ---------------------------------------------------------
 * Service worker for the Dart Maths Trainer PWA. Precaches the
 * whole app shell (every HTML page, the stylesheet, every JS file
 * an HTML page actually references, the manifest, and the icons)
 * on install, then serves everything cache-first with a network
 * fallback - appropriate here since this is a static, no-backend
 * app where "the latest version" only ever changes when a new
 * service worker itself is deployed, not from moment to moment.
 *
 * Google Fonts (loaded cross-origin from each page's own <head>)
 * are deliberately NOT precached here - font files are versioned
 * by Google's own CDN and already cached by the browser's normal
 * HTTP cache with long-lived headers, so this service worker only
 * concerns itself with this app's own same-origin files.
 *
 * CACHE_VERSION is the one thing to bump when shipping a change to
 * any cached file - it's what forces old cached files to be
 * replaced (see activate below); forgetting to bump it means
 * players can keep seeing a stale cached version indefinitely.
 * ---------------------------------------------------------
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `darts-trainer-${CACHE_VERSION}`;

const APP_SHELL = [
  'index.html',
  'practice-picker.html',
  'game-picker.html',
  '3-dart-practice.html',
  '3-dart-practice-board.html',
  'three-dart-game.html',
  'three-dart-game-board.html',
  'streak-practice.html',
  'checkout-quiz-picker.html',
  'checkout-quiz.html',
  'checkout-calculator.html',
  'lifetime-stats.html',

  'css/styles.css',

  'js/gameCore.bundle.js',
  'js/pickerIcons.bundle.js',
  'js/lifetimeStats.js',
  'js/lifetimeStatsUi.js',
  'js/scoreResultUi.js',
  'js/practiceUi.js',
  'js/practiceMain.js',
  'js/practiceBoardUi.js',
  'js/practiceBoardMain.js',
  'js/ui.js',
  'js/main.js',
  'js/gameBoardUi.js',
  'js/gameBoardMain.js',
  'js/dartboard.js',
  'js/countdownTimer.js',
  'js/streakTiming.js',
  'js/streakDailyStats.js',
  'js/refereeTarget.js',
  'js/streakUi.js',
  'js/streakMain.js',
  'js/checkoutEngine.js',
  'js/checkoutQuizEngine.js',
  'js/checkoutQuizUi.js',
  'js/checkoutQuizMain.js',
  'js/checkoutCalculatorMain.js',
  'js/setupPicker.js',
  'js/prefetch.js',
  'js/continuePrompt.js',
  'js/pwaRegister.js',

  'manifest.json',
  'favicon.ico',
  'icons/icon-72.png',
  'icons/icon-96.png',
  'icons/icon-128.png',
  'icons/icon-144.png',
  'icons/icon-152.png',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-384.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    // Deliberately NOT calling self.skipWaiting() here - an already-open
    // tab keeps running on its current (working) cache until the player
    // actually navigates again or reloads, rather than a new service
    // worker taking over mid-session and potentially serving a mismatched
    // mix of old HTML and new JS. See the 'activate' handler below and
    // js/pwaRegister.js, which listens for 'waiting' and offers a
    // deliberate "Update available" refresh instead.
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('darts-trainer-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
});

// Lets js/pwaRegister.js's "Reload" button hand control to this
// (already-installed, waiting) service worker on demand, rather
// than it taking over unprompted - see install's comment above for
// why an update is never applied silently under an open tab.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => {
          if (request.mode === 'navigate') return caches.match('index.html');
          return undefined;
        });
    })
  );
});

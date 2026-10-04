/*
 * Nalu's background script for notifications.
 *
 * Shows every push itself, with no remote scripts: iPhones wake this file for
 * each notification while Nalu is closed, and a push that doesn't end in a
 * visible notification is dropped (repeated misses can get pushes revoked).
 * Firebase's page-side SDK only needs this registration to create the token.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function readPayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch (error) {
    return { notification: { body: event.data ? event.data.text() : '' } };
  }
}

self.addEventListener('push', (event) => {
  const payload = readPayload(event);
  const notification = payload.notification || {};
  const data = payload.data || {};
  const path =
    data.path ||
    (payload.fcmOptions && payload.fcmOptions.link) ||
    '/';
  const title = notification.title || 'Nalu';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: notification.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.category || 'nalu',
      renotify: true,
      data: { path },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate(path).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(path);
    }),
  );
});

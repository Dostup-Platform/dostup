// Firebase Messaging Service Worker
// This file handles push notifications when the app is in the background

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Cache name for offline support
const OFFLINE_CACHE = 'dostup-offline-v1';
const OFFLINE_URLS = ['/offline.html', '/icon-192.png', '/logo.png'];

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBU7eLriaqnhOIDrd7O4wQmCAwqEqj-kZ4",
  authDomain: "dostup-5f5aa.firebaseapp.com",
  projectId: "dostup-5f5aa",
  storageBucket: "dostup-5f5aa.firebasestorage.app",
  messagingSenderId: "201015831480",
  appId: "1:201015831480:web:59116187a7c3375e2afd4d"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Retrieve firebase messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Dostup';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.data?.type || 'default',
    data: payload.data,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Открыть'
      }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click:', event);
  
  event.notification.close();

  // Get the notification data
  const data = event.notification.data || {};
  let targetUrl = '/';

  // Determine where to navigate based on notification type
  if (data.type === 'booking' || data.type === 'cancellation' || data.type === 'payment') {
    targetUrl = '/creator';
  } else if (data.type === 'creator_cancellation' || data.type === 'reminder') {
    targetUrl = '/dashboard';
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle service worker installation - cache offline page
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker installed');
  
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => {
      console.log('[firebase-messaging-sw.js] Caching offline page');
      return cache.addAll(OFFLINE_URLS);
    })
  );
  
  self.skipWaiting();
});

// Handle service worker activation - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker activated');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== OFFLINE_CACHE) {
            console.log('[firebase-messaging-sw.js] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

// Handle fetch requests - show offline page when navigation fails
self.addEventListener('fetch', (event) => {
  // Only handle navigation requests (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        console.log('[firebase-messaging-sw.js] Network failed, serving offline page');
        return caches.match('/offline.html');
      })
    );
  }
});

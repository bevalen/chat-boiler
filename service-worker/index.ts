/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// Handle push notifications
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.log("Push event but no data");
    return;
  }

  try {
    const data = event.data.json();
    const { title, body, icon, badge, data: notificationData } = data;

    const options: NotificationOptions = {
      body: body || "You have a new notification",
      icon: icon || "/logos/profile-icon-512.png",
      badge: badge || "/logos/profile-icon-512.png",
      data: notificationData || {},
      tag: notificationData?.id || "maia-notification",
      requireInteraction: false,
    };

    event.waitUntil(
      self.registration.showNotification(title || "MAIA", options)
    );
  } catch (error) {
    console.error("Error handling push event:", error);
    // Fallback for plain text
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification("MAIA", {
        body: text,
        icon: "/logos/profile-icon-512.png",
        badge: "/logos/profile-icon-512.png",
      })
    );
  }
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = "/";

  // Navigate based on notification type
  if (data.linkType && data.linkId) {
    switch (data.linkType) {
      case "conversation":
        targetUrl = `/?conversation=${data.linkId}`;
        break;
      case "task":
        targetUrl = "/tasks";
        break;
      case "project":
        targetUrl = `/projects/${data.linkId}`;
        break;
      case "reminder":
        targetUrl = "/reminders";
        break;
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ("focus" in client && "navigate" in client) {
          client.focus();
          return client.navigate(targetUrl);
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed:", event.notification.tag);
});

// Update badge count (for supported platforms)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SET_BADGE") {
    const count = event.data.count || 0;
    if ("setAppBadge" in navigator) {
      if (count > 0) {
        (navigator as unknown as { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count);
      } else {
        (navigator as unknown as { clearAppBadge: () => Promise<void> }).clearAppBadge();
      }
    }
  }
});

export {};

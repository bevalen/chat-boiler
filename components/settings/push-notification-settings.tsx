"use client";

import { Bell, BellOff, Loader2, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export function PushNotificationSettings() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <BellOff className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <h3 className="font-medium">Push Notifications</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Push notifications are not supported on this device or browser.
              {" "}
              <span className="text-xs">
                (Requires iOS 16.4+ with app added to Home Screen, or a modern desktop browser)
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <h3 className="font-medium">Push Notifications Blocked</h3>
            <p className="text-sm text-muted-foreground mt-1">
              You have blocked notifications for this app. To enable them, update your
              browser or device settings to allow notifications from this site.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <h3 className="font-medium">Push Notifications</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isSubscribed
                ? "You will receive push notifications when MAIA has updates for you."
                : "Enable push notifications to get notified when MAIA sends you a message."}
            </p>
            {error && (
              <p className="text-sm text-destructive mt-2">{error}</p>
            )}
          </div>
        </div>
        <Button
          variant={isSubscribed ? "outline" : "default"}
          size="sm"
          onClick={() => (isSubscribed ? unsubscribe() : subscribe())}
          disabled={isLoading}
          className="shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSubscribed ? (
            <>
              <Check className="h-4 w-4 mr-1.5" />
              Enabled
            </>
          ) : (
            "Enable"
          )}
        </Button>
      </div>
    </div>
  );
}

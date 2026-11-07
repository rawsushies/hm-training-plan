/* Notification abstraction (future phase). Nothing here requests permission or shows a notification.
 *
 * The app talks only to HMTPNotify.adapter. The web build installs NullNotifier, which reports
 * "unsupported". A future Android (Capacitor) build registers a native adapter, e.g. one backed by
 * @capacitor/local-notifications for scheduled workout reminders and Firebase Cloud Messaging for
 * remote (group / server-generated) messages. See docs/NOTIFICATION_ROADMAP.md.
 *
 * Adapter contract:
 *   id: string                          adapter name
 *   supported(): boolean                can this platform deliver notifications at all?
 *   permission(): Promise<"granted"|"denied"|"prompt"|"unsupported">
 *   requestPermission(): Promise<same>  ONLY called after an explicit user action in Settings
 *   schedule(reminders): Promise<{scheduled:number}>   reminders from HMTP.buildReminders()
 *   cancelAll(): Promise<void>
 *   channels: [{id, name, importance}]  Android notification channels (one per category)
 */
(function (G) {
  "use strict";
  const CHANNELS = [
    { id: "workout", name: "Pengingat workout", importance: 4 },
    { id: "tips", name: "Tips latihan", importance: 2 },
    { id: "weekly", name: "Rekap mingguan", importance: 2 },
    { id: "monthly", name: "Review bulanan", importance: 2 }
  ];
  const NullNotifier = {
    id: "none", channels: CHANNELS,
    supported: () => false,
    permission: async () => "unsupported",
    requestPermission: async () => "unsupported",
    schedule: async () => ({ scheduled: 0 }),
    cancelAll: async () => {}
  };
  const api = {
    CHANNELS, NullNotifier, adapter: NullNotifier,
    /** Called by a native shell at startup to install a real adapter. */
    setAdapter(a) {
      const need = ["supported", "permission", "requestPermission", "schedule", "cancelAll"];
      if (!a || need.some(k => typeof a[k] !== "function")) throw new Error("Invalid notification adapter");
      api.adapter = a;
    },
    isActive: () => api.adapter !== NullNotifier && api.adapter.supported()
  };
  G.HMTPNotify = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

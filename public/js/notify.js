/* Notifications. The app talks only to HMTPNotify.adapter.
 *
 * - Web: NullNotifier ("unsupported"). A browser tab cannot deliver reminders reliably in the
 *   background, so the web build never asks for permission and never fakes it with timers.
 * - Android APK with @capacitor/local-notifications: NativeNotifier. Reminders are handed to the OS
 *   alarm manager (inexact, allowWhileIdle), so they fire with the app closed and survive reboots
 *   (the plugin restores them on BOOT_COMPLETED). The app re-plans them whenever it starts, resumes,
 *   the plan changes or the timezone changes. See docs/NOTIFICATIONS.md.
 * - An older APK that receives this JS through a live update has no plugin: it stays on NullNotifier
 *   and the UI says an app update is needed.
 *
 * Adapter contract:
 *   id: string
 *   supported(): boolean
 *   permission(): Promise<"granted"|"denied"|"prompt"|"unsupported">
 *   requestPermission(): Promise<same>  ONLY called after an explicit user action
 *   schedule(reminders): Promise<{scheduled:number}>   replaces everything this app scheduled before
 *   cancelAll(): Promise<void>
 *   pending(): Promise<number>
 *   channels: [{id, name, importance}]
 */
(function (G) {
  "use strict";
  const CHANNELS = [
    { id: "workout", name: "Pengingat workout", importance: 4, description: "Sebelum sesi latihan dan malam sebelumnya" },
    { id: "race", name: "Hitung mundur race", importance: 4, description: "Menjelang hari race" },
    { id: "hydration", name: "Pengingat minum", importance: 3, description: "Sebelum long run dan race" },
    { id: "tips", name: "Tips latihan", importance: 2, description: "Awal tiap minggu latihan" },
    { id: "weekly", name: "Rekap mingguan", importance: 2, description: "Ringkasan minggu yang sudah lewat" },
    { id: "monthly", name: "Review bulanan", importance: 2, description: "Akhir tiap blok latihan" }
  ];
  const MAX_SCHEDULED = 60;           // well under Android's per-app alarm limit
  const SMALL_ICON = "ic_stat_werunit";
  const ACCENT = "#FF5A1F";   // --acc

  /** Stable positive 31-bit id from a reminder id string (FNV-1a). */
  function numId(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 1) || 1;
  }
  const mapPerm = p => p === "granted" ? "granted" : p === "denied" ? "denied" : "prompt";

  const NullNotifier = {
    id: "none", channels: CHANNELS,
    supported: () => false,
    permission: async () => "unsupported",
    requestPermission: async () => "unsupported",
    schedule: async () => ({ scheduled: 0 }),
    cancelAll: async () => {},
    pending: async () => 0
  };

  /** Build an adapter over the Capacitor LocalNotifications plugin object. */
  function nativeAdapter(LN) {
    let channelsReady = false;
    async function ensureChannels() {
      if (channelsReady || typeof LN.createChannel !== "function") return;
      for (const c of CHANNELS) {
        try { await LN.createChannel({ id: c.id, name: c.name, description: c.description, importance: c.importance, visibility: 0, vibration: c.importance >= 4 }); } catch (e) {}
      }
      channelsReady = true;
    }
    async function ours() {
      const r = await LN.getPending();
      return (r && r.notifications || []).filter(n => !n.extra || n.extra.app === "werunit");
    }
    return {
      id: "android-local", channels: CHANNELS,
      supported: () => true,
      async permission() { try { return mapPerm((await LN.checkPermissions()).display); } catch (e) { return "prompt"; } },
      async requestPermission() { await ensureChannels(); try { return mapPerm((await LN.requestPermissions()).display); } catch (e) { return "denied"; } },
      async cancelAll() { const p = await ours(); if (p.length) await LN.cancel({ notifications: p.map(n => ({ id: n.id })) }); },
      async pending() { try { return (await ours()).length; } catch (e) { return 0; } },
      async schedule(reminders, now = new Date()) {
        await ensureChannels();
        await this.cancelAll();
        const list = (reminders || []).filter(r => r.at > now).slice(0, MAX_SCHEDULED).map(r => ({
          id: numId(r.id), title: r.title, body: r.body, largeBody: r.body,
          channelId: r.cat, smallIcon: SMALL_ICON, iconColor: ACCENT,
          schedule: { at: new Date(r.at.getTime()), allowWhileIdle: true },
          isExactNotification: false,   // inexact: the OS may batch it by a few minutes to save battery
          extra: { app: "werunit", rid: r.id, cat: r.cat }
        }));
        if (!list.length) return { scheduled: 0 };
        await LN.schedule({ notifications: list });
        return { scheduled: list.length };
      },
      async test() {
        await ensureChannels();
        await LN.schedule({ notifications: [{ id: numId("test:" + Date.now()), title: "WeRunIt", body: "Notifikasi tes berhasil. Pengingat latihan bakal muncul seperti ini.", channelId: "workout", smallIcon: SMALL_ICON, iconColor: ACCENT, schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, isExactNotification: false, extra: { app: "werunit-test" } }] });
      }
    };
  }

  const api = {
    CHANNELS, NullNotifier, adapter: NullNotifier, numId, nativeAdapter, MAX_SCHEDULED,
    setAdapter(a) {
      const need = ["supported", "permission", "requestPermission", "schedule", "cancelAll"];
      if (!a || need.some(k => typeof a[k] !== "function")) throw new Error("Invalid notification adapter");
      api.adapter = a;
    },
    isActive: () => api.adapter !== NullNotifier && api.adapter.supported(),
    /** "web" | "native-missing-plugin" | "native" */
    platform() {
      const C = G.Capacitor;
      if (!(C && C.isNativePlatform && C.isNativePlatform())) return "web";
      return C.isPluginAvailable && C.isPluginAvailable("LocalNotifications") ? "native" : "native-missing-plugin";
    },
    /** Install the native adapter when this is an APK that bundles the plugin. Returns true if installed. */
    installNative() {
      if (api.platform() !== "native") return false;
      const C = G.Capacitor, LN = (C.Plugins && C.Plugins.LocalNotifications) || C.registerPlugin("LocalNotifications");
      api.setAdapter(nativeAdapter(LN));
      return true;
    }
  };
  G.HMTPNotify = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

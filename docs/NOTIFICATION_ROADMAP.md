# Notification roadmap

## Status in this release

- **No notification is ever sent, scheduled or requested.** The web build never calls
  `Notification.requestPermission()` (an e2e test asserts this).
- *Menu → Notifikasi* (marked **segera hadir**) stores per-account preferences and shows a
  **preview** of the next 7 days of reminders, computed from the real schedule and logs.
- Browser `setTimeout` isn't used as a fake background scheduler; it can't work when the page is closed.

## Pieces already in place

| Piece | Where |
|---|---|
| Preferences `settings.notif` = `{enabled, workout, tips, weekly, monthly, leadMin, wdTime, weTime, quietStart, quietEnd, tz}` | validated by `HMTP.cleanNotif`, synced per account |
| Deterministic planner `HMTP.buildReminders({sessions, weeks, logs, prefs, now, horizonDays})` | `public/js/logic.js` (unit-tested) |
| Adapter interface + `NullNotifier` + channel list | `public/js/notify.js` |

Planner rules:
- **Workout:** `pre:` reminder `leadMin` before the session time (weekday sessions use the weekday
  run time, weekends the weekend time), and `eve:` reminder the day before at the weekday/weekend
  reminder time ("Besok Long Run 8 km. Siapkan sepatu dan perlengkapanmu."). Done/skipped sessions
  and strength are excluded.
- **Tips:** Monday of each week, text chosen by week type (base, locked, elevation, benchmark, taper,
  race).
- **Weekly analysis:** Monday after a finished week: run count, km vs target, change vs the previous
  week, "longest so far" only if true. Everything comes from logged data.
- **Monthly review:** day after each 4-week block.
- **Quiet hours:** reminders move to the end of quiet hours, or are dropped if that would be after
  the session starts.
- Uses device local time; `tz` is stored so a native scheduler can reschedule after a time-zone change.
- Readiness is described as a heuristic, never as a medical assessment.

## Android implementation plan (Capacitor)

1. Add a Capacitor shell around `public/` (no app rewrite).
2. **Local notifications** (`@capacitor/local-notifications`) for workout / tips / weekly / monthly:
   - create channels from `HMTPNotify.CHANNELS` (workout = high importance, others default/low);
   - Android 13+: `POST_NOTIFICATIONS` is a runtime permission. Request it only when the user turns on
     "Aktifkan notifikasi". If denied, keep the setting off and explain; the app keeps working;
   - **exact alarms**: don't assume them. Use inexact scheduling by default. If exact timing is
     wanted, check `canScheduleExactAlarms` (Android 12+) and send the user to settings; never block
     on it;
   - reschedule (cancelAll + schedule next 7–14 days) on: app start, plan/settings/log change, time-zone
     change, device reboot (plugin handles `BOOT_COMPLETED`).
3. Implement the adapter and register it: `HMTPNotify.setAdapter(capacitorAdapter)`. The web build
   keeps `NullNotifier`.
4. **Remote push** (Firebase Cloud Messaging) only for things the device can't compute alone: group
   activity, server-generated recaps. Needs a backend (Cloud Functions → Blaze plan). Store FCM tokens in
   `users/{uid}/devices/{id}` with rules restricted to the owner; send by deterministic rules, no AI.
5. Test permission grant/deny, channels, delivery while the app is killed, and quiet hours on a real
   Android 13+ device. The emulator preview isn't proof of delivery.

## Separation

| Local (device) | Remote (server) |
|---|---|
| workout reminders, tips, weekly/monthly analysis from local data | group notifications, server-side recaps, backend-triggered pushes |

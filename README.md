# Maintenance Tracker

A React Native (Expo) app that tracks vehicle maintenance by mileage and nags you weekly until overdue work gets done.

## What it does

1. **Garage (home)** — a list of every saved vehicle, each with a **badge showing how many maintenance items are due**. Add as many vehicles as you like; remove ones you no longer own.
2. **Vehicle setup** — cascading Year → Make → Model → Sub-model & engine pickers.
   - Makes & models come live from the **NHTSA vPIC API** (US-government database, always current).
   - Sub-model / engine variants come from the **EPA fueleconomy.gov API** (1984 – current).
   - If a variant isn't in the EPA data (brand-new models, rare imports), you can type the trim and engine manually.
3. **Mileage & history** — enter the current odometer reading, then answer a quick questionnaire about which services were already done ("Recently / A while ago / Never–not sure", with an optional "how many miles ago" guesstimate) so the initial checklist reflects reality.
4. **Checklist dashboard** — every service is shown as **Overdue**, **Due soon** (within 500 mi), or **Upcoming**, with exact due mileages. Update the odometer any time; statuses recompute. Add **custom maintenance items** (name + interval, e.g. "Timing belt every 60,000 mi") per vehicle — they're tracked, reminded, and badge-counted exactly like the standard schedule, and can be removed.
5. **Reminder frequencies** — two dropdowns per vehicle (**Daily / Weekly / Bi-weekly / Monthly / Custom**): one for how often to be nudged to refresh the odometer, one for how often to be re-reminded about maintenance that's due. If the reading goes stale, the app shows a banner and fires a reminder you can tap to update straight away.
6. **Reminders** — each overdue/due-soon task schedules a repeating **weekly local notification** that keeps firing until you check the task off, and each vehicle has its own mileage-update prompt on the chosen cadence. Tapping a notification deep-links to that specific vehicle. Completing a task records it in history and silences its reminder.

Maintenance intervals are industry-standard averages defined in [src/data/schedule.ts](src/data/schedule.ts) — tweak them there if your owner's manual differs.

## Running it

```bash
npm install
npx expo start        # scan the QR code with the Expo Go app (iOS/Android)
npx expo start --web  # quick UI preview in the browser (no notifications on web)
```

### Notifications: what to know

Notifications are **local / on-device** — no server or push service required — and differ by platform:

**Native app (Expo Go or an EAS build)** — `src/notifications.ts` uses `expo-notifications`:
- A repeating weekly reminder per due maintenance task, plus a per-vehicle mileage-update prompt on the chosen cadence. They fire even when the app is closed.
- On **Android**, scheduled notifications don't survive a reboot; the app re-registers them on launch, so open it occasionally after restarting your phone.

**Web / installed PWA** — `src/webNotifications.ts` + `public/sw.js`:
- The garage screen shows an "Enable reminders" prompt; tapping it requests permission (must be a user gesture).
- Once granted, the app writes a snapshot into the Cache API (due counts + odometer age + cadence per vehicle) and registers **Periodic Background Sync**. On an **installed Android PWA** the service worker then shows reminders **while the app is closed, offline, with no server**.
- At each background-sync or push event the service worker decides what to show: a per-vehicle **"Update your mileage"** prompt when the reading is older than that vehicle's mileage frequency (tapping it deep-links into the odometer editor), and/or a per-vehicle **"maintenance due"** reminder. Wake-ups arrive on the browser's schedule (roughly daily), so the worker records when it last showed each reminder (Cache API) and only re-shows once the vehicle's chosen frequency has elapsed — the frequency dropdowns are honored even though the wake-ups aren't ours to schedule.
- **iOS** PWAs can show notifications when the app is opened, but iOS blocks background/scheduled local notifications — reaching a closed iOS PWA needs server-sent Web Push.

**Web Push backend** (`push-worker/`, optional) — a Cloudflare Worker + cron that nudges every subscribed device on a schedule. The push carries **no vehicle data**; the service worker reads the on-device snapshot and renders the reminder, so nothing personal is stored server-side beyond the anonymous push subscription. Configure the client via `src/pushConfig.ts`. See [push-worker/README.md](push-worker/README.md).

For a real native install:
```bash
npx eas build --platform android   # or ios (requires an Expo account)
```

## Project layout

```
App.tsx                     app state, screen routing, reminder syncing
src/api/vehicles.ts         NHTSA + EPA vehicle-data clients
src/data/schedule.ts        maintenance items & intervals
src/logic.ts                per-vehicle due/overdue computation, task completion
src/cadence.ts              mileage-update cadence math (stale detection)
src/notifications.ts        native reminder scheduling (expo-notifications)
src/webNotifications.ts     web/PWA notifications + background-sync snapshot
public/sw.js                service worker: taps, background sync, web push
src/storage.ts              AsyncStorage persistence + v1→v2 migration
src/screens/Home           garage: vehicle list with due-count badges
src/screens/VehicleSetup    year/make/model/trim pickers
src/screens/MileageSetup    odometer + service-history questionnaire
src/screens/Dashboard       per-vehicle checklist, mileage, cadence, remove
src/components/ui.tsx       shared buttons, cards, searchable select
src/components/NotificationPrompt.tsx   web "enable reminders" card
```

Data lives entirely on the user's own device (AsyncStorage / browser `localStorage`) — there is no backend, so no user's data is ever visible to anyone else.

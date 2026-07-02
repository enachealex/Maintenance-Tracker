# Maintenance Tracker

A React Native (Expo) app that tracks vehicle maintenance by mileage and nags you weekly until overdue work gets done.

## What it does

1. **Vehicle setup** — cascading Year → Make → Model → Sub-model & engine pickers.
   - Makes & models come live from the **NHTSA vPIC API** (US-government database, always current).
   - Sub-model / engine variants come from the **EPA fueleconomy.gov API** (1984 – current).
   - If a variant isn't in the EPA data (brand-new models, rare imports), you can type the trim and engine manually.
2. **Mileage & history** — enter the current odometer reading, then answer a quick questionnaire about which services were already done ("Recently / A while ago / Never–not sure") so the initial checklist reflects reality.
3. **Checklist dashboard** — every service is shown as **Overdue**, **Due soon** (within 500 mi), or **Upcoming**, with exact due mileages. Update the odometer any time; statuses recompute.
4. **Weekly reminders** — each overdue/due-soon task schedules a repeating **weekly local notification** that keeps firing until you check the task off. Completing a task records it in history and silences its reminder.

Maintenance intervals are industry-standard averages defined in [src/data/schedule.ts](src/data/schedule.ts) — tweak them there if your owner's manual differs.

## Running it

```bash
npm install
npx expo start        # scan the QR code with the Expo Go app (iOS/Android)
npx expo start --web  # quick UI preview in the browser (no notifications on web)
```

### Notifications: what to know

- **Local weekly notifications** are used — no server or push service needed. They fire even when the app is closed.
- On **Android**, scheduled notifications don't survive a reboot; the app re-registers them every time it launches, so open the app occasionally after restarting your phone.
- **Expo Go** is fine for development. For a real install (and the most reliable notification behavior), build the app:
  ```bash
  npx eas build --platform android   # or ios (requires an Expo account)
  ```

## Project layout

```
App.tsx                     app state, screen routing, reminder syncing
src/api/vehicles.ts         NHTSA + EPA vehicle-data clients
src/data/schedule.ts        maintenance items & intervals
src/logic.ts                due/overdue computation, task completion
src/notifications.ts        weekly reminder scheduling (expo-notifications)
src/storage.ts              AsyncStorage persistence
src/screens/VehicleSetup    year/make/model/trim pickers
src/screens/MileageSetup    odometer + service-history questionnaire
src/screens/Dashboard       checklist, mileage updates, check-offs
src/components/ui.tsx       shared buttons, cards, searchable select
```

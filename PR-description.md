## Finish real-time sync + restyle the account screen

Follow-up on this branch's existing work (`009d9b3` and earlier): the
sync machinery was basically done, but had two real bugs, no test
coverage, and the sign-in/sign-up screen was still raw unstyled HTML.

### fix: surface real-time sync errors instead of dropping them

- Removed leftover `console.log` debug statements in `syncPattern`
  (fired on every save, even the no-op call with no user signed in).
- `subscribeToAccountPatterns` / `subscribeToAccountPalettes` only
  logged `onSnapshot` errors to the console — a dropped connection on
  one device silently killed that device's real-time sync with no way
  for the UI to notice. Both now accept an `onError` callback.
- `useAccount` exposes a new `syncStatus`
  (`'offline' | 'connecting' | 'live' | 'error'`) derived from the two
  listeners, and **recovers back to `'live'`** the next time a
  snapshot succeeds after an error — previously it got stuck on
  `'error'` forever even after the connection came back.
- Added test coverage for `accountRepo`'s subscriptions and
  `useAccount`'s `syncStatus` state machine — neither had any tests.

### feat: restyle the account screen with the app's design system

`AccountScreen` was the only screen in the app with zero design-system
classes. Rebuilt it with what already exists elsewhere
(`PaletteManageScreen` etc.):

- `.container-narrow` + `.surface` card
- a real segmented control for Sign in / Create account instead of two
  loose buttons
- `.btn-primary` / `.btn-secondary` / `.btn-ghost`, labels properly
  associated via `htmlFor`/`id`
- consistent "← Back" `btn-ghost` corner button
- a small **sync-status badge** (live / connecting / error) once
  signed in, so a broken connection is visible instead of silent

Also fixed the "Account" button in `HomeScreen`'s header, which had no
`btn` class and looked out of place next to "Manage Palettes" / "+ New
Pattern".

All existing `AccountScreen` tests pass with the same assertions (same
copy, same aria-labels, same roles) — added cases for the new sync
badge states.

### Testing

- `npx tsc --noEmit` — clean
- `npx vitest run` — 236/236 passing (17 new tests)
- `npm run build` — succeeds

### Before merging

This still needs the `VITE_FIREBASE_*` env vars set in the Vercel
project for the deployed app to actually authenticate — without them
`isSharingConfigured()` returns false and account creation/sign-in
fails silently client-side. Worth double-checking those are set (and
that the Firestore rules in `firebase/firestore.rules` are deployed)
before this goes to `master`.

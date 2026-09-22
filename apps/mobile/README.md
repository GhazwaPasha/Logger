# @work-ledger/mobile

LogBase native app (Expo SDK 57, Expo Router, React Native 0.86). It talks to the same NestJS API as the web app (`apps/api`).

```bash
npm run dev:mobile      # from the repo root (expo start)
npm run android -w @work-ledger/mobile
```

- Routes live in `src/app/` (file-based, Expo Router). Non-route code goes in `src/components`, `src/hooks`, `src/constants`.
- `ios/` and `android/` are generated (`expo prebuild`) and git-ignored. Configure native behaviour in `app.json`.
- The root `android/` directory is the Bubblewrap TWA wrapper around the PWA and is unrelated to this app.
- Before adding a dependency, use `npx expo install <pkg>` so the version matches the SDK.

## Why React is pinned to 19.2.3

React Native 0.86 requires an exact React version, and the app shares this monorepo with the Next.js web app. The root `package.json` `overrides` and the web app's `react`/`react-dom` pins keep a single copy of React in `node_modules`. Without them, `expo-router`'s auto-installed `react-dom` peer hoists a newer React to the root, and React Native crashes at runtime with "Incompatible React versions". When you bump the Expo SDK, update all three places together.

## Why `expo-router` is also a root dependency

Expo CLI's tooling is hoisted to the repo root and finds `expo-router` with plain Node resolution. Left alone, npm nests `expo-router` under `apps/mobile/node_modules`, and `expo start` crashes with `Cannot find module 'expo-router/_ctx-shared'` (typed-routes generation). Declaring it in the root `package.json` forces one hoisted copy. Keep its version in step with `apps/mobile/package.json` when upgrading the SDK.

## Auth stack pins (root `package.json`)

`@better-auth/core` is pinned to `1.6.9` in root `overrides` **and** listed as a root dependency. `@better-auth/expo` otherwise resolves a newer core than `better-auth`, which breaks the client types, and without the root dependency npm leaves the only copy under `apps/web/node_modules` where the mobile app's `better-auth` can't reach it (Metro: `Unable to resolve "@better-auth/core/utils/string"`). Keep it in step with `better-auth` when upgrading.

## Local development

```bash
npm run dev            # API (:4000) + web/auth (:3000)
npm run dev:mobile     # Metro; open in Expo Go or an emulator
```

The app finds the local servers from Metro's host address, so no env setup is needed. Restart Metro (`expo start --clear`) after running `npm install`; a running dev server keeps a stale file map and reports modules as missing.

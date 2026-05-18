# AGENTS.md

## Commands
- Install with `npm install`; this repo uses `package-lock.json`.
- Start dev server with `npm start` (`expo start`). Platform shortcuts: `npm run ios`, `npm run android`, `npm run web`.
- Required frontend verification before handing off UI changes: `npm run lint` then `npx expo-doctor`.
- There is no test or typecheck script in `package.json`; do not invent one.
- Formatting command exists as `npm run format` and runs Prettier over the repo.
- EAS profiles live in `eas.json`; EAS build commands require an Expo account (`eas login`) or `EXPO_TOKEN` in CI.

## App Entry And Navigation
- `package.json` uses `"main": "expo-router/entry"`; do not add back legacy `App.js`, `index.js`, or `AppNavigator.js` entrypoints.
- Real root wiring is `app/_layout.js`: providers, auth gating, asset preload, persisted React Query cache, root `Stack`.
- Main tabs are Expo Router Native Tabs in `app/MainTabs/_layout.js`; keep the forced dark tab background `#171515`.
- Files under `app/` are route wrappers. Most UI lives in `screens/`, with route wrappers passing `navigation`/`route` through `utils/expoNavigationCompat.js`.
- Detail routes should pass IDs (`albumId`, `songId`, `artistId`, `profileId`) rather than serialized entity objects in route params.

## API, Auth, And Cache
- API base URL is `EXPO_PUBLIC_API_URL`, with fallback in `config/env.js` to `https://songbox-ordinario.onrender.com`; `.env.example` documents the env key.
- Sentry is initialized in `app/_layout.js` and stays disabled unless `EXPO_PUBLIC_SENTRY_DSN` is set.
- API calls use the axios client from `api/client.js`; authenticated calls come from `AuthContext` as `axiosInstance`.
- Auth tokens are stored in `expo-secure-store` under `userToken`; logout and 401 handling must call `clearUserScopedQueryCache()` to avoid cross-user persisted data.
- React Query is configured in `api/queryClient.js` and persisted to AsyncStorage under `songbox-react-query-cache`; only selected query scopes persist.
- User-scoped query keys live in `api/queryKeys.js`; include `userId` in new persisted/user-specific keys.

## Mutations And Data Flow
- Reuse hooks for shared mutations instead of duplicating screen-level axios calls: `hooks/useFavorites.js`, `hooks/useRating.js`, `hooks/useFollowUser.js`.
- Favorite/rating mutations already invalidate `activity`; preserve that when adding related optimistic updates.
- Comments/reviews UI is centralized in `components/CommentSection.js`; keep replies visually one level deep even when replying to a reply.

## Expo/Native UI Notes
- `app.json` forces dark mode (`userInterfaceStyle: "dark"`), sets scheme `frontsb`, enables New Architecture, and registers `expo-router`.
- Use `expo-image` for images in app UI; existing screens rely on its caching/contentFit behavior.
- For glass surfaces, prefer `expo-glass-effect` with `expo-blur` fallback, matching `CommentSection.js` patterns.

## Backend Boundary
- The Flask/Supabase backend is a sibling repo at `/home/story/Documents/songbox/backend`, not inside this git repo.
- If a frontend change requires backend verification, run backend tests from that sibling repo with `/tmp/opencode/songbox-backend-venv/bin/python -m unittest discover -s tests`.

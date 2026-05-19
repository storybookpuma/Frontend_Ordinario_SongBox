import AsyncStorage from '@react-native-async-storage/async-storage';

/** Matches backend TTL for home:feed and mobile:home (180s). */
export const HOME_FEED_STALE_MS = 3 * 60 * 1000;

const HOME_FEED_CACHE_VERSION = 'v4';

export const getHomeAsyncStorageKey = (userId) =>
  `homeSpotifyFeed:${HOME_FEED_CACHE_VERSION}:${userId || 'anonymous'}`;

const getLegacyHomeAsyncStorageKeys = (userId) => [
  `homeSpotifyFeed:v3:${userId}`,
  `homeSpotifyFeed:v2:${userId}`,
];

export const isHomeFeedFresh = (feed) => {
  if (!feed?.cachedAt) return false;
  return Date.now() - feed.cachedAt < HOME_FEED_STALE_MS;
};

export const readCachedHomeFeed = async (userId) => {
  if (!userId) return null;

  let cached = await AsyncStorage.getItem(getHomeAsyncStorageKey(userId));
  if (!cached) {
    for (const key of getLegacyHomeAsyncStorageKeys(userId)) {
      cached = await AsyncStorage.getItem(key);
      if (cached) break;
    }
  }
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached);
    return isHomeFeedFresh(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const writeCachedHomeFeed = async (userId, feed) => {
  if (!userId || !feed) return;
  await AsyncStorage.setItem(
    getHomeAsyncStorageKey(userId),
    JSON.stringify({ ...feed, cachedAt: Date.now() }),
  );
};

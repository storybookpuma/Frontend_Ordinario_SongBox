import { Linking } from 'react-native';

const SPOTIFY_HOSTS = new Set(['open.spotify.com', 'p.scdn.co']);
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

const canOpenAllowedUrl = (url, { hosts = new Set(), schemes = new Set(['https:']) } = {}) => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    if (!schemes.has(parsed.protocol)) {
      return false;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return true;
    }
    return hosts.size === 0 || hosts.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

export const openSpotifyUrl = async (url) => {
  if (!canOpenAllowedUrl(url, { hosts: SPOTIFY_HOSTS, schemes: new Set(['https:', 'spotify:']) })) {
    return false;
  }

  await Linking.openURL(url);
  return true;
};

export const openYouTubeUrl = async (url) => {
  if (!canOpenAllowedUrl(url, { hosts: YOUTUBE_HOSTS })) {
    return false;
  }

  await Linking.openURL(url);
  return true;
};

import { API_BASE_URL } from '../config/env';

export const getUserId = (user) => (user && (user._id || user.id) ? (user._id || user.id).toString() : '');

export const normalizeFavorite = (favorite) => ({
  ...favorite,
  entityId: favorite.entityId || favorite.id,
  entityType: favorite.entityType || favorite.type,
  name: favorite.name || favorite.title || 'Untitled',
  image: favorite.image || favorite.cover_image || favorite.profile_picture,
});

export const splitFavorites = (favorites = []) => {
  const normalized = favorites.map(normalizeFavorite);

  return {
    albums: normalized.filter((fav) => fav.entityType === 'album'),
    songs: normalized.filter((fav) => fav.entityType === 'song'),
    artists: normalized.filter((fav) => fav.entityType === 'artist'),
  };
};

export const normalizeComment = (comment) => ({
  ...comment,
  _id: comment._id || comment.id,
  liked_by: Array.isArray(comment.liked_by) ? comment.liked_by : [],
  disliked_by: Array.isArray(comment.disliked_by) ? comment.disliked_by : [],
  likes: Number(comment.likes || 0),
  dislikes: Number(comment.dislikes || 0),
});

export const sortComments = (comments = []) => (
  comments.map(normalizeComment).sort((a, b) => b.likes - a.likes)
);

export const resolveImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = API_BASE_URL.replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const normalizeUser = (user) => ({
  ...user,
  id: user?.id || user?._id,
  username: user?.username || 'User',
  profile_picture: resolveImageUrl(user?.profile_picture) || null,
  following: Array.isArray(user?.following) ? user.following : [],
});

export const normalizeAlbum = (album) => {
  const artistName = Array.isArray(album?.artist)
    ? album.artist.join(', ')
    : (album?.artist || album?.artists?.join(', ') || 'Artista Desconocido');

  return {
    ...album,
    id: album?.id || album?._id,
    title: album?.title || album?.name || 'Untitled Album',
    name: album?.name || album?.title || 'Untitled Album',
    artist: artistName,
    image: album?.image || album?.cover_image || null,
    cover_image: album?.cover_image || album?.image || null,
  };
};

export const normalizeArtist = (artist) => ({
  ...artist,
  id: artist?.id || artist?._id,
  name: artist?.name || 'Unknown Artist',
  image: artist?.image || artist?.profile_picture || null,
  genres: Array.isArray(artist?.genres) ? artist.genres : [],
});

export const normalizeSong = (song) => ({
  ...song,
  id: song?.id || song?._id,
  title: song?.title || song?.name || 'Untitled Song',
  name: song?.name || song?.title || 'Untitled Song',
  artist: song?.artist || 'Unknown Artist',
  album: song?.album || '',
  image: song?.image || song?.cover_image || null,
  cover_image: song?.cover_image || song?.image || null,
});

import { useContext, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';
import { invalidateHomeFeedForUser } from '../api/queryClient';
import { getUserId } from '../utils/normalizers';

export const useFavorites = () => {
  const { axiosInstance, user } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const userId = getUserId(user);
  const queryKey = queryKeys.favorites(userId);

  const query = useQuery({
    queryKey,
    enabled: Boolean(userId && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/get_favorites');
      return response.data.favorites || [];
    },
  });

  const favorites = useMemo(() => query.data || [], [query.data]);

  const getDetailsQueryKey = (entityType, entityId) => {
    const keyFactory = entityType === 'song' ? queryKeys.songDetails : entityType === 'album' ? queryKeys.albumDetails : queryKeys.artistDetails;
    return keyFactory(entityId, userId);
  };

  const updateDetailFavoriteCache = (entityType, entityId, nextFavorite) => {
    queryClient.setQueryData(getDetailsQueryKey(entityType, entityId), (current) => {
      if (!current) return current;
      if (current.artist) {
        return { ...current, artist: { ...current.artist, isFavorite: nextFavorite } };
      }
      return { ...current, isFavorite: nextFavorite };
    });
  };

  const updateMobileProfileFavorites = (entityType, entityId, isFavorite, favorite) => {
    queryClient.setQueryData(queryKeys.mobileProfile(userId), (current) => {
      if (!current) return current;
      const withoutItem = (current.favorites || []).filter(
        (item) => !(item.entityType === entityType && String(item.entityId) === String(entityId))
      );
      if (isFavorite) {
        return { ...current, favorites: withoutItem, stats: { ...(current.stats || {}), favorites: withoutItem.length } };
      }
      const nextFavorites = [
        ...withoutItem,
        {
          entityType,
          entityId,
          name: favorite?.name,
          image: favorite?.image,
          artist: favorite?.artist,
        },
      ];
      return { ...current, favorites: nextFavorites, stats: { ...(current.stats || {}), favorites: nextFavorites.length } };
    });
  };

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ entityType, entityId, isFavorite, favorite }) => {
      if (isFavorite) {
        await axiosInstance.post('/remove_favorite', { entityType, entityId });
        return { entityType, entityId, favorite: null };
      }

      const payload = {
        entityType,
        entityId,
        name: favorite?.name,
        image: favorite?.image,
        artist: favorite?.artist,
      };
      await axiosInstance.post('/add_favorite', payload);
      return { entityType, entityId, favorite: payload };
    },
    onMutate: async ({ entityType, entityId, isFavorite, favorite }) => {
      await queryClient.cancelQueries({ queryKey });
      await queryClient.cancelQueries({ queryKey: queryKeys.mobileProfile(userId) });
      await queryClient.cancelQueries({ queryKey: getDetailsQueryKey(entityType, entityId) });
      const previousFavorites = queryClient.getQueryData(queryKey);
      const previousMobileProfile = queryClient.getQueryData(queryKeys.mobileProfile(userId));
      const previousDetails = queryClient.getQueryData(getDetailsQueryKey(entityType, entityId));
      queryClient.setQueryData(queryKey, (current = []) => {
        if (isFavorite) {
          return current.filter(
            (item) => !(item.entityType === entityType && String(item.entityId) === String(entityId))
          );
        }
        return [
          ...current,
          {
            entityType,
            entityId,
            name: favorite?.name,
            image: favorite?.image,
            artist: favorite?.artist,
          },
        ];
      });
      updateDetailFavoriteCache(entityType, entityId, !isFavorite);
      updateMobileProfileFavorites(entityType, entityId, isFavorite, favorite);
      return { entityType, entityId, previousFavorites, previousMobileProfile, previousDetails };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(queryKey, context.previousFavorites);
      }
      if (context?.previousMobileProfile) {
        queryClient.setQueryData(queryKeys.mobileProfile(userId), context.previousMobileProfile);
      }
      if (context?.previousDetails) {
        queryClient.setQueryData(getDetailsQueryKey(context.entityType, context.entityId), context.previousDetails);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['activity'], exact: false });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasteWall(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mobileProfile(userId) });
      invalidateHomeFeedForUser(queryClient, userId);
    },
  });

  const helpers = useMemo(() => ({
    isFavorite: (entityType, entityId) => favorites.some(
      (favorite) => favorite.entityType === entityType && String(favorite.entityId) === String(entityId)
    ),
    invalidateFavorites: () => queryClient.invalidateQueries({ queryKey }),
    toggleFavorite: (variables) => toggleFavoriteMutation.mutateAsync(variables),
    isTogglingFavorite: toggleFavoriteMutation.isPending,
  }), [favorites, queryClient, queryKey, toggleFavoriteMutation]);

  return { ...query, favorites, ...helpers };
};

import { useContext, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';
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
      const previousFavorites = queryClient.getQueryData(queryKey);
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
      return { previousFavorites };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(queryKey, context.previousFavorites);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['activity'], exact: false });
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

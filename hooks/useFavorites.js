import { useContext, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

  const helpers = useMemo(() => ({
    isFavorite: (entityType, entityId) => favorites.some(
      (favorite) => favorite.entityType === entityType && String(favorite.entityId) === String(entityId)
    ),
    invalidateFavorites: () => queryClient.invalidateQueries({ queryKey }),
  }), [favorites, queryClient, queryKey]);

  return { ...query, favorites, ...helpers };
};

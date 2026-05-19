import { useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';
import { invalidateHomeFeedForUser } from '../api/queryClient';
import { useToast } from '../context/ToastContext';
import { getApiErrorMessage } from '../utils/errors';
import { getUserId } from '../utils/normalizers';

export const useRating = ({ entityType, entityId, name, image, artist, enabled = true }) => {
  const { axiosInstance, user } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const userId = getUserId(user);
  const queryKey = queryKeys.userRating(entityType, entityId, userId);
  const detailsQueryKey = queryKeys[entityType === 'song' ? 'songDetails' : entityType === 'album' ? 'albumDetails' : 'artistDetails'](entityId, userId);

  const query = useQuery({
    queryKey,
    enabled: Boolean(enabled && entityId && userId && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/get_user_rating', {
        params: { entityType, entityId },
      });
      return response.data.rating || 0;
    },
  });

  const invalidateRelated = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: detailsQueryKey });
    queryClient.invalidateQueries({ queryKey: ['charts', entityType], exact: false });
    queryClient.invalidateQueries({ queryKey: ['activity'], exact: false });
    queryClient.invalidateQueries({ queryKey: queryKeys.mobileProfile(userId) });
    invalidateHomeFeedForUser(queryClient, userId);
  };

  const updateDetailsRatingCache = (summary) => {
    if (!summary) return;
    queryClient.setQueryData(detailsQueryKey, (current) => {
      if (!current) return current;
      const ratingPatch = {
        averageRating: summary.averageRating,
        ratingCount: summary.ratingCount,
        ratingDistribution: summary.ratingDistribution,
      };
      if (current.artist) {
        return { ...current, artist: { ...current.artist, ...ratingPatch } };
      }
      return { ...current, ...ratingPatch };
    });
  };

  const createMutation = useMutation({
    mutationFn: (rating) => axiosInstance.post('/rate_entity', { entityType, entityId, rating, name, image, artist }),
    onSuccess: (_response, rating) => {
      queryClient.setQueryData(queryKey, rating);
      invalidateRelated();
      showToast('Tu calificación ha sido registrada.');
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, 'No se pudo registrar tu calificación.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (rating) => axiosInstance.put('/rate_entity', { entityType, entityId, rating, name, image, artist }),
    onSuccess: (_response, rating) => {
      queryClient.setQueryData(queryKey, rating);
      invalidateRelated();
      showToast('Tu calificación ha sido actualizada.');
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, 'No se pudo actualizar tu calificación.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => axiosInstance.delete('/rate_entity', { data: { entityType, entityId } }),
    onSuccess: () => {
      queryClient.setQueryData(queryKey, 0);
      invalidateRelated();
      showToast('Tu calificación ha sido eliminada.');
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, 'No se pudo eliminar tu calificación.'));
    },
  });

  const rateEntity = async ({ rating, currentRating, setUserRating, onSuccess }) => {
    const previousRating = currentRating;
    setUserRating(rating);

    try {
      let response;
      if (previousRating === 0) {
        response = await createMutation.mutateAsync(rating);
      } else {
        response = await updateMutation.mutateAsync(rating);
      }
      updateDetailsRatingCache(response.data);
      onSuccess?.(response.data);
    } catch (error) {
      setUserRating(previousRating);
      throw error;
    }
  };

  const deleteRating = async ({ currentRating, setUserRating, onSuccess }) => {
    const previousRating = currentRating;
    setUserRating(0);

    try {
      const response = await deleteMutation.mutateAsync();
      updateDetailsRatingCache(response.data);
      onSuccess?.(response.data);
    } catch (error) {
      setUserRating(previousRating);
      throw error;
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return {
    ...query,
    rateEntity,
    deleteRating,
    isMutating,
  };
};

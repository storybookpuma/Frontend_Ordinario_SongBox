import { useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';
import { useToast } from '../context/ToastContext';
import { getApiErrorMessage } from '../utils/errors';

export const useRating = ({ entityType, entityId, enabled = true }) => {
  const { axiosInstance } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const queryKey = queryKeys.userRating(entityType, entityId);

  const query = useQuery({
    queryKey,
    enabled: Boolean(enabled && entityId && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/get_user_rating', {
        params: { entityType, entityId },
      });
      return response.data.rating || 0;
    },
  });

  const rateEntity = async ({ rating, currentRating, setUserRating, onSuccess }) => {
    setUserRating(rating);

    try {
      const response = await axiosInstance.post('/rate_entity', { entityType, entityId, rating });
      queryClient.setQueryData(queryKey, rating);
      onSuccess?.(response.data);
      showToast('Tu calificación ha sido registrada.');
    } catch (error) {
      setUserRating(currentRating);
      showToast(getApiErrorMessage(error, 'No se pudo registrar tu calificación.'));
    }
  };

  return { ...query, rateEntity };
};

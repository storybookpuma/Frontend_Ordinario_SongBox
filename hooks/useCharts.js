import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';

export const useCharts = ({ entityType = 'song', limit = 20, enabled = true }) => {
  const { axiosInstance } = useContext(AuthContext);

  return useQuery({
    queryKey: queryKeys.charts(entityType, limit),
    enabled: Boolean(enabled && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/charts/top_rated', {
        params: { entityType, limit },
      });
      return response.data.items || [];
    },
  });
};

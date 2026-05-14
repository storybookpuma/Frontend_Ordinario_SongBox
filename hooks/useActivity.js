import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';

export const useActivity = ({ limit = 20, enabled = true }) => {
  const { axiosInstance } = useContext(AuthContext);

  return useQuery({
    queryKey: queryKeys.activity(limit),
    enabled: Boolean(enabled && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/activity', {
        params: { limit },
      });
      return response.data.activities || [];
    },
  });
};

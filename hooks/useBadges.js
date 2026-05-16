import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';

export function useBadges() {
  const { axiosInstance, user } = useContext(AuthContext);

  return useQuery({
    queryKey: queryKeys.badges,
    enabled: Boolean(user && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/badges');
      return response.data.badges || [];
    },
  });
}

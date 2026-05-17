import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';
import { getUserId } from '../utils/normalizers';

export function useBadges() {
  const { axiosInstance, user } = useContext(AuthContext);
  const userId = getUserId(user);

  return useQuery({
    queryKey: queryKeys.badges(userId),
    enabled: Boolean(userId && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/badges');
      return response.data.badges || [];
    },
  });
}

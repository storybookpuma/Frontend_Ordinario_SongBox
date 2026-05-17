import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';
import { getUserId } from '../utils/normalizers';

export const useActivity = ({ limit = 20, scope = 'personalized', enabled = true }) => {
  const { axiosInstance, user } = useContext(AuthContext);
  const userId = getUserId(user);

  return useQuery({
    queryKey: queryKeys.activity(limit, scope, userId),
    enabled: Boolean(enabled && axiosInstance && (scope !== 'personalized' || userId)),
    queryFn: async () => {
      const response = await axiosInstance.get('/activity', {
        params: { limit, scope },
      });
      return response.data.activities || [];
    },
  });
};

import { useContext } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';
import { getUserId } from '../utils/normalizers';

export const useActivity = ({ limit = 20, scope = 'personalized', enabled = true }) => {
  const { axiosInstance, user } = useContext(AuthContext);
  const userId = getUserId(user);

  return useInfiniteQuery({
    queryKey: queryKeys.activity(limit, scope, userId),
    enabled: Boolean(enabled && axiosInstance && (scope !== 'personalized' || userId)),
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const response = await axiosInstance.get('/activity', {
        params: { limit, scope, cursor: pageParam || undefined },
      });
      return {
        activities: response.data.activities || [],
        nextCursor: response.data.nextCursor || null,
        hasMore: Boolean(response.data.hasMore),
      };
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });
};

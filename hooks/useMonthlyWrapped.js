import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';
import { getUserId } from '../utils/normalizers';

export const useMonthlyWrapped = (month) => {
  const { axiosInstance, user } = useContext(AuthContext);
  const userId = getUserId(user);

  return useQuery({
    queryKey: queryKeys.monthlyWrapped(month, userId),
    enabled: Boolean(axiosInstance && userId),
    queryFn: async () => {
      const response = await axiosInstance.get('/wrapped/monthly', {
        params: month ? { month } : undefined,
      });
      return response.data;
    },
  });
};

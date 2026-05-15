import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';

export const useMonthlyWrapped = (month) => {
  const { axiosInstance } = useContext(AuthContext);

  return useQuery({
    queryKey: queryKeys.monthlyWrapped(month),
    enabled: Boolean(axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/wrapped/monthly', {
        params: month ? { month } : undefined,
      });
      return response.data;
    },
  });
};

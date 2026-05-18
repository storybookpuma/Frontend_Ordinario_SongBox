import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';
import { getUserId } from '../utils/normalizers';

export const usePremiumInsights = () => {
  const { axiosInstance, user } = useContext(AuthContext);
  const userId = getUserId(user);

  return useQuery({
    queryKey: queryKeys.premiumInsights(userId),
    enabled: Boolean(axiosInstance && userId),
    queryFn: async () => {
      const [dashboardResponse, profileResponse] = await Promise.all([
        axiosInstance.get('/premium/listening-dashboard'),
        axiosInstance.get('/premium/taste-profile'),
      ]);
      return {
        ...dashboardResponse.data,
        tasteProfile: profileResponse.data.profile,
        sync: profileResponse.data.sync,
      };
    },
    retry: (failureCount, error) => {
      if (error?.response?.status === 403) return false;
      return failureCount < 2;
    },
  });
};

export const useSpotifyImport = () => {
  const { axiosInstance, user } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const userId = getUserId(user);

  return useMutation({
    mutationFn: async (asset) => {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.name || 'spotify-history.zip',
        type: asset.mimeType || 'application/zip',
      });
      const response = await axiosInstance.post('/spotify/import', formData, {
        params: { mode: 'replace' },
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.premiumInsights(userId) });
    },
  });
};

export const usePremiumRecompute = () => {
  const { axiosInstance, user } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const userId = getUserId(user);

  return useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post('/premium/taste-profile/recompute');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.premiumInsights(userId) });
    },
  });
};

export const useSpotifyFullSync = () => {
  const { axiosInstance, user } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const userId = getUserId(user);

  return useMutation({
    mutationFn: async (force = false) => {
      const response = await axiosInstance.post('/spotify/sync', null, {
        params: force ? { force: 'true' } : undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.premiumInsights(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasteWall(userId) });
    },
  });
};

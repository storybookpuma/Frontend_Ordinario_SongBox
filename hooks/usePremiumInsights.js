import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';
import { getUserId } from '../utils/normalizers';
import { waitForSpotifySyncJob } from '../utils/spotifySync';

export const usePremiumInsights = () => {
  const { axiosInstance, user } = useContext(AuthContext);
  const userId = getUserId(user);

  return useQuery({
    queryKey: queryKeys.premiumInsights(userId),
    enabled: Boolean(axiosInstance && userId),
    queryFn: async () => {
      const response = await axiosInstance.get('/mobile/premium/insights', { timeout: 12000 });
      return response.data;
    },
    retry: (failureCount, error) => {
      if (error?.response?.status === 403) return false;
      return failureCount < 1;
    },
    staleTime: 1000 * 60 * 5,
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
      if (response.data?.queued && response.data?.jobId) {
        await waitForSpotifySyncJob(axiosInstance, response.data.jobId);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.premiumInsights(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasteWall(userId) });
    },
  });
};

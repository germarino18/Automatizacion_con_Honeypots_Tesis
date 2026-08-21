import { useQuery } from '@tanstack/react-query';

import {
  apiGet,
  type HealthResponse,
  type ServicesHealthResponse,
} from './api';

const HEALTH_REFETCH_MS = 30_000;

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet<HealthResponse>('/health'),
    refetchInterval: HEALTH_REFETCH_MS,
    staleTime: 15_000,
  });
}

export function useServicesHealth() {
  return useQuery({
    queryKey: ['health', 'services'],
    queryFn: () => apiGet<ServicesHealthResponse>('/health/services'),
    refetchInterval: HEALTH_REFETCH_MS,
    staleTime: 15_000,
    retry: false,
  });
}

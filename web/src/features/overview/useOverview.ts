import { useQuery } from '@tanstack/react-query';

import { apiGet, type Overview } from '../../lib/api';

export function useOverview(from?: string, to?: string) {
  return useQuery({
    queryKey: ['overview', from ?? null, to ?? null],
    queryFn: () =>
      apiGet<Overview>('/overview', {
        from,
        to,
      }),
    staleTime: 15_000,
  });
}

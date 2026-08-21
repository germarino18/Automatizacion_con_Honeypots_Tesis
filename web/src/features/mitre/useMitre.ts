import { useQuery } from '@tanstack/react-query';

import { apiGet, type MitreResponse } from '../../lib/api';

export function useMitre(from?: string, to?: string) {
  return useQuery({
    queryKey: ['mitre', from ?? null, to ?? null],
    queryFn: () =>
      apiGet<MitreResponse>('/mitre', {
        from,
        to,
      }),
    staleTime: 30_000,
  });
}

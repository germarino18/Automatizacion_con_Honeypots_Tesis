import { useQuery } from '@tanstack/react-query';

import { apiGet, type GeoResponse } from '../../lib/api';

export function useGeoCountries(from?: string, to?: string) {
  return useQuery({
    queryKey: ['geo', 'countries', from ?? null, to ?? null],
    queryFn: () =>
      apiGet<GeoResponse>('/geo/countries', {
        from,
        to,
      }),
    staleTime: 30_000,
  });
}

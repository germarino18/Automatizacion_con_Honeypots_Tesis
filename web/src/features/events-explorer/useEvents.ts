import { useQuery, keepPreviousData } from '@tanstack/react-query';

import {
  apiGet,
  type EventDetail,
  type EventFilters,
  type EventPage,
} from '../../lib/api';

export function useEvents(filters: EventFilters = {}) {
  return useQuery({
    queryKey: ['events', filters],
    queryFn: () => apiGet<EventPage>('/events', filters),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useEventDetail(eventId: number | null) {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: () => apiGet<EventDetail>(`/events/${eventId}`),
    enabled: eventId !== null,
  });
}

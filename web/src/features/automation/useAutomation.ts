import { useQuery } from '@tanstack/react-query';

import {
  apiGet,
  type AutomationResponsesFilters,
  type ExecutionsResponse,
  type ResponsePage,
  type WorkflowsResponse,
} from '../../lib/api';

export function useWorkflows() {
  return useQuery({
    queryKey: ['automation', 'workflows'],
    queryFn: () => apiGet<WorkflowsResponse>('/automation/workflows'),
    staleTime: 30_000,
  });
}

export function useExecutions() {
  return useQuery({
    queryKey: ['automation', 'executions'],
    queryFn: () => apiGet<ExecutionsResponse>('/automation/executions'),
    staleTime: 15_000,
  });
}

export function useAutomationResponses(
  filters: AutomationResponsesFilters = {},
) {
  return useQuery({
    queryKey: ['automation', 'responses', filters],
    queryFn: () => apiGet<ResponsePage>('/automation/responses', filters),
    staleTime: 15_000,
  });
}

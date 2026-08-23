import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  apiPost,
  type BlockIpResponse,
  type CreateTicketResponse,
  type SimulateResponse,
} from '../../lib/api';

export interface SimulatePayload {
  honeypot: 'cowrie' | 'dionaea';
  payload: Record<string, unknown>;
}

export interface BlockIpPayload {
  src_ip: string;
  reason: string;
  duration: number | null;
}

export interface CreateTicketPayload {
  name: string;
  content: string;
  urgency: string;
}

/**
 * Acciones SOAR: tras el éxito se refrescan ejecuciones + respuestas
 * (y eventos/overview para que la simulación aparezca en el feed).
 */
function useAutomationAction<TVars, TResult>(
  action: (vars: TVars) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['automation', 'executions'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['automation', 'responses'],
      });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });
}

export function useSimulateAttack() {
  return useAutomationAction<SimulatePayload, SimulateResponse>((payload) =>
    apiPost<SimulateResponse>('/automation/simulate', payload),
  );
}

export function useBlockIp() {
  return useAutomationAction<BlockIpPayload, BlockIpResponse>((payload) =>
    apiPost<BlockIpResponse>('/automation/block-ip', payload),
  );
}

export function useCreateTicket() {
  return useAutomationAction<CreateTicketPayload, CreateTicketResponse>(
    (payload) =>
      apiPost<CreateTicketResponse>('/automation/create-ticket', payload),
  );
}

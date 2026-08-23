import { useState } from 'react';

import Modal from '../../components/Modal';

import { useBlockIp, useCreateTicket, useSimulateAttack } from './mutations';
import { parsePayloadText } from './payload';
import { isValidIpv4, parseOptionalDuration } from './validators';

export interface ActionModalProps {
  onClose: () => void;
  /** Se invoca SOLO tras éxito: cierra el modal y muestra el aviso. */
  onDone: (notice: string) => void;
}

function errorOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Error desconocido';
}

function summarizeResult(result: Record<string, unknown>): string {
  const text = JSON.stringify(result) ?? '';
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

/** Modal de simulación de ataque contra un honeypot vía webhook n8n. */
export function SimulateModal({ onClose, onDone }: ActionModalProps) {
  const [honeypot, setHoneypot] = useState<'cowrie' | 'dionaea'>('cowrie');
  const [payloadText, setPayloadText] = useState('');
  const mutation = useSimulateAttack();

  return (
    <Modal
      title="Simular ataque"
      error={mutation.isError ? errorOf(mutation.error) : null}
      pending={mutation.isPending}
      submitLabel="Simular"
      onClose={onClose}
      onSubmit={() =>
        mutation.mutate(
          { honeypot, payload: parsePayloadText(payloadText) },
          {
            onSuccess: (response) =>
              onDone(
                `Simulación enviada a ${response.honeypot}. Resultado de n8n: ${summarizeResult(response.result)}`,
              ),
          },
        )
      }
    >
      <label className="modal-field">
        <span>Honeypot</span>
        <select
          value={honeypot}
          onChange={(event) =>
            setHoneypot(event.target.value as 'cowrie' | 'dionaea')
          }
        >
          <option value="cowrie">Cowrie (SSH/Telnet)</option>
          <option value="dionaea">Dionaea (malware)</option>
        </select>
      </label>
      <label className="modal-field">
        <span>Payload</span>
        <textarea
          rows={6}
          value={payloadText}
          onChange={(event) => setPayloadText(event.target.value)}
          placeholder={'{"user":"root","password":"123456"} o texto libre'}
          className="font-mono"
        />
        <small>JSON libre o texto; se envía como objeto al webhook.</small>
      </label>
    </Modal>
  );
}

/** Modal de bloqueo de IP vía workflow firewall-block de n8n. */
export function BlockIpModal({ onClose, onDone }: ActionModalProps) {
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [durationText, setDurationText] = useState('');
  const mutation = useBlockIp();

  const duration = parseOptionalDuration(durationText);
  const ipValid = isValidIpv4(ip);
  const canSubmit =
    ipValid && reason.trim().length > 0 && duration.ok && !mutation.isPending;

  return (
    <Modal
      title="Bloquear IP"
      error={mutation.isError ? errorOf(mutation.error) : null}
      pending={mutation.isPending}
      submitLabel="Bloquear"
      submitDisabled={!canSubmit}
      onClose={onClose}
      onSubmit={() => {
        if (!ipValid || !duration.ok) return;
        mutation.mutate(
          { src_ip: ip.trim(), reason: reason.trim(), duration: duration.seconds },
          {
            onSuccess: (response) =>
              onDone(
                `Bloqueo solicitado para ${response.src_ip}. Resultado de n8n: ${summarizeResult(response.result)}`,
              ),
          },
        );
      }}
    >
      <label className="modal-field">
        <span>IP origen</span>
        <input
          type="text"
          value={ip}
          onChange={(event) => setIp(event.target.value)}
          placeholder="203.0.113.10"
          className="font-mono"
          autoFocus
        />
        {ip.trim() !== '' && !ipValid ? (
          <small className="modal-hint-error">Formato IPv4 inválido.</small>
        ) : null}
      </label>
      <label className="modal-field">
        <span>Razón</span>
        <input
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Fuerza bruta SSH detectada"
        />
      </label>
      <label className="modal-field">
        <span>Duración (segundos, opcional)</span>
        <input
          type="text"
          inputMode="numeric"
          value={durationText}
          onChange={(event) => setDurationText(event.target.value)}
          placeholder="3600"
          className="font-mono"
        />
        {!duration.ok ? (
          <small className="modal-hint-error">
            Ingresá un entero ≥ 0 o dejalo vacío.
          </small>
        ) : null}
      </label>
    </Modal>
  );
}

/** Modal de creación de ticket GLPI vía workflow glpi-ticket de n8n. */
export function TicketModal({ onClose, onDone }: ActionModalProps) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const mutation = useCreateTicket();

  const canSubmit = name.trim().length > 0 && content.trim().length > 0;

  return (
    <Modal
      title="Crear ticket GLPI"
      error={mutation.isError ? errorOf(mutation.error) : null}
      pending={mutation.isPending}
      submitLabel="Crear ticket"
      submitDisabled={!canSubmit}
      onClose={onClose}
      onSubmit={() => {
        if (!canSubmit) return;
        mutation.mutate(
          { name: name.trim(), content: content.trim(), urgency },
          {
            onSuccess: (response) =>
              onDone(
                `Ticket "${name.trim()}" enviado a GLPI. Resultado de n8n: ${summarizeResult(response.result)}`,
              ),
          },
        );
      }}
    >
      <label className="modal-field">
        <span>Nombre</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Alerta SOC: fuerza bruta desde 203.0.113.10"
          autoFocus
        />
      </label>
      <label className="modal-field">
        <span>Contenido</span>
        <textarea
          rows={5}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Descripción del incidente para el ticket…"
        />
      </label>
      <label className="modal-field">
        <span>Urgencia</span>
        <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
          <option value="low">Baja</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
        </select>
      </label>
    </Modal>
  );
}

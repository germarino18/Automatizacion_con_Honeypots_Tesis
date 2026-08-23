import { useState } from 'react';

import {
  SEVERITIES,
  toDateTimeInputValue,
  type EventFilterState,
} from './filters';

const HONEYPOT_OPTIONS = ['cowrie', 'dionaea'] as const;

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

interface EventFiltersBarProps {
  value: EventFilterState;
  onApply: (draft: EventFilterState) => void;
  onReset: () => void;
}

/**
 * Barra de filtros con borrador local: los cambios solo golpean la API
 * al pulsar "Aplicar" (o Enter). El borrador se resincroniza cuando el
 * estado aplicado cambia (reset del padre, deep-link inicial).
 */
export default function EventFiltersBar({
  value,
  onApply,
  onReset,
}: EventFiltersBarProps) {
  const [draft, setDraft] = useState<EventFilterState>(value);
  const [syncedValue, setSyncedValue] = useState<EventFilterState>(value);

  // Patrón canónico de React para reajustar estado durante render cuando
  // cambia el valor aplicado (reset del padre, deep-link inicial): evita
  // el setState-en-effect y el render en cascada.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  const patch = (partial: Partial<EventFilterState>) => {
    setDraft((current) => ({ ...current, ...partial }));
  };

  return (
    <form
      className="card filters-bar"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft);
      }}
    >
      <div className="filter-field">
        <label htmlFor="filter-from">Desde (UTC)</label>
        <input
          id="filter-from"
          type="datetime-local"
          value={toDateTimeInputValue(draft.from)}
          onChange={(event) => patch({ from: event.target.value })}
        />
      </div>

      <div className="filter-field">
        <label htmlFor="filter-to">Hasta (UTC)</label>
        <input
          id="filter-to"
          type="datetime-local"
          value={toDateTimeInputValue(draft.to)}
          onChange={(event) => patch({ to: event.target.value })}
        />
      </div>

      <div className="filter-field">
        <label htmlFor="filter-severity">Severidad</label>
        <select
          id="filter-severity"
          value={draft.severity}
          onChange={(event) =>
            patch({ severity: event.target.value as EventFilterState['severity'] })
          }
        >
          <option value="">Todas</option>
          {SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {SEVERITY_LABELS[severity]}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor="filter-honeypot">Honeypot</label>
        <select
          id="filter-honeypot"
          value={draft.source_honeypot}
          onChange={(event) => patch({ source_honeypot: event.target.value })}
        >
          <option value="">Todos</option>
          {HONEYPOT_OPTIONS.map((honeypot) => (
            <option key={honeypot} value={honeypot}>
              {honeypot}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor="filter-protocol">Protocolo</label>
        <input
          id="filter-protocol"
          type="text"
          placeholder="ej. ssh"
          value={draft.protocol}
          onChange={(event) => patch({ protocol: event.target.value })}
        />
      </div>

      <div className="filter-field">
        <label htmlFor="filter-src-ip">IP origen</label>
        <input
          id="filter-src-ip"
          type="text"
          placeholder="ej. 203.0.113.7"
          value={draft.src_ip}
          onChange={(event) => patch({ src_ip: event.target.value })}
        />
      </div>

      <div className="filter-field">
        <label htmlFor="filter-technique">Técnica MITRE</label>
        <input
          id="filter-technique"
          type="text"
          placeholder="ej. T1110"
          value={draft.technique}
          onChange={(event) => patch({ technique: event.target.value })}
        />
      </div>

      <div className="filter-field filter-field-wide">
        <label htmlFor="filter-search">Búsqueda de texto</label>
        <input
          id="filter-search"
          type="search"
          placeholder="Comandos o raw_data…"
          value={draft.search}
          onChange={(event) => patch({ search: event.target.value })}
        />
      </div>

      <div className="filter-actions">
        <button type="submit" className="btn btn-accent">
          Aplicar filtros
        </button>
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          Restablecer
        </button>
      </div>
    </form>
  );
}

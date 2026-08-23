import { useMemo, useState } from 'react';

import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';

import {
  BlockIpModal,
  SimulateModal,
  TicketModal,
} from './ActionModals';
import type { ExecutionItem, ResponseItem } from '../../lib/api';
import { formatInteger, formatTimestamp } from '../../lib/formatters';
import { useAutomationResponses, useExecutions, useWorkflows } from './useAutomation';

const RESPONSES_PAGE_SIZE = 10;
const EXECUTIONS_LIMIT = 50;

type ModalKind = 'simulate' | 'block' | 'ticket' | null;

function executionStatusBadge(status: string | null | undefined): string {
  const value = (status ?? '').toLowerCase();
  if (value === 'success') return 'badge-status success';
  if (value === 'error' || value === 'failed' || value === 'crashed') {
    return 'badge-status danger';
  }
  if (
    value === 'running' ||
    value === 'waiting' ||
    value === 'new' ||
    value === 'active'
  ) {
    return 'badge-status running';
  }
  return 'badge-status';
}

function actionTypeBadge(actionType: string): string {
  const value = actionType.toLowerCase();
  if (value.includes('bloqueo')) return 'badge-action bloqueo';
  if (value.includes('alerta')) return 'badge-action alerta';
  return 'badge-action';
}

function ExecutionsTable({
  executions,
  workflowNames,
}: {
  executions: ExecutionItem[];
  workflowNames: Map<string, string>;
}) {
  const latest = executions.slice(0, EXECUTIONS_LIMIT);
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Workflow</th>
            <th>Estado</th>
            <th>Inicio</th>
          </tr>
        </thead>
        <tbody>
          {latest.map((execution) => (
            <tr key={String(execution.id)}>
              <td className="font-mono">{String(execution.id)}</td>
              <td>
                {execution.workflowId !== null &&
                execution.workflowId !== undefined
                  ? (workflowNames.get(String(execution.workflowId)) ??
                    `#${String(execution.workflowId)}`)
                  : '—'}
              </td>
              <td>
                <span className={executionStatusBadge(execution.status)}>
                  {execution.status ?? 'desconocido'}
                </span>
              </td>
              <td className="cell-muted font-mono">
                {execution.startedAt ? formatTimestamp(execution.startedAt) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResponsesTable({ items }: { items: ResponseItem[] }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Acción</th>
            <th>Actor</th>
            <th>Estado</th>
            <th>Evento</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <span className={actionTypeBadge(item.action_type)}>
                  {item.action_type}
                </span>
              </td>
              <td>{item.actor ?? '—'}</td>
              <td>{item.status ?? '—'}</td>
              <td className="font-mono">
                {item.event_id !== null && item.event_id !== undefined
                  ? item.event_id
                  : '—'}
              </td>
              <td className="cell-muted font-mono">
                {formatTimestamp(item.timestamp ?? item.created_at ?? '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Automatización y Respuesta: pipelines n8n + acciones SOAR + historial. */
export default function Automatizacion() {
  const workflows = useWorkflows();
  const executions = useExecutions();
  const [page, setPage] = useState(1);
  const responses = useAutomationResponses({
    page,
    page_size: RESPONSES_PAGE_SIZE,
  });

  const [activeModal, setActiveModal] = useState<ModalKind>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const n8nDown =
    workflows.isError ||
    workflows.data?.degraded === true ||
    executions.data?.degraded === true;

  const degradedMessage =
    executions.data?.degraded === true
      ? (executions.data.message ?? 'n8n en estado degradado.')
      : workflows.isError
        ? 'No se pudo consultar n8n; las acciones están deshabilitadas.'
        : 'Las acciones SOAR requieren n8n y está degradado.';

  const workflowNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const workflow of workflows.data?.items ?? []) {
      names.set(String(workflow.id), workflow.name);
    }
    return names;
  }, [workflows.data]);

  const activeCount = (workflows.data?.items ?? []).filter((w) => w.active).length;
  const inactiveCount = (workflows.data?.items ?? []).length - activeCount;

  const totalPages = Math.max(
    1,
    Math.ceil((responses.data?.total ?? 0) / RESPONSES_PAGE_SIZE),
  );

  const openModal = (kind: Exclude<ModalKind, null>) => {
    setNotice(null);
    setActiveModal(kind);
  };

  const handleDone = (message: string) => {
    setActiveModal(null);
    setNotice(message);
  };

  const renderModal = () => {
    switch (activeModal) {
      case 'simulate':
        return (
          <SimulateModal
            onClose={() => setActiveModal(null)}
            onDone={handleDone}
          />
        );
      case 'block':
        return (
          <BlockIpModal
            onClose={() => setActiveModal(null)}
            onDone={handleDone}
          />
        );
      case 'ticket':
        return (
          <TicketModal
            onClose={() => setActiveModal(null)}
            onDone={handleDone}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section className="screen">
      <h1 className="screen-title">Automatización y Respuesta</h1>
      <p className="screen-subtitle">
        Estado de los pipelines n8n, historial de ejecuciones/respuestas y
        acciones SOAR manuales.
      </p>

      {n8nDown ? (
        <div className="live-banner warning" role="alert">
          ⚠ n8n degradado o no disponible: {degradedMessage}
        </div>
      ) : null}
      {notice ? (
        <div className="action-notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            className="action-notice-dismiss"
            onClick={() => setNotice(null)}
            aria-label="Descartar aviso"
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="metric-grid automation-metrics">
        <article className="card metric-card">
          <h2 className="metric-card-title">Pipelines</h2>
          <p className="metric-card-value font-mono">
            {workflows.isError ? '—' : formatInteger(workflows.data?.items.length ?? 0)}
          </p>
        </article>
        <article className="card metric-card">
          <h2 className="metric-card-title">Activos</h2>
          <p className="metric-card-value font-mono">
            {workflows.isError ? '—' : formatInteger(activeCount)}
          </p>
        </article>
        <article className="card metric-card">
          <h2 className="metric-card-title">Inactivos</h2>
          <p className="metric-card-value font-mono">
            {workflows.isError ? '—' : formatInteger(inactiveCount)}
          </p>
        </article>
        <article className="card metric-card">
          <h2 className="metric-card-title">Ejecuciones recientes</h2>
          <p className="metric-card-value font-mono">
            {executions.isError ? '—' : formatInteger(executions.data?.items.length ?? 0)}
          </p>
        </article>
      </div>

      <div className="actions-row">
        <button
          type="button"
          className="btn btn-accent"
          disabled={n8nDown}
          title={n8nDown ? 'Requiere n8n disponible' : undefined}
          onClick={() => openModal('simulate')}
        >
          Simular ataque
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={n8nDown}
          title={n8nDown ? 'Requiere n8n disponible' : undefined}
          onClick={() => openModal('block')}
        >
          Bloquear IP
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={n8nDown}
          title={n8nDown ? 'Requiere n8n disponible' : undefined}
          onClick={() => openModal('ticket')}
        >
          Crear ticket GLPI
        </button>
      </div>

      <div className="panel-grid automation-panels">
        <article className="card panel">
          <h2 className="panel-title panel-title-with-count">
            <span>Ejecuciones recientes</span>
            <span className="mitre-tactic-subtotal">
              últimas {EXECUTIONS_LIMIT}
            </span>
          </h2>
          {executions.isPending ? (
            <div className="loading-state">
              <span className="spinner" aria-hidden="true" /> Cargando…
            </div>
          ) : executions.isError ? (
            <ErrorState
              message={
                executions.error instanceof Error
                  ? executions.error.message
                  : 'Error desconocido'
              }
              onRetry={() => {
                void executions.refetch();
              }}
            />
          ) : (executions.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title="Sin ejecuciones"
              message="n8n no reporta ejecuciones recientes."
            />
          ) : (
            <ExecutionsTable
              executions={executions.data.items}
              workflowNames={workflowNames}
            />
          )}
        </article>

        <article className="card panel">
          <h2 className="panel-title panel-title-with-count">
            <span>Historial de respuestas</span>
            <span className="mitre-tactic-subtotal font-mono">
              {responses.data ? `${formatInteger(responses.data.total)} registros` : ''}
            </span>
          </h2>
          {responses.isPending ? (
            <div className="loading-state">
              <span className="spinner" aria-hidden="true" /> Cargando…
            </div>
          ) : responses.isError ? (
            <ErrorState
              message={
                responses.error instanceof Error
                  ? responses.error.message
                  : 'Error desconocido'
              }
              onRetry={() => {
                void responses.refetch();
              }}
            />
          ) : (responses.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title="Sin respuestas registradas"
              message="Todavía no hay acciones automatizadas (bloqueos, alertas o simulaciones)."
            />
          ) : (
            <>
              <ResponsesTable items={responses.data.items} />
              <div className="table-footer">
                <span className="page-info font-mono">
                  Página {responses.data.page} de {totalPages}
                </span>
                <div className="pagination">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            </>
          )}
        </article>
      </div>

      {renderModal()}
    </section>
  );
}

import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import type { WorkflowItem } from '../../lib/api';
import { formatTimestamp } from '../../lib/formatters';
import { useWorkflows } from '../automation/useAutomation';

const N8N_EDITOR_BASE = 'http://localhost:5678/workflow';

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`badge-status ${active ? 'success' : ''}`}>
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}

/** Pantalla Workflows n8n: inventario de pipelines y enlace al editor. */
export default function WorkflowsN8n() {
  const workflows = useWorkflows();
  const items: WorkflowItem[] = workflows.data?.items ?? [];

  return (
    <section className="screen">
      <h1 className="screen-title">Workflows n8n</h1>
      <p className="screen-subtitle">
        Inventario de workflows registrados en la instancia n8n del SOC, con su
        estado de activación y acceso directo al editor.
      </p>

      {workflows.data?.degraded === true ? (
        <div className="live-banner warning" role="alert">
          ⚠ n8n degradado:{' '}
          {workflows.data.message ?? 'respuesta parcial de la instancia.'}
        </div>
      ) : null}

      <article className="card panel">
        <h2 className="panel-title panel-title-with-count">
          <span>Workflows</span>
          {!workflows.isError && workflows.data ? (
            <span className="mitre-tactic-subtotal font-mono">
              {items.length} registrados
            </span>
          ) : null}
        </h2>

        {workflows.isPending ? (
          <div className="loading-state">
            <span className="spinner" aria-hidden="true" /> Cargando…
          </div>
        ) : workflows.isError ? (
          <ErrorState
            message={
              workflows.error instanceof Error
                ? workflows.error.message
                : 'Error desconocido'
            }
            onRetry={() => {
              void workflows.refetch();
            }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="Sin workflows"
            message="La instancia n8n no reporta workflows registrados."
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Última actualización</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((workflow) => (
                  <tr key={String(workflow.id)}>
                    <td>{workflow.name}</td>
                    <td>
                      <ActiveBadge active={workflow.active} />
                    </td>
                    <td className="cell-muted font-mono">
                      {workflow.updated_at
                        ? formatTimestamp(workflow.updated_at)
                        : '—'}
                    </td>
                    <td>
                      <a
                        className="btn btn-ghost"
                        href={`${N8N_EDITOR_BASE}/${String(workflow.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir en editor ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

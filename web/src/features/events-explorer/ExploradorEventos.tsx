import { useState } from 'react';

import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { downloadTextFile, eventsToCsv } from '../../lib/csv';
import { formatInteger } from '../../lib/formatters';
import EventDetailDrawer from './EventDetailDrawer';
import EventFiltersBar from './EventFiltersBar';
import EventsTable from './EventsTable';
import { fetchEventsForExport } from './exportEvents';
import { useEventFilters } from './useEventFilters';
import { useEvents } from './useEvents';

function exportFilename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `eventos_${today}.csv`;
}

/** Explorador de Eventos: filtros combinables, paginación, CSV y detalle. */
export default function ExploradorEventos() {
  const {
    state,
    page,
    pageSize,
    query,
    applyFilters,
    resetFilters,
    goToPage,
    changePageSize,
  } = useEventFilters();

  const { data, isPending, isFetching, isError, error, refetch } =
    useEvents(query);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const rows = await fetchEventsForExport(query);
      downloadTextFile(exportFilename(), eventsToCsv(rows));
    } catch (cause) {
      setExportError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo generar el CSV.',
      );
    } finally {
      setExporting(false);
    }
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="screen">
      <h1 className="screen-title">Explorador de Eventos</h1>
      <p className="screen-subtitle">
        Filtros combinables sobre honeypot_events, orden fijo por timestamp
        descendente. Las fechas se interpretan en UTC.
      </p>

      <EventFiltersBar
        value={state}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      <div className="events-toolbar">
        {data ? (
          <span className="events-count">
            {formatInteger(total)} eventos · Página {page} de {totalPages}
          </span>
        ) : (
          <span />
        )}
        <div className="events-export">
          {exportError ? (
            <span className="export-error" role="alert">
              {exportError}
            </span>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={exporting || total === 0}
            onClick={() => {
              void handleExport();
            }}
          >
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
        </div>
      </div>

      <div className="card panel">
        {isPending ? (
          <div className="loading-state">
            <span className="spinner" aria-hidden="true" /> Cargando eventos…
          </div>
        ) : isError || !data ? (
          <ErrorState
            message={
              error instanceof Error ? error.message : 'Error desconocido'
            }
            onRetry={() => {
              void refetch();
            }}
          />
        ) : data.items.length === 0 ? (
          <EmptyState
            title="Sin resultados"
            message="Ningún evento cumple los filtros aplicados. Prueba a relajarlos."
          />
        ) : (
          <>
            <EventsTable
              events={data.items}
              fetching={isFetching && !isPending}
              onSelect={(event) => setSelectedId(event.id)}
            />
            <div className="table-footer">
              <span className="page-info font-mono">
                Página {page} de {totalPages} · {formatInteger(total)} eventos
              </span>
              <div className="pagination">
                <label htmlFor="page-size">Por página</label>
                <select
                  id="page-size"
                  className="page-size-select"
                  value={pageSize}
                  onChange={(event) =>
                    changePageSize(Number(event.target.value))
                  }
                >
                  {[25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <EventDetailDrawer
        eventId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </section>
  );
}

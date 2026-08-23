import { useNavigate } from 'react-router-dom';

import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import type { TechniqueCount } from '../../lib/api';
import { formatInteger } from '../../lib/formatters';
import type { MitreSection } from './grouping';
import { groupByTactic } from './grouping';
import { useMitre } from './useMitre';

function TechniqueRow({
  item,
  maxCount,
  onSelect,
}: {
  item: TechniqueCount;
  maxCount: number;
  onSelect: (technique: string) => void;
}) {
  const width = `${Math.round((item.count / Math.max(maxCount, 1)) * 100)}%`;
  return (
    <li>
      <button
        type="button"
        className="mitre-row-btn"
        onClick={() => onSelect(item.technique)}
        title={`Ver eventos de ${item.technique} en el explorador`}
      >
        <span className="mitre-row-top">
          <span className="mitre-row-id-name">
            <span className="font-mono mitre-tech-id">{item.technique}</span>
            <span className="mitre-tech-name">{item.name ?? '—'}</span>
          </span>
          <span className="mitre-count font-mono">
            {formatInteger(item.count)}
          </span>
        </span>
        <span className="bar-track">
          <span className="bar-fill" style={{ width }} />
        </span>
      </button>
    </li>
  );
}

function TacticSection({
  section,
  onSelect,
}: {
  section: MitreSection;
  onSelect: (technique: string) => void;
}) {
  return (
    <article className="card panel">
      <h2 className="panel-title mitre-tactic-title">
        <span>{section.tactic}</span>
        <span className="mitre-tactic-subtotal font-mono">
          {formatInteger(section.subtotal)}
        </span>
      </h2>
      <ul className="mitre-list">
        {section.items.map((item) => (
          <TechniqueRow
            key={item.technique}
            item={item}
            maxCount={section.maxCount}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </article>
  );
}

/** Matriz MITRE ATT&CK: técnicas observadas agrupadas por táctica. */
export default function MatrizMitre() {
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch } = useMitre();

  const goToExplorer = (technique: string) => {
    navigate(`/eventos?technique=${encodeURIComponent(technique)}`);
  };

  return (
    <section className="screen">
      <h1 className="screen-title">Matriz MITRE ATT&amp;CK</h1>
      <p className="screen-subtitle">
        Técnicas detectadas agrupadas por táctica. Seleccioná una técnica para
        abrir el Explorador de Eventos con ese filtro aplicado.
      </p>

      {isPending ? (
        <div className="card loading-state">
          <span className="spinner" aria-hidden="true" /> Cargando matriz…
        </div>
      ) : isError || !data ? (
        <div className="card">
          <ErrorState
            message={
              error instanceof Error ? error.message : 'Error desconocido'
            }
            onRetry={() => {
              void refetch();
            }}
          />
        </div>
      ) : data.techniques.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Sin técnicas registradas"
            message="No hay eventos con técnica ATT&CK en el rango consultado."
          />
        </div>
      ) : (
        <>
          <div className="events-toolbar">
            <span className="events-count">
              {formatInteger(data.techniques.length)} técnicas ·{' '}
              {formatInteger(data.total)} eventos
            </span>
          </div>
          <div className="mitre-grid">
            {groupByTactic(data.techniques).map((section) => (
              <TacticSection
                key={section.tactic}
                section={section}
                onSelect={goToExplorer}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

import { useMemo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { formatInteger } from '../../lib/formatters';

import worldTopoJson from '../../assets/world-110m.json';
import { MAP_NEUTRAL_COLOR, buildColorScale } from './colorScale';
import { buildAtlasIndex, matchCountry } from './countryMatching';
import { useGeoCountries } from './useGeo';

interface WorldTopo {
  objects: {
    countries: {
      geometries: Array<{ properties?: { name?: string } }>;
    };
  };
}

const worldTopo = worldTopoJson as unknown as WorldTopo;

interface CountryRow {
  country: string;
  count: number;
  geoName: string | null;
}

function Legend({
  buckets,
}: {
  buckets: readonly { min: number; max: number; color: string }[];
}) {
  if (buckets.length === 0) return null;
  return (
    <div className="mapa-legend">
      <span className="mapa-legend-title">Ataques por país</span>
      <ul className="mapa-legend-list">
        {buckets.map((bucket) => (
          <li key={bucket.color}>
            <span
              className="mapa-legend-swatch"
              style={{ background: bucket.color }}
              aria-hidden="true"
            />
            <span className="font-mono mapa-legend-range">
              {formatInteger(bucket.min)}–{formatInteger(bucket.max)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mapa Geográfico: origen de los ataques con topojson offline embebido. */
export default function MapaGeografico() {
  const { data, isPending, isError, error, refetch } = useGeoCountries();

  const atlasIndex = useMemo(
    () =>
      buildAtlasIndex(
        worldTopo.objects.countries.geometries.map(
          (geometry) => geometry.properties?.name ?? '',
        ),
      ),
    [],
  );

  const rows = useMemo<CountryRow[]>(
    () =>
      (data?.countries ?? [])
        .map((entry) => ({
          country: entry.country,
          count: entry.count,
          geoName: matchCountry(entry.country, atlasIndex),
        }))
        .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country)),
    [data, atlasIndex],
  );

  const scale = useMemo(() => buildColorScale(rows.map((row) => row.count)), [rows]);

  const countByGeoName = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row.geoName !== null && !counts.has(row.geoName)) {
        counts.set(row.geoName, row.count);
      }
    }
    return counts;
  }, [rows]);

  // "Sin data geo": lista vacía o solo el marcador "Desconocido" de la API.
  const hasGeoData =
    rows.length > 0 && rows.some((row) => row.country !== 'Desconocido');

  return (
    <section className="screen">
      <h1 className="screen-title">Mapa Geográfico</h1>
      <p className="screen-subtitle">
        Origen geográfico de los ataques según el enriquecimiento de eventos.
      </p>

      {isPending ? (
        <div className="card loading-state">
          <span className="spinner" aria-hidden="true" /> Cargando mapa…
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
      ) : !hasGeoData ? (
        <div className="card">
          <EmptyState
            title="Sin datos geográficos"
            message="Ningún evento del rango consultado tiene país en su enriquecimiento (ni coincidió con la tabla de rangos IP)."
          />
        </div>
      ) : (
        <>
          {data.fallback_used ? (
            <div className="live-banner warning" role="status">
              Sin enriquecimiento directo: países estimados por rangos de IP.
            </div>
          ) : null}
          <div className="mapa-layout">
            <article className="card panel mapa-map-panel">
              <ComposableMap
                width={800}
                height={400}
                projection="geoEqualEarth"
                projectionConfig={{ scale: 146 }}
                className="mapa-svg"
              >
                <Geographies geography={worldTopoJson as unknown as Record<string, unknown>}>
                  {({ geographies }) => (
                    <>
                      {geographies.map((geo) => {
                        const name =
                          typeof geo.properties?.name === 'string'
                            ? geo.properties.name
                            : '';
                        const count = countByGeoName.get(name);
                        const fill =
                          count === undefined
                            ? MAP_NEUTRAL_COLOR
                            : scale.colorFor(count);
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={fill}
                            className="geo-path"
                          >
                            <title>
                              {count === undefined
                                ? `${name} — sin ataques`
                                : `${name}: ${formatInteger(count)} ataques`}
                            </title>
                          </Geography>
                        );
                      })}
                    </>
                  )}
                </Geographies>
              </ComposableMap>
              <Legend buckets={scale.buckets} />
            </article>

            <article className="card panel mapa-table-panel">
              <h2 className="panel-title panel-title-with-count">
                <span>Países de origen</span>
                <span className="mitre-tactic-subtotal font-mono">
                  {formatInteger(data.total)} eventos
                </span>
              </h2>
              <div className="table-scroll mapa-table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>País</th>
                      <th>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.country}>
                        <td title={row.geoName ?? 'Sin geometría en el mapa'}>
                          {row.country}
                        </td>
                        <td className="font-mono">{formatInteger(row.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  );
}

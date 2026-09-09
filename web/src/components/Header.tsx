import { useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthContext';
import { downloadTextFile, eventsToCsv } from '../lib/csv';
import { fetchEventsForExport } from '../features/events-explorer/exportEvents';

interface SectionInfo {
  kicker: string;
  title: string;
}

const SECTION_BY_PATH: Record<string, SectionInfo> = {
  '/': { kicker: 'Overview', title: 'Resumen del SOC' },
  '/live': { kicker: 'Live feed', title: 'Ataques en Vivo' },
  '/eventos': { kicker: 'Exploration', title: 'Explorador de Eventos' },
  '/mitre': { kicker: 'Framework', title: 'Matriz MITRE ATT&CK' },
  '/mapa': { kicker: 'Geomap', title: 'Mapa Geográfico' },
  '/malware': { kicker: 'Indicators', title: 'Malware & IoC' },
  '/automatizacion': { kicker: 'Automation', title: 'Automatización y Respuesta' },
  '/workflows': { kicker: 'Workflows', title: 'Workflows n8n' },
  '/login': { kicker: 'Access', title: 'Iniciar sesión' },
};

const DEFAULT_SECTION: SectionInfo = {
  kicker: 'Threat ops',
  title: 'Consola SOC',
};

function sectionInfo(pathname: string): SectionInfo {
  return SECTION_BY_PATH[pathname] ?? DEFAULT_SECTION;
}

function exportFilename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `eventos_${today}.csv`;
}

/** Exporta el set completo de eventos (misma lógica que el Explorador). */
function ExportarCsv() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const rows = await fetchEventsForExport({});
      downloadTextFile(exportFilename(), eventsToCsv(rows));
    } catch (cause) {
      setExportError(
        cause instanceof Error ? cause.message : 'No se pudo generar el CSV.',
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="header-export">
      {exportError ? (
        <span className="export-error" role="alert">
          {exportError}
        </span>
      ) : null}
      <button
        type="button"
        className="btn btn--primary"
        disabled={exporting}
        title="Exportar todos los eventos a CSV"
        onClick={() => {
          void handleExport();
        }}
      >
        {exporting ? 'Exportando…' : 'Exportar CSV'}
      </button>
    </div>
  );
}

export default function Header() {
  const { pathname } = useLocation();
  const { isAuthenticated, status } = useAuth();
  const { kicker, title } = sectionInfo(pathname);

  return (
    <header className="header">
      <div className="header-section">
        <span className="header-kicker">{kicker}</span>
        <span className="header-title">{title}</span>
      </div>
      <div className="header-user">
        <span
          className="header-window"
          title="Ventana de análisis: últimas 24 horas"
        >
          <span className="status-dot sse" aria-hidden="true" />
          24 H
        </span>
        {status === 'authenticated' && (
          <span className="header-user-name">SOC Operator</span>
        )}
        {!isAuthenticated ? null : pathname === '/' ? <ExportarCsv /> : null}
      </div>
    </header>
  );
}
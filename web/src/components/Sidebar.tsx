import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import type { ReactNode } from 'react';

import { useAuth } from '../features/auth/AuthContext';
import { useServicesHealth } from '../lib/useHealth';
import {
  sidebarRailClass,
  sidebarToggleLabel,
  toggleSidebarMode,
  type SidebarMode,
} from './sidebarState';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  icon: ReactNode;
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Resumen',
    end: true,
    icon: (
      <Icon path="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
    ),
  },
  {
    to: '/live',
    label: 'Ataques en Vivo',
    icon: <Icon path="M2 12h4l3 -8 4 16 3 -8h6" />,
  },
  {
    to: '/eventos',
    label: 'Explorador',
    icon: (
      <Icon path="M4 6h16M4 12h16M4 18h10" />
    ),
  },
  {
    to: '/mitre',
    label: 'MITRE ATT&CK',
    icon: (
      <Icon path="M4 4h7v5H4zM13 4h7v5h-7zM4 15h7v5H4zM13 15h7v5h-7z" />
    ),
  },
  {
    to: '/mapa',
    label: 'Mapa Geográfico',
    icon: (
      <Icon path="M12 21c-4 -4.5 -7 -8 -7 -11a7 7 0 0 1 14 0c0 3 -3 6.5 -7 11zM12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0" />
    ),
  },
  {
    to: '/malware',
    label: 'Malware & IoC',
    icon: (
      <Icon path="M9 3v3M15 3v3M6 6h12v7a6 6 0 0 1 -12 0zM9 12h.01M15 12h.01M12 12v3" />
    ),
  },
  {
    to: '/automatizacion',
    label: 'Automatización',
    icon: (
      <Icon path="M12 2l3 3h4v4l3 3 -3 3v4h-4l-3 3 -3 -3H5v-4L2 12l3 -3V5h4z" />
    ),
  },
  {
    to: '/workflows',
    label: 'Workflows n8n',
    icon: (
      <Icon path="M3 5h6v6H3zM15 13h6v6h-6zM9 8h4a2 2 0 0 1 2 2v5M12 8V5a2 2 0 0 1 2-2h1" />
    ),
  },
];

/** Escudo de la marca con el gradiente v3 (#38449e → #141733). */
function BrandMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="brand-shield-grad" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38449e" />
          <stop offset="100%" stopColor="#141733" />
        </linearGradient>
      </defs>
      <path
        d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z"
        fill="url(#brand-shield-grad)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8.5 12l2.5 2.5 4.5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function statusLabel(status: string): string {
  if (status === 'ok') return 'operativo';
  if (status === 'down') return 'caído';
  if (status === 'degraded') return 'degradado';
  return status;
}

function ServiceStatus() {
  const { data, isError } = useServicesHealth();

  const services: Array<{ key: string; label: string; status: string }> =
    isError
      ? [{ key: 'api', label: 'API', status: 'down' }]
      : Object.entries(data?.services ?? {}).map(([key, value]) => ({
          key,
          label: key === 'n8n' ? 'n8n' : key.charAt(0).toUpperCase() + key.slice(1),
          status: value.status === 'ok' ? 'ok' : value.status,
        }));

  if (!isError && services.length === 0) {
    services.push(
      { key: 'api', label: 'API', status: 'unknown' },
      { key: 'postgres', label: 'Postgres', status: 'unknown' },
      { key: 'n8n', label: 'n8n', status: 'unknown' },
    );
  }

  return (
    <div className="sidebar-services">
      <p className="sidebar-services-title">Servicios</p>
      {services.map((service) => (
        <div
          className="service-status"
          key={service.key}
          title={`${service.label} — ${statusLabel(service.status)}`}
        >
          <span
            className={`status-dot ${service.status}`}
            title={statusLabel(service.status)}
          />
          <span className="service-label">{service.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Sidebar() {
  const { isAuthenticated, status, logout } = useAuth();
  const [mode, setMode] = useState<SidebarMode>('expanded');

  return (
    <aside className={`sidebar${sidebarRailClass(mode)}`}>
      <button
        type="button"
        className="sidebar-brand"
        onClick={() => setMode((current) => toggleSidebarMode(current))}
        aria-expanded={mode === 'expanded'}
        aria-label={sidebarToggleLabel(mode)}
        title={sidebarToggleLabel(mode)}
      >
        <span className="sidebar-brand-icon">
          <BrandMark />
        </span>
        <span className="sidebar-brand-text">
          <span className="sidebar-brand-name">HONEYPOT SOC</span>
          <span className="sidebar-brand-tagline">threat ops</span>
        </span>
      </button>

      <nav className="sidebar-nav" aria-label="Navegación principal">
        <h2 className="sidebar-section-title">Operación</h2>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}`
            }
            title={item.label}
          >
            {item.icon}
            <span className="sidebar-link-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <ServiceStatus />
        <button
          type="button"
          className="btn btn--tint-danger sidebar-logout"
          disabled={!isAuthenticated || status === 'probing'}
          title={
            isAuthenticated
              ? 'Cerrar la sesión actual'
              : 'Inicia sesión para cerrar sesión'
          }
          onClick={() => {
            void logout();
          }}
        >
          <Icon path="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          <span className="sidebar-logout-label">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
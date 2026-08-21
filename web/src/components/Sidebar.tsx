import { NavLink } from 'react-router-dom';

import type { ReactNode } from 'react';

import { useServicesHealth } from '../lib/useHealth';

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
];

function BrandMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z"
        fill="var(--accent-soft)"
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
    <div className="sidebar-footer">
      <p className="sidebar-services-title">Servicios</p>
      {services.map((service) => (
        <div className="service-status" key={service.key}>
          <span
            className={`status-dot ${service.status}`}
            title={service.status}
          />
          <span>{service.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">
          <BrandMark />
        </span>
        <div>
          <div className="sidebar-brand-name">Honeypot SOC</div>
          <div className="sidebar-brand-tagline">Threat Intelligence</div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Navegación principal">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <ServiceStatus />
    </aside>
  );
}

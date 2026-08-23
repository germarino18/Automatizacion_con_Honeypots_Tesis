import { useLocation } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthContext';

const SECTION_BY_PATH: Array<[string, string]> = [
  ['/', 'Resumen del SOC'],
  ['/live', 'Ataques en Vivo'],
  ['/eventos', 'Explorador de Eventos'],
  ['/mitre', 'Matriz MITRE ATT&CK'],
  ['/mapa', 'Mapa Geográfico'],
  ['/malware', 'Malware & IoC'],
  ['/automatizacion', 'Automatización y Respuesta'],
  ['/workflows', 'Workflows n8n'],
  ['/login', 'Iniciar sesión'],
];

function sectionTitle(pathname: string): string {
  const match = SECTION_BY_PATH.find(([path]) => path === pathname);
  return match ? match[1] : 'Consola SOC';
}

export default function Header() {
  const { pathname } = useLocation();
  const { isAuthenticated, status, logout } = useAuth();

  return (
    <header className="header">
      <span className="header-section">{sectionTitle(pathname)}</span>
      <div className="header-user">
        {status === 'authenticated' && (
          <span className="header-user-name">SOC Operator</span>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!isAuthenticated}
          title={
            isAuthenticated
              ? 'Cerrar la sesión actual'
              : 'Inicia sesión para cerrar sesión'
          }
          onClick={() => {
            void logout();
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}

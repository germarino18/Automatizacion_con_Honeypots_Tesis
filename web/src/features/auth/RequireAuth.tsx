import { Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';

import { useAuth } from './AuthContext';

export default function RequireAuth({ children }: { children: ReactElement }) {
  const { status } = useAuth();

  if (status === 'probing') {
    return (
      <section className="screen">
        <div className="card">
          <div className="empty-state">
            <span className="empty-state-title">Verificando sesión…</span>
          </div>
        </div>
      </section>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }

  return children;
}

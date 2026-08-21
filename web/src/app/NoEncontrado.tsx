import { Link } from 'react-router-dom';

export default function NoEncontrado() {
  return (
    <section className="screen">
      <h1 className="screen-title">404</h1>
      <p className="screen-subtitle">La ruta solicitada no existe.</p>
      <div className="card">
        <div className="empty-state">
          <span className="empty-state-title">Página no encontrada</span>
          <span>
            Vuelve al{' '}
            <Link to="/" style={{ color: 'var(--accent)' }}>
              Resumen del SOC
            </Link>
            .
          </span>
        </div>
      </div>
    </section>
  );
}

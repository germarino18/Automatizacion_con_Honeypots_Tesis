import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../../lib/api';
import { useHealth } from '../../lib/useHealth';
import { useAuth } from './AuthContext';

const DEMO_USER = import.meta.env.VITE_SOC_DEMO_USER ?? '';
const DEMO_PASSWORD = import.meta.env.VITE_SOC_DEMO_PASSWORD ?? '';

export default function Login() {
  const [username, setUsername] = useState(DEMO_USER);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { data: health, isError: healthError } = useHealth();

  const apiOnline = !healthError && health?.status === 'ok';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Credenciales inválidas'
          : 'No se pudo conectar con la API. Reintenta más tarde.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="standalone-page">
      <div className="card login-card">
        <div className="login-heading">
          <span className="login-shield" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24">
              <defs>
                <linearGradient
                  id="login-shield-grad"
                  x1="1"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#38449e" />
                  <stop offset="100%" stopColor="#141733" />
                </linearGradient>
              </defs>
              <path
                d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z"
                fill="url(#login-shield-grad)"
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
          </span>
          <h1 className="login-title">HONEYPOT&nbsp;SOC</h1>
          <p className="login-subtitle">threat ops</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="label">Usuario</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="label">Contraseña</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || username === '' || password === ''}
          >
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
          <span
            className={`login-api-status${apiOnline ? '' : ' offline'}`}
          >
            <span
              className={`status-dot${apiOnline ? ' sse' : ' offline'}`}
              aria-hidden="true"
            />
            API en línea · v3.0
          </span>
        </form>
      </div>
    </section>
  );
}
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../../lib/api';
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
    <section className="screen">
      <h1 className="screen-title">Iniciar sesión</h1>
      <p className="screen-subtitle">
        Acceso a la consola del SOC con tus credenciales de operador.
      </p>
      <div className="card login-card">
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Usuario</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label className="login-field">
            <span>Contraseña</span>
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
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="login-submit"
            disabled={submitting || username === '' || password === ''}
          >
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </section>
  );
}
